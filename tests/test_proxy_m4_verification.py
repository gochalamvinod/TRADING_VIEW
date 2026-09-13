"""
Comprehensive verification test for Requirement R3:
- Reverse Proxy routing on port 9000 (/config, /symbols, /history, /time, /quotes, /trade/*, /ticks)
- Cache-Control header enforcement (no-cache, no-store, must-revalidate)
- CORS header enforcement
- High-concurrency threaded load verification
"""

import sys
import time
import requests
import concurrent.futures

BASE = "http://127.0.0.1:9000"

def main():
    print("=================================================================")
    print("   REQUIREMENT R3 VERIFICATION: PORT 9000 PROXY & THREAD SAFETY   ")
    print("=================================================================\n")

    # 1. Health check & Headers
    print("--- 1. Testing /health endpoint & headers ---")
    r = requests.get(f"{BASE}/health", timeout=5)
    print(f"Status Code: {r.status_code}")
    print(f"Health Response: {r.json()}")
    assert r.status_code == 200, f"/health failed: {r.status_code}"
    cc = r.headers.get("Cache-Control", "")
    assert "no-cache" in cc and "no-store" in cc and "must-revalidate" in cc, f"Bad Cache-Control: {cc}"
    assert r.headers.get("Access-Control-Allow-Origin") == "*", "Missing CORS header"
    print("  [PASS] /health is healthy and contains strict no-cache + CORS headers.\n")

    # 2. UDF & Trading API Endpoints
    print("--- 2. Testing API Routing to Backend 8080 ---")
    now = int(time.time())
    endpoints = [
        ("GET", "/config", None),
        ("GET", "/time", None),
        ("GET", "/symbols?symbol=XAUUSD.", None),
        ("GET", f"/history?symbol=XAUUSD.&resolution=1&from={now - 3600}&to={now}", None),
        ("GET", "/ticks?symbol=XAUUSD.&ticks_per_bar=40", None),
        ("GET", "/quotes?symbols=XAUUSD.", None),
        ("GET", "/trade/account", None),
        ("GET", "/trade/positions", None),
        ("GET", "/trade/orders", None),
        ("POST", "/trade/lot_calculator", {"symbol": "XAUUSD.", "risk_percent": 1.0, "sl_distance": 100}),
    ]

    for method, ep, body in endpoints:
        url = BASE + ep
        t0 = time.perf_counter()
        if method == "GET":
            resp = requests.get(url, timeout=10)
        else:
            resp = requests.post(url, json=body, timeout=10)
        elapsed_ms = (time.perf_counter() - t0) * 1000

        cc = resp.headers.get("Cache-Control", "")
        print(f"  {method:<4} {ep:<45} -> Status: {resp.status_code} ({elapsed_ms:.1f}ms) | Cache-Control: {cc}")

        assert resp.status_code == 200, f"Endpoint {ep} failed with status {resp.status_code}: {resp.text[:200]}"
        assert "no-cache" in cc and "no-store" in cc, f"Missing strict Cache-Control on {ep}: {cc}"
        assert resp.headers.get("Access-Control-Allow-Origin") == "*", f"Missing CORS on {ep}"

    print("  [PASS] All 10 API endpoints routed successfully with correct headers.\n")

    # 3. Threaded Concurrency Stress Test
    print("--- 3. Testing High-Concurrency Threaded Load (100 concurrent requests) ---")
    def worker(idx):
        path = "/time" if idx % 2 == 0 else "/quotes?symbols=XAUUSD."
        t_start = time.perf_counter()
        res = requests.get(f"{BASE}{path}", timeout=10)
        t_elapsed = (time.perf_counter() - t_start) * 1000
        return res.status_code == 200, t_elapsed

    total_reqs = 100
    with concurrent.futures.ThreadPoolExecutor(max_workers=25) as pool:
        results = list(pool.map(worker, range(total_reqs)))

    successes = [r[0] for r in results]
    latencies = [r[1] for r in results]
    success_count = sum(successes)
    print(f"  Total Requests: {total_reqs}")
    print(f"  Successful:     {success_count}/{total_reqs} ({success_count / total_reqs * 100:.1f}%)")
    print(f"  Latency Min:    {min(latencies):.2f}ms")
    print(f"  Latency Avg:    {sum(latencies) / len(latencies):.2f}ms")
    print(f"  Latency Max:    {max(latencies):.2f}ms")

    assert success_count == total_reqs, f"Some requests failed during concurrency test! {total_reqs - success_count} failures"
    print("  [PASS] Threaded load test passed with 100% success rate!\n")

    print("=================================================================")
    print("         ALL REQUIREMENT R3 VERIFICATIONS PASSED 100%           ")
    print("=================================================================")

if __name__ == "__main__":
    main()
