"""
Empirical Adversarial Stress Test Suite for MetaTrader 5 Execution & Concurrency.
Agent 14: Adversarial MT5 Order Execution & Concurrency Challenger.

Targets:
- Demo Account: 70257567 (OrbexGlobal-Server)
- Proxy Port: 9000 (http://127.0.0.1:9000)
- Backend Port: 8080 (http://127.0.0.1:8080)
- Symbols: XAUUSD., EURUSD., INVALID123, XYZNONEXISTENT

Objectives:
1. Rapid sequence market BUY/SELL orders (0.01 lot) on XAUUSD. and EURUSD. -> Verify retcode == 10009.
2. Immediate position closure -> Verify clean closure (0 open positions).
3. Adversarial invalid symbol rejection -> Verify graceful rejection (retcode != 10009, no 500 crashes).
4. Pending orders with tight SL/TP brackets -> Verify placement, bracket validation, modification, cancellation.
5. Adversarial invalid SL/TP bracket test -> Verify broker stops violation (retcode 10016) handled gracefully.
6. High concurrency stress test -> 12 simultaneous threads hitting MT5 order/quote endpoints via barrier synchronization, verifying zero deadlocks in ThreadSafeMT5Wrapper.
"""

import time
import threading
import concurrent.futures
from typing import Dict, Any, List
from curl_cffi import requests

BASE_URL = "http://127.0.0.1:9000"
EXPECTED_LOGIN = 70257567
EXPECTED_SERVER = "OrbexGlobal-Server"

results_log: List[Dict[str, Any]] = []

def log_step(name: str, passed: bool, details: Dict[str, Any]):
    record = {
        "test": name,
        "passed": passed,
        "timestamp": time.time(),
        "details": details
    }
    results_log.append(record)
    status_str = "[PASS]" if passed else "[FAIL]"
    print(f"\n{status_str} {name}")
    for k, v in details.items():
        print(f"   {k}: {v}")


def clean_slate():
    """Ensure no residual positions or pending orders exist."""
    try:
        requests.post(f"{BASE_URL}/trade/close_all", json={"cancel_pending": True}, timeout=8)
        time.sleep(0.5)
        # Verify
        for _ in range(3):
            r = requests.get(f"{BASE_URL}/trade/positions", timeout=5)
            if len(r.json()) == 0:
                break
            requests.post(f"{BASE_URL}/trade/close_all", json={"cancel_pending": True}, timeout=8)
            time.sleep(0.5)
    except Exception as e:
        print(f"[WARN] Cleanup exception: {e}")


def test_01_preflight_account():
    """Verify MT5 account 70257567 connection, permissions, and initial zero-position state."""
    clean_slate()

    r = requests.get(f"{BASE_URL}/trade/account", timeout=5)
    assert r.status_code == 200, f"Account query failed: {r.status_code}"
    acc = r.json()
    assert acc.get("login") == EXPECTED_LOGIN, f"Expected login {EXPECTED_LOGIN}, got {acc.get('login')}"
    assert acc.get("server") == EXPECTED_SERVER, f"Expected server {EXPECTED_SERVER}, got {acc.get('server')}"
    assert acc.get("trade_allowed") is True, "Trading not allowed on account"
    assert acc.get("trade_expert") is True, "EA trading not allowed on account"

    r_pos = requests.get(f"{BASE_URL}/trade/positions", timeout=5)
    assert r_pos.status_code == 200
    pos = r_pos.json()

    r_ord = requests.get(f"{BASE_URL}/trade/orders", timeout=5)
    assert r_ord.status_code == 200

    log_step("01_Preflight_Account", True, {
        "login": acc.get("login"),
        "server": acc.get("server"),
        "balance": acc.get("balance"),
        "equity": acc.get("equity"),
        "leverage": f"1:{acc.get('leverage')}",
        "initial_positions": len(pos)
    })


