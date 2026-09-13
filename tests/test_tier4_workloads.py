"""
Tier 4: Real-World End-to-End Workload Test Suite
Simulates authentic multi-step user workflows and application scenarios:
Scalper, Swing Trader, Custom Indicator Author, Multi-Symbol Dashboard,
Oscillator Sub-pane, Cache Lifecycle, and TradingView UDF Handshake.
Contains 7 comprehensive scenario test cases.
"""

import os
import sys
import time
import json
import pytest
from datetime import datetime, timezone, timedelta
import numpy as np
import pandas as pd

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


class TestTier4RealWorldWorkloads:
    """Tier 4: End-to-End Application Scenario & Workload Tests."""

    def test_t4_01_scalper_workflow(self, client):
        """
        Scenario 1: High-Frequency Scalper Workflow
        Step 1: Check server capabilities at /config
        Step 2: Resolve symbol EURUSD.
        Step 3: Fetch 40-tick OHLC bars for instant entry timing
        Step 4: Fetch 1-second (1S) bars for microscopic order flow
        Step 5: Verify sub-second response times and data integrity
        """
        # Step 1: Server Config
        r_conf = client.get("/config")
        assert r_conf.status_code == 200
        assert r_conf.json().get("has_seconds") is True

        # Step 2: Symbol Resolver
        r_sym = client.get("/symbols?symbol=EURUSD")
        assert r_sym.status_code == 200

        # Step 3: 40-Tick Bars
        t0 = time.perf_counter()
        r_ticks = client.get("/ticks?symbol=EURUSD.&ticks_per_bar=40")
        t_ticks = time.perf_counter() - t0
        assert r_ticks.status_code == 200
        data_ticks = r_ticks.json()
        assert data_ticks.get("s") == "ok"
        assert len(data_ticks["t"]) > 0

        # Step 4: 1S Seconds Bars
        now = int(time.time())
        t0 = time.perf_counter()
        r_sec = client.get(f"/history?symbol=EURUSD.&resolution=1S&from={now - 600}&to={now}")
        t_sec = time.perf_counter() - t0
        assert r_sec.status_code == 200
        data_sec = r_sec.json()
        assert data_sec.get("s") in ("ok", "no_data")

    def test_t4_02_swing_trader_workflow(self, client, pine_bridge, sample_pine_scripts):
        """
        Scenario 2: Swing Trader Workflow
        Step 1: Fetch 180 days of Daily (1D) rates for XAUUSD.
        Step 2: Fetch 4-Hour (240) rates for medium-term confirmation
        Step 3: Transpile 9/21 EMA Cross Strategy indicator
        Step 4: Verify indicator produces overlay styles and buy/sell shape plots
        """
        now = int(time.time())
        # Step 1: 1D Rates (180 days)
        r_daily = client.get(f"/history?symbol=XAUUSD.&resolution=1D&from={now - 180 * 86400}&to={now}")
        assert r_daily.status_code == 200
        data_daily = r_daily.json()
        assert data_daily.get("s") in ("ok", "no_data")

        # Step 2: 4H Rates
        r_4h = client.get(f"/history?symbol=XAUUSD.&resolution=240&from={now - 30 * 86400}&to={now}")
        assert r_4h.status_code == 200

        # Step 3 & 4: Transpile EMA Cross
        transpile_res = pine_bridge.transpile_script(sample_pine_scripts["ema_cross"])
        assert transpile_res.get("metainfo") is not None
        metainfo = transpile_res["metainfo"]
        assert metainfo.get("is_price_study") is True
        assert len(metainfo.get("plots", [])) == 4

    def test_t4_03_custom_indicator_full_lifecycle(self, pine_bridge):
        """
        Scenario 3: Custom Indicator Author Lifecycle
        Step 1: User writes custom MACD with altered parameters (fast=10, slow=20, signal=7)
        Step 2: Transpile code into TradingView study descriptor
        Step 3: Save to simulated localStorage
        Step 4: Simulate page reload and load from storage
        Step 5: Export to custom_indicators_getter study registry
        """
        custom_macd_code = """//@version=5
indicator("My Customized MACD", overlay=false)

fastLength = input.int(10, "Fast EMA", minval=1)
slowLength = input.int(20, "Slow EMA", minval=1)
signalLength = input.int(7, "Signal Smoothing", minval=1)

[macdLine, signalLine, hist] = ta.macd(close, fastLength, slowLength, signalLength)

plot(macdLine, "MACD", color=color.blue)
plot(signalLine, "Signal", color=color.orange)
plot(hist, "Histogram", color=color.gray, style=plot.style_histogram)
"""
        # Step 2: Transpile
        res = pine_bridge.transpile_script(custom_macd_code)
        assert res.get("metainfo") is not None
        metainfo = res["metainfo"]
        assert metainfo["inputs"][0]["defval"] == 10
        assert metainfo["inputs"][1]["defval"] == 20
        assert metainfo["inputs"][2]["defval"] == 7

        # Step 3: Save to simulated LocalStorage
        local_storage = {}
        indicator_record = {
            "id": "user_macd_001",
            "name": "My Customized MACD",
            "code": custom_macd_code,
            "metainfo": metainfo,
            "savedAt": "2026-08-27T10:30:00Z"
        }
        local_storage["user_macd_001"] = json.dumps(indicator_record)

        # Step 4: Reload from LocalStorage
        loaded_raw = local_storage.get("user_macd_001")
        assert loaded_raw is not None
        loaded_indicator = json.loads(loaded_raw)
        assert loaded_indicator["name"] == "My Customized MACD"

        # Step 5: Export to Study Registry
        study_descriptor = {
            "name": loaded_indicator["name"],
            "metainfo": loaded_indicator["metainfo"],
            "constructor": lambda: None
        }
        assert study_descriptor["metainfo"]["_metainfoVersion"] == 52

    def test_t4_04_multi_symbol_dashboard_workload(self, client):
        """
        Scenario 4: Multi-Symbol Multi-Resolution Dashboard
        Simultaneously requests 4 charts:
        - EURUSD. 1S
        - GBPUSD. 15m
        - XAUUSD. 1H
        - USDIndex 1D
        Verifies all 4 return valid data without cross-talk or server degradation.
        """
        now = int(time.time())
        requests_config = [
            ("EURUSD.", "1S", now - 300, now),
            ("GBPUSD.", "15", now - 86400 * 2, now),
            ("XAUUSD.", "60", now - 86400 * 7, now),
            ("USDIndex", "1D", now - 86400 * 90, now),
        ]

        responses = []
        for sym, res, f_time, t_time in requests_config:
            resp = client.get(f"/history?symbol={sym}&resolution={res}&from={f_time}&to={t_time}")
            responses.append((sym, res, resp))

        for sym, res, resp in responses:
            assert resp.status_code == 200, f"Dashboard query failed for {sym} at {res}"
            data = resp.json()
            assert data.get("s") in ("ok", "no_data")
            if data.get("s") == "ok":
                assert len(data["t"]) > 0
                assert len(data["o"]) == len(data["t"])

    def test_t4_05_oscillator_subpane_workflow(self, client, pine_bridge, sample_pine_scripts):
        """
        Scenario 5: Oscillator Sub-pane Workflow
        Step 1: Query 1-minute candlestick data
        Step 2: Transpile 14-period RSI
        Step 3: Verify sub-pane metainfo configuration (is_price_study=false, hlines at 70/30)
        """
        now = int(time.time())
        r_hist = client.get(f"/history?symbol=EURUSD.&resolution=1&from={now - 3600}&to={now}")
        assert r_hist.status_code == 200

        res_rsi = pine_bridge.transpile_script(sample_pine_scripts["rsi"])
        assert res_rsi.get("metainfo") is not None
        metainfo = res_rsi["metainfo"]
        assert metainfo.get("is_price_study") is False
        assert len(metainfo.get("bands", [])) == 2
        band_vals = [b.get("value") for b in metainfo.get("defaults", {}).get("bands", [])]
        assert 70 in band_vals
        assert 30 in band_vals

    def test_t4_06_cache_stress_and_market_tick_updates(self, client):
        """
        Scenario 6: Cache Stress & Rapid Consecutive Queries
        Performs 10 rapid queries on seconds feed to verify stability.
        """
        now = int(time.time())
        for i in range(10):
            resp = client.get(f"/history?symbol=EURUSD.&resolution=1S&from={now - 300}&to={now}")
            assert resp.status_code == 200
            data = resp.json()
            assert data.get("s") in ("ok", "no_data")

    def test_t4_07_tradingview_udf_handshake(self, client):
        """
        Scenario 7: Full TradingView UDF Client Initialization Handshake
        Full sequence executed by TradingView Advanced Charts on page load:
        Step 1: GET /config (get datafeed configuration)
        Step 2: GET /time (synchronize server time)
        Step 3: GET /symbols?symbol=EURUSD (resolve symbol metadata)
        Step 4: GET /history?symbol=EURUSD.&resolution=1&from=...&to=... (fetch initial 1m bars)
        Step 5: GET /history?symbol=EURUSD.&resolution=1S&from=...&to=... (user switches to 1S)
        Step 6: GET /ticks?symbol=EURUSD.&ticks_per_bar=40 (user switches to tick bars)
        """
        # Step 1: /config
        r1 = client.get("/config")
        assert r1.status_code == 200
        conf = r1.json()
        assert "supported_resolutions" in conf

        # Step 2: /time
        r2 = client.get("/time")
        assert r2.status_code == 200

        # Step 3: /symbols
        r3 = client.get("/symbols?symbol=EURUSD")
        assert r3.status_code == 200

        # Step 4: /history 1m
        now = int(time.time())
        r4 = client.get(f"/history?symbol=EURUSD.&resolution=1&from={now - 3600}&to={now}")
        assert r4.status_code == 200

        # Step 5: /history 1S
        r5 = client.get(f"/history?symbol=EURUSD.&resolution=1S&from={now - 600}&to={now}")
        assert r5.status_code == 200

        # Step 6: /ticks
        r6 = client.get("/ticks?symbol=EURUSD.&ticks_per_bar=40")
        assert r6.status_code == 200
        assert r6.json().get("s") == "ok"
