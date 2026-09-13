import httpx
import json

client = httpx.Client(base_url='http://127.0.0.1:9000', timeout=15.0)

print("--- 1. Testing /health ---")
r_health = client.get('/health')
print("Status:", r_health.status_code)
assert r_health.status_code == 200
data_health = r_health.json()
print("Health status:", data_health.get('status'))
assert data_health.get('status') == 'healthy'

print("\n--- 2. Testing /pine/catalog ---")
r_cat1 = client.get('/pine/catalog')
print("Status:", r_cat1.status_code)
assert r_cat1.status_code == 200
cat1 = r_cat1.json()
print("Catalog length:", len(cat1))
assert isinstance(cat1, list)
assert len(cat1) >= 20

print("\n--- 3. Testing /pine/indicators/catalog ---")
r_cat2 = client.get('/pine/indicators/catalog')
print("Status:", r_cat2.status_code)
assert r_cat2.status_code == 200
cat2 = r_cat2.json()
print("Indicators catalog length:", len(cat2))
assert isinstance(cat2, list)
assert len(cat2) >= 20
assert cat1 == cat2

print("\n--- 4. Testing /pine/transpile (Indicator) ---")
ind_source = """//@version=5
indicator("Pytest SMA Indicator", overlay=true)
length = input.int(14, "Length")
val = ta.sma(close, length)
plot(val, "SMA Plot", color=color.blue)
"""
r_trans = client.post('/pine/transpile', json={'source': ind_source})
print("Status:", r_trans.status_code)
assert r_trans.status_code == 200
data = r_trans.json()
print("Keys:", list(data.keys()))
assert data.get('success') is True
assert len(data.get('code', '')) > 50
assert data.get('declarationType') == 'indicator'
assert data.get('usesVisibleRange') is False
assert isinstance(data.get('inputs'), list)
assert len(data.get('inputs')) == 1
assert data.get('inputs')[0]['varId'] == 'length'
assert data.get('inputs')[0]['type'] == 'int'
assert data.get('inputs')[0]['defval'] == 14
assert isinstance(data.get('props'), list)
assert len(data.get('props')) > 0
# Backwards compatibility check
assert data.get('meta') == data.get('inputs')

print("\n--- 5. Testing /pine/transpile (Strategy) ---")
strat_source = """//@version=5
strategy("Pytest Strategy", overlay=true)
fast = ta.sma(close, 9)
slow = ta.sma(close, 21)
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long)
if ta.crossunder(fast, slow)
    strategy.close("Long")
"""
r_strat = client.post('/pine/transpile', json={'source': strat_source})
print("Status:", r_strat.status_code)
assert r_strat.status_code == 200
data_s = r_strat.json()
print("Keys:", list(data_s.keys()))
assert data_s.get('success') is True
assert len(data_s.get('code', '')) > 50
assert data_s.get('declarationType') == 'strategy'
assert data_s.get('usesVisibleRange') is False
assert isinstance(data_s.get('props'), list)
assert len(data_s.get('props')) > 0

print("\n--- 6. Testing /pine/transpile (Custom Symbol Candles / plotcandle) ---")
candle_source = """//@version=5
indicator("Custom Symbol Candles", overlay=false)
sym = input.symbol("AAPL", "Symbol")
res = input.timeframe("D", "Resolution")
[o, h, l, c] = request.security(sym, res, [open, high, low, close])
plotcandle(o, h, l, c, title="Candles", color=c >= o ? color.green : color.red)
"""
r_candle = client.post('/pine/transpile', json={'source': candle_source})
print("Status:", r_candle.status_code)
assert r_candle.status_code == 200
data_c = r_candle.json()
print("Keys:", list(data_c.keys()))
assert data_c.get('success') is True
assert len(data_c.get('code', '')) > 50
assert data_c.get('declarationType') == 'indicator'
inputs_c = data_c.get('inputs')
print("Inputs count:", len(inputs_c))
input_types = [inp.get('type') for inp in inputs_c]
print("Input types:", input_types)
assert 'symbol' in input_types
assert 'resolution' in input_types or 'timeframe' in input_types

print("\n--- 7. Testing /pine/transpile (Syntax Error handling) ---")
broken_source = """//@version=5
indicator("Invalid
"""
r_err = client.post('/pine/transpile', json={'source': broken_source})
print("Status:", r_err.status_code)
assert r_err.status_code == 200
data_err = r_err.json()
assert data_err.get('success') is False
assert 'error' in data_err
print("Error message:", data_err.get('error'))

print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")
