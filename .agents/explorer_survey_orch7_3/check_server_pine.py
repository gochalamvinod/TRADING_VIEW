import sys, os
sys.path.insert(0, r"e:\TRADINGVIEW ADVANCED")

from fastapi.testclient import TestClient
import server

c = TestClient(server.app)

# 1. Health
r_health = c.get("/health")
print(f"1. /health: {r_health.status_code}")
print("   Response:", r_health.json())

# 2. Catalog
r_cat = c.get("/pine/catalog")
print(f"2. /pine/catalog: {r_cat.status_code}")
catalog = r_cat.json()
print(f"   Items count: {len(catalog)}")
if catalog:
    print(f"   Sample item: {catalog[0]['name']} (id={catalog[0].get('id')})")

# 3. Transpile standard SMA
src = """//@version=5
indicator("Test SMA", overlay=true)
len = input.int(14, "Length")
v = ta.sma(close, len)
plot(v, "SMA", color=color.blue)
"""
r_trans = c.post("/pine/transpile", json={"source": src})
print(f"3. /pine/transpile: {r_trans.status_code}")
trans_res = r_trans.json()
print("   success:", trans_res.get("success"))
print("   keys:", list(trans_res.keys()))
if "metainfo" in trans_res:
    print("   plots count:", len(trans_res["metainfo"].get("plots", [])))

# 4. Source endpoint
r_src = c.get("/pine/source/Folded_RSI.pine")
print(f"4. /pine/source/Folded_RSI.pine: {r_src.status_code}, len={len(r_src.text)}")

# 5. JS endpoint
r_js = c.get("/pine/js/Folded_RSI.js")
print(f"5. /pine/js/Folded_RSI.js: {r_js.status_code}, len={len(r_js.text)}")

# 6. Static assets
for asset in ["/pine_transpiler.bundle.js", "/pine_indicators.js", "/pine_editor_ide.js", "/pine_editor.css"]:
    r_asset = c.get(asset)
    print(f"6. Static asset {asset}: {r_asset.status_code}, len={len(r_asset.content)}")
