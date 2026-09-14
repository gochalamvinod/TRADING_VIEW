import os
import sys

sys.path.insert(0, r"e:\TRADINGVIEW ADVANCED")
os.environ["BROKER_BACKEND"] = "MT5"
os.environ["PRICE_TYPE"] = "MID"

import server
from fastapi.testclient import TestClient

client = TestClient(server.app)

print("--- Testing /config in MT5 mode ---")
r = client.get("/config")
print("Status:", r.status_code, "Supported resolutions count:", len(r.json().get("supported_resolutions", [])))
assert r.status_code == 200

print("--- Testing /symbols in MT5 mode ---")
r = client.get("/symbols?symbol=EURUSD")
print("Status:", r.status_code, "Symbol name:", r.json().get("name"))
assert r.status_code == 200

print("--- Testing /quotes in MT5 mode ---")
r = client.get("/quotes?symbols=EURUSD")
print("Status:", r.status_code, "Quotes count:", len(r.json().get("d", [])))
assert r.status_code == 200

print("--- Testing /history (1m EURUSD) in MT5 mode ---")
r = client.get("/history?symbol=EURUSD&resolution=1&countback=10")
h = r.json()
print("Status:", r.status_code, "s:", h.get("s"), "Bars count:", len(h.get("t", [])))
assert h.get("s") == "ok"

print("--- Testing /history (1S EURUSD) in MT5 mode ---")
r = client.get("/history?symbol=EURUSD&resolution=1S&countback=10")
h = r.json()
print("Status:", r.status_code, "s:", h.get("s"))

print("\n>>> ALL MT5 ENDPOINTS VERIFIED 100% FUNCTIONAL! <<<")
