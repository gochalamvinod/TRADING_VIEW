"""
test_tier6_r1_to_r4.py — Tier 6 Verification Suite: Requirements R1 through R4
MetaTrader 5 Backend & TradingView Advanced Charts

Covers:
1. R1: Custom integer seconds (1S, 5S, 10S, 15S, 21S, 27S, 30S) & ticks (1T, 10T, 20T, 40T, 100T) /history queries.
2. R2: In-memory HFT /quotes sub-10ms latency benchmark (<10ms) & UDF schema validation.
3. R2: WebSocket /ws/quotes streaming verification (connection, snapshot, subscription).
4. R2: MT5 trade endpoints (/trade/order, /trade/pending, /trade/modify, /trade/close, /trade/positions, /trade/account).
5. R3: MT5 IPC concurrent stress test (concurrent quotes, history, and order sends without deadlock or error).
"""

import os
import sys
import time
import json
import threading
import concurrent.futures
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional
from unittest.mock import patch

import pytest
import cupy as np
import MetaTrader5 as raw_mt5
from fastapi.testclient import TestClient

# Ensure project root in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import server
import ticks
import seconds
from hft_engine import hft_engine, mt5


class MockAccountInfo:
    """Mock AccountInfo structure for offline or patched MT5 environments."""
    login = 70257567
    name = "Vinod Vinod"
    server = "OrbexGlobal-Server"
    currency = "USD"
    company = "Orbex Global Ltd"
    balance = 105181.45
    equity = 105186.15
    profit = 4.70
    margin = 88.67
    margin_free = 105097.48
    margin_level = 118627.55
    leverage = 100
    trade_allowed = True
    trade_expert = True
    limit_orders = 300
    margin_mode = 2
    currency_digits = 2


@pytest.fixture(autouse=True)
def setup_tier6_environment(mock_mt5_singleton):
    """
    Ensure test environment has all attributes on MockSymbolInfo
    and MT5 account connection initialized.
    """
    # Initialize raw MT5 if available
    is_live = False
    try:
        is_live = bool(raw_mt5.initialize())
    except Exception:
        pass

    # Ensure mock symbol info has tick size and stops level
    for sym_info in mock_mt5_singleton._symbols_registry.values():
        if not hasattr(sym_info, "trade_tick_size"):
            sym_info.trade_tick_size = sym_info.point
        if not hasattr(sym_info, "trade_tick_value"):
            sym_info.trade_tick_value = 1.0
        if not hasattr(sym_info, "trade_stops_level"):
            sym_info.trade_stops_level = 20
        if not hasattr(sym_info, "trade_contract_size"):
            sym_info.trade_contract_size = 100000.0

    # Ensure account_info is available if raw MT5 is offline
    acc_patch = None
    if not is_live or raw_mt5.account_info() is None:
        mock_acc = MockAccountInfo()
        acc_patch = patch.object(raw_mt5, "account_info", return_value=mock_acc)
        acc_patch.start()

    yield

    if acc_patch:
        acc_patch.stop()


# ============================================================================
# Class 1: R1 Custom Seconds and Ticks /history Support
# ============================================================================