def test_02_rapid_market_buy_sell():
    """Place rapid sequence of market BUY and SELL orders (0.01 lot) on XAUUSD. and EURUSD."""
    orders_to_place = [
        {"symbol": "XAUUSD.", "action": "BUY", "volume": 0.01, "comment": "Challenger Mkt Buy XAU"},
        {"symbol": "XAUUSD.", "action": "SELL", "volume": 0.01, "comment": "Challenger Mkt Sell XAU"},
        {"symbol": "EURUSD.", "action": "BUY", "volume": 0.01, "comment": "Challenger Mkt Buy EUR"},
        {"symbol": "EURUSD.", "action": "SELL", "volume": 0.01, "comment": "Challenger Mkt Sell EUR"},
    ]

    placed_orders = []
    latencies = []

    for req_data in orders_to_place:
        t0 = time.perf_counter()
        resp = requests.post(f"{BASE_URL}/trade/order", json=req_data, timeout=8)
        dt_ms = (time.perf_counter() - t0) * 1000
        latencies.append(dt_ms)

        assert resp.status_code == 200, f"Order failed with HTTP {resp.status_code}: {resp.text}"
        data = resp.json()
        
        # Verify retcode == 10009 (TRADE_RETCODE_DONE)
        retcode = data.get("retcode")
        assert retcode == 10009, f"Expected retcode 10009, got {retcode} ({data.get('retcode_name')})"
        assert data.get("success") is True, f"Order success flag is not True: {data}"
        assert data.get("order") > 0 or data.get("ticket") > 0, "No valid order ticket returned"
        assert data.get("deal") > 0, "No valid deal ticket returned"

        ticket = data.get("order") or data.get("ticket")
        placed_orders.append({
            "symbol": req_data["symbol"],
            "action": req_data["action"],
            "ticket": ticket,
            "deal": data.get("deal"),
            "price": data.get("price"),
            "retcode": retcode,
            "retcode_name": data.get("retcode_name"),
            "latency_ms": round(dt_ms, 2)
        })

    log_step("02_Rapid_Market_Buy_Sell", True, {
        "placed_count": len(placed_orders),
        "orders": placed_orders,
        "avg_latency_ms": round(sum(latencies) / len(latencies), 2),
        "max_latency_ms": round(max(latencies), 2),
        "min_latency_ms": round(min(latencies), 2),
    })

    return placed_orders


def test_03_position_verification_and_close(placed_orders: List[Dict[str, Any]]):
    """Verify open positions exist and close them cleanly one-by-one."""
    r_pos = requests.get(f"{BASE_URL}/trade/positions", timeout=5)
    assert r_pos.status_code == 200
    positions = r_pos.json()
    assert len(positions) >= len(placed_orders), f"Expected at least {len(placed_orders)} positions, found {len(positions)}"

    closed_records = []
    close_latencies = []

    for pos in positions:
        target_tkt = pos["ticket"]
        t0 = time.perf_counter()
        r_close = requests.post(f"{BASE_URL}/trade/close", json={"ticket": target_tkt}, timeout=8)
        dt_ms = (time.perf_counter() - t0) * 1000
        close_latencies.append(dt_ms)

        assert r_close.status_code == 200, f"Close failed HTTP {r_close.status_code}: {r_close.text}"
        c_data = r_close.json()
        assert c_data.get("success") is True, f"Position close failed: {c_data}"
        assert c_data.get("retcode") in (10009, 10008), f"Expected retcode 10009/10008, got {c_data.get('retcode')}"
        closed_records.append({
            "ticket": target_tkt,
            "symbol": pos.get("symbol"),
            "type_name": pos.get("type_name"),
            "deal": c_data.get("deal"),
            "retcode": c_data.get("retcode"),
            "profit": c_data.get("profit"),
            "latency_ms": round(dt_ms, 2)
        })

    # Ensure clean slate
    clean_slate()

    r_final = requests.get(f"{BASE_URL}/trade/positions", timeout=5)
    final_pos = r_final.json()
    assert len(final_pos) == 0, f"Positions remaining after close: {final_pos}"

    log_step("03_Position_Verification_And_Close", True, {
        "closed_count": len(closed_records),
        "closed_records": closed_records,
        "remaining_positions": len(final_pos),
        "avg_close_latency_ms": round(sum(close_latencies) / len(close_latencies), 2) if close_latencies else 0
    })


