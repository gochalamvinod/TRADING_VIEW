"""
High-Performance 1,000 Orders Stress Test for TradingView + MT5 Unified Platform
Executes 1,000 live order operations against the demo account via http://127.0.0.1:9000
Pipelines in batches of 25 orders to stay within the broker's 300 max pending orders limit.
Measures latency, retcodes, throughput, and guarantees zero leftover open orders.
"""

import os
import sys
import time
import json
import statistics
from curl_cffi import requests

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

BASE_URL = "http://127.0.0.1:9000"
TOTAL_TARGET = 1000
BATCH_SIZE = 25
NUM_BATCHES = TOTAL_TARGET // BATCH_SIZE

def log(msg):
    now_str = time.strftime("%H:%M:%S")
    print(f"[{now_str}] {msg}", flush=True)

def main():
    print("=" * 75)
    print(f"  STARTING 1,000 ORDERS STRESS TEST ON METATRADER 5 DEMO ACCOUNT")
    print(f"  Target: {TOTAL_TARGET} Placed + {TOTAL_TARGET} Cancelled = 2,000 Order Operations")
    print(f"  Batch Size: {BATCH_SIZE} orders/batch across {NUM_BATCHES} batches")
    print(f"  Target URL: {BASE_URL}")
    print("=" * 75, flush=True)

    session = requests.Session()

    # Pre-check account
    acc = session.get(f"{BASE_URL}/trade/account").json()
    log(f"Account: #{acc.get('login')} ({acc.get('company')}) | Balance: {acc.get('balance')} {acc.get('currency')} | Equity: {acc.get('equity')}")
    log(f"Max broker pending limit: {acc.get('limit_orders')} orders")

    # Clean existing
    for p in session.get(f"{BASE_URL}/trade/positions").json():
        session.post(f"{BASE_URL}/trade/close", json={"ticket": p["ticket"]})
    for o in session.get(f"{BASE_URL}/trade/orders").json():
        session.post(f"{BASE_URL}/trade/close", json={"ticket": o["ticket"]})

    q = session.get(f"{BASE_URL}/quotes?symbols=XAUUSD.").json()
    current_bid = float(q["d"][0]["v"]["bid"])
    log(f"Initial XAUUSD. Bid: {current_bid:.2f}")

    all_latencies_ms = []
    successful_orders = 0
    failed_orders = 0
    total_cancelled = 0
    order_records = []

    global_start_time = time.perf_counter()

    for batch_idx in range(1, NUM_BATCHES + 1):
        batch_start = time.perf_counter()
        batch_tickets = []

        # Place BATCH_SIZE orders
        for item_idx in range(BATCH_SIZE):
            order_num = (batch_idx - 1) * BATCH_SIZE + item_idx + 1
            # Place well below market so it never accidentally fills
            offset = 100.0 + (item_idx * 0.5)
            price = round(current_bid - offset, 2)

            t0 = time.perf_counter()
            try:
                r = session.post(f"{BASE_URL}/trade/pending", json={
                    "symbol": "XAUUSD.",
                    "order_type": "BUY_LIMIT",
                    "volume": 0.01,
                    "price": price,
                    "comment": f"Stress #{order_num}"
                }, timeout=10)
                t1 = time.perf_counter()
                lat_ms = (t1 - t0) * 1000.0
                all_latencies_ms.append(lat_ms)

                res = r.json()
                if res.get("success") and res.get("retcode") == 10009:
                    successful_orders += 1
                    tkt = res.get("order")
                    batch_tickets.append(tkt)
                    order_records.append({
                        "order_num": order_num,
                        "ticket": tkt,
                        "retcode": 10009,
                        "latency_ms": round(lat_ms, 2),
                        "status": "DONE"
                    })
                else:
                    failed_orders += 1
                    log(f"  [WARN] Order #{order_num} failed: {res}")
            except Exception as e:
                failed_orders += 1
                log(f"  [ERR] Order #{order_num} exception: {e}")

        # Immediately cancel batch to free slots
        for tkt in batch_tickets:
            try:
                rc = session.post(f"{BASE_URL}/trade/close", json={"ticket": tkt}, timeout=10)
                if rc.json().get("success"):
                    total_cancelled += 1
            except Exception:
                pass

        batch_end = time.perf_counter()
        batch_duration = batch_end - batch_start
        placed_so_far = batch_idx * BATCH_SIZE
        ops_rate = BATCH_SIZE / batch_duration if batch_duration > 0 else 0

        # Progress update every 2 batches (50 orders)
        if batch_idx % 2 == 0 or batch_idx == NUM_BATCHES:
            elapsed = time.perf_counter() - global_start_time
            avg_lat = statistics.mean(all_latencies_ms) if all_latencies_ms else 0
            log(f"Progress: [{placed_so_far:4d}/{TOTAL_TARGET}] orders placed & cancelled | Elapsed: {elapsed:.1f}s | Batch Rate: {ops_rate:.1f} orders/s | Avg Lat: {avg_lat:.1f}ms")

    global_end_time = time.perf_counter()
    total_elapsed = global_end_time - global_start_time

    # Final Account State Verification
    final_pos = session.get(f"{BASE_URL}/trade/positions").json()
    final_orders = session.get(f"{BASE_URL}/trade/orders").json()
    final_acc = session.get(f"{BASE_URL}/trade/account").json()

    # Latency Stats
    mean_lat = statistics.mean(all_latencies_ms) if all_latencies_ms else 0
    median_lat = statistics.median(all_latencies_ms) if all_latencies_ms else 0
    sorted_lat = sorted(all_latencies_ms) if all_latencies_ms else []
    p90 = sorted_lat[int(len(sorted_lat) * 0.90)] if sorted_lat else 0
    p95 = sorted_lat[int(len(sorted_lat) * 0.95)] if sorted_lat else 0
    p99 = sorted_lat[int(len(sorted_lat) * 0.99)] if sorted_lat else 0
    min_lat = min(all_latencies_ms) if all_latencies_ms else 0
    max_lat = max(all_latencies_ms) if all_latencies_ms else 0
    tps = successful_orders / total_elapsed if total_elapsed > 0 else 0

    print("\n" + "=" * 75)
    print("  1,000 ORDERS STRESS TEST BENCHMARK RESULTS")
    print("=" * 75)
    print(f"  Target Placed:         {TOTAL_TARGET}")
    print(f"  Successfully Placed:   {successful_orders} ({successful_orders/TOTAL_TARGET*100:.1f}%)")
    print(f"  Successfully Cancelled:{total_cancelled} ({total_cancelled/TOTAL_TARGET*100:.1f}%)")
    print(f"  Failed Placements:     {failed_orders}")
    print(f"  Total Wall Time:       {total_elapsed:.2f} seconds ({total_elapsed/60:.2f} minutes)")
    print(f"  Overall Throughput:    {tps:.2f} orders/second (placement only)")
    print(f"  Effective Operations:  {(successful_orders + total_cancelled)/total_elapsed:.2f} total operations/second")
    print("---------------------------------------------------------------------------")
    print("  LATENCY DISTRIBUTION (Per Order IPC + Remote Broker Network):")
    print(f"    Min Latency:         {min_lat:.2f} ms")
    print(f"    Median Latency (P50):{median_lat:.2f} ms")
    print(f"    Mean Latency:        {mean_lat:.2f} ms")
    print(f"    P90 Latency:         {p90:.2f} ms")
    print(f"    P95 Latency:         {p95:.2f} ms")
    print(f"    P99 Latency:         {p99:.2f} ms")
    print(f"    Max Latency:         {max_lat:.2f} ms")
    print("---------------------------------------------------------------------------")
    print("  FINAL DEMO ACCOUNT STATE:")
    print(f"    Active Positions:    {len(final_pos)} (Target: 0)")
    print(f"    Active Orders:       {len(final_orders)} (Target: 0)")
    print(f"    Ending Balance:      {final_acc.get('balance')} {final_acc.get('currency')}")
    print(f"    Ending Equity:       {final_acc.get('equity')} {final_acc.get('currency')}")
    print("=" * 75)

    results_data = {
        "timestamp": time.time(),
        "total_target": TOTAL_TARGET,
        "successful_placed": successful_orders,
        "successful_cancelled": total_cancelled,
        "failed_orders": failed_orders,
        "success_rate_pct": round(successful_orders / TOTAL_TARGET * 100, 2),
        "total_elapsed_seconds": round(total_elapsed, 2),
        "throughput_ops": round(tps, 2),
        "latency_ms": {
            "min": round(min_lat, 2),
            "median": round(median_lat, 2),
            "mean": round(mean_lat, 2),
            "p90": round(p90, 2),
            "p95": round(p95, 2),
            "p99": round(p99, 2),
            "max": round(max_lat, 2)
        },
        "final_positions": len(final_pos),
        "final_orders": len(final_orders)
    }

    results_file = os.path.join(os.path.dirname(__file__), "1000_orders_benchmark_results.json")
    with open(results_file, "w") as f:
        json.dump(results_data, f, indent=2)
    log(f"Results saved to {results_file}")

    if successful_orders == TOTAL_TARGET and len(final_pos) == 0 and len(final_orders) == 0:
        print("\n✅ 1,000 ORDERS STRESS TEST PASSED WITH 100% SUCCESS AND ZERO LEFTOVER ORDERS!\n")
        return True
    else:
        print("\n⚠️ 1,000 ORDERS STRESS TEST COMPLETED WITH SOME WARNINGS OR RESIDUALS.\n")
        return False

if __name__ == "__main__":
    ok = main()
    sys.exit(0 if ok else 1)
