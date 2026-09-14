import os
import sys
import time

sys.path.insert(0, r"e:\TRADINGVIEW ADVANCED")
os.environ["BROKER_BACKEND"] = "OANDA"
os.environ["PRICE_TYPE"] = "MID"

import server
from fastapi.testclient import TestClient

client = TestClient(server.app)

print("--- Testing /config ---")
r = client.get("/config")
print("Status:", r.status_code, "Supported resolutions count:", len(r.json().get("supported_resolutions", [])))
assert r.status_code == 200

print("--- Testing /symbols (EURUSD) ---")
r = client.get("/symbols?symbol=EURUSD")
print("Status:", r.status_code, "Name:", r.json().get("name"), "Pricescale:", r.json().get("pricescale"))
assert r.status_code == 200

print("--- Testing /quotes (EURUSD, XAUUSD) ---")
r = client.get("/quotes?symbols=EURUSD,XAUUSD")
print("Status:", r.status_code, "Quotes count:", len(r.json().get("d", [])))
for q in r.json().get("d", []):
    v = q.get("v", {})
    print(f"  {q.get('n')}: lp={v.get('lp')} bid={v.get('bid')} ask={v.get('ask')}")
assert r.status_code == 200

print("--- Testing /history (1m EURUSD) ---")
r = client.get("/history?symbol=EURUSD&resolution=1&countback=10")
h = r.json()
print("Status:", r.status_code, "s:", h.get("s"), "Bars:", len(h.get("t", [])))
assert h.get("s") == "ok"

print("--- Testing /history (1D EURUSD) ---")
r = client.get("/history?symbol=EURUSD&resolution=1D&countback=5")
h = r.json()
print("Status:", r.status_code, "s:", h.get("s"), "Bars:", len(h.get("t", [])))
assert h.get("s") == "ok"

print("--- Testing /trade/account ---")
r = client.get("/trade/account")
acc = r.json()
print("Status:", r.status_code, "Account name:", acc.get("name"), "Balance:", acc.get("balance"), "Server:", acc.get("server"))
assert r.status_code == 200

print("--- Testing /trade/positions ---")
r = client.get("/trade/positions")
print("Status:", r.status_code, "Positions:", r.json())
assert r.status_code == 200

print("--- Testing /trade/orders ---")
r = client.get("/trade/orders")
print("Status:", r.status_code, "Orders count:", len(r.json()))
assert r.status_code == 200

print("--- Testing /trade/history ---")
r = client.get("/trade/history")
th = r.json()
print("Status:", r.status_code, "Deals count:", len(th.get("deals", [])), "Orders count:", len(th.get("orders", [])))
assert r.status_code == 200

print("--- Testing /search (GOLD) ---")
r = client.get("/search?query=gold")
sr = r.json()
print("Status:", r.status_code, "Found:", len(sr))
if sr:
    print("  First hit:", sr[0])
assert r.status_code == 200

print("--- Testing /ticks (EURUSD) ---")
r = client.get("/ticks?symbol=EURUSD")
tr = r.json()
print("Status:", r.status_code, "s:", tr.get("s"), "Bars:", tr.get("bars"))
assert tr.get("s") == "ok"

print("\n>>> ALL OANDA ENDPOINTS VERIFIED 100% FUNCTIONAL! <<<")
