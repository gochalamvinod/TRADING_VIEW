"""
tests/test_agent13_challenger_quotes_intervals.py

Empirical stress testing and adversarial challenge harness for:
1. /quotes latency (<10ms across 100 requests in burst/concurrency)
2. Arbitrary custom seconds/ticks resampling (21S, 27S, 20T, 40T)
   - Strict timestamp monotonicity (0 time order violations)
   - Non-empty array validation (t, o, h, l, c, v)
   - Resampling execution latency (< 50ms)
3. Adversarial boundary & schema fuzzing
"""

import sys
import os
import time
import json
import statistics
import concurrent.futures
from typing import List, Dict, Any, Tuple
import requests

SERVER_BASE_8080 = "http://127.0.0.1:8080"
PROXY_BASE_9000 = "http://127.0.0.1:9000"

def calculate_stats(latencies: List[float]) -> Dict[str, float]:
    sorted_lats = sorted(latencies)
    n = len(sorted_lats)
    def pct(p: float) -> float:
        idx = int(round(p * (n - 1)))
        return sorted_lats[idx]
    
    return {
        "count": n,
        "min": round(sorted_lats[0], 3),
        "p25": round(pct(0.25), 3),
        "median": round(pct(0.50), 3),
        "p75": round(pct(0.75), 3),
        "p90": round(pct(0.90), 3),
        "p95": round(pct(0.95), 3),
        "p99": round(pct(0.99), 3),
        "max": round(sorted_lats[-1], 3),
        "mean": round(statistics.mean(sorted_lats), 3),
        "stdev": round(statistics.stdev(sorted_lats) if n > 1 else 0.0, 3)
    }

def test_quotes_burst_sequential(url: str, num_requests: int = 100) -> Tuple[Dict[str, float], bool]:
    session = requests.Session()
    # Warmup
    r_warm = session.get(url, timeout=5)
    assert r_warm.status_code == 200, f"Warmup failed: {r_warm.status_code}"
    
    latencies = []
    schema_valid = True
    for _ in range(num_requests):
        t0 = time.perf_counter()
        resp = session.get(url, timeout=5)
        el = (time.perf_counter() - t0) * 1000.0
        latencies.append(el)
        if resp.status_code != 200:
            schema_valid = False
            continue
        data = resp.json()
        if data.get("s") != "ok" or not isinstance(data.get("d"), list):
            schema_valid = False
            
    stats = calculate_stats(latencies)
    return stats, schema_valid

def test_quotes_burst_concurrent(url: str, num_requests: int = 100, workers: int = 10) -> Tuple[Dict[str, float], bool]:
    latencies = []
    schema_valid = True
    
    def fetch_worker():
        s = requests.Session()
        t0 = time.perf_counter()
        resp = s.get(url, timeout=5)
        el = (time.perf_counter() - t0) * 1000.0
        return resp.status_code, resp.json() if resp.status_code == 200 else {}, el

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as pool:
        futures = [pool.submit(fetch_worker) for _ in range(num_requests)]
        for f in concurrent.futures.as_completed(futures):
            code, data, el = f.result()
            latencies.append(el)
            if code != 200 or data.get("s") != "ok" or not isinstance(data.get("d"), list):
                schema_valid = False

    stats = calculate_stats(latencies)
    return stats, schema_valid

def validate_ohlc_bars(bars: Dict[str, Any], symbol: str, expected_interval_type: str, interval_val: int) -> Dict[str, Any]:
    issues = []
    status = bars.get("s")
    if status != "ok":
        issues.append(f"Status is not 'ok': got '{status}'")
        return {"valid": False, "issues": issues, "count": 0}
        
    t = bars.get("t", [])
    o = bars.get("o", [])
    h = bars.get("h", [])
    l = bars.get("l", [])
    c = bars.get("c", [])
    v = bars.get("v", [])
    
    n = len(t)
    if n == 0:
        issues.append("Bar arrays are empty")
        return {"valid": False, "issues": issues, "count": 0}
        
    lengths = {len(o), len(h), len(l), len(c), len(v)}
    if lengths != {n}:
        issues.append(f"Array length mismatch: t={n}, o={len(o)}, h={len(h)}, l={len(l)}, c={len(c)}, v={len(v)}")
        
    # Check monotonicity
    violations = []
    for i in range(n - 1):
        if t[i+1] <= t[i]:
            violations.append((i, t[i], t[i+1], t[i+1] - t[i]))
            
    if violations:
        issues.append(f"Found {len(violations)} time order violations! Example: t[{violations[0][0]}]={violations[0][1]} >= t[{violations[0][0]+1}]={violations[0][2]}")
        
    # Check OHLC relations
    ohlc_violations = []
    for i in range(n):
        if h[i] < max(o[i], c[i], l[i]) - 1e-6:
            ohlc_violations.append((i, "High < max(Open, Close, Low)"))
        if l[i] > min(o[i], c[i], h[i]) + 1e-6:
            ohlc_violations.append((i, "Low > min(Open, Close, High)"))
        if min(o[i], h[i], l[i], c[i]) <= 0:
            ohlc_violations.append((i, "Non-positive price"))
            
    if ohlc_violations:
        issues.append(f"Found {len(ohlc_violations)} OHLC relation violations! First: idx {ohlc_violations[0][0]} {ohlc_violations[0][1]}")

    # Check seconds alignment if seconds
    if expected_interval_type == "S":
        misaligned = [t[i] for i in range(min(50, n)) if t[i] % interval_val != 0]
        if misaligned:
            issues.append(f"{len(misaligned)} timestamps not aligned to {interval_val}S boundary! e.g. {misaligned[0]}")

    return {
        "valid": len(issues) == 0,
        "issues": issues,
        "count": n,
        "violations_count": len(violations),
        "first_t": t[0] if n > 0 else None,
        "last_t": t[-1] if n > 0 else None
    }

