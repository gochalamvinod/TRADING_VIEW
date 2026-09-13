"""
MT5 Seconds-Based OHLC Resampling and In-Memory Caching Engine.

Provides ultra-fast resampling of sub-minute resolutions (1S, 5S, 10S, 15S, 30S)
backed by an in-memory 30-day raw tick cache with incremental delta synchronization.
"""

from datetime import datetime, timezone, timedelta
from typing import List, Dict, Optional, Any
import time
import threading
from hft_engine import mt5
import numpy as np
import pandas as pd


def ensure_mt5() -> bool:
    """Ensure MetaTrader5 IPC connection is initialized."""
    info = mt5.terminal_info()
    if info is None:
        return bool(mt5.initialize())
    return True


_symbol_cache: Dict[str, str] = {}
_selected_symbols: set = set()
_cached_broker_offset: int = 10800


def try_symbol_variants(symbol: str) -> str:
    """
    Resolve symbol against MT5 Market Watch.
    Handles exact match, uppercase, dot suffix, broker suffixes, and case-insensitivity.
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


class TickCacheManager:
    """
    In-memory cache for raw MT5 ticks with incremental delta synchronization.
    Maintains up to 30 days of raw ticks per symbol to eliminate repeated IPC roundtrips.
    """
    def __init__(self, max_symbols: int = 10, max_days: int = 30):
        self.max_symbols = max_symbols
        self.max_days = max_days
        self._cache: Dict[str, Dict[str, Any]] = {}
        self._lock = threading.Lock()

    def get_ticks(self, symbol: str, days: int = 3, verbose: bool = False) -> np.ndarray:
        resolved_sym = try_symbol_variants(symbol)
        days = max(1, min(7, days))

        with self._lock:
            now_utc = datetime.now(timezone.utc)
            entry = self._cache.get(resolved_sym)

            # Fast return if already cached and synced within 1.0s
            if entry is not None and len(entry.get("ticks", [])) > 0:
                if (now_utc - entry.get("last_sync", now_utc - timedelta(seconds=10))).total_seconds() < 1.0:
                    return entry["ticks"]

            ensure_mt5()
            if resolved_sym not in _selected_symbols:
                mt5.symbol_select(resolved_sym, True)
                _selected_symbols.add(resolved_sym)

            # Cold fetch if not cached or empty
            if entry is None or len(entry.get("ticks", [])) == 0:
                end = now_utc + timedelta(days=1)
                start = now_utc - timedelta(days=days)
                if verbose:
                    print(f"[CACHE COLD] Fetching {days}d ticks for {resolved_sym}: {start} -> {end}")

                ticks = mt5.copy_ticks_range(resolved_sym, start, end, mt5.COPY_TICKS_ALL)
                if ticks is None or len(ticks) == 0:
                    return np.empty(0)

                # Maintain cache size limit
                if len(self._cache) >= self.max_symbols and resolved_sym not in self._cache:
                    oldest_key = next(iter(self._cache))
                    del self._cache[oldest_key]

                last_msc = int(ticks[-1]["time_msc"]) if "time_msc" in ticks.dtype.names else int(ticks[-1]["time"] * 1000)
                self._cache[resolved_sym] = {
                    "ticks": ticks,
                    "last_time_msc": last_msc,
                    "last_sync": now_utc,
                }
                return ticks

            # Incremental delta fetch from last tick timestamp
            last_msc = entry["last_time_msc"]
            last_dt = datetime.fromtimestamp(last_msc / 1000.0, tz=timezone.utc)
            delta_ticks = mt5.copy_ticks_from(resolved_sym, last_dt, 5000, mt5.COPY_TICKS_ALL)

            if delta_ticks is not None and len(delta_ticks) > 0:
                if "time_msc" in delta_ticks.dtype.names:
                    newer_mask = delta_ticks["time_msc"] > last_msc
                else:
                    newer_mask = (delta_ticks["time"] * 1000) > last_msc

                new_ticks = delta_ticks[newer_mask]
                if len(new_ticks) > 0:
                    combined = np.concatenate([entry["ticks"], new_ticks])
                    cutoff_msc = int((now_utc - timedelta(days=self.max_days)).timestamp() * 1000)
                    if "time_msc" in combined.dtype.names:
                        combined = combined[combined["time_msc"] >= cutoff_msc]
                    else:
                        combined = combined[(combined["time"] * 1000) >= cutoff_msc]
                    if len(combined) > 150_000:
                        combined = combined[-150_000:]
                    if "time_msc" in combined.dtype.names:
                        new_last_msc = int(combined[-1]["time_msc"])
                    else:
                        new_last_msc = int(combined[-1]["time"] * 1000)

                    entry["ticks"] = combined
                    entry["last_time_msc"] = new_last_msc
                    if verbose:
                        print(f"[CACHE DELTA] Appended {len(new_ticks)} new ticks for {resolved_sym}")

            entry["last_sync"] = now_utc
            return entry["ticks"]

    def clear(self, symbol: Optional[str] = None):
        with self._lock:
            if symbol:
                self._cache.pop(symbol, None)
            else:
                self._cache.clear()


# Global cache manager instance
tick_cache = TickCacheManager(max_symbols=10, max_days=30)


def get_ohlc_records(
    symbol: str,
    seconds: int = 5,
    side: str = "bid",
    days: int = 3,
    from_ts: Optional[float] = None,
    to_ts: Optional[float] = None,
    countback: Optional[int] = None,
    hours: Optional[int] = None,
    verbose: bool = False,
) -> Dict[str, Any]:
    """
    Fetch raw ticks from cache and resample into vectorized N-second OHLC bars.

    Parameters:
        symbol: Symbol identifier (e.g. 'EURUSD' or 'EURUSD.')
        seconds: Bar duration in seconds (1, 5, 10, 15, 30, etc.)
        side: Price side ('bid', 'ask', or 'mid')
        days: Days of tick history to cache (default 3)
        from_ts: Optional start UNIX timestamp (seconds) filter
        to_ts: Optional end UNIX timestamp (seconds) filter
        countback: Optional maximum number of recent bars to return
        hours: Backward compatibility parameter; if passed, overrides days to max(1, hours // 24)
        verbose: Enable debug logging

    Returns:
        Dict adhering to TradingView UDF format:
        { "s": "ok", "t": [...], "o": [...], "h": [...], "l": [...], "c": [...], "v": [...] }
    """
    if seconds <= 0:
        raise ValueError("seconds must be > 0")

    if hours is not None and hours > 0:
        days = max(1, min(7, (hours + 23) // 24))

    # If countback requested without from_ts, compute an efficient lookback window
    if from_ts is None and to_ts is not None and countback is not None and countback > 0:
        from_ts = to_ts - max(1800, countback * seconds * 3)

    ticks = tick_cache.get_ticks(symbol, days=days, verbose=verbose)

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

    # Calculate timezone offset between broker server clock (e.g. OrbexGlobal UTC+3) and UTC
    global _cached_broker_offset
    hours_offset = _cached_broker_offset
    if ticks is not None and len(ticks) > 0:
        last_t = ticks[-1]["time"] if "time" in ticks.dtype.names else (ticks[-1]["time_msc"] / 1000.0)
        diff = last_t - time.time()
        if abs(diff) < 86400 * 3:
            hours_offset = int(round(diff / 1800.0) * 1800)
            _cached_broker_offset = hours_offset
    else:
        try:
            tick = mt5.symbol_info_tick(symbol)
            if tick and tick.time > 0:
                diff = tick.time - time.time()
                if abs(diff) < 86400 * 3:
                    hours_offset = int(round(diff / 1800.0) * 1800)
                    _cached_broker_offset = hours_offset
        except Exception:
            pass

    # Time filtering on ticks using fast binary search (searchsorted)
    if from_ts is not None or to_ts is not None:
        has_msc = "time_msc" in ticks.dtype.names
        time_arr = ticks["time_msc"] if has_msc else (ticks["time"] * 1000)

        start_idx = 0
        end_idx = len(ticks)

        if from_ts is not None:
            from_msc = int((from_ts - seconds * 2) * 1000)
            start_idx = int(np.searchsorted(time_arr, from_msc))

        if to_ts is not None:
            to_msc = int((to_ts + seconds * 2) * 1000)
            end_idx = int(np.searchsorted(time_arr, to_msc, side="right"))

        ticks_subset = ticks[start_idx:end_idx]
    else:
        ticks_subset = ticks

    if len(ticks_subset) == 0:
        return {
            "s": "no_data",
            "t": [],
            "o": [],
            "h": [],
            "l": [],
            "c": [],
            "v": []
        }

    # Extract price array
    ps = (side or "bid").lower()
    if ps == "ask":
        prices = ticks_subset["ask"]
    elif ps == "mid":
        prices = (ticks_subset["bid"] + ticks_subset["ask"]) * 0.5
    else:
        prices = ticks_subset["bid"]

    if len(prices) > 0 and prices[0] <= 0:
        if "last" in ticks_subset.dtype.names:
            prices = np.where(prices > 0, prices, ticks_subset["last"].astype(np.float64))
        if "ask" in ticks_subset.dtype.names:
            prices = np.where(prices > 0, prices, ticks_subset["ask"].astype(np.float64))

    # Extract timestamps and volumes (ticks_subset['time'] is already int64 epoch seconds)
    if "time" in ticks_subset.dtype.names:
        t_sec = ticks_subset["time"]
    elif "time_msc" in ticks_subset.dtype.names:
        t_sec = (ticks_subset["time_msc"] // 1000).astype(np.int64)
    else:
        t_sec = np.zeros(len(prices), dtype=np.int64)

    # Convert to true UTC epoch seconds (copy_ticks_range is already in true UTC)
    t_utc = t_sec

    if "volume_real" in ticks_subset.dtype.names:
        volumes = ticks_subset["volume_real"]
    elif "volume" in ticks_subset.dtype.names:
        volumes = ticks_subset["volume"].astype(np.float64)
    else:
        volumes = np.zeros(len(prices), dtype=np.float64)
        volumes = np.zeros(len(prices), dtype=np.float64)

    # Ultra-fast vectorized NumPy resampling (<10ms across 250k ticks)
    sec_int = int(seconds)
    buckets = (t_utc // sec_int) * sec_int

    boundary_mask = np.r_[True, buckets[1:] != buckets[:-1]]
    start_idx = np.flatnonzero(boundary_mask)
    end_idx = np.r_[start_idx[1:], len(prices)]

    epoch_s = buckets[start_idx]
    o_arr = prices[start_idx]
    c_arr = prices[end_idx - 1]
    h_arr = np.maximum.reduceat(prices, start_idx)
    l_arr = np.minimum.reduceat(prices, start_idx)
    vol_arr = np.add.reduceat(volumes, start_idx)

    # Exact window trim comparing UTC to UTC
    if from_ts is not None or to_ts is not None:
        window_mask = np.ones(len(epoch_s), dtype=bool)
        if from_ts is not None:
            window_mask &= (epoch_s >= int(from_ts))
        if to_ts is not None:
            window_mask &= (epoch_s <= int(to_ts))

        if not np.all(window_mask):
            epoch_s = epoch_s[window_mask]
            o_arr = o_arr[window_mask]
            h_arr = h_arr[window_mask]
            l_arr = l_arr[window_mask]
            c_arr = c_arr[window_mask]
            vol_arr = vol_arr[window_mask]

    if len(epoch_s) == 0:
        resp: Dict[str, Any] = {
            "s": "no_data",
            "t": [],
            "o": [],
            "h": [],
            "l": [],
            "c": [],
            "v": []
        }
        if ticks is not None and len(ticks) > 0:
            first_t = ticks[0]["time"] if "time" in ticks.dtype.names else (ticks[0]["time_msc"] // 1000)
            earliest_utc = int(first_t)
            resp["nextTime"] = earliest_utc
        return resp

    if countback is not None and countback > 0 and len(epoch_s) > countback:
        epoch_s = epoch_s[-countback:]
        o_arr = o_arr[-countback:]
        h_arr = h_arr[-countback:]
        l_arr = l_arr[-countback:]
        c_arr = c_arr[-countback:]
        vol_arr = vol_arr[-countback:]

    t_list = epoch_s.tolist()
    o_list = o_arr.tolist()
    h_list = h_arr.tolist()
    l_list = l_arr.tolist()
    c_list = c_arr.tolist()
    vol_list = vol_arr.tolist()

    return {
        "s": "ok",
        "t": t_list,
        "o": o_list,
        "h": h_list,
        "l": l_list,
        "c": c_list,
        "v": vol_list,
    }
