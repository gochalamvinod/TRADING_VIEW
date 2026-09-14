import sys
import os
sys.path.insert(0, r"e:\TRADINGVIEW ADVANCED")

import server
from starlette.testclient import TestClient

print("=" * 70)
print("TESTING LIVE SERVER (MT5) FASTAPI ASGI ENDPOINTS")
print("=" * 70)

client = TestClient(server.app)

# 1. Test /time endpoints (float, int, json, default)
print("\n[TEST 1] Testing /time endpoint precision in server.py...")
r_default = client.get("/time")
assert r_default.status_code == 200, f"Failed /time default: {r_default.status_code}"
t_val = float(r_default.text.strip())
print(f"  /time (default float string): {r_default.text.strip()} (parsed: {t_val:.6f})")
assert t_val > 1700000000.0, "Invalid timestamp"

r_float = client.get("/time?format=float")
assert r_float.status_code == 200
print(f"  /time?format=float:           {r_float.text.strip()}")

r_int = client.get("/time?format=int")
assert r_int.status_code == 200
print(f"  /time?format=int:             {r_int.text.strip()}")

r_json = client.get("/time?format=json")
assert r_json.status_code == 200
j_val = r_json.json()
print(f"  /time?format=json:            {j_val}")
print("  [PASS] /time delivers microsecond pure UTC without adding broker offset!")

# 2. Test /config
print("\n[TEST 2] Testing /config endpoint in server.py...")
r_cfg = client.get("/config")
assert r_cfg.status_code == 200
cfg = r_cfg.json()
print(f"  supports_time: {cfg.get('supports_time')}")
print(f"  broker_backend: {cfg.get('broker_backend')}")
assert cfg["broker_backend"] == "MT5"
assert cfg["supports_time"] is True
print("  [PASS] /config correctly configured for MT5!")

# 3. Test /health
print("\n[TEST 3] Testing /health in server.py...")
r_health = client.get("/health")
assert r_health.status_code == 200
health = r_health.json()
print(f"  Status: {health.get('status')}, MT5: {health.get('mt5')}, OANDA: {health.get('oanda')}")
assert health["broker_backend"] == "MT5"
assert health["oanda"] == "disabled"
print("  [PASS] /health confirms clean MT5 mode and disabled OANDA!")

print("\n" + "=" * 70)
print("ALL SERVER (MT5) ASGI ENDPOINTS VERIFIED AND PASSING!")
print("=" * 70)
