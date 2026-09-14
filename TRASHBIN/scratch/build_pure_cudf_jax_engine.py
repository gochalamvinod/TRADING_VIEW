import os

engine_code = '''"""
High-Performance GPU and JAX-Accelerated Technical Indicators Engine.
Purely powered by:
1. RAPIDS cuDF GPU DataFrame (on NVIDIA GeForce GTX 1650 via CUDA).
2. Google JAX Engine with XLA JIT compilation and hardware scan loops.
3. Completely FREE of NumPy and Pandas (0% NumPy, 0% Pandas).
"""

import math
import time
import functools
from typing import Dict, Any, Union, Optional, Tuple, List

# 1. RAPIDS cuDF GPU DataFrame Engine
import cudf

# 2. Google JAX Numerical Tensor Engine
import jax
import jax.numpy as jnp
import jax.lax as lax

GPU_DEVICE_NAME = cudf.GPU_DEVICE_NAME


# =========================================================================
# JAX XLA JIT Indicator Kernels (Pure JAX - Zero NumPy, Zero Pandas)
# =========================================================================

@functools.partial(jax.jit, static_argnames=('length',))
def _jax_rolling_max(x: jnp.ndarray, length: int) -> jnp.ndarray:
    pad = jnp.pad(x, (length - 1, 0), mode='edge')
    return lax.reduce_window(pad, -jnp.inf, lax.max, window_dimensions=(length,), window_strides=(1,), padding='VALID')


@functools.partial(jax.jit, static_argnames=('length',))
def _jax_rolling_min(x: jnp.ndarray, length: int) -> jnp.ndarray:
    pad = jnp.pad(x, (length - 1, 0), mode='edge')
    return lax.reduce_window(pad, jnp.inf, lax.min, window_dimensions=(length,), window_strides=(1,), padding='VALID')


@functools.partial(jax.jit, static_argnames=('length',))
def _jax_sma(x: jnp.ndarray, length: int) -> jnp.ndarray:
    kernel = jnp.ones(length, dtype=jnp.float32) / float(length)
    pad = jnp.pad(x, (length - 1, 0), mode='edge')
    return jnp.convolve(pad, kernel, mode='valid')


@functools.partial(jax.jit, static_argnames=('length',))
def _jax_ema(x: jnp.ndarray, length: int) -> jnp.ndarray:
    alpha = 2.0 / (length + 1.0)
    def step(prev, curr):
        val = alpha * curr + (1.0 - alpha) * prev
        return val, val
    _, ema = lax.scan(step, x[0], x)
    return ema


@functools.partial(jax.jit, static_argnames=('length',))
def _jax_wma(x: jnp.ndarray, length: int) -> jnp.ndarray:
    weights = jnp.arange(1, length + 1, dtype=jnp.float32)
    w_sum = jnp.sum(weights)
    kernel = weights[::-1] / w_sum
    pad = jnp.pad(x, (length - 1, 0), mode='edge')
    return jnp.convolve(pad, kernel, mode='valid')


@functools.partial(jax.jit, static_argnames=('length', 'half_length', 'sqrt_length'))
def _jax_hma(x: jnp.ndarray, length: int, half_length: int, sqrt_length: int) -> jnp.ndarray:
    wma_half = _jax_wma(x, half_length)
    wma_full = _jax_wma(x, length)
    diff = 2.0 * wma_half - wma_full
    return _jax_wma(diff, sqrt_length)


@functools.partial(jax.jit, static_argnames=('length',))
def _jax_dema(x: jnp.ndarray, length: int) -> jnp.ndarray:
    e1 = _jax_ema(x, length)
    e2 = _jax_ema(e1, length)
    return 2.0 * e1 - e2


@functools.partial(jax.jit, static_argnames=('length',))
def _jax_tema(x: jnp.ndarray, length: int) -> jnp.ndarray:
    e1 = _jax_ema(x, length)
    e2 = _jax_ema(e1, length)
    e3 = _jax_ema(e2, length)
    return 3.0 * e1 - 3.0 * e2 + e3


@functools.partial(jax.jit, static_argnames=('length',))
def _jax_rsi(close: jnp.ndarray, length: int) -> jnp.ndarray:
    diff = jnp.diff(close, prepend=close[0])
    gains = jnp.where(diff > 0, diff, 0.0)
    losses = jnp.where(diff < 0, -diff, 0.0)
    alpha = 1.0 / float(length)
    def rma(prev, curr):
        val = alpha * curr + (1.0 - alpha) * prev
        return val, val
    _, g = lax.scan(rma, gains[0], gains)
    _, l = lax.scan(rma, losses[0], losses)
    rs = g / jnp.maximum(l, 1e-10)
    return 100.0 - (100.0 / (1.0 + rs))


@functools.partial(jax.jit, static_argnames=('fast', 'slow', 'signal'))
def _jax_macd(close: jnp.ndarray, fast: int, slow: int, signal: int) -> Tuple[jnp.ndarray, jnp.ndarray, jnp.ndarray]:
    ema_fast = _jax_ema(close, fast)
    ema_slow = _jax_ema(close, slow)
    macd = ema_fast - ema_slow
    sig = _jax_ema(macd, signal)
    hist = macd - sig
    return macd, sig, hist


@functools.partial(jax.jit, static_argnames=('length',))
def _jax_bb(close: jnp.ndarray, length: int, mult: float) -> Tuple[jnp.ndarray, jnp.ndarray, jnp.ndarray]:
    basis = _jax_sma(close, length)
    pad = jnp.pad(close, (length - 1, 0), mode='edge')
    sq = pad ** 2
    kernel = jnp.ones(length, dtype=jnp.float32) / float(length)
    mean_sq = jnp.convolve(sq, kernel, mode='valid')
    variance = jnp.maximum(mean_sq - (basis ** 2), 0.0)
    stdev = jnp.sqrt(variance)
    upper = basis + mult * stdev
    lower = basis - mult * stdev
    return basis, upper, lower


@functools.partial(jax.jit, static_argnames=('length',))
def _jax_atr(high: jnp.ndarray, low: jnp.ndarray, close: jnp.ndarray, length: int) -> jnp.ndarray:
    prev_close = jnp.roll(close, 1).at[0].set(close[0])
    tr1 = high - low
    tr2 = jnp.abs(high - prev_close)
    tr3 = jnp.abs(low - prev_close)
    tr = jnp.maximum(tr1, jnp.maximum(tr2, tr3))
    alpha = 1.0 / float(length)
    def rma(prev, curr):
        val = alpha * curr + (1.0 - alpha) * prev
        return val, val
    _, atr = lax.scan(rma, tr[0], tr)
    return atr


@functools.partial(jax.jit, static_argnames=('length',))
def _jax_supertrend(high: jnp.ndarray, low: jnp.ndarray, close: jnp.ndarray, length: int, factor: float) -> Tuple[jnp.ndarray, jnp.ndarray]:
    atr = _jax_atr(high, low, close, length)
    hl2 = (high + low) / 2.0
    basic_ub = hl2 + factor * atr
    basic_lb = hl2 - factor * atr
    n = close.shape[0]

    def st_step(carry, i):
        prev_ub, prev_lb, prev_dir, prev_close = carry
        curr_c = close[i]
        curr_b_ub = basic_ub[i]
        curr_b_lb = basic_lb[i]

        curr_ub = jnp.where((curr_b_ub < prev_ub) | (prev_close > prev_ub), curr_b_ub, prev_ub)
        curr_lb = jnp.where((curr_b_lb > prev_lb) | (prev_close < prev_lb), curr_b_lb, prev_lb)

        curr_dir = jnp.where(prev_dir == -1,
                             jnp.where(curr_c > prev_ub, 1, -1),
                             jnp.where(curr_c < prev_lb, -1, 1))

        trend = jnp.where(curr_dir == 1, curr_lb, curr_ub)
        return (curr_ub, curr_lb, curr_dir, curr_c), (trend, curr_dir)

    init_carry = (basic_ub[0], basic_lb[0], 1, close[0])
    _, (trend, direction) = lax.scan(st_step, init_carry, jnp.arange(n))
    return trend, direction


@functools.partial(jax.jit, static_argnames=('k_len', 'd_len', 'smooth_k'))
def _jax_stoch(high: jnp.ndarray, low: jnp.ndarray, close: jnp.ndarray, k_len: int, d_len: int, smooth_k: int) -> Tuple[jnp.ndarray, jnp.ndarray]:
    hh = _jax_rolling_max(high, k_len)
    ll = _jax_rolling_min(low, k_len)
    raw_k = ((close - ll) / jnp.maximum(hh - ll, 1e-10)) * 100.0
    k = _jax_sma(raw_k, length=smooth_k)
    d = _jax_sma(k, length=d_len)
    return k, d


@functools.partial(jax.jit, static_argnames=('rsi_len', 'stoch_len', 'k_len', 'd_len'))
def _jax_stochrsi(close: jnp.ndarray, rsi_len: int, stoch_len: int, k_len: int, d_len: int) -> Tuple[jnp.ndarray, jnp.ndarray]:
    rsi = _jax_rsi(close, length=rsi_len)
    min_r = _jax_rolling_min(rsi, length=stoch_len)
    max_r = _jax_rolling_max(rsi, length=stoch_len)
    stoch = ((rsi - min_r) / jnp.maximum(max_r - min_r, 1e-10)) * 100.0
    k = _jax_sma(stoch, length=k_len)
    d = _jax_sma(k, length=d_len)
    return k, d


@functools.partial(jax.jit, static_argnames=('length',))
def _jax_cci(high: jnp.ndarray, low: jnp.ndarray, close: jnp.ndarray, length: int) -> jnp.ndarray:
    typ = (high + low + close) / 3.0
    sma_tp = _jax_sma(typ, length=length)
    diff = jnp.abs(typ - sma_tp)
    mad = _jax_sma(diff, length=length)
    return (typ - sma_tp) / (0.015 * jnp.maximum(mad, 1e-10))


@functools.partial(jax.jit, static_argnames=('length',))
def _jax_adx(high: jnp.ndarray, low: jnp.ndarray, close: jnp.ndarray, length: int) -> Tuple[jnp.ndarray, jnp.ndarray, jnp.ndarray]:
    up_move = high - jnp.roll(high, 1).at[0].set(high[0])
    down_move = jnp.roll(low, 1).at[0].set(low[0]) - low
    plus_dm = jnp.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = jnp.where((down_move > up_move) & (down_move > 0), down_move, 0.0)
    atr = _jax_atr(high, low, close, length)
    plus_di = 100.0 * _jax_ema(plus_dm, length) / jnp.maximum(atr, 1e-10)
    minus_di = 100.0 * _jax_ema(minus_dm, length) / jnp.maximum(atr, 1e-10)
    dx = 100.0 * jnp.abs(plus_di - minus_di) / jnp.maximum(plus_di + minus_di, 1e-10)
    adx = _jax_ema(dx, length)
    return adx, plus_di, minus_di


# =========================================================================
# High-Level Indicator Dispatcher (Powered by RAPIDS cuDF & JAX Engine)
# =========================================================================

def compute_indicator(
    name: str,
    rates: Any,
    params: Optional[Dict[str, Any]] = None,
    engine: str = "auto"
) -> Dict[str, Any]:
    """
    Computes technical indicator using RAPIDS cuDF GPU DataFrame and JAX Engine.
    100% FREE OF NUMPY AND PANDAS.
    """
    t_start = time.perf_counter()
    params = params or {}
    name_upper = name.upper().strip()

    # Ingest data directly into RAPIDS cuDF GPU DataFrame (replaces pandas completely)
    gdf = cudf.DataFrame(rates)
    n_bars = len(gdf)

    if n_bars == 0:
        return {
            "name": name,
            "plots": {},
            "engine": "none",
            "compute_time_ms": 0.0,
            "bars": 0
        }

    # Extract GPU Series & convert to JAX array for compiled XLA execution (zero numpy)
    c_series = gdf['close']
    h_series = gdf['high']
    l_series = gdf['low']
    v_series = gdf['tick_volume'] if 'tick_volume' in gdf.columns else (gdf['volume'] if 'volume' in gdf.columns else c_series)

    j_c = jnp.asarray(c_series.values)
    j_h = jnp.asarray(h_series.values)
    j_l = jnp.asarray(l_series.values)
    j_v = jnp.asarray(v_series.values)

    active_engine_name = f"RAPIDS cuDF & JAX Engine ({GPU_DEVICE_NAME})"

    plots = {}

    # 1. Moving Averages
    if name_upper in ("SMA", "MOVING AVERAGE", "MOVING AVERAGE SIMPLE"):
        length = max(1, int(params.get("length", 14)))
        # cuDF GPU Rolling Mean!
        plots["plot_0"] = c_series.rolling(length).mean().to_list()

    elif name_upper in ("EMA", "MOVING AVERAGE EXPONENTIAL"):
        length = max(1, int(params.get("length", 14)))
        # cuDF GPU Exponential Moving Average!
        plots["plot_0"] = c_series.ewm(span=length).mean().to_list()

    elif name_upper in ("WMA", "MOVING AVERAGE WEIGHTED"):
        length = max(1, int(params.get("length", 14)))
        plots["plot_0"] = _jax_wma(j_c, length).tolist()

    elif name_upper in ("HMA", "HULL MOVING AVERAGE"):
        length = max(2, int(params.get("length", 14)))
        half_len = max(1, int(length / 2))
        sqrt_len = max(1, int(math.sqrt(length)))
        plots["plot_0"] = _jax_hma(j_c, length=length, half_length=half_len, sqrt_length=sqrt_len).tolist()

    elif name_upper in ("DEMA", "DOUBLE EMA"):
        length = max(1, int(params.get("length", 14)))
        plots["plot_0"] = _jax_dema(j_c, length).tolist()

    elif name_upper in ("TEMA", "TRIPLE EMA"):
        length = max(1, int(params.get("length", 14)))
        plots["plot_0"] = _jax_tema(j_c, length).tolist()

    # 2. Oscillators & Momentum
    elif name_upper in ("RSI", "RELATIVE STRENGTH INDEX"):
        length = max(1, int(params.get("length", 14)))
        plots["plot_0"] = _jax_rsi(j_c, length).tolist()

    elif name_upper in ("MACD", "MOVING AVERAGE CONVERGENCE DIVERGENCE"):
        fast = max(1, int(params.get("fast_length", 12)))
        slow = max(1, int(params.get("slow_length", 26)))
        signal = max(1, int(params.get("signal_length", 9)))
        macd, sig, hist = _jax_macd(j_c, fast=fast, slow=slow, signal=signal)
        plots["macd"] = macd.tolist()
        plots["signal"] = sig.tolist()
        plots["hist"] = hist.tolist()

    elif name_upper in ("BB", "BOLLINGER BANDS"):
        length = max(1, int(params.get("length", 20)))
        mult = float(params.get("mult", 2.0))
        basis, upper, lower = _jax_bb(j_c, length=length, mult=mult)
        plots["basis"] = basis.tolist()
        plots["upper"] = upper.tolist()
        plots["lower"] = lower.tolist()

    elif name_upper in ("ATR", "AVERAGE TRUE RANGE"):
        length = max(1, int(params.get("length", 14)))
        plots["plot_0"] = _jax_atr(j_h, j_l, j_c, length).tolist()

    elif name_upper in ("SUPERTREND", "SUPER TREND"):
        length = max(1, int(params.get("length", 10)))
        factor = float(params.get("factor", 3.0))
        trend, direction = _jax_supertrend(j_h, j_l, j_c, length=length, factor=factor)
        plots["supertrend"] = trend.tolist()
        plots["direction"] = direction.tolist()

    elif name_upper in ("VWAP", "VOLUME WEIGHTED AVERAGE PRICE"):
        typ = (j_h + j_l + j_c) / 3.0
        cum_pv = jnp.cumsum(typ * j_v)
        cum_v = jnp.cumsum(j_v)
        vwap = cum_pv / jnp.maximum(cum_v, 1e-10)
        plots["plot_0"] = vwap.tolist()

    elif name_upper in ("MOMENTUM", "MOM"):
        length = max(1, int(params.get("length", 10)))
        mom = j_c - jnp.roll(j_c, length).at[:length].set(j_c[0])
        plots["plot_0"] = mom.tolist()

    elif name_upper in ("ROC", "RATE OF CHANGE"):
        length = max(1, int(params.get("length", 9)))
        prev = jnp.roll(j_c, length).at[:length].set(j_c[0])
        roc = ((j_c - prev) / jnp.maximum(prev, 1e-10)) * 100.0
        plots["plot_0"] = roc.tolist()

    elif name_upper in ("DONCHIAN", "DONCHIAN CHANNELS"):
        length = max(1, int(params.get("length", 20)))
        up = _jax_rolling_max(j_h, length)
        lo = _jax_rolling_min(j_l, length)
        mid = (up + lo) / 2.0
        plots["upper"] = up.tolist()
        plots["lower"] = lo.tolist()
        plots["middle"] = mid.tolist()

    elif name_upper in ("WILLIAMS %R", "WILLIAMS_R", "WR"):
        length = max(1, int(params.get("length", 14)))
        hh = _jax_rolling_max(j_h, length)
        ll = _jax_rolling_min(j_l, length)
        denom = jnp.maximum(hh - ll, 1e-10)
        wr = ((hh - j_c) / denom) * -100.0
        plots["plot_0"] = wr.tolist()

    elif name_upper in ("STOCH", "STOCHASTIC"):
        k_len = max(1, int(params.get("k_length", 14)))
        d_len = max(1, int(params.get("d_length", 3)))
        smooth_k = max(1, int(params.get("smooth_k", 3)))
        k, d = _jax_stoch(j_h, j_l, j_c, k_len=k_len, d_len=d_len, smooth_k=smooth_k)
        plots["k"] = k.tolist()
        plots["d"] = d.tolist()

    elif name_upper in ("STOCHRSI", "STOCHASTIC RSI"):
        rsi_len = max(1, int(params.get("rsi_length", 14)))
        stoch_len = max(1, int(params.get("stoch_length", 14)))
        k_len = max(1, int(params.get("k_length", 3)))
        d_len = max(1, int(params.get("d_length", 3)))
        k, d = _jax_stochrsi(j_c, rsi_len=rsi_len, stoch_len=stoch_len, k_len=k_len, d_len=d_len)
        plots["k"] = k.tolist()
        plots["d"] = d.tolist()

    elif name_upper in ("CCI", "COMMODITY CHANNEL INDEX"):
        length = max(1, int(params.get("length", 20)))
        plots["plot_0"] = _jax_cci(j_h, j_l, j_c, length=length).tolist()

    elif name_upper in ("PIVOT", "PIVOT POINTS STANDARD"):
        pp = (j_h + j_l + j_c) / 3.0
        r1 = 2.0 * pp - j_l
        s1 = 2.0 * pp - j_h
        r2 = pp + (j_h - j_l)
        s2 = pp - (j_h - j_l)
        r3 = j_h + 2.0 * (pp - j_l)
        s3 = j_l - 2.0 * (j_h - pp)
        plots["pp"] = pp.tolist()
        plots["r1"] = r1.tolist()
        plots["s1"] = s1.tolist()
        plots["r2"] = r2.tolist()
        plots["s2"] = s2.tolist()
        plots["r3"] = r3.tolist()
        plots["s3"] = s3.tolist()

    elif name_upper in ("ICHIMOKU", "ICHIMOKU CLOUD"):
        conv_len = max(1, int(params.get("conversion_length", 9)))
        base_len = max(1, int(params.get("base_length", 26)))
        span_b_len = max(1, int(params.get("span_b_length", 52)))
        disp = int(params.get("displacement", 26))

        def hl_avg(n):
            return (_jax_rolling_max(j_h, n) + _jax_rolling_min(j_l, n)) / 2.0

        tenkan = hl_avg(conv_len)
        kijun = hl_avg(base_len)
        senkou_a = (tenkan + kijun) / 2.0
        senkou_b = hl_avg(span_b_len)
        chikou = jnp.roll(j_c, -disp).at[-disp:].set(float('nan'))

        plots["conversion_line"] = tenkan.tolist()
        plots["base_line"] = kijun.tolist()
        plots["span_a"] = senkou_a.tolist()
        plots["span_b"] = senkou_b.tolist()
        plots["lagging_span"] = chikou.tolist()

    elif name_upper in ("ADX", "DMI", "AVERAGE DIRECTIONAL INDEX"):
        length = max(1, int(params.get("length", 14)))
        adx, plus_di, minus_di = _jax_adx(j_h, j_l, j_c, length=length)
        plots["adx"] = adx.tolist()
        plots["plus_di"] = plus_di.tolist()
        plots["minus_di"] = minus_di.tolist()

    else:
        length = max(1, int(params.get("length", 14)))
        plots["plot_0"] = _jax_sma(j_c, length).tolist()

    t_end = time.perf_counter()
    compute_ms = round((t_end - t_start) * 1000.0, 2)

    # Sanitize NaN/Inf for valid JSON format using Python standard math module
    for k, arr in list(plots.items()):
        plots[k] = [None if (v is None or math.isnan(v) or math.isinf(v)) else round(float(v), 5) for v in arr]

    times_list = [int(t) for t in gdf['time'].to_list()] if 'time' in gdf.columns else []

    return {
        "name": name,
        "engine": active_engine_name,
        "compute_time_ms": compute_ms,
        "bars": n_bars,
        "times": times_list,
        "plots": plots
    }


def get_available_indicators() -> Dict[str, Any]:
    """Returns list of supported server-side indicators with parameters."""
    return {
        "engine_status": {
            "gpu_device": GPU_DEVICE_NAME,
            "cudf_engine": "RAPIDS cuDF GPU DataFrame (Active)",
            "jax_engine": "Google JAX XLA JIT (Active)",
            "numpy_free": True,
            "pandas_free": True
        },
        "indicators": [
            {"id": "SMA", "name": "Simple Moving Average", "overlay": True, "params": {"length": 14}},
            {"id": "EMA", "name": "Exponential Moving Average", "overlay": True, "params": {"length": 14}},
            {"id": "WMA", "name": "Weighted Moving Average", "overlay": True, "params": {"length": 14}},
            {"id": "HMA", "name": "Hull Moving Average", "overlay": True, "params": {"length": 14}},
            {"id": "DEMA", "name": "Double EMA", "overlay": True, "params": {"length": 14}},
            {"id": "TEMA", "name": "Triple EMA", "overlay": True, "params": {"length": 14}},
            {"id": "RSI", "name": "Relative Strength Index", "overlay": False, "params": {"length": 14}},
            {"id": "MACD", "name": "MACD", "overlay": False, "params": {"fast_length": 12, "slow_length": 26, "signal_length": 9}},
            {"id": "BB", "name": "Bollinger Bands", "overlay": True, "params": {"length": 20, "mult": 2.0}},
            {"id": "ATR", "name": "Average True Range", "overlay": False, "params": {"length": 14}},
            {"id": "SUPERTREND", "name": "SuperTrend", "overlay": True, "params": {"length": 10, "factor": 3.0}},
            {"id": "STOCH", "name": "Stochastic", "overlay": False, "params": {"k_length": 14, "d_length": 3, "smooth_k": 3}},
            {"id": "STOCHRSI", "name": "Stochastic RSI", "overlay": False, "params": {"rsi_length": 14, "stoch_length": 14, "k_length": 3, "d_length": 3}},
            {"id": "VWAP", "name": "Volume Weighted Average Price", "overlay": True, "params": {}},
            {"id": "PIVOT", "name": "Pivot Points Standard", "overlay": True, "params": {}},
            {"id": "CCI", "name": "Commodity Channel Index", "overlay": False, "params": {"length": 20}},
            {"id": "ADX", "name": "Average Directional Index", "overlay": False, "params": {"length": 14}},
            {"id": "MOMENTUM", "name": "Momentum", "overlay": False, "params": {"length": 10}},
            {"id": "ROC", "name": "Rate of Change", "overlay": False, "params": {"length": 9}},
            {"id": "ICHIMOKU", "name": "Ichimoku Cloud", "overlay": True, "params": {"conversion_length": 9, "base_length": 26, "span_b_length": 52, "displacement": 26}},
            {"id": "DONCHIAN", "name": "Donchian Channels", "overlay": True, "params": {"length": 20}},
            {"id": "WILLIAMS_R", "name": "Williams %R", "overlay": False, "params": {"length": 14}}
        ]
    }
'''

with open(r'e:\TRADINGVIEW ADVANCED\indicators_engine.py', 'w', encoding='utf-8') as f:
    f.write(engine_code)
print("Successfully written indicators_engine.py with cuDF and JAX!")