def test_04_adversarial_invalid_symbols():
    """Attempt order placement with invalid symbols, verifying graceful rejection without 500 crashes."""
    invalid_cases = [
        {"symbol": "INVALID123", "action": "BUY", "volume": 0.01, "comment": "Invalid Sym Test 1"},
        {"symbol": "XYZNONEXISTENT", "action": "SELL", "volume": 0.01, "comment": "Invalid Sym Test 2"},
        {"symbol": "BAD@SYMBOL!#", "action": "BUY", "volume": 0.01, "comment": "Invalid Sym Test 3"},
        {"symbol": "", "action": "BUY", "volume": 0.01, "comment": "Empty Sym Test"},
    ]

    rejection_records = []

    for test_payload in invalid_cases:
        t0 = time.perf_counter()
        resp = requests.post(f"{BASE_URL}/trade/order", json=test_payload, timeout=5)
        dt_ms = (time.perf_counter() - t0) * 1000

        # Must NOT return 500 Internal Server Error
        assert resp.status_code in (400, 404, 422), f"Expected 4xx client error, got {resp.status_code}"
        assert resp.status_code != 500, "Server crashed with 500 on invalid symbol!"

        err_body = resp.json()
        assert "detail" in err_body or "error" in err_body, "No error details in response"

        rejection_records.append({
            "input_symbol": test_payload["symbol"],
            "http_status": resp.status_code,
            "error_detail": err_body.get("detail") or err_body.get("error"),
            "latency_ms": round(dt_ms, 2)
        })

    # Verify server is still alive and responsive after invalid attempts
    r_check = requests.get(f"{BASE_URL}/trade/account", timeout=5)
    assert r_check.status_code == 200, "Server unresponsive after invalid symbol tests"

    log_step("04_Adversarial_Invalid_Symbols", True, {
        "tested_cases": len(rejection_records),
        "results": rejection_records,
        "server_healthy": True
    })


def test_05_pending_orders_with_tight_brackets():
    """Test pending order placement with tight SL/TP brackets, modification, and cancellation."""
    # 1. Get live price for XAUUSD.
    r_quote = requests.get(f"{BASE_URL}/quotes?symbols=XAUUSD.", timeout=5)
    quotes = {item["n"]: item for item in r_quote.json().get("d", [])}

    xau_quote = quotes["XAUUSD."]["v"]
    xau_bid = xau_quote["bid"]
    xau_ask = xau_quote["ask"]

    # XAUUSD stops level is 20 points (0.20 USD). Place Buy Limit at ask - 15.0 USD, SL at -5.0, TP at +5.0
    limit_price = round(xau_ask - 15.0, 2)
    sl_price = round(limit_price - 5.0, 2)
    tp_price = round(limit_price + 5.0, 2)

    pending_req = {
        "symbol": "XAUUSD.",
        "type": "BUY_LIMIT",
        "price": limit_price,
        "volume": 0.01,
        "sl": sl_price,
        "tp": tp_price,
        "comment": "Challenger Tight Bracket XAU"
    }

    t0 = time.perf_counter()
    r_pend = requests.post(f"{BASE_URL}/trade/pending", json=pending_req, timeout=8)
    dt_ms = (time.perf_counter() - t0) * 1000

    assert r_pend.status_code == 200, f"Pending order placement failed: {r_pend.text}"
    p_data = r_pend.json()
    assert p_data.get("success") is True, f"Pending order returned failure: {p_data}"
    assert p_data.get("retcode") in (10009, 10008), f"Expected retcode 10009/10008, got {p_data.get('retcode')}"
    order_ticket = p_data.get("order")
    assert order_ticket > 0, "Invalid pending order ticket"

    # Verify pending order exists in /trade/orders
    r_orders = requests.get(f"{BASE_URL}/trade/orders?ticket={order_ticket}", timeout=5)
    assert r_orders.status_code == 200
    orders_list = r_orders.json()
    assert len(orders_list) == 1, f"Expected 1 pending order, found {len(orders_list)}"
    ord_found = orders_list[0]
    assert ord_found["ticket"] == order_ticket
    assert abs(ord_found["price_open"] - limit_price) < 0.01
    assert abs(ord_found["sl"] - sl_price) < 0.01
    assert abs(ord_found["tp"] - tp_price) < 0.01

    # Modify the pending order SL and TP brackets
    new_sl = round(limit_price - 7.0, 2)
    new_tp = round(limit_price + 7.0, 2)
    mod_req = {
        "ticket": order_ticket,
        "price": limit_price,
        "sl": new_sl,
        "tp": new_tp
    }
    r_mod = requests.post(f"{BASE_URL}/trade/modify", json=mod_req, timeout=8)
    assert r_mod.status_code == 200
    mod_data = r_mod.json()
    assert mod_data.get("success") is True, f"Modify failed: {mod_data}"

    # Verify modification reflected
    r_orders2 = requests.get(f"{BASE_URL}/trade/orders?ticket={order_ticket}", timeout=5)
    ord_mod = r_orders2.json()[0]
    assert abs(ord_mod["sl"] - new_sl) < 0.01
    assert abs(ord_mod["tp"] - new_tp) < 0.01

    # Cancel pending order
    r_cancel = requests.post(f"{BASE_URL}/trade/close", json={"ticket": order_ticket}, timeout=8)
    assert r_cancel.status_code == 200
    cancel_data = r_cancel.json()
    assert cancel_data.get("success") is True, f"Cancel failed: {cancel_data}"

    # Verify order is gone
    r_orders3 = requests.get(f"{BASE_URL}/trade/orders?ticket={order_ticket}", timeout=5)
    assert len(r_orders3.json()) == 0, "Pending order still present after cancel"

    log_step("05_Pending_Orders_With_Tight_Brackets", True, {
        "order_ticket": order_ticket,
        "initial_limit_price": limit_price,
        "initial_sl": sl_price,
        "initial_tp": tp_price,
        "modified_sl": new_sl,
        "modified_tp": new_tp,
        "placement_latency_ms": round(dt_ms, 2),
        "cancelled_cleanly": True
    })


