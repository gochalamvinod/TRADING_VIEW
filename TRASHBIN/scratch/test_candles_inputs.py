"""Test Custom Symbol Candles transpilation with 9 inputs."""
import httpx, json

BASE = "http://127.0.0.1:9000"

code = """//@version=5
indicator("Custom Symbol Candles", overlay=false)
sym = input.symbol("BINANCE:BTCUSDT", title="Symbol")
tf = input.timeframe("", title="Timeframe")
showCandles = input.bool(true, title="Show Candles")
upColor = input.color(color.green, title="Up Candle Color")
downColor = input.color(color.red, title="Down Candle Color")
borderUp = input.color(color.green, title="Border Up")
borderDown = input.color(color.red, title="Border Down")
wickUp = input.color(color.green, title="Wick Up")
wickDown = input.color(color.red, title="Wick Down")

[o, h, l, c] = request.security(sym, tf, [open, high, low, close])

plotcandle(showCandles ? o : na, h, l, c, title="Candles",
           color = c >= o ? upColor : downColor,
           wickcolor = c >= o ? wickUp : wickDown,
           bordercolor = c >= o ? borderUp : borderDown)
"""

r = httpx.post(f"{BASE}/pine/transpile", json={"source": code}, timeout=15)
data = r.json()
print(f"Status: {r.status_code}")
print(f"Success: {data.get('success')}")
print(f"Input count: {len(data.get('inputs', []))}")
print(f"Declaration type: {data.get('declarationType')}")

if data.get("inputs"):
    print("\nAll inputs:")
    for i, inp in enumerate(data["inputs"]):
        vid = inp.get("varId", inp.get("id", "?"))
        t = inp.get("type", "?")
        title = inp.get("title", "?")
        d = inp.get("defval", "?")
        print(f"  [{i}] {vid}: type={t}, title={title}, defval={d}")

expected_count = 9
actual = len(data.get("inputs", []))
if actual == expected_count:
    print(f"\nPASS: Got exactly {expected_count} inputs as expected")
else:
    print(f"\nWARN: Expected {expected_count} inputs, got {actual}")

# Check types
types_found = set(inp.get("type", "?") for inp in data.get("inputs", []))
print(f"Input types found: {types_found}")
expected_types = {"symbol", "timeframe", "bool", "color"}
missing = expected_types - types_found
if missing:
    print(f"WARN: Missing input types: {missing}")
else:
    print(f"PASS: All expected input types present: {expected_types}")