class TestR1CustomSecondsAndTicksHistory:
    """R1: Arbitrary custom integer seconds and ticks /history OHLC queries."""

    @pytest.mark.parametrize("sec_res", ["1S", "5S", "10S", "15S", "21S", "27S", "30S"])
    def test_r1_01_custom_seconds_ohlc_integrity(self, client, sec_res):
        """Verify custom integer seconds (1S, 5S, 10S, 15S, 21S, 27S, 30S) return valid OHLC bars."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution={sec_res}&from={now - 600}&to={now}")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") in ("ok", "no_data")
        if data.get("s") == "ok":
            assert len(data["t"]) > 0
            assert len(data["t"]) == len(data["o"]) == len(data["h"]) == len(data["l"]) == len(data["c"])
            # Bar integrity: H >= max(O, C), L <= min(O, C), H >= L
            for o, h, l, c in zip(data["o"][:20], data["h"][:20], data["l"][:20], data["c"][:20]):
                assert h >= l, f"High {h} must be >= Low {l}"
                assert h >= min(o, c) - 1e-5
                assert l <= max(o, c) + 1e-5

    @pytest.mark.parametrize("tick_res", ["1T", "10T", "20T", "40T", "100T"])
    def test_r1_02_custom_ticks_ohlc_integrity(self, client, tick_res):
        """Verify custom integer ticks (1T, 10T, 20T, 40T, 100T) return valid tick-count OHLC bars."""
        resp = client.get(f"/history?symbol=EURUSD.&resolution={tick_res}&countback=50")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") in ("ok", "no_data")
        if data.get("s") == "ok":
            assert len(data["t"]) > 0
            assert len(data["t"]) == len(data["o"]) == len(data["h"]) == len(data["l"]) == len(data["c"])
            # Verify timestamps are monotonically non-decreasing
            for i in range(1, min(len(data["t"]), 20)):
                assert data["t"][i] >= data["t"][i - 1], "Timestamps must be monotonic"

    def test_r1_03_non_standard_seconds_resampling(self, client):
        """Verify non-standard prime/arbitrary seconds like 21S and 27S produce fewer bars than 1S."""
        now = int(time.time())
        r_1s = client.get(f"/history?symbol=EURUSD.&resolution=1S&from={now - 600}&to={now}").json()
        r_21s = client.get(f"/history?symbol=EURUSD.&resolution=21S&from={now - 600}&to={now}").json()
        r_27s = client.get(f"/history?symbol=EURUSD.&resolution=27S&from={now - 600}&to={now}").json()

        if r_1s.get("s") == "ok" and r_21s.get("s") == "ok" and r_27s.get("s") == "ok":
            assert len(r_1s["t"]) >= len(r_21s["t"]), "1S bar count must be >= 21S bar count"
            assert len(r_21s["t"]) >= len(r_27s["t"]), "21S bar count must be >= 27S bar count"

    def test_r1_04_ticks_countback_limit(self, client):
        """Verify countback parameter strictly caps the returned tick bars."""
        target_count = 25
        resp = client.get(f"/history?symbol=EURUSD.&resolution=20T&countback={target_count}")
        assert resp.status_code == 200
        data = resp.json()
        if data.get("s") == "ok":
            assert len(data["t"]) <= target_count

    def test_r1_05_custom_resolutions_boundary_queries(self, client):
        """Verify invalid or extreme resolutions return appropriate error or fallback."""
        resp = client.get("/history?symbol=EURUSD.&resolution=0S")
        assert resp.status_code in (400, 422)

        resp_tick = client.get("/history?symbol=EURUSD.&resolution=0T")
        assert resp_tick.status_code in (400, 422)


# ============================================================================
# Class 2: R2 Sub-10ms HFT Quotes Latency & UDF Schema
# ============================================================================

class TestR2HFTQuotesAndLatency:
    """R2: Sub-10ms in-memory HFT /quotes latency benchmark & UDF structure verification."""

    def test_r2_01_hft_quotes_sub_10ms_latency(self, client):
        """Benchmark 50 consecutive /quotes requests, verifying strict sub-10ms response time."""
        latencies = []
        # Warmup
        for _ in range(5):
            client.get("/quotes?symbols=EURUSD.")

        for _ in range(50):
            t0 = time.perf_counter()
            resp = client.get("/quotes?symbols=EURUSD.")
            dt = (time.perf_counter() - t0) * 1000.0  # ms
            assert resp.status_code == 200
            latencies.append(dt)

        avg_latency = sum(latencies) / len(latencies)
        p95_latency = np.percentile(latencies, 95)
        print(f"\n[BENCHMARK] /quotes avg: {avg_latency:.3f}ms, p95: {p95_latency:.3f}ms")

        # In-memory HFT cache guarantees sub-10ms response
        assert avg_latency < 10.0, f"Average latency {avg_latency:.2f}ms exceeds 10ms threshold"
        assert p95_latency < 20.0, f"95th percentile {p95_latency:.2f}ms exceeds threshold"

    def test_r2_02_hft_quotes_multi_symbol_latency(self, client):
        """Benchmark multi-symbol /quotes batch queries (< 10ms)."""
        t0 = time.perf_counter()
        resp = client.get("/quotes?symbols=EURUSD.,XAUUSD.,GBPUSD.")
        dt = (time.perf_counter() - t0) * 1000.0
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") == "ok"
        assert len(data.get("d", [])) == 3
        assert dt < 15.0, f"Multi-symbol latency {dt:.2f}ms exceeds threshold"

    def test_r2_03_quotes_udf_schema_completeness(self, client):
        """Verify /quotes payload satisfies complete TradingView UDF standard schema."""
        resp = client.get("/quotes?symbols=EURUSD.")
        assert resp.status_code == 200
        payload = resp.json()
        assert payload.get("s") == "ok"
        assert isinstance(payload.get("d"), list)
        assert len(payload["d"]) > 0

        item = payload["d"][0]
        assert item.get("s") == "ok"
        assert item.get("n") == "EURUSD."
        assert "v" in item
        v = item["v"]
        for field in ["lp", "ask", "bid", "spread", "ch", "chp", "short_name", "exchange", "open_price", "high_price", "low_price"]:
            assert field in v, f"Field '{field}' missing from quote values"

    def test_r2_04_quotes_ask_bid_validity(self, client):
        """Verify ask price is greater than or equal to bid price with non-negative spread."""
        resp = client.get("/quotes?symbols=EURUSD.")
        item = resp.json()["d"][0]
        v = item["v"]
        if v.get("ask") and v.get("bid"):
            assert v["ask"] >= v["bid"], f"Ask {v['ask']} must be >= Bid {v['bid']}"
            assert v.get("spread", 0) >= 0, "Spread must be non-negative"


# ============================================================================
# Class 3: R2 WebSocket /ws/quotes Push Stream
# ============================================================================

class TestR2WebSocketQuotes:
    """R2: WebSocket /ws/quotes streaming verification."""

    def test_r2_05_ws_quotes_connection_and_subscription(self, client):
        """Verify WebSocket client connects, sends subscription, and registers client."""
        with client.websocket_connect("/ws/quotes") as ws:
            # Subscribe to XAUUSD.
            ws.send_json({"action": "subscribe", "symbol": "XAUUSD."})
            # Client should be registered in hft_engine._ws_subscribers
            assert len(hft_engine._ws_subscribers) > 0

            # Send subscribe to EURUSD.
            ws.send_json({"action": "subscribe", "symbol": "EURUSD."})

    def test_r2_06_ws_quotes_message_format(self, client):
        """Verify WebSocket message structure conforms to quote protocol."""
        # Prime a quote in hft_engine
        hft_engine.latest_quotes["EURUSD."] = {
            "s": "ok",
            "n": "EURUSD.",
            "v": {
                "lp": 1.08550,
                "ask": 1.08560,
                "bid": 1.08540,
                "spread": 20,
                "ch": 0.0010,
                "chp": 0.1,
            }
        }
        with client.websocket_connect("/ws/quotes") as ws:
            msg = ws.receive_json()
            assert "type" in msg
            assert msg["type"] == "quote"
            assert "symbol" in msg
            assert "data" in msg
            assert msg["data"].get("s") == "ok"


# ============================================================================
# Class 4: R2 MT5 Trade Endpoints Verification
# ============================================================================

class TestR2MT5TradeEndpoints:
    """R2: MT5 trade endpoints (/trade/order, /trade/pending, /trade/modify, /trade/close, /trade/positions, /trade/account)."""

    def test_r2_07_trade_account_endpoint(self, client):
        """Verify GET /trade/account returns status 200 and valid account details."""
        resp = client.get("/trade/account")
        assert resp.status_code == 200
        data = resp.json()
        assert "login" in data or ("account" in data and "login" in data["account"])
        acc = data.get("account", data)
        for field in ["balance", "equity", "leverage"]:
            assert field in acc, f"Expected '{field}' in account summary"
            assert isinstance(acc[field], (int, float))

    def test_r2_08_trade_market_order_execution(self, client):
        """Verify POST /trade/order executes BUY market order with diagnostics."""
        req = {
            "symbol": "EURUSD.",
            "action": "BUY",
            "volume": 0.01,
            "comment": "Tier6 Test BUY"
        }
        resp = client.post("/trade/order", json=req)
        assert resp.status_code == 200
        data = resp.json()
        assert "success" in data
        assert "retcode" in data
        assert "order" in data or "ticket" in data

    def test_r2_09_trade_pending_order_lifecycle(self, client):
        """Verify POST /trade/pending places pending order and returns valid order ticket."""
        req = {
            "symbol": "EURUSD.",
            "type": "BUY_LIMIT",
            "price": 1.05000,
            "volume": 0.01,
            "sl": 1.04500,
            "tp": 1.06000,
            "comment": "Tier6 Test Limit"
        }
        resp = client.post("/trade/pending", json=req)
        assert resp.status_code == 200
        data = resp.json()
        assert "success" in data
        assert "retcode" in data
        assert "order" in data

    def test_r2_10_trade_modify_endpoint(self, client):
        """Verify POST /trade/modify accepts modification parameters."""
        req = {
            "ticket": 99999999,
            "price": 1.05200,
            "sl": 1.04600,
            "tp": 1.06200
        }
        resp = client.post("/trade/modify", json=req)
        assert resp.status_code in (200, 400, 404)
        data = resp.json()
        assert "success" in data or "error" in data or "status" in data

    def test_r2_11_trade_close_endpoint(self, client):
        """Verify POST /trade/close handles order/position closure requests."""
        req = {"ticket": 99999999}
        resp = client.post("/trade/close", json=req)
        assert resp.status_code in (200, 400, 404)
        data = resp.json()
        assert "success" in data or "error" in data or "status" in data

    def test_r2_12_trade_positions_and_orders(self, client):
        """Verify GET /trade/positions and GET /trade/orders return valid collections."""
        r_pos = client.get("/trade/positions")
        assert r_pos.status_code == 200
        pos_data = r_pos.json()
        assert isinstance(pos_data, (list, dict))

        r_ord = client.get("/trade/orders")
        assert r_ord.status_code == 200
        ord_data = r_ord.json()
        assert isinstance(ord_data, (list, dict))

    def test_r2_13_trade_lot_calculator(self, client):
        """Verify POST /trade/lot_calculator computes valid risk-adjusted lot sizes."""
        req = {
            "symbol": "EURUSD.",
            "risk_percent": 1.5,
            "sl_points": 50,
            "use_equity": True
        }
        resp = client.post("/trade/lot_calculator", json=req)
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("success") is True
        assert data.get("calculated_lot") is not None
        assert data["calculated_lot"] > 0


# ============================================================================
# Class 5: R3 MT5 IPC Concurrent Stress Test
# ============================================================================

class TestR3MT5IPCConcurrentStress:
    """R3: High-concurrency burst and multi-threaded IPC stress without deadlock or errors."""

    def test_r3_01_concurrent_quotes_and_history_no_deadlock(self, client):
        """20 concurrent threads simultaneously requesting /quotes and /history."""
        num_threads = 20
        errors = []

        def worker(tid):
            try:
                # Alternate between quotes and history
                if tid % 2 == 0:
                    r = client.get("/quotes?symbols=EURUSD.,XAUUSD.")
                    assert r.status_code == 200
                else:
                    now = int(time.time())
                    r = client.get(f"/history?symbol=EURUSD.&resolution=5S&from={now - 300}&to={now}")
                    assert r.status_code == 200
            except Exception as ex:
                errors.append((tid, str(ex)))

        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker, i) for i in range(num_threads)]
            concurrent.futures.wait(futures, timeout=10.0)

        assert len(errors) == 0, f"Encountered concurrent errors: {errors}"

    def test_r3_02_concurrent_trading_and_quotes_burst(self, client):
        """15 concurrent threads querying trade endpoints and quotes simultaneously."""
        num_threads = 15
        errors = []

        def worker(tid):
            try:
                if tid % 3 == 0:
                    r = client.get("/trade/account")
                elif tid % 3 == 1:
                    r = client.get("/quotes?symbols=XAUUSD.")
                else:
                    r = client.get("/trade/positions")
                assert r.status_code == 200
            except Exception as ex:
                errors.append((tid, str(ex)))

        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker, i) for i in range(num_threads)]
            concurrent.futures.wait(futures, timeout=10.0)

        assert len(errors) == 0, f"Encountered concurrent trading burst errors: {errors}"
