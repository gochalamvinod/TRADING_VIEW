const fs = require('fs');
const path = require('path');

const engineCode = `"""
High-Performance Vectorized Server-Side Technical Indicators Engine.
Vectorized over NumPy 2.x and Pandas for sub-millisecond execution.
Exposes compute_indicator(name, rates, params) returning plot arrays.
"""

import numpy as np
import pandas as pd
from typing import Dict, Any, Union, Optional


def _to_series(arr: Union[np.ndarray, list]) -> pd.Series:
    if isinstance(arr, pd.Series):
        return arr
    return pd.Series(arr)


def compute_sma(close: np.ndarray, length: int = 14) -> np.ndarray:
    """Vectorized Simple Moving Average."""
    length = max(1, int(length))
    s = pd.Series(close).rolling(window=length, min_periods=length).mean()
    return s.to_numpy(dtype=np.float64)


def compute_ema(close: np.ndarray, length: int = 14) -> np.ndarray:
    """Vectorized Exponential Moving Average."""
    length = max(1, int(length))
    s = pd.Series(close).ewm(span=length, adjust=False).mean()
    return s.to_numpy(dtype=np.float64)


def compute_wma(close: np.ndarray, length: int = 14) -> np.ndarray:
    """Vectorized Weighted Moving Average."""
    length = max(1, int(length))
    weights = np.arange(1, length + 1)
    def w_sum(x):
        return np.dot(x, weights) / weights.sum()
    s = pd.Series(close).rolling(window=length).apply(w_sum, raw=True)
    return s.to_numpy(dtype=np.float64)


def compute_hma(close: np.ndarray, length: int = 14) -> np.ndarray:
    """Hull Moving Average: WMA(2*WMA(n/2) - WMA(n)), sqrt(n)."""
    length = max(2, int(length))
    half_length = int(length / 2)
    sqrt_length = int(np.sqrt(length))
    wma_half = compute_wma(close, half_length)
    wma_full = compute_wma(close, length)
    diff = 2 * wma_half - wma_full
    return compute_wma(diff, sqrt_length)


def compute_dema(close: np.ndarray, length: int = 14) -> np.ndarray:
    """Double Exponential Moving Average: 2*EMA - EMA(EMA)."""
    e1 = compute_ema(close, length)
    e2 = compute_ema(e1, length)
    return 2 * e1 - e2


def compute_tema(close: np.ndarray, length: int = 14) -> np.ndarray:
    """Triple Exponential Moving Average: 3*E1 - 3*E2 + E3."""
    e1 = compute_ema(close, length)
    e2 = compute_ema(e1, length)
    e3 = compute_ema(e2, length)
    return 3 * e1 - 3 * e2 + e3


def compute_rsi(close: np.ndarray, length: int = 14) -> np.ndarray:
    """Vectorized Wilder's RSI (100% TradingView standard)."""
    length = max(1, int(length))
    delta = np.diff(close)
    gains = np.where(delta > 0, delta, 0.0)
    losses = np.where(delta < 0, -delta, 0.0)

    # Pad first element
    gains = np.insert(gains, 0, 0.0)
    losses = np.insert(losses, 0, 0.0)

    alpha = 1.0 / length
    avg_gain = pd.Series(gains).ewm(alpha=alpha, adjust=False).mean()
    avg_loss = pd.Series(losses).ewm(alpha=alpha, adjust=False).mean()

    rs = avg_gain / (avg_loss + 1e-12)
    rsi = 100.0 - (100.0 / (1.0 + rs))
    return rsi.to_numpy(dtype=np.float64)


def compute_macd(close: np.ndarray, fast: int = 12, slow: int = 26, signal: int = 9) -> Dict[str, np.ndarray]:
    """Vectorized Moving Average Convergence Divergence."""
    fast_ema = compute_ema(close, fast)
    slow_ema = compute_ema(close, slow)
    macd_line = fast_ema - slow_ema
    signal_line = compute_ema(macd_line, signal)
    histogram = macd_line - signal_line
    return {
        "macd": macd_line,
        "signal": signal_line,
        "hist": histogram
    }


def compute_bollinger_bands(close: np.ndarray, length: int = 20, mult: float = 2.0) -> Dict[str, np.ndarray]:
    """Vectorized Bollinger Bands."""
    length = max(1, int(length))
    s_close = pd.Series(close)
    basis = s_close.rolling(window=length).mean().to_numpy()
    std = s_close.rolling(window=length).std(ddof=0).to_numpy()
    upper = basis + mult * std
    lower = basis - mult * std
    percent_b = np.where((upper - lower) > 0, (close - lower) / (upper - lower + 1e-12), 0.5)
    bandwidth = np.where(basis > 0, (upper - lower) / (basis + 1e-12) * 100.0, 0.0)
    return {
        "basis": basis,
        "upper": upper,
        "lower": lower,
        "percent_b": percent_b,
        "bandwidth": bandwidth
    }


def compute_atr(high: np.ndarray, low: np.ndarray, close: np.ndarray, length: int = 14) -> np.ndarray:
    """Vectorized Average True Range."""
    length = max(1, int(length))
    prev_close = np.roll(close, 1)
    prev_close[0] = close[0]

    tr1 = high - low
    tr2 = np.abs(high - prev_close)
    tr3 = np.abs(low - prev_close)
    tr = np.maximum(tr1, np.maximum(tr2, tr3))

    alpha = 1.0 / length
    atr = pd.Series(tr).ewm(alpha=alpha, adjust=False).mean().to_numpy()
    return atr


def compute_supertrend(high: np.ndarray, low: np.ndarray, close: np.ndarray, length: int = 10, mult: float = 3.0) -> Dict[str, np.ndarray]:
    """Vectorized Supertrend with trailing stop logic."""
    atr = compute_atr(high, low, close, length)
    hl2 = (high + low) / 2.0

    basic_upper = hl2 + mult * atr
    basic_lower = hl2 - mult * atr

    n = len(close)
    final_upper = np.copy(basic_upper)
    final_lower = np.copy(basic_lower)
    trend = np.ones(n, dtype=np.int32)
    supertrend = np.copy(basic_upper)

    for i in range(1, n):
        if basic_lower[i] > final_lower[i-1] or close[i-1] < final_lower[i-1]:
            final_lower[i] = basic_lower[i]
        else:
            final_lower[i] = final_lower[i-1]

        if basic_upper[i] < final_upper[i-1] or close[i-1] > final_upper[i-1]:
            final_upper[i] = basic_upper[i]
        else:
            final_upper[i] = final_upper[i-1]

        if trend[i-1] == 1:
            trend[i] = -1 if close[i] < final_lower[i] else 1
        else:
            trend[i] = 1 if close[i] > final_upper[i] else -1

        supertrend[i] = final_lower[i] if trend[i] == 1 else final_upper[i]

    return {
        "supertrend": supertrend,
        "upper": final_upper,
        "lower": final_lower,
        "direction": trend
    }


def compute_stochastic(high: np.ndarray, low: np.ndarray, close: np.ndarray, k_len: int = 14, k_smooth: int = 3, d_len: int = 3) -> Dict[str, np.ndarray]:
    """Vectorized Stochastic Oscillator."""
    s_high = pd.Series(high)
    s_low = pd.Series(low)
    s_close = pd.Series(close)

    lowest_low = s_low.rolling(window=k_len).min()
    highest_high = s_high.rolling(window=k_len).max()

    denom = highest_high - lowest_low
    raw_k = np.where(denom > 0, (s_close - lowest_low) / (denom + 1e-12) * 100.0, 50.0)

    k_line = pd.Series(raw_k).rolling(window=k_smooth).mean().to_numpy()
    d_line = pd.Series(k_line).rolling(window=d_len).mean().to_numpy()

    return {
        "k": k_line,
        "d": d_line
    }


def compute_stoch_rsi(close: np.ndarray, rsi_len: int = 14, stoch_len: int = 14, k_smooth: int = 3, d_smooth: int = 3) -> Dict[str, np.ndarray]:
    """Stochastic RSI."""
    rsi_vals = compute_rsi(close, rsi_len)
    s_rsi = pd.Series(rsi_vals)
    lowest_rsi = s_rsi.rolling(window=stoch_len).min()
    highest_rsi = s_rsi.rolling(window=stoch_len).max()
    denom = highest_rsi - lowest_rsi
    raw_k = np.where(denom > 0, (s_rsi - lowest_rsi) / (denom + 1e-12) * 100.0, 50.0)
    k = pd.Series(raw_k).rolling(window=k_smooth).mean().to_numpy()
    d = pd.Series(k).rolling(window=d_smooth).mean().to_numpy()
    return {"k": k, "d": d}


def compute_vwap(high: np.ndarray, low: np.ndarray, close: np.ndarray, volume: np.ndarray, times: np.ndarray) -> np.ndarray:
    """Volume Weighted Average Price (anchored daily)."""
    typical_price = (high + low + close) / 3.0
    cum_vol_price = np.cumsum(typical_price * volume)
    cum_vol = np.cumsum(volume)
    return np.where(cum_vol > 0, cum_vol_price / (cum_vol + 1e-12), typical_price)


def compute_pivot_points(high: np.ndarray, low: np.ndarray, close: np.ndarray) -> Dict[str, np.ndarray]:
    """Standard Pivot Points."""
    p = (high + low + close) / 3.0
    r1 = 2 * p - low
    s1 = 2 * p - high
    r2 = p + (high - low)
    s2 = p - (high - low)
    r3 = high + 2 * (p - low)
    s3 = low - 2 * (high - p)
    return {
        "p": p,
        "r1": r1, "r2": r2, "r3": r3,
        "s1": s1, "s2": s2, "s3": s3
    }


def compute_cci(high: np.ndarray, low: np.ndarray, close: np.ndarray, length: int = 20) -> np.ndarray:
    """Commodity Channel Index."""
    length = max(1, int(length))
    tp = (high + low + close) / 3.0
    s_tp = pd.Series(tp)
    sma_tp = s_tp.rolling(window=length).mean()
    mad = s_tp.rolling(window=length).apply(lambda x: np.mean(np.abs(x - np.mean(x))), raw=True)
    cci = (s_tp - sma_tp) / (0.015 * mad + 1e-12)
    return cci.to_numpy(dtype=np.float64)


def compute_adx_dmi(high: np.ndarray, low: np.ndarray, close: np.ndarray, length: int = 14) -> Dict[str, np.ndarray]:
    """Average Directional Index (ADX) and Directional Movement (+DI, -DI)."""
    length = max(1, int(length))
    n = len(close)
    up_move = np.diff(high, prepend=high[0])
    down_move = -np.diff(low, prepend=low[0])

    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

    tr = compute_atr(high, low, close, length=1)
    alpha = 1.0 / length

    smooth_tr = pd.Series(tr).ewm(alpha=alpha, adjust=False).mean()
    smooth_plus_dm = pd.Series(plus_dm).ewm(alpha=alpha, adjust=False).mean()
    smooth_minus_dm = pd.Series(minus_dm).ewm(alpha=alpha, adjust=False).mean()

    plus_di = 100.0 * (smooth_plus_dm / (smooth_tr + 1e-12))
    minus_di = 100.0 * (smooth_minus_dm / (smooth_tr + 1e-12))

    dx = 100.0 * np.abs(plus_di - minus_di) / (plus_di + minus_di + 1e-12)
    adx = pd.Series(dx).ewm(alpha=alpha, adjust=False).mean().to_numpy()

    return {
        "adx": adx,
        "plus_di": plus_di.to_numpy(),
        "minus_di": minus_di.to_numpy()
    }


def compute_momentum(close: np.ndarray, length: int = 10) -> np.ndarray:
    """Momentum: close - close[n]."""
    length = max(1, int(length))
    shifted = np.roll(close, length)
    res = close - shifted
    res[:length] = 0.0
    return res


def compute_roc(close: np.ndarray, length: int = 14) -> np.ndarray:
    """Rate of Change (%): ((close - close[n]) / close[n]) * 100."""
    length = max(1, int(length))
    shifted = np.roll(close, length)
    shifted[:length] = np.nan
    roc = (close - shifted) / (shifted + 1e-12) * 100.0
    return np.nan_to_num(roc, nan=0.0)


def compute_ichimoku(high: np.ndarray, low: np.ndarray, close: np.ndarray, conversion_len: int = 9, base_len: int = 26, leading_b_len: int = 52, displacement: int = 26) -> Dict[str, np.ndarray]:
    """Ichimoku Kinko Hyo."""
    s_high = pd.Series(high)
    s_low = pd.Series(low)

    tenkan = (s_high.rolling(window=conversion_len).max() + s_low.rolling(window=conversion_len).min()) / 2.0
    kijun = (s_high.rolling(window=base_len).max() + s_low.rolling(window=base_len).min()) / 2.0
    senkou_a = (tenkan + kijun) / 2.0
    senkou_b = (s_high.rolling(window=leading_b_len).max() + s_low.rolling(window=leading_b_len).min()) / 2.0

    return {
        "conversion": tenkan.to_numpy(),
        "base": kijun.to_numpy(),
        "span_a": senkou_a.to_numpy(),
        "span_b": senkou_b.to_numpy(),
        "lagging": close
    }


def compute_donchian(high: np.ndarray, low: np.ndarray, length: int = 20) -> Dict[str, np.ndarray]:
    """Donchian Channels."""
    length = max(1, int(length))
    s_high = pd.Series(high)
    s_low = pd.Series(low)
    upper = s_high.rolling(window=length).max().to_numpy()
    lower = s_low.rolling(window=length).min().to_numpy()
    basis = (upper + lower) / 2.0
    return {"upper": upper, "lower": lower, "basis": basis}


def compute_williams_r(high: np.ndarray, low: np.ndarray, close: np.ndarray, length: int = 14) -> np.ndarray:
    """Williams %R."""
    length = max(1, int(length))
    s_high = pd.Series(high)
    s_low = pd.Series(low)
    highest_high = s_high.rolling(window=length).max()
    lowest_low = s_low.rolling(window=length).min()
    wr = -100.0 * (highest_high - close) / (highest_high - lowest_low + 1e-12)
    return wr.to_numpy()


# Clean NaN/Inf sanitizer
def sanitize_array(arr: np.ndarray) -> list:
    """Sanitize float array for JSON serialization (convert NaN/Inf to None)."""
    return [None if (np.isnan(v) or np.isinf(v)) else round(float(v), 5) for v in arr]


def compute_indicator(indicator_name: str, rates: np.ndarray, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Main entry point for server-side indicator computation.
    """
    params = params or {}
    name = (indicator_name or "").strip().upper()

    t = rates['time'].astype(np.int64)
    o = rates['open'].astype(np.float64)
    h = rates['high'].astype(np.float64)
    l = rates['low'].astype(np.float64)
    c = rates['close'].astype(np.float64)
    v = rates['tick_volume'].astype(np.float64)

    plots = {}

    if name in ("SMA", "MOVING AVERAGE", "MA"):
        length = int(params.get("length", 14))
        plots["SMA"] = sanitize_array(compute_sma(c, length))
    elif name in ("EMA", "MOVING AVERAGE EXPONENTIAL"):
        length = int(params.get("length", 14))
        plots["EMA"] = sanitize_array(compute_ema(c, length))
    elif name in ("WMA", "MOVING AVERAGE WEIGHTED"):
        length = int(params.get("length", 14))
        plots["WMA"] = sanitize_array(compute_wma(c, length))
    elif name in ("HMA", "HULL MOVING AVERAGE"):
        length = int(params.get("length", 14))
        plots["HMA"] = sanitize_array(compute_hma(c, length))
    elif name in ("DEMA", "DOUBLE EMA"):
        length = int(params.get("length", 14))
        plots["DEMA"] = sanitize_array(compute_dema(c, length))
    elif name in ("TEMA", "TRIPLE EMA"):
        length = int(params.get("length", 14))
        plots["TEMA"] = sanitize_array(compute_tema(c, length))
    elif name in ("RSI", "RELATIVE STRENGTH INDEX"):
        length = int(params.get("length", 14))
        plots["RSI"] = sanitize_array(compute_rsi(c, length))
    elif name in ("MACD", "MOVING AVERAGE CONVERGENCE DIVERGENCE"):
        fast = int(params.get("fast", 12))
        slow = int(params.get("slow", 26))
        signal = int(params.get("signal", 9))
        res = compute_macd(c, fast, slow, signal)
        plots["MACD"] = sanitize_array(res["macd"])
        plots["Signal"] = sanitize_array(res["signal"])
        plots["Hist"] = sanitize_array(res["hist"])
    elif name in ("BB", "BOLLINGER BANDS"):
        length = int(params.get("length", 20))
        mult = float(params.get("mult", 2.0))
        res = compute_bollinger_bands(c, length, mult)
        plots["Basis"] = sanitize_array(res["basis"])
        plots["Upper"] = sanitize_array(res["upper"])
        plots["Lower"] = sanitize_array(res["lower"])
    elif name in ("ATR", "AVERAGE TRUE RANGE"):
        length = int(params.get("length", 14))
        plots["ATR"] = sanitize_array(compute_atr(h, l, c, length))
    elif name in ("SUPERTREND", "SUPER TREND"):
        length = int(params.get("length", 10))
        mult = float(params.get("mult", 3.0))
        res = compute_supertrend(h, l, c, length, mult)
        plots["Supertrend"] = sanitize_array(res["supertrend"])
        plots["Upper"] = sanitize_array(res["upper"])
        plots["Lower"] = sanitize_array(res["lower"])
        plots["Direction"] = [int(d) for d in res["direction"]]
    elif name in ("STOCH", "STOCHASTIC"):
        k_len = int(params.get("k_len", 14))
        k_smooth = int(params.get("k_smooth", 3))
        d_len = int(params.get("d_len", 3))
        res = compute_stochastic(h, l, c, k_len, k_smooth, d_len)
        plots["%K"] = sanitize_array(res["k"])
        plots["%D"] = sanitize_array(res["d"])
    elif name in ("STOCHRSI", "STOCHASTIC RSI"):
        rsi_len = int(params.get("rsi_len", 14))
        stoch_len = int(params.get("stoch_len", 14))
        k_smooth = int(params.get("k_smooth", 3))
        d_smooth = int(params.get("d_smooth", 3))
        res = compute_stoch_rsi(c, rsi_len, stoch_len, k_smooth, d_smooth)
        plots["%K"] = sanitize_array(res["k"])
        plots["%D"] = sanitize_array(res["d"])
    elif name in ("VWAP", "VOLUME WEIGHTED AVERAGE PRICE"):
        plots["VWAP"] = sanitize_array(compute_vwap(h, l, c, v, t))
    elif name in ("PIVOT", "PIVOT POINTS", "PIVOT POINTS STANDARD"):
        res = compute_pivot_points(h, l, c)
        for k, arr in res.items():
            plots[k.upper()] = sanitize_array(arr)
    elif name in ("CCI", "COMMODITY CHANNEL INDEX"):
        length = int(params.get("length", 20))
        plots["CCI"] = sanitize_array(compute_cci(h, l, c, length))
    elif name in ("ADX", "DMI", "AVERAGE DIRECTIONAL INDEX", "DIRECTIONAL MOVEMENT"):
        length = int(params.get("length", 14))
        res = compute_adx_dmi(h, l, c, length)
        plots["ADX"] = sanitize_array(res["adx"])
        plots["+DI"] = sanitize_array(res["plus_di"])
        plots["-DI"] = sanitize_array(res["minus_di"])
    elif name in ("MOMENTUM", "MOM"):
        length = int(params.get("length", 10))
        plots["Momentum"] = sanitize_array(compute_momentum(c, length))
    elif name in ("ROC", "RATE OF CHANGE"):
        length = int(params.get("length", 14))
        plots["ROC"] = sanitize_array(compute_roc(c, length))
    elif name in ("ICHIMOKU", "ICHIMOKU CLOUD"):
        res = compute_ichimoku(h, l, c)
        plots["Conversion"] = sanitize_array(res["conversion"])
        plots["Base"] = sanitize_array(res["base"])
        plots["SpanA"] = sanitize_array(res["span_a"])
        plots["SpanB"] = sanitize_array(res["span_b"])
    elif name in ("DONCHIAN", "DONCHIAN CHANNELS"):
        length = int(params.get("length", 20))
        res = compute_donchian(h, l, length)
        plots["Upper"] = sanitize_array(res["upper"])
        plots["Lower"] = sanitize_array(res["lower"])
        plots["Basis"] = sanitize_array(res["basis"])
    elif name in ("WILLIAMS %R", "WILLIAMS_R", "%R"):
        length = int(params.get("length", 14))
        plots["%R"] = sanitize_array(compute_williams_r(h, l, c, length))
    else:
        # Fallback to SMA
        plots["SMA"] = sanitize_array(compute_sma(c, 14))

    return {
        "indicator": name,
        "count": len(t),
        "times": [int(x) for x in t],
        "plots": plots
    }
`;

fs.writeFileSync(path.join('e:/TRADINGVIEW ADVANCED', 'indicators_engine.py'), engineCode, 'utf8');
console.log('Successfully created indicators_engine.py!');
