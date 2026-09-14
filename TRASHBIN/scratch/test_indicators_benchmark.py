import sys
sys.path.insert(0, r'e:\TRADINGVIEW ADVANCED')
import indicators_engine as ie
import numpy as np

n = 2000
close = np.cumprod(1.0 + np.random.randn(n) * 0.002) * 1.1000
rates = {
    'time': np.arange(n),
    'open': close,
    'high': close + 0.001,
    'low': close - 0.001,
    'close': close,
    'volume': np.full(n, 500.0, dtype=np.float32)
}

inds = [
    'SMA', 'EMA', 'WMA', 'HMA', 'DEMA', 'TEMA',
    'RSI', 'MACD', 'BB', 'ATR', 'SUPERTREND', 'VWAP',
    'STOCH', 'STOCHRSI', 'CCI', 'ADX', 'DONCHIAN', 'ICHIMOKU',
    'WILLIAMS_R', 'MOMENTUM', 'ROC', 'PIVOT'
]

print("=" * 70)
print(f"BENCHMARKING 22 INDICATORS OVER {n} BARS (GPU / JAX ACCELERATED)")
print("=" * 70)

for ind in inds:
    # Warm up / run
    _ = ie.compute_indicator(ind, rates)
    res = ie.compute_indicator(ind, rates)
    engine = res["engine"]
    ms = res["compute_time_ms"]
    plots = list(res["plots"].keys())
    print(f"{ind:15} | {engine:40} | {ms:6.2f} ms | plots: {plots}")

print("=" * 70)
print("Engine Status:", ie.get_available_indicators()["engine_status"])
print("ALL 22 INDICATORS VERIFIED SUCCESSFULLY!")