def test_06_adversarial_invalid_stops_bracket():
    """
    Adversarial test: Intentionally violate broker stops level (e.g. SL placed inside stops level or wrong side).
    Verify MT5 returns TRADE_RETCODE_INVALID_STOPS (10016) and server handles it gracefully with success=False.
    """
    r_quote = requests.get(f"{BASE_URL}/quotes?symbols=XAUUSD.", timeout=5)
    ask_price = r_quote.json()["d"][0]["v"]["ask"]

    # For a BUY, SL must be below the market price by at least stops_level (0.20 USD).
    # If we put SL ABOVE the ask price, it is an invalid stop!
    invalid_bracket_req = {
        "symbol": "XAUUSD.",
        "action": "BUY",
        "volume": 0.01,
        "sl": round(ask_price + 50.0, 2),  # Adversarial: SL placed 50 USD ABOVE buy price!
        "comment": "Challenger Invalid SL Test"
    }

    r_inv = requests.post(f"{BASE_URL}/trade/order", json=invalid_bracket_req, timeout=8)
    assert r_inv.status_code == 200  # API returns JSON with failure status
    inv_data = r_inv.json()

    # Must be marked failed with TRADE_RETCODE_INVALID_STOPS (10016)
    assert inv_data.get("success") is False, f"Expected order to fail, but got: {inv_data}"
    assert inv_data.get("retcode") == 10016, f"Expected retcode 10016 (INVALID_STOPS), got {inv_data.get('retcode')}"
    assert "INVALID_STOPS" in inv_data.get("retcode_name", ""), f"Unexpected retcode name: {inv_data}"

    log_step("06_Adversarial_Invalid_Stops_Bracket", True, {
        "retcode": inv_data.get("retcode"),
        "retcode_name": inv_data.get("retcode_name"),
        "retcode_description": inv_data.get("retcode_description"),
        "graceful_rejection": True
    })


