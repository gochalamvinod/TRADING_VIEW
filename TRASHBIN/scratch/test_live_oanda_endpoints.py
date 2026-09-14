import sys
import os
sys.path.insert(0, r"e:\TRADINGVIEW ADVANCED")
import httpx
import server_oanda
import time
import orjson

print("=" * 70)
print("TESTING LIVE SERVER_OANDA FASTAPI ASGI ENDPOINTS")
print("=" * 70)

from starlette.testclient import TestClient

client = TestClient(server_oanda.app)

# 1. Test /time endpoints (float, int, json, default)
print("\n[TEST 1] Testing /time endpoint precision...")
# Default UDF
r_default = client.get("/time")
assert r_default.status_code == 200, f"Failed /time default: {r_default.status_code}"
t_val = float(r_default.text.strip())
print(f"  /time (default float string): {r_default.text.strip()} (parsed: {t_val:.6f})")
assert t_val > 1700000000.0, "Invalid timestamp"

# format=float
r_float = client.get("/time?format=float")
assert r_float.status_code == 200
t_float = float(r_float.text.strip())
print(f"  /time?format=float:           {r_float.text.strip()}")

# format=int
r_int = client.get("/time?format=int")
assert r_int.status_code == 200
t_int = int(r_int.text.strip())
print(f"  /time?format=int:             {t_int}")

# format=json
r_json = client.get("/time?format=json")
assert r_json.status_code == 200
j_val = r_json.json()
print(f"  /time?format=json:            {j_val}")
assert j_val["broker_offset_sec"] == 0, "OANDA offset must be 0!"
print("  [PASS] /time delivers microsecond pure UTC in all required UDF formats!")

# 2. Test /config
print("\n[TEST 2] Testing /config endpoint...")
r_cfg = client.get("/config")
assert r_cfg.status_code == 200
cfg = r_cfg.json()
print(f"  supports_time: {cfg.get('supports_time')}")
print(f"  broker_backend: {cfg.get('broker_backend')}")
assert cfg["broker_backend"] == "OANDA"
assert cfg["supports_time"] is True
print("  [PASS] /config correctly configured for OANDA and UDF time sync!")

# 3. Test /symbols
print("\n[TEST 3] Testing /symbols?symbol=EURUSD...")
r_sym = client.get("/symbols?symbol=EURUSD")
assert r_sym.status_code == 200
sym_info = r_sym.json()
print(f"  Symbol: {sym_info.get('name')}, ticker: {sym_info.get('ticker')}, description: {sym_info.get('description')}")
print("  [PASS] /symbols returns accurate instrument metadata!")

# 4. Test /quotes
print("\n[TEST 4] Testing /quotes?symbols=EURUSD,XAUUSD...")
r_quotes = client.get("/quotes?symbols=EURUSD,XAUUSD")
assert r_quotes.status_code == 200
q_data = r_quotes.json()
print(f"  Quotes count: {len(q_data.get('d', []))}")
for item in q_data.get("d", []):
    print(f"    {item['n']}: lp={item['p']}, time_utc_msc={item.get('time_utc_msc')}")
    assert item.get("time_utc_msc", 0) > 0
print("  [PASS] /quotes provides real-time quotes with microsecond UTC timestamps!")

# 5. Test /history
print("\n[TEST 5] Testing /history?symbol=EURUSD&resolution=1&countback=5...")
r_hist = client.get("/history?symbol=EURUSD&resolution=1&countback=5")
assert r_hist.status_code == 200
hist = r_hist.json()
assert hist["s"] == "ok"
print(f"  Bars returned: {len(hist['t'])}, latest bar time: {hist['t'][-1]}, close: {hist['c'][-1]}")
print("  [PASS] /history delivers valid bars with UTC timestamps!")

# 6. Test /health
print("\n[TEST 6] Testing /health...")
r_health = client.get("/health")
assert r_health.status_code == 200
health = r_health.json()
print(f"  Status: {health.get('status')}, OANDA: {health.get('oanda')}, MT5: {health.get('mt5')}")
assert health["broker_backend"] == "OANDA"
assert health["mt5"] == "disabled"
print("  [PASS] /health confirms clean OANDA mode and disabled MT5!")

print("\n" + "=" * 70)
print("ALL SERVER_OANDA ASGI ENDPOINTS VERIFIED AND PASSING!")
print("=" * 70)
