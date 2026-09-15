import time
import json
import http.client
import cupy as np

def run_benchmark(host="127.0.0.1", port=8080, symbol="XAUUSD.", iterations=50, spacing_s=0.01):
    url_path = f"/quotes?symbols={symbol}"
    conn = http.client.HTTPConnection(host, port, timeout=5)

    # Warmup
    for _ in range(5):
        conn.request("GET", url_path)
        r = conn.getresponse()
        r.read()

    latencies = []
    sample_response = None

    for i in range(iterations):
        t0 = time.perf_counter()
        conn.request("GET", url_path)
        r = conn.getresponse()
        body = r.read()
        t1 = time.perf_counter()

        latency_ms = (t1 - t0) * 1000.0
        latencies.append(latency_ms)

        assert r.status == 200, f"Expected 200, got {r.status}"
        data = json.loads(body)
        if sample_response is None:
            sample_response = data

        if spacing_s > 0:
            time.sleep(spacing_s)

    conn.close()
    lat = np.array(latencies)

    print(f"\n==================================================")
    print(f"BENCHMARK RESULTS: {symbol} on http://{host}:{port}{url_path}")
    print(f"Iterations: {iterations} (spacing: {spacing_s*1000:.0f}ms)")
    print(f"Min:        {lat.min():.3f} ms")
    print(f"Avg:        {lat.mean():.3f} ms")
    print(f"Median:     {np.median(lat):.3f} ms")
    print(f"P95:        {np.percentile(lat, 95):.3f} ms")
    print(f"P99:        {np.percentile(lat, 99):.3f} ms")
    print(f"Max:        {lat.max():.3f} ms")
    print(f"==================================================")

    # Verify UDF structure
    assert sample_response is not None, "No response captured"
    assert sample_response.get("s") == "ok", f"Status not ok: {sample_response}"
    items = sample_response.get("d", [])
    assert len(items) > 0, "Empty data array in response"
    item = items[0]
    assert item.get("s") == "ok", f"Item status not ok: {item}"
    assert item.get("n") == symbol, f"Symbol mismatch: {item.get('n')} != {symbol}"
    v = item.get("v", {})

    required_fields = [
        "lp", "ask", "bid", "spread", "high_price",
        "low_price", "open_price", "prev_close_price",
        "ch", "chp", "description"
    ]

    print("\nVerifying TradingView UDF Quote Structure:")
    for f in required_fields:
        assert f in v, f"Required field '{f}' missing from response 'v' object!"
        print(f"  [OK] {f:<18}: {v[f]}")

    return {
        "min": float(lat.min()),
        "avg": float(lat.mean()),
        "median": float(np.median(lat)),
        "p95": float(np.percentile(lat, 95)),
        "p99": float(np.percentile(lat, 99)),
        "max": float(lat.max()),
        "sample": item
    }

if __name__ == "__main__":
    print("--- BENCHMARK 1: Unified Server (port 9000) with 10ms Spacing ---")
    direct_res = run_benchmark("127.0.0.1", 9000, "XAUUSD.", 100, spacing_s=0.01)

    print("\n--- BENCHMARK 2: Unified Server (port 9000) Back-to-Back Burst (0ms Spacing) ---")
    direct_burst = run_benchmark("127.0.0.1", 9000, "XAUUSD.", 100, spacing_s=0.0)

    print("\n--- FINAL SUMMARY AUDIT ---")
    print(f"Port 9000 (10ms spacing): Min={direct_res['min']:.2f}ms, Avg={direct_res['avg']:.2f}ms, Median={direct_res['median']:.2f}ms, P95={direct_res['p95']:.2f}ms")
    print(f"Port 9000 (burst):        Min={direct_burst['min']:.2f}ms, Avg={direct_burst['avg']:.2f}ms, Median={direct_burst['median']:.2f}ms, P95={direct_burst['p95']:.2f}ms")

    # Verify requirement: /quotes < 10ms latency
    assert direct_res["avg"] < 10.0, f"Average latency {direct_res['avg']:.2f}ms exceeds 10ms!"
    assert direct_res["p95"] < 10.0, f"P95 latency {direct_res['p95']:.2f}ms exceeds 10ms!"
    assert direct_burst["avg"] < 10.0, f"Burst average latency {direct_burst['avg']:.2f}ms exceeds 10ms!"
    assert direct_burst["p95"] < 10.0, f"Burst P95 latency {direct_burst['p95']:.2f}ms exceeds 10ms!"
    print("\n==================================================")
    print("ALL VERIFICATION REQUIREMENTS PASSED!")
    print("Requirement R3: /quotes latency < 10ms (P95 < 10ms & Avg < 10ms) & Full UDF Structure VERIFIED!")
    print("==================================================")
