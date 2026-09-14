"""
Comprehensive backend verification for PineTS Integration (F39-F43).
Tests all server endpoints and PineTS transpilation without requiring a browser.
"""
import httpx
import json
import sys

BASE = "http://127.0.0.1:9000"
PASS = 0
FAIL = 0

def check(name, condition, detail=""):
    global PASS, FAIL
    if condition:
        PASS += 1
        print(f"  PASS: {name}")
    else:
        FAIL += 1
        print(f"  FAIL: {name} - {detail}")

print("=" * 70)
print("COMPREHENSIVE PINETS BACKEND VERIFICATION SUITE")
print("=" * 70)

# ── Suite 1: Server Health ─────────────────────────────────────────────
print("\n[1/7] Server Health & Config")
r = httpx.get(f"{BASE}/health", timeout=5)
check("Health endpoint returns 200", r.status_code == 200)
data = r.json()
check("Server status is healthy", data.get("status") == "healthy")
check("MT5 connected", data.get("mt5") == "connected")

r = httpx.get(f"{BASE}/config", timeout=5)
cfg = r.json()
check("Config has_ticks", cfg.get("has_ticks") == True)
check("Config has_seconds", cfg.get("has_seconds") == True)
check("Config supports_search", cfg.get("supports_search") == True)

# ── Suite 2: Pine Catalog ──────────────────────────────────────────────
print("\n[2/7] Pine Indicator Catalog")
r = httpx.get(f"{BASE}/pine/catalog", timeout=5)
check("Catalog returns 200", r.status_code == 200)
catalog = r.json()
check("Catalog is array", isinstance(catalog, list))
check("Catalog has items", len(catalog) > 0, f"got {len(catalog)}")
if catalog:
    first = catalog[0]
    check("Catalog item has 'name'", "name" in first)
    check("Catalog item has 'pineName'", "pineName" in first)

# ── Suite 3: Simple Transpilation ──────────────────────────────────────
print("\n[3/7] Simple PineTS Transpilation (SMA)")
code_sma = """//@version=5
indicator("Test SMA", overlay=false)
len = input.int(14, "Length")
plot(ta.sma(close, len))
"""
r = httpx.post(f"{BASE}/pine/transpile", json={"source": code_sma}, timeout=15)
check("Transpile returns 200", r.status_code == 200)
data = r.json()
check("Transpile success", data.get("success") == True)
check("Has inputs array", isinstance(data.get("inputs"), list))
check("SMA has 1 input", len(data.get("inputs", [])) == 1, f"got {len(data.get('inputs', []))}")
if data.get("inputs"):
    inp = data["inputs"][0]
    check("Input varId is 'len'", inp.get("varId") == "len")
    check("Input type is 'int'", inp.get("type") == "int")
    check("Input defval is 14", inp.get("defval") == 14)

# ── Suite 4: Custom Symbol Candles (9 inputs) ──────────────────────────
print("\n[4/7] Custom Symbol Candles Transpilation (9 Inputs)")
code_candles = """//@version=5
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
r = httpx.post(f"{BASE}/pine/transpile", json={"source": code_candles}, timeout=15)
check("Candles transpile 200", r.status_code == 200)
data = r.json()
check("Candles transpile success", data.get("success") == True)
inputs = data.get("inputs", [])
check("Has 9 inputs", len(inputs) == 9, f"got {len(inputs)}")

# Verify input types
type_map = {inp.get("varId", ""): inp.get("type", "") for inp in inputs}
check("sym is symbol type", type_map.get("sym") == "symbol")
check("tf is timeframe type", type_map.get("tf") == "timeframe")
check("showCandles is bool type", type_map.get("showCandles") == "bool")
color_vars = ["upColor", "downColor", "borderUp", "borderDown", "wickUp", "wickDown"]
for cv in color_vars:
    check(f"{cv} is color type", type_map.get(cv) == "color")

# ── Suite 5: Multi-Indicator Transpilation ─────────────────────────────
print("\n[5/7] Multi-Indicator Transpilation (RSI, MACD, Bollinger)")
scripts = [
    ("//@version=5\nindicator('RSI', overlay=false)\nlen = input.int(14, 'Length')\nplot(ta.rsi(close, len))", "RSI"),
    ("//@version=5\nindicator('BB', overlay=true)\nlen = input.int(20, 'Length')\nmult = input.float(2.0, 'Mult')\n[mid, upper, lower] = ta.bb(close, len, mult)\nplot(mid)\nplot(upper)\nplot(lower)", "Bollinger"),
    ("//@version=5\nindicator('SuperTrend', overlay=true)\natrPeriod = input.int(10, 'ATR Period')\nfactor = input.float(3.0, 'Factor')\n[st, dir] = ta.supertrend(factor, atrPeriod)\nplot(st)", "SuperTrend"),
]
for code, name in scripts:
    r = httpx.post(f"{BASE}/pine/transpile", json={"source": code}, timeout=15)
    data = r.json()
    check(f"{name} transpiles successfully", data.get("success") == True)

# ── Suite 6: Error Handling ────────────────────────────────────────────
print("\n[6/7] Error Handling & Edge Cases")
# Empty source
r = httpx.post(f"{BASE}/pine/transpile", json={"source": ""}, timeout=10)
check("Empty source returns 400", r.status_code == 400)

# Invalid JSON body
r = httpx.post(f"{BASE}/pine/transpile", content=b"not json", headers={"Content-Type": "application/json"}, timeout=10)
check("Invalid JSON returns 422", r.status_code == 422)

# ── Suite 7: Frontend Assets ──────────────────────────────────────────
print("\n[7/7] Frontend Asset Integrity")
r = httpx.get(f"{BASE}/", timeout=5)
html = r.text
check("index.html loads", r.status_code == 200)
check("Has PineTS bundle script tag", "pinets.min.browser.js" in html)
check("Has pine_indicators.js script tag", "pine_indicators.js" in html)
check("Has pine_editor_ide.js script tag", "pine_editor_ide.js" in html)
check("Has pine_editor.css link tag", "pine_editor.css" in html)
check("Has custom_indicators_getter", "custom_indicators_getter" in html)
check("Has PineTSLib bootstrap", "PineTSLib" in html)
check("Has PineTS.Indicator alias", "PineTS.Indicator" in html)

# Check JS files serve correctly
for js_file in ["pine_indicators.js", "pine_editor_ide.js", "pinets.bundle.js"]:
    r = httpx.get(f"{BASE}/{js_file}", timeout=5)
    check(f"{js_file} serves 200", r.status_code == 200, f"got {r.status_code}")

r = httpx.get(f"{BASE}/pine_editor.css", timeout=5)
check("pine_editor.css serves 200", r.status_code == 200)

# Check PineTS browser bundle
r = httpx.get(f"{BASE}/PineTS-main/dist/pinets.min.browser.js", timeout=5)
check("PineTS browser bundle serves 200", r.status_code == 200, f"got {r.status_code}")

# Legend CSS checks in index.html
check("Legend interval eye suppression CSS", "legend-interval-show-hide-action" in html)
check("valuesWrapper nowrap CSS", "valuesWrapper" in html)
check("Legend properties enabled", "showSeriesTitle" in html)

# ── Summary ────────────────────────────────────────────────────────────
print("\n" + "=" * 70)
total = PASS + FAIL
print(f"RESULTS: {PASS}/{total} PASSED, {FAIL}/{total} FAILED")
if FAIL == 0:
    print("ALL TESTS PASSED - F39-F43 Backend Integration Verified!")
else:
    print(f"WARNING: {FAIL} test(s) failed")
print("=" * 70)
sys.exit(0 if FAIL == 0 else 1)
