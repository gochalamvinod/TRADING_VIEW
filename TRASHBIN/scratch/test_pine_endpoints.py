"""Quick smoke test for Pine endpoints and frontend integration."""
import httpx

BASE = "http://127.0.0.1:9000"

# 1. Health
r = httpx.get(f"{BASE}/health", timeout=5)
print(f"[Health] {r.status_code} - OK")

# 2. Catalog
r = httpx.get(f"{BASE}/pine/catalog", timeout=5)
items = r.json() if r.status_code == 200 else []
print(f"[Catalog] {r.status_code} - {len(items)} items")

# 3. Transpile
code = """//@version=5
indicator("Test SMA", overlay=false)
len = input.int(14, "Length")
plot(ta.sma(close, len))
"""
r = httpx.post(f"{BASE}/pine/transpile", json={"source": code}, timeout=15)
data = r.json()
success = data.get("success", False)
inp_count = len(data.get("inputs", []))
print(f"[Transpile] {r.status_code} - success={success}, inputs={inp_count}")
if data.get("inputs"):
    for inp in data["inputs"]:
        vid = inp.get("varId", inp.get("id", "?"))
        t = inp.get("type", "?")
        d = inp.get("defval", "?")
        print(f"  Input: {vid} type={t} defval={d}")

# 4. Frontend page
r = httpx.get(f"{BASE}/", timeout=5)
text = r.text
checks = {
    "PineTS bundle": "pinets.min.browser.js" in text,
    "pine_indicators.js": "pine_indicators.js" in text,
    "pine_editor_ide.js": "pine_editor_ide.js" in text,
    "custom_indicators_getter": "custom_indicators_getter" in text,
    "pine_editor.css": "pine_editor.css" in text,
}
print(f"[Frontend] {r.status_code}")
for k, v in checks.items():
    status = "PASS" if v else "FAIL"
    print(f"  {status}: {k}")

# 5. Config check (supported_resolutions)
r = httpx.get(f"{BASE}/config", timeout=5)
cfg = r.json()
has_ticks = cfg.get("has_ticks", False)
has_seconds = cfg.get("has_seconds", False)
print(f"[Config] {r.status_code} - has_ticks={has_ticks}, has_seconds={has_seconds}")

print("\n=== ALL SMOKE TESTS COMPLETE ===")
