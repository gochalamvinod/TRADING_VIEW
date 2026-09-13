import os
import re
import requests
import json

def test_endpoints():
    print("=== Testing Endpoints ===")
    endpoints = [
        ("GET", "http://127.0.0.1:9000/quotes?symbols=XAUUSD.", 200),
        ("GET", "http://127.0.0.1:9000/trade/account", 200),
        ("GET", "http://127.0.0.1:9000/trade/positions", 200),
        ("GET", "http://127.0.0.1:9000/trade/orders", 200),
        ("GET", "http://127.0.0.1:9000/history?symbol=XAUUSD.&resolution=1&from=1700000000&to=1700003600", 200),
        ("GET", "http://127.0.0.1:9000/config", 200),
        ("GET", "http://127.0.0.1:9000/symbols?symbol=XAUUSD.", 200),
    ]

    all_passed = True
    for method, url, expected_code in endpoints:
        try:
            r = requests.request(method, url, timeout=10)
            status_ok = (r.status_code == expected_code)
            res_json = None
            try:
                res_json = r.json()
            except Exception:
                pass
            print(f"[{'PASS' if status_ok else 'FAIL'}] {method} {url} -> {r.status_code}")
            if not status_ok:
                print(f"  Response: {r.text[:200]}")
                all_passed = False
            elif "quotes" in url:
                assert res_json.get("s") == "ok", "Quotes response missing 's': 'ok'"
                assert len(res_json.get("d", [])) > 0, "Quotes empty data list"
                quote_data = res_json["d"][0]
                assert quote_data.get("n") == "XAUUSD.", f"Unexpected quote name {quote_data.get('n')}"
                print(f"  Quote bid={quote_data['v'].get('bid')} ask={quote_data['v'].get('ask')}")
            elif "account" in url:
                assert res_json.get("login") == 70257567, f"Expected login 70257567, got {res_json.get('login')}"
                print(f"  Account {res_json.get('login')}: balance={res_json.get('balance')}, equity={res_json.get('equity')}")
            elif "positions" in url:
                print(f"  Open positions count: {len(res_json)}")
                assert len(res_json) == 0, f"Account has {len(res_json)} open positions, expected 0!"
            elif "orders" in url:
                print(f"  Pending orders count: {len(res_json)}")
                assert len(res_json) == 0, f"Account has {len(res_json)} pending orders, expected 0!"
        except Exception as ex:
            print(f"[ERROR] {method} {url} -> {ex}")
            all_passed = False
    return all_passed

def test_static_and_cache():
    print("\n=== Testing Static Assets & Cache-Control ===")
    files_to_check = ["/", "/index.html", "/mt5_broker.js", "/charting_library/charting_library.standalone.js", "/datafeeds/udf/dist/bundle.js"]
    all_passed = True
    for p in files_to_check:
        try:
            r = requests.get(f"http://127.0.0.1:9000{p}", timeout=10)
            status_ok = (r.status_code == 200)
            cc = r.headers.get("cache-control", "")
            has_no_cache = "no-cache" in cc
            print(f"[{'PASS' if status_ok else 'FAIL'}] {p} -> {r.status_code} ({len(r.content)} bytes) | Cache-Control: {cc}")
            if not status_ok:
                all_passed = False
        except Exception as ex:
            print(f"[ERROR] {p} -> {ex}")
            all_passed = False
    return all_passed

if __name__ == "__main__":
    ep_ok = test_endpoints()
    st_ok = test_static_and_cache()
    print(f"\nFinal Result: {'ALL TESTS PASSED' if (ep_ok and st_ok) else 'FAILURES DETECTED'}")