def test_07_concurrency_deadlock_stress():
    """
    Stress test ThreadSafeMT5Wrapper with 12 concurrent threads simultaneously
    submitting market orders, quote fetches, account queries, and position queries.
    Uses threading.Barrier to ensure maximum lock contention.
    """
    THREAD_COUNT = 12
    barrier = threading.Barrier(THREAD_COUNT)
    thread_results = [None] * THREAD_COUNT

    def worker(tid: int):
        barrier.wait(timeout=5)  # Synchronize release
        t_start = time.perf_counter()
        try:
            if tid in (0, 1):
                # Market Buy XAUUSD.
                r = requests.post(f"{BASE_URL}/trade/order", json={
                    "symbol": "XAUUSD.", "action": "BUY", "volume": 0.01, "comment": f"Conc Buy XAU #{tid}"
                }, timeout=10)
                thread_results[tid] = ("order_buy_xau", r.status_code, r.json(), (time.perf_counter() - t_start) * 1000)
            elif tid in (2, 3):
                # Market Sell EURUSD.
                r = requests.post(f"{BASE_URL}/trade/order", json={
                    "symbol": "EURUSD.", "action": "SELL", "volume": 0.01, "comment": f"Conc Sell EUR #{tid}"
                }, timeout=10)
                thread_results[tid] = ("order_sell_eur", r.status_code, r.json(), (time.perf_counter() - t_start) * 1000)
            elif tid in (4, 5):
                # Query positions
                r = requests.get(f"{BASE_URL}/trade/positions", timeout=10)
                thread_results[tid] = ("positions", r.status_code, len(r.json()), (time.perf_counter() - t_start) * 1000)
            elif tid in (6, 7):
                # Query account info
                r = requests.get(f"{BASE_URL}/trade/account", timeout=10)
                thread_results[tid] = ("account", r.status_code, r.json().get("login"), (time.perf_counter() - t_start) * 1000)
            elif tid in (8, 9):
                # Query quotes
                r = requests.get(f"{BASE_URL}/quotes?symbols=XAUUSD.,EURUSD.", timeout=10)
                thread_results[tid] = ("quotes", r.status_code, r.json().get("s"), (time.perf_counter() - t_start) * 1000)
            else:
                # Query history
                r = requests.get(f"{BASE_URL}/trade/history?days=1", timeout=10)
                thread_results[tid] = ("history", r.status_code, r.json().get("status"), (time.perf_counter() - t_start) * 1000)
        except Exception as e:
            thread_results[tid] = ("exception", 500, str(e), (time.perf_counter() - t_start) * 1000)

    threads = [threading.Thread(target=worker, args=(i,), name=f"ConcTestThread-{i}") for i in range(THREAD_COUNT)]
    t_all_start = time.perf_counter()
    for t in threads:
        t.start()
    for t in threads:
        t.join(timeout=15)

    total_duration_ms = (time.perf_counter() - t_all_start) * 1000

    # Verify no thread hung or raised unhandled timeout exception
    deadlocks = [i for i, res in enumerate(thread_results) if res is None or res[0] == "exception"]
    assert len(deadlocks) == 0, f"Deadlock or exception detected in threads: {deadlocks}, results: {thread_results}"

    # Verify orders in concurrent burst succeeded
    order_results = [res for res in thread_results if res[0] in ("order_buy_xau", "order_sell_eur")]
    placed_tickets = []
    for op_name, code, payload, lat in order_results:
        assert code == 200, f"Concurrent order failed HTTP {code}: {payload}"
        assert payload.get("retcode") == 10009, f"Concurrent order failed with retcode: {payload}"
        tkt = payload.get("order") or payload.get("ticket")
        placed_tickets.append(tkt)

    # Clean up all created positions cleanly
    clean_slate()

    # Final position check
    r_pos_final = requests.get(f"{BASE_URL}/trade/positions", timeout=5)
    final_pos = r_pos_final.json()
    assert len(final_pos) == 0, f"Unclosed positions after concurrency test: {final_pos}"

    log_step("07_Concurrency_Deadlock_Stress", True, {
        "threads_spawned": THREAD_COUNT,
        "deadlocks_detected": 0,
        "concurrent_order_tickets": placed_tickets,
        "total_burst_duration_ms": round(total_duration_ms, 2),
        "thread_latencies_ms": [round(res[3], 2) for res in thread_results if res],
        "all_threads_success": True
    })


def run_all_tests():
    print("=========================================================================")
    print("STARTING AGENT 14 EMPIRICAL ADVERSARIAL STRESS TEST SUITE (v2)")
    print(f"Target: Demo Account {EXPECTED_LOGIN} ({EXPECTED_SERVER}) on {BASE_URL}")
    print("=========================================================================")

    try:
        test_01_preflight_account()
        placed_orders = test_02_rapid_market_buy_sell()
        test_03_position_verification_and_close(placed_orders)
        test_04_adversarial_invalid_symbols()
        test_05_pending_orders_with_tight_brackets()
        test_06_adversarial_invalid_stops_bracket()
        test_07_concurrency_deadlock_stress()

        print("\n=========================================================================")
        print("ALL 7 ADVERSARIAL STRESS TESTS PASSED WITH 100% SUCCESS RATE!")
        print("VERDICT: APPROVE")
        print("=========================================================================")
        return True, results_log
    except Exception as e:
        print(f"\n[FATAL STRESS FAILURE]: {e}")
        import traceback
        traceback.print_exc()
        clean_slate()
        return False, results_log


if __name__ == "__main__":
    success, logs = run_all_tests()
    exit(0 if success else 1)