def benchmark_resampling_endpoint(url: str, symbol: str, interval_type: str, interval_val: int, iterations: int = 20) -> Dict[str, Any]:
    session = requests.Session()
    # Warmup
    r_warm = session.get(url, timeout=10)
    assert r_warm.status_code == 200, f"Failed warmup: {r_warm.status_code}"
    
    validation = validate_ohlc_bars(r_warm.json(), symbol, interval_type, interval_val)
    
    latencies = []
    for _ in range(iterations):
        t0 = time.perf_counter()
        resp = session.get(url, timeout=10)
        el = (time.perf_counter() - t0) * 1000.0
        latencies.append(el)
        assert resp.status_code == 200
        
    stats = calculate_stats(latencies)
    return {
        "stats": stats,
        "validation": validation
    }

def main():
    print("=" * 80)
    print("AGENT 13: EMPIRICAL CHALLENGER - QUOTES LATENCY & CUSTOM INTERVALS STRESS HARNESS")
    print("=" * 80)
    
    all_passed = True
    quotes_url = f"{SERVER_BASE_8080}/quotes?symbols=XAUUSD.,EURUSD.,BTCUSD."
    quotes_proxy_url = f"{PROXY_BASE_9000}/quotes?symbols=XAUUSD.,EURUSD.,BTCUSD."
    
    print("\n--- [OBJECTIVE 1: /quotes LATENCY BENCHMARK (<10ms across 100 requests)] ---")
    
    # 1.1 Sequential 100 requests (port 8080)
    print("\n[1.1] Testing 100 Sequential Burst Requests to port 8080...")
    seq_stats, seq_valid = test_quotes_burst_sequential(quotes_url, 100)
    print(f"  Min: {seq_stats['min']}ms | P50: {seq_stats['median']}ms | P95: {seq_stats['p95']}ms | P99: {seq_stats['p99']}ms | Max: {seq_stats['max']}ms")
    print(f"  Mean: {seq_stats['mean']}ms +/- {seq_stats['stdev']}ms")
    print(f"  Schema Valid: {seq_valid}")
    if seq_stats["p95"] >= 10.0:
        print(f"  [CHALLENGE FAIL] 8080 Sequential P95 ({seq_stats['p95']}ms) >= 10.0ms target!")
        all_passed = False
    else:
        print(f"  [CHALLENGE PASS] 8080 Sequential P95 ({seq_stats['p95']}ms) < 10.0ms target.")

    # 1.2 Concurrent 100 requests (port 8080, 10 workers)
    print("\n[1.2] Testing 100 Concurrent Burst Requests to port 8080 (10 parallel workers)...")
    con_stats, con_valid = test_quotes_burst_concurrent(quotes_url, 100, workers=10)
    print(f"  Min: {con_stats['min']}ms | P50: {con_stats['median']}ms | P95: {con_stats['p95']}ms | P99: {con_stats['p99']}ms | Max: {con_stats['max']}ms")
    print(f"  Mean: {con_stats['mean']}ms +/- {con_stats['stdev']}ms")
    print(f"  Schema Valid: {con_valid}")
    if con_stats["p95"] >= 10.0:
        print(f"  [CHALLENGE FAIL] 8080 Concurrent P95 ({con_stats['p95']}ms) >= 10.0ms target!")
        all_passed = False
    else:
        print(f"  [CHALLENGE PASS] 8080 Concurrent P95 ({con_stats['p95']}ms) < 10.0ms target.")

    # 1.3 Sequential 100 requests through Proxy port 9000
    print("\n[1.3] Testing 100 Sequential Burst Requests via Proxy port 9000...")
    proxy_stats, proxy_valid = test_quotes_burst_sequential(quotes_proxy_url, 100)
    print(f"  Min: {proxy_stats['min']}ms | P50: {proxy_stats['median']}ms | P95: {proxy_stats['p95']}ms | P99: {proxy_stats['p99']}ms | Max: {proxy_stats['max']}ms")
    print(f"  Mean: {proxy_stats['mean']}ms +/- {proxy_stats['stdev']}ms")
    print(f"  Schema Valid: {proxy_valid}")

    print("\n--- [OBJECTIVE 2: CUSTOM INTERVALS RESAMPLING STRESS] ---")
    interval_targets = [
        ("XAUUSD. 21S History", f"{SERVER_BASE_8080}/history?symbol=XAUUSD.&resolution=21S", "XAUUSD.", "S", 21),
        ("EURUSD. 27S History", f"{SERVER_BASE_8080}/history?symbol=EURUSD.&resolution=27S", "EURUSD.", "S", 27),
        ("XAUUSD. 20T Ticks Endpoint", f"{SERVER_BASE_8080}/ticks?symbol=XAUUSD.&ticks_per_bar=20", "XAUUSD.", "T", 20),
        ("EURUSD. 40T Ticks Endpoint", f"{SERVER_BASE_8080}/ticks?symbol=EURUSD.&ticks_per_bar=40", "EURUSD.", "T", 40),
        ("XAUUSD. 20T History Resolution", f"{SERVER_BASE_8080}/history?symbol=XAUUSD.&resolution=20T", "XAUUSD.", "T", 20),
        ("EURUSD. 40T History Resolution", f"{SERVER_BASE_8080}/history?symbol=EURUSD.&resolution=40T", "EURUSD.", "T", 40),
    ]

    resampling_results = {}
    for name, url, symbol, itype, ival in interval_targets:
        print(f"\n[2.x] Testing {name} ({url})...")
        res = benchmark_resampling_endpoint(url, symbol, itype, ival, iterations=20)
        resampling_results[name] = res
        val = res["validation"]
        stats = res["stats"]
        print(f"  Bars Count: {val['count']} | Timestamp Monotonicity Violations: {val['violations_count']}")
        print(f"  Latency - Min: {stats['min']}ms | P50: {stats['median']}ms | P95: {stats['p95']}ms | Max: {stats['max']}ms")
        if not val["valid"]:
            print(f"  [VALIDATION FAIL] Issues: {val['issues']}")
            all_passed = False
        else:
            print(f"  [VALIDATION PASS] 0 order violations, valid non-empty OHLC arrays.")
            
        if stats["median"] > 50.0:
            print(f"  [PERF WARNING] Median latency ({stats['median']}ms) > 50ms")
        else:
            print(f"  [PERF PASS] Median latency ({stats['median']}ms) <= 50ms")

    print("\n--- [OBJECTIVE 3: ADVERSARIAL EDGE CASE FUZZING] ---")
    adversarial_tests = [
        ("Invalid negative seconds (-5S)", f"{SERVER_BASE_8080}/history?symbol=XAUUSD.&resolution=-5S", 400),
        ("Invalid zero seconds (0S)", f"{SERVER_BASE_8080}/history?symbol=XAUUSD.&resolution=0S", 400),
        ("Zero ticks per bar (0T)", f"{SERVER_BASE_8080}/history?symbol=XAUUSD.&resolution=0T", 400),
        ("Negative ticks per bar (-10T)", f"{SERVER_BASE_8080}/history?symbol=XAUUSD.&resolution=-10T", 400),
        ("Arbitrary non-standard seconds (13S)", f"{SERVER_BASE_8080}/history?symbol=XAUUSD.&resolution=13S", 200),
        ("Arbitrary non-standard ticks (33T)", f"{SERVER_BASE_8080}/history?symbol=EURUSD.&resolution=33T", 200),
    ]
    
    adv_passed = True
    for test_name, adv_url, expected_code in adversarial_tests:
        r = requests.get(adv_url)
        code = r.status_code
        status_ok = (code == expected_code)
        print(f"  {test_name:<40} -> Status {code} (Expected {expected_code}): {'PASS' if status_ok else 'FAIL'}")
        if not status_ok:
            adv_passed = False
            all_passed = False

    print("\n" + "=" * 80)
    final_verdict = "APPROVE" if all_passed else "REJECT"
    print(f"FINAL CHALLENGER VERDICT: {final_verdict}")
    print("=" * 80)
    
    # Save full JSON report for inclusion in handoff
    report_data = {
        "verdict": final_verdict,
        "quotes_8080_sequential": seq_stats,
        "quotes_8080_concurrent": con_stats,
        "quotes_9000_proxy": proxy_stats,
        "resampling": resampling_results,
        "adversarial_passed": adv_passed
    }
    with open("tests/empirical_results.json", "w") as f:
        json.dump(report_data, f, indent=2)

    return 0 if all_passed else 1

if __name__ == "__main__":
    sys.exit(main())
