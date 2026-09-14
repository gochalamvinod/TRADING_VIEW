"""
MT5 Tick-Count OHLC utility.

Provides high-performance 2D numpy vectorized grouping of raw MT5 ticks into
fixed tick-count OHLC bars for TradingView Advanced Charts UDF feeds.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Any
from hft_engine import mt5
import time
import jax
jax.config.update("jax_enable_x64", True)
import jax.numpy as jnp


def ensure_mt5() -> bool:
    """Ensure MetaTrader5 IPC connection is initialized."""
    info = mt5.terminal_info()
    if info is None:
        return bool(mt5.initialize())
    return True


_symbol_cache: Dict[str, str] = {}
_selected_symbols: set = set()


def try_symbol_variants(symbol: str) -> str:
    """
    Resolve a symbol name against MT5 Market Watch symbols.
    Handles exact names, uppercase, trailing dot ('.'), broker suffixes ('m', '.r', 'pro'),
    and case-insensitive matching.
    """
    if not symbol:
        return symbol

    if symbol in _symbol_cache:
        return _symbol_cache[symbol]

    ensure_mt5()
    sym_clean = symbol.strip()

    candidates = [
        sym_clean,
        sym_clean.upper(),
        sym_clean.upper() + '.',
        sym_clean.upper().rstrip('.'),
        sym_clean.upper() + 'm',
        sym_clean.upper() + '.r',
        sym_clean.upper() + 'pro',
        sym_clean.upper() + '_i',
    ]

    for cand in candidates:
        try:
            info = mt5.symbol_info(cand)
            if info is not None:
                _symbol_cache[symbol] = cand
                return cand
        except Exception:
            pass

    # Case-insensitive fallback across all terminal symbols
    try:
        all_symbols = mt5.symbols_get()
        if all_symbols:
            sym_lower = sym_clean.lower()
            for s in all_symbols:
                s_name_lower = s.name.lower()
                if s_name_lower == sym_lower or s_name_lower == sym_lower + '.':
                    _symbol_cache[symbol] = s.name
                    return s.name
    except Exception:
        pass

    _symbol_cache[symbol] = symbol
    return symbol


def fetch_ticks(symbol: str, start: datetime, end: datetime):
    """Fetch raw ticks from MT5 within given datetime range."""
    return mt5.copy_ticks_range(symbol, start, end, mt5.COPY_TICKS_ALL)


def get_tickcount_ohlc_records(
    symbol: str,
    ticks_per_bar: int = 40,
    side: str = "bid",
    days: int = 2,
    from_ts: Optional[float] = None,
    to_ts: Optional[float] = None,
    countback: Optional[int] = None,
    only_full: bool = False,
    include_count: bool = False,
    include_volume: bool = True,
    verbose: bool = False,
    months: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Fetch MT5 ticks and compute tick-count OHLC bars using ultra-fast 2D numpy reshaping.

    Parameters:
        symbol: Symbol identifier (e.g. 'EURUSD' or 'EURUSD.')
        ticks_per_bar: Number of ticks per OHLC bar (default 40)
        side: Price side ('bid', 'ask', or 'mid')
        days: Historical window in days (default 2 for < 1s latency)
        from_ts: Optional start UNIX timestamp (seconds) filter
        to_ts: Optional end UNIX timestamp (seconds) filter
        countback: Optional maximum number of recent bars to return
        only_full: If True, discards partial trailing bar
        include_count: If True, includes 'ticks' array in output
        include_volume: If True, calculates and returns tick volume
        verbose: If True, logs diagnostic timings
        months: Backward compatibility parameter; if passed, overrides days to months * 30

    Returns:
        Dict adhering to TradingView UDF format:
        { "s": "ok", "t": [...], "o": [...], "h": [...], "l": [...], "c": [...], "v": [...] }
    """
    if ticks_per_bar < 1:
        raise ValueError("'ticks_per_bar' must be >= 1")

    if not ensure_mt5():
        raise RuntimeError("MetaTrader5 initialization failed")

    if months is not None and months > 0:
        days = months * 30

    resolved_sym = try_symbol_variants(symbol)
    if resolved_sym not in _selected_symbols:
        mt5.symbol_select(resolved_sym, True)
        _selected_symbols.add(resolved_sym)

    now_utc = datetime.now(timezone.utc)
    max_end = now_utc + timedelta(days=1)
    if to_ts is not None and to_ts > 0:
        requested_end = datetime.fromtimestamp(to_ts, tz=timezone.utc) + timedelta(minutes=5)
        end = min(requested_end, max_end)
    else:
        end = max_end

    # Clamp lookback window to max 2-3 days (default `days`) to prevent MT5 IPC overload
    days = max(1, min(7, days))
    max_lookback = end - timedelta(days=days)

    if from_ts is not None and from_ts > 0:
        requested_start = datetime.fromtimestamp(from_ts, tz=timezone.utc) - timedelta(minutes=5)
        start = max(requested_start, max_lookback)
    else:
        start = max_lookback

    if verbose:
        print(f"[TICKS] Fetching ticks for {resolved_sym}: {start} -> {end}")

    import broker_time
    offset = broker_time.get_broker_timezone_offset(resolved_sym)
    start_broker = datetime.fromtimestamp(start.timestamp() + offset)
    end_broker = datetime.fromtimestamp(end.timestamp() + offset)

    ticks = fetch_ticks(resolved_sym, start_broker, end_broker)

    if ticks is None or len(ticks) == 0:
        return {
            "s": "no_data",
            "t": [],
            "o": [],
            "h": [],
            "l": [],
            "c": [],
            "v": []
        }

    # Extract price array according to requested side
    ps = (side or "bid").lower()
    if ps == "ask":
        prices = ticks['ask']
    elif ps == "mid":
        prices = (ticks['bid'] + ticks['ask']) * 0.5
    else:
        prices = ticks['bid']

    # Fallback only if prices contain zeroes (e.g., non-forex CFDs)
    if len(prices) > 0 and prices[0] <= 0:
        if 'last' in ticks.dtype.names:
            prices = jnp.where(prices > 0, prices, ticks['last'])
        if 'ask' in ticks.dtype.names:
            prices = jnp.where(prices > 0, prices, ticks['ask'])

    # Extract timestamps in TRUE UTC with millisecond precision
    if 'time_msc' in ticks.dtype.names:
        raw_msc = ticks['time_msc'].astype(jnp.int64)
    else:
        raw_msc = (ticks['time'] * 1000).astype(jnp.int64)
    t_utc_msc = raw_msc - int(offset * 1000)
    times = t_utc_msc / 1000.0

    # Extract volumes
    if 'volume_real' in ticks.dtype.names:
        volumes = ticks['volume_real']
    elif 'volume' in ticks.dtype.names:
        volumes = ticks['volume'].astype(jnp.float64)
    else:
        volumes = jnp.zeros(len(prices), dtype=jnp.float64)

    n = len(prices)
    num_bars = n // ticks_per_bar

    if num_bars == 0:
        if only_full:
            return {
                "s": "no_data",
                "t": [],
                "o": [],
                "h": [],
                "l": [],
                "c": [],
                "v": []
            }
        else:
            return {
                "s": "ok",
                "t": [float(times[-1])],
                "o": [float(prices[0])],
                "h": [float(jnp.max(prices))],
                "l": [float(jnp.min(prices))],
                "c": [float(prices[-1])],
                "v": [float(jnp.sum(volumes))] if include_volume else [0.0]
            }

    # High-speed 2D JAX reshape
    n_used = num_bars * ticks_per_bar
    p_chunk = prices[:n_used].reshape(num_bars, ticks_per_bar)
    t_chunk = times[:n_used].reshape(num_bars, ticks_per_bar)

    o_raw = p_chunk[:, 0]
    h_raw = jnp.max(p_chunk, axis=1)
    l_raw = jnp.min(p_chunk, axis=1)
    c_raw = p_chunk[:, -1]
    v_raw = jnp.sum(volumes[:n_used].reshape(num_bars, ticks_per_bar), axis=1) if include_volume else jnp.zeros(num_bars, dtype=jnp.float64)

    # Strictly monotonically increasing timestamps for TradingView (millisecond precision)
    t_raw = jnp.round(t_chunk[:, -1], 3)
    if len(t_raw) > 1 and jnp.all(jnp.diff(t_raw) > 0):
        t_arr = t_raw
    else:
        t_raw_list = t_raw.tolist()
        t_list = []
        last_t = 0.0
        for cur_t in t_raw_list:
            if cur_t <= last_t:
                cur_t = round(last_t + 0.001, 3)
            t_list.append(cur_t)
            last_t = cur_t
        t_arr = jnp.array(t_list, dtype=jnp.float64)

    # Handle trailing partial bar if requested
    if not only_full and n > n_used:
        rem_p = prices[n_used:]
        rem_t = times[n_used:]
        rem_o = float(rem_p[0])
        rem_h = float(jnp.max(rem_p))
        rem_l = float(jnp.min(rem_p))
        rem_c = float(rem_p[-1])
        cur_rem_t = round(float(rem_t[-1]), 3)
        last_t = float(t_arr[-1]) if len(t_arr) > 0 else 0.0
        if cur_rem_t <= last_t:
            cur_rem_t = round(last_t + 0.001, 3)
        rem_v = float(jnp.sum(volumes[n_used:])) if include_volume else 0.0

        o_raw = jnp.concatenate([o_raw, jnp.array([rem_o])])
        h_raw = jnp.concatenate([h_raw, jnp.array([rem_h])])
        l_raw = jnp.concatenate([l_raw, jnp.array([rem_l])])
        c_raw = jnp.concatenate([c_raw, jnp.array([rem_c])])
        v_raw = jnp.concatenate([v_raw, jnp.array([rem_v])])
        t_arr = jnp.concatenate([t_arr, jnp.array([cur_rem_t])])

    # Filter by time window if from_ts or to_ts provided using vectorized JAX mask
    if from_ts is not None or to_ts is not None:
        mask = jnp.ones(len(t_arr), dtype=bool)
        if from_ts is not None:
            mask &= (t_arr >= int(from_ts))
        if to_ts is not None:
            mask &= (t_arr <= int(to_ts))
        if not jnp.all(mask):
            t_arr = t_arr[mask]
            o_raw = o_raw[mask]
            h_raw = h_raw[mask]
            l_raw = l_raw[mask]
            c_raw = c_raw[mask]
            v_raw = v_raw[mask]

    if len(t_arr) == 0:
        return {
            "s": "no_data",
            "t": [],
            "o": [],
            "h": [],
            "l": [],
            "c": [],
            "v": []
        }

    if countback is not None and countback > 0 and len(t_arr) > countback:
        t_arr = t_arr[-countback:]
        o_raw = o_raw[-countback:]
        h_raw = h_raw[-countback:]
        l_raw = l_raw[-countback:]
        c_raw = c_raw[-countback:]
        v_raw = v_raw[-countback:]

    t = t_arr.tolist()
    o = o_raw.tolist()
    h = h_raw.tolist()
    l = l_raw.tolist()
    c = c_raw.tolist()
    v = v_raw.tolist()

    result: Dict[str, Any] = {
        "s": "ok",
        "t": t,
        "o": o,
        "h": h,
        "l": l,
        "c": c,
        "v": v
    }

    if include_count:
        counts = [ticks_per_bar] * num_bars
        if not only_full and n > n_used:
            counts.append(n - n_used)
        if countback is not None and countback > 0 and len(counts) > countback:
            counts = counts[-countback:]
        result["ticks"] = counts

    return result