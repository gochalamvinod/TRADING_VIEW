import httpx
import json
import subprocess
import os

print("=== Starting Adversarial Verification in Python ===")

client = httpx.Client(base_url="http://127.0.0.1:9000", timeout=15.0)

# 1. Test arbitrary unseen PineScript to verify server.py does not hardcode
unique_script = """//@version=5
indicator("Adversarial Test Script 9999", overlay=false)
threshold_val = input.float(3.14159, "Custom Pi Threshold")
flag_enabled = input.bool(true, "Feature Flag")
sym_ref = input.symbol("BTCUSD", "Target Symbol")
tf_ref = input.timeframe("15", "Target TF")
tint = input.color(#ABCDEF, "Tint Color")
[a, b, c, d] = request.security(sym_ref, tf_ref, [open, high, low, close])
plotcandle(a, b, c, d, color=tint)
"""

r = client.post("/pine/transpile", json={"source": unique_script})
assert r.status_code == 200, f"Expected 200, got {r.status_code}"
data = r.json()
assert data.get("success") is True, f"Expected success: true, got {data}"
assert data.get("declarationType") == "indicator"
inputs = data.get("inputs", [])
print(f"Extracted {len(inputs)} inputs from unique script:")
for inp in inputs:
    print(" ", inp.get("varId"), "->", inp.get("type"), "=", inp.get("defval"))

var_ids = [inp.get("varId") for inp in inputs]
assert "threshold_val" in var_ids, "threshold_val must be introspected"
assert "flag_enabled" in var_ids, "flag_enabled must be introspected"
assert "sym_ref" in var_ids, "sym_ref must be introspected"
assert "tf_ref" in var_ids, "tf_ref must be introspected"
assert "tint" in var_ids, "tint must be introspected"

# Verify float value
thresh_inp = next(i for i in inputs if i["varId"] == "threshold_val")
assert abs(float(thresh_inp["defval"]) - 3.14159) < 1e-4

print(" [PASS] Dynamic server-side transpilation confirmed (no hardcoding).")

# 2. Test empty source error handling
r_empty = client.post("/pine/transpile", json={"source": "   "})
assert r_empty.status_code == 400
print(" [PASS] Empty source raises HTTP 400 as expected.")

# 3. Test malformed syntax
r_bad = client.post("/pine/transpile", json={"source": "indicator(foo = bar"})
assert r_bad.status_code == 200
assert r_bad.json().get("success") is False
assert "error" in r_bad.json()
print(" [PASS] Malformed syntax returns success: false with informative error.")

# 4. Check catalog endpoints consistency
r_cat = client.get("/pine/catalog")
r_ind_cat = client.get("/pine/indicators/catalog")
assert r_cat.status_code == 200
assert r_ind_cat.status_code == 200
assert r_cat.json() == r_ind_cat.json()
print(" [PASS] /pine/catalog and /pine/indicators/catalog are identical and valid.")

print("=== All Python Adversarial Tests Passed ===")
