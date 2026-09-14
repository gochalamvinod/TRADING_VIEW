import os

content = '''"""
High-Performance GPU and JAX-Accelerated Technical Indicators Engine.
Leverages:
1. NVIDIA GeForce GTX 1650 GPU acceleration via CuPy / CUDA arrays.
2. JAX with XLA JIT compilation and hardware scan loops.
3. Pure tensor/array operations with zero Pandas dependencies for calculations.
"""

import time
import functools
import numpy as np
from typing import Dict, Any, Union, Optional, Tuple

# Detect and initialize GPU (CuPy CUDA)
GPU_AVAILABLE = False
GPU_DEVICE_NAME = "None"
try:
    import cupy as cp
    dev_props = cp.cuda.runtime.getDeviceProperties(0)
    dev_name = dev_props['name']
    GPU_DEVICE_NAME = dev_name.decode() if isinstance(dev_name, bytes) else str(dev_name)
    GPU_AVAILABLE = True
except Exception:
    GPU_AVAILABLE = False

# Initialize JAX XLA
import jax
import jax.numpy as jnp
import jax.lax as lax

# =========================================================================
# JAX XLA JIT Indicator Kernels
# =========================================================================

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


# =========================================================================
# NVIDIA GPU (CuPy CUDA) Indicator Implementations
# =========================================================================

def _cp_sma(x: 'cp.ndarray', length: int) -> 'cp.ndarray':
    length = max(1, int(length))
    pad = cp.pad(x, (length, 0), mode='edge')
    cs = cp.cumsum(pad)
    return (cs[length:] - cs[:-length]) / float(length)


def _cp_ema(x: 'cp.ndarray', length: int) -> 'cp.ndarray':
    alpha = 2.0 / (length + 1.0)
    n = len(x)
    out = cp.empty(n, dtype=cp.float32)
    out[0] = x[0]
    for i in range(1, n):
        out[i] = alpha * x[i] + (1.0 - alpha) * out[i-1]
    return out


def _cp_rsi(close: 'cp.ndarray', length: int) -> 'cp.ndarray':
    diff = cp.diff(close, prepend=close[0])
    gains = cp.where(diff > 0, diff, 0.0)
    losses = cp.where(diff < 0, -diff, 0.0)
    alpha = 1.0 / float(length)
    n = len(close)
    avg_gain = cp.empty(n, dtype=cp.float32)
    avg_loss = cp.empty(n, dtype=cp.float32)
    avg_gain[0] = gains[0]
    avg_loss[0] = losses[0]
    for i in range(1, n):
        avg_gain[i] = alpha * gains[i] + (1.0 - alpha) * avg_gain[i-1]
        avg_loss[i] = alpha * losses[i] + (1.0 - alpha) * avg_loss[i-1]
    rs = avg_gain / cp.maximum(avg_loss, 1e-10)
    return 100.0 - (100.0 / (1.0 + rs))


# =========================================================================
# High-Level Indicator Dispatcher (Zero-Pandas Columnar Execution)
# =========================================================================

def compute_indicator(
    name: str,
    rates: Union[Dict[str, Any], np.ndarray],
    params: Optional[Dict[str, Any]] = None,
    engine: str = "auto"
) -> Dict[str, Any]:
    """
    Computes technical indicator using NVIDIA GPU (CuPy) or JAX XLA JIT.
    rates can be a dict: {"time": [...], "open": [...], "high": [...], "low": [...], "close": [...], "volume": [...]}
    or structured numpy array from MT5 copy_rates.
    """
    t_start = time.perf_counter()
    params = params or {}
    name_upper = name.upper().strip()

    # Extract columnar arrays without pandas
    if isinstance(rates, dict):
        times = np.asarray(rates.get("time", rates.get("times", [])))
        open_ = np.asarray(rates.get("open", []), dtype=np.float32)
        high_ = np.asarray(rates.get("high", []), dtype=np.float32)
        low_ = np.asarray(rates.get("low", []), dtype=np.float32)
        close_ = np.asarray(rates.get("close", []), dtype=np.float32)
        vol_ = np.asarray(rates.get("volume", rates.get("tick_volume", [])), dtype=np.float32)
    else:
        times = np.asarray(rates['time'])
        open_ = np.asarray(rates['open'], dtype=np.float32)
        high_ = np.asarray(rates['high'], dtype=np.float32)
        low_ = np.asarray(rates['low'], dtype=np.float32)
        close_ = np.asarray(rates['close'], dtype=np.float32)
        vol_ = np.asarray(rates['tick_volume'] if 'tick_volume' in rates.dtype.names else rates['volume'], dtype=np.float32)

    n_bars = len(close_)
    if n_bars == 0:
        return {
            "name": name,
            "plots": {},
            "engine": "none",
            "compute_time_ms": 0.0,
            "bars": 0
        }

    # Determine execution engine
    use_gpu = (engine == "gpu" or (engine == "auto" and GPU_AVAILABLE))
    active_engine_name = f"GPU: {GPU_DEVICE_NAME} (CuPy CUDA)" if use_gpu and GPU_AVAILABLE else "JAX XLA JIT (Vectorized)"

    plots = {}

    # 1. Moving Averages
    if name_upper in ("SMA", "MOVING AVERAGE", "MOVING AVERAGE SIMPLE"):
        length = max(1, int(params.get("length", 14)))
        if use_gpu and GPU_AVAILABLE:
            d_c = cp.asarray(close_)
            res = _cp_sma(d_c, length).get()
        else:
            j_c = jnp.asarray(close_)
            res = np.asarray(_jax_sma(j_c, length=length))
        plots["plot_0"] = res.tolist()

    elif name_upper in ("EMA", "MOVING AVERAGE EXPONENTIAL"):
        length = max(1, int(params.get("length", 14)))
        if use_gpu and GPU_AVAILABLE:
            d_c = cp.asarray(close_)
            res = _cp_ema(d_c, length).get()
        else:
            j_c = jnp.asarray(close_)
            res = np.asarray(_jax_ema(j_c, length=length))
        plots["plot_0"] = res.tolist()

    elif name_upper in ("WMA", "MOVING AVERAGE WEIGHTED"):
        length = max(1, int(params.get("length", 14)))
        j_c = jnp.asarray(close_)
        res = np.asarray(_jax_wma(j_c, length=length))
        plots["plot_0"] = res.tolist()

    elif name_upper in ("HMA", "HULL MOVING AVERAGE"):
        length = max(2, int(params.get("length", 14)))
        half_len = max(1, int(length / 2))
        sqrt_len = max(1, int(np.sqrt(length)))
        j_c = jnp.asarray(close_)
        res = np.asarray(_jax_hma(j_c, length=length, half_length=half_len, sqrt_length=sqrt_len))
        plots["plot_0"] = res.tolist()

    elif name_upper in ("DEMA", "DOUBLE EMA"):
        length = max(1, int(params.get("length", 14)))
        j_c = jnp.asarray(close_)
        res = np.asarray(_jax_dema(j_c, length=length))
        plots["plot_0"] = res.tolist()

    elif name_upper in ("TEMA", "TRIPLE EMA"):
        length = max(1, int(params.get("length", 14)))
        j_c = jnp.asarray(close_)
        res = np.asarray(_jax_tema(j_c, length=length))
        plots["plot_0"] = res.tolist()

    # 2. Oscillators & Momentum
    elif name_upper in ("RSI", "RELATIVE STRENGTH INDEX"):
        length = max(1, int(params.get("length", 14)))
        if use_gpu and GPU_AVAILABLE:
            d_c = cp.asarray(close_)
            res = _cp_rsi(d_c, length).get()
        else:
            j_c = jnp.asarray(close_)
            res = np.asarray(_jax_rsi(j_c, length=length))
        plots["plot_0"] = res.tolist()

    elif name_upper in ("MACD", "MOVING AVERAGE CONVERGENCE DIVERGENCE"):
        fast = max(1, int(params.get("fast_length", 12)))
        slow = max(1, int(params.get("slow_length", 26)))
        signal = max(1, int(params.get("signal_length", 9)))
        j_c = jnp.asarray(close_)
        macd, sig, hist = _jax_macd(j_c, fast=fast, slow=slow, signal=signal)
        plots["macd"] = np.asarray(macd).tolist()
        plots["signal"] = np.asarray(sig).tolist()
        plots["hist"] = np.asarray(hist).tolist()

    elif name_upper in ("BB", "BOLLINGER BANDS"):
        length = max(1, int(params.get("length", 20)))
        mult = float(params.get("mult", 2.0))
        j_c = jnp.asarray(close_)
        basis, upper, lower = _jax_bb(j_c, length=length, mult=mult)
        plots["basis"] = np.asarray(basis).tolist()
        plots["upper"] = np.asarray(upper).tolist()
        plots["lower"] = np.asarray(lower).tolist()

    elif name_upper in ("ATR", "AVERAGE TRUE RANGE"):
        length = max(1, int(params.get("length", 14)))
        j_h, j_l, j_c = jnp.asarray(high_), jnp.asarray(low_), jnp.asarray(close_)
        res = np.asarray(_jax_atr(j_h, j_l, j_c, length=length))
        plots["plot_0"] = res.tolist()

    elif name_upper in ("SUPERTREND", "SUPER TREND"):
        length = max(1, int(params.get("length", 10)))
        factor = float(params.get("factor", 3.0))
        j_h, j_l, j_c = jnp.asarray(high_), jnp.asarray(low_), jnp.asarray(close_)
        trend, direction = _jax_supertrend(j_h, j_l, j_c, length=length, factor=factor)
        plots["supertrend"] = np.asarray(trend).tolist()
        plots["direction"] = np.asarray(direction).tolist()

    elif name_upper in ("VWAP", "VOLUME WEIGHTED AVERAGE PRICE"):
        j_h, j_l, j_c, j_v = jnp.asarray(high_), jnp.asarray(low_), jnp.asarray(close_), jnp.asarray(vol_)
        typ = (j_h + j_l + j_c) / 3.0
        cum_pv = jnp.cumsum(typ * j_v)
        cum_v = jnp.cumsum(j_v)
        vwap = cum_pv / jnp.maximum(cum_v, 1e-10)
        plots["plot_0"] = np.asarray(vwap).tolist()

    elif name_upper in ("MOMENTUM", "MOM"):
        length = max(1, int(params.get("length", 10)))
        j_c = jnp.asarray(close_)
        mom = j_c - jnp.roll(j_c, length).at[:length].set(j_c[0])
        plots["plot_0"] = np.asarray(mom).tolist()

    elif name_upper in ("ROC", "RATE OF CHANGE"):
        length = max(1, int(params.get("length", 9)))
        j_c = jnp.asarray(close_)
        prev = jnp.roll(j_c, length).at[:length].set(j_c[0])
        roc = ((j_c - prev) / jnp.maximum(prev, 1e-10)) * 100.0
        plots["plot_0"] = np.asarray(roc).tolist()

    elif name_upper in ("DONCHIAN", "DONCHIAN CHANNELS"):
        length = max(1, int(params.get("length", 20)))
        windows_h = np.lib.stride_tricks.sliding_window_view(np.pad(high_, (length - 1, 0), mode='edge'), length)
        windows_l = np.lib.stride_tricks.sliding_window_view(np.pad(low_, (length - 1, 0), mode='edge'), length)
        up = np.max(windows_h, axis=-1)
        lo = np.min(windows_l, axis=-1)
        mid = (up + lo) / 2.0
        plots["upper"] = up.tolist()
        plots["lower"] = lo.tolist()
        plots["middle"] = mid.tolist()

    elif name_upper in ("WILLIAMS %R", "WILLIAMS_R", "WR"):
        length = max(1, int(params.get("length", 14)))
        windows_h = np.lib.stride_tricks.sliding_window_view(np.pad(high_, (length - 1, 0), mode='edge'), length)
        windows_l = np.lib.stride_tricks.sliding_window_view(np.pad(low_, (length - 1, 0), mode='edge'), length)
        hh = np.max(windows_h, axis=-1)
        ll = np.min(windows_l, axis=-1)
        denom = np.maximum(hh - ll, 1e-10)
        wr = ((hh - close_) / denom) * -100.0
        plots["plot_0"] = wr.tolist()

    elif name_upper in ("STOCH", "STOCHASTIC"):
        k_len = max(1, int(params.get("k_length", 14)))
        d_len = max(1, int(params.get("d_length", 3)))
        smooth_k = max(1, int(params.get("smooth_k", 3)))
        windows_h = np.lib.stride_tricks.sliding_window_view(np.pad(high_, (k_len - 1, 0), mode='edge'), length=k_len)
        windows_l = np.lib.stride_tricks.sliding_window_view(np.pad(low_, (k_len - 1, 0), mode='edge'), length=k_len)
        hh = np.max(windows_h, axis=-1)
        ll = np.min(windows_l, axis=-1)
        raw_k = ((close_ - ll) / np.maximum(hh - ll, 1e-10)) * 100.0
        k = np.asarray(_jax_sma(jnp.asarray(raw_k), length=smooth_k))
        d = np.asarray(_jax_sma(jnp.asarray(k), length=d_len))
        plots["k"] = k.tolist()
        plots["d"] = d.tolist()

    elif name_upper in ("STOCHRSI", "STOCHASTIC RSI"):
        rsi_len = max(1, int(params.get("rsi_length", 14)))
        stoch_len = max(1, int(params.get("stoch_length", 14)))
        k_len = max(1, int(params.get("k_length", 3)))
        d_len = max(1, int(params.get("d_length", 3)))
        rsi = np.asarray(_jax_rsi(jnp.asarray(close_), length=rsi_len))
        windows = np.lib.stride_tricks.sliding_window_view(np.pad(rsi, (stoch_len - 1, 0), mode='edge'), length=stoch_len)
        min_r = np.min(windows, axis=-1)
        max_r = np.max(windows, axis=-1)
        stoch = ((rsi - min_r) / np.maximum(max_r - min_r, 1e-10)) * 100.0
        k = np.asarray(_jax_sma(jnp.asarray(stoch), length=k_len))
        d = np.asarray(_jax_sma(jnp.asarray(k), length=d_len))
        plots["k"] = k.tolist()
        plots["d"] = d.tolist()

    elif name_upper in ("CCI", "COMMODITY CHANNEL INDEX"):
        length = max(1, int(params.get("length", 20)))
        typ = (high_ + low_ + close_) / 3.0
        sma_tp = np.asarray(_jax_sma(jnp.asarray(typ), length=length))
        windows = np.lib.stride_tricks.sliding_window_view(np.pad(typ, (length - 1, 0), mode='edge'), length=length)
        mad = np.mean(np.abs(windows - sma_tp[:, None]), axis=-1)
        cci = (typ - sma_tp) / (0.015 * np.maximum(mad, 1e-10))
        plots["plot_0"] = cci.tolist()

    elif name_upper in ("PIVOT", "PIVOT POINTS STANDARD"):
        pp = (high_ + low_ + close_) / 3.0
        r1 = 2.0 * pp - low_
        s1 = 2.0 * pp - high_
        r2 = pp + (high_ - low_)
        s2 = pp - (high_ - low_)
        r3 = high_ + 2.0 * (pp - low_)
        s3 = low_ - 2.0 * (high_ - pp)
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
            wh = np.lib.stride_tricks.sliding_window_view(np.pad(high_, (n - 1, 0), mode='edge'), length=n)
            wl = np.lib.stride_tricks.sliding_window_view(np.pad(low_, (n - 1, 0), mode='edge'), length=n)
            return (np.max(wh, axis=-1) + np.min(wl, axis=-1)) / 2.0

        tenkan = hl_avg(conv_len)
        kijun = hl_avg(base_len)
        senkou_a = (tenkan + kijun) / 2.0
        senkou_b = hl_avg(span_b_len)
        chikou = np.roll(close_, -disp)
        chikou[-disp:] = np.nan

        plots["conversion_line"] = tenkan.tolist()
        plots["base_line"] = kijun.tolist()
        plots["span_a"] = senkou_a.tolist()
        plots["span_b"] = senkou_b.tolist()
        plots["lagging_span"] = chikou.tolist()

    elif name_upper in ("ADX", "DMI", "AVERAGE DIRECTIONAL INDEX"):
        length = max(1, int(params.get("length", 14)))
        up_move = high_ - np.roll(high_, 1)
        down_move = np.roll(low_, 1) - low_
        up_move[0] = 0
        down_move[0] = 0

        plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
        minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

        j_h, j_l, j_c = jnp.asarray(high_), jnp.asarray(low_), jnp.asarray(close_)
        atr = np.asarray(_jax_atr(j_h, j_l, j_c, length=length))

        plus_di = 100.0 * np.asarray(_jax_ema(jnp.asarray(plus_dm), length=length)) / np.maximum(atr, 1e-10)
        minus_di = 100.0 * np.asarray(_jax_ema(jnp.asarray(minus_dm), length=length)) / np.maximum(atr, 1e-10)
        dx = 100.0 * np.abs(plus_di - minus_di) / np.maximum(plus_di + minus_di, 1e-10)
        adx = np.asarray(_jax_ema(jnp.asarray(dx), length=length))

        plots["adx"] = adx.tolist()
        plots["plus_di"] = plus_di.tolist()
        plots["minus_di"] = minus_di.tolist()

    else:
        length = max(1, int(params.get("length", 14)))
        j_c = jnp.asarray(close_)
        res = np.asarray(_jax_sma(j_c, length=length))
        plots["plot_0"] = res.tolist()

    t_end = time.perf_counter()
    compute_ms = round((t_end - t_start) * 1000.0, 2)

    for k, arr in list(plots.items()):
        plots[k] = [None if (v is None or np.isnan(v) or np.isinf(v)) else round(float(v), 5) for v in arr]

    return {
        "name": name,
        "engine": active_engine_name,
        "compute_time_ms": compute_ms,
        "bars": n_bars,
        "times": times.tolist(),
        "plots": plots
    }


def get_available_indicators() -> Dict[str, Any]:
    """Returns list of supported server-side indicators with parameters."""
    return {
        "engine_status": {
            "gpu_available": GPU_AVAILABLE,
            "gpu_device": GPU_DEVICE_NAME,
            "jax_available": True,
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
    f.write(content)
print('Successfully written updated indicators_engine.py')
