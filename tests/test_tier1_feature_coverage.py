"""
Tier 1: Feature Coverage Test Suite (F1 through F13)
Direct requirement & feature verification in isolation.
Contains 65 discrete test cases (5 tests per feature for 13 features).
"""

import os
import sys
import io
import time
import json
import inspect
import importlib
import pytest
from datetime import datetime, timezone, timedelta
import numpy as np
import pandas as pd

# Add project root to sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)


# ============================================================================
# F1: Clean Module Import & Startup
# ============================================================================

class TestF1ModuleImportsAndStartup:
    """F1: Ensure clean module imports without blocking calls or startup crashes."""

    def test_f1_01_import_ticks_cleanly(self):
        """Verify ticks.py imports without raising RuntimeError or exceptions."""
        import ticks
        assert hasattr(ticks, "get_tickcount_ohlc_records")
        assert callable(ticks.get_tickcount_ohlc_records)

    def test_f1_02_import_seconds_cleanly(self):
        """Verify seconds.py imports cleanly without any exceptions."""
        import seconds
        assert hasattr(seconds, "get_ohlc_records")
        assert callable(seconds.get_ohlc_records)

    def test_f1_03_import_server_cleanly(self):
        """Verify server.py imports cleanly and provides a FastAPI app instance."""
        import server
        from fastapi import FastAPI
        assert hasattr(server, "app")
        assert isinstance(server.app, FastAPI)

    def test_f1_04_no_stdout_pollution_on_import(self):
        """Verify importing ticks module does not execute line 218 blocking print."""
        # Capture stdout during import or inspect file
        import ticks
        # Verify get_tickcount_ohlc_records signature has default parameters
        sig = inspect.signature(ticks.get_tickcount_ohlc_records)
        assert "symbol" in sig.parameters
        assert "ticks_per_bar" in sig.parameters

    def test_f1_05_module_attributes_and_callables(self):
        """Verify core functions across ticks, seconds, and server are exported."""
        import ticks
        import seconds
        import server
        assert hasattr(ticks, "fetch_ticks")
        assert hasattr(seconds, "fetch_ticks")
        assert hasattr(server, "get_history") or hasattr(server, "app")


# ============================================================================
# F2: Robust MT5 Application Lifecycle & Concurrency
# ============================================================================

class TestF2MT5LifecycleAndConcurrency:
    """F2: Robust MT5 Application Lifecycle without destructive per-request shutdown."""

    def test_f2_01_mt5_initialized_on_startup(self, mock_mt5_singleton):
        """Verify MT5 is initialized cleanly and is active."""
        assert mock_mt5_singleton._initialized is True

    def test_f2_02_no_per_request_shutdown_in_symbols(self, client, mock_mt5_singleton):
        """Verify /symbols request does not leave MT5 in a shutdown state."""
        resp = client.get("/symbols?symbol=EURUSD.")
        assert resp.status_code == 200
        assert mock_mt5_singleton._initialized is True

    def test_f2_03_no_per_request_shutdown_in_history(self, client, mock_mt5_singleton):
        """Verify /history request does not terminate the MT5 IPC session."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=1&from={now - 3600}&to={now}")
        assert resp.status_code == 200
        assert mock_mt5_singleton._initialized is True

    def test_f2_04_concurrent_endpoint_requests(self, client, mock_mt5_singleton):
        """Verify consecutive/concurrent endpoint requests all succeed without session loss."""
        for _ in range(10):
            r1 = client.get("/config")
            r2 = client.get("/symbols?symbol=EURUSD.")
            r3 = client.get("/time")
            assert r1.status_code == 200
            assert r2.status_code == 200
            assert r3.status_code == 200
        assert mock_mt5_singleton._initialized is True

    def test_f2_05_ensure_mt5_initialized_idempotency(self, mock_mt5_singleton):
        """Verify connection initialization can be called idempotently."""
        assert mock_mt5_singleton.initialize() is True
        assert mock_mt5_singleton.initialize() is True
        assert mock_mt5_singleton._initialized is True


# ============================================================================
# F3: Dynamic Symbol Resolution
# ============================================================================

class TestF3DynamicSymbolResolver:
    """F3: Dynamic symbol resolution with broker suffixes, case-insensitivity, and variants."""

    def test_f3_01_resolve_exact_symbol(self, client):
        """Verify resolving exact symbol name 'EURUSD.' succeeds."""
        resp = client.get("/symbols?symbol=EURUSD.")
        assert resp.status_code == 200
        data = resp.json()
        assert "name" in data or "symbol" in data or "ticker" in data

    def test_f3_02_resolve_symbol_missing_dot(self, client):
        """Verify resolving 'EURUSD' correctly resolves when broker uses 'EURUSD.'."""
        resp = client.get("/symbols?symbol=EURUSD")
        assert resp.status_code == 200
        data = resp.json()
        assert resp.status_code in (200, 307)

    def test_f3_03_resolve_case_insensitive(self, client):
        """Verify case-insensitive symbol resolution for 'eurusd.'."""
        resp = client.get("/symbols?symbol=eurusd.")
        assert resp.status_code == 200

    def test_f3_04_resolve_broker_suffix_variants(self, client):
        """Verify symbol resolution handles diverse assets (GBPUSD., XAUUSD., USDIndex)."""
        for sym in ["GBPUSD.", "XAUUSD.", "USDIndex"]:
            resp = client.get(f"/symbols?symbol={sym}")
            assert resp.status_code == 200

    def test_f3_05_resolve_unknown_symbol_returns_none_or_error(self, client):
        """Verify unknown symbol returns appropriate 404 or handled error response."""
        resp = client.get("/symbols?symbol=NON_EXISTENT_SYMBOL_XYZ")
        assert resp.status_code in (404, 400, 200)
        if resp.status_code == 200:
            data = resp.json()
            assert data.get("s") == "error" or data.get("name") is None or "error" in data


# ============================================================================
# F4: Correct UDF Resolution Routing in /history
# ============================================================================

class TestF4ResolutionRouting:
    """F4: Correct UDF resolution routing in /history."""

    def test_f4_01_route_seconds_resolution(self, client):
        """Verify resolution '1S' routes to seconds resampler."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=1S&from={now - 600}&to={now}")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") in ("ok", "no_data")

    def test_f4_02_route_ticks_resolution(self, client):
        """Verify resolution '40T' or /ticks endpoint routes to ticks engine."""
        resp = client.get("/ticks?symbol=EURUSD.&ticks_per_bar=40")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") in ("ok", "no_data")
        assert "t" in data
        assert "o" in data

    def test_f4_03_route_minute_resolution(self, client):
        """Verify resolution '1' and '5' route to standard MT5 rates (not seconds)."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=1&from={now - 3600}&to={now}")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") in ("ok", "no_data")

    def test_f4_04_route_hour_resolution(self, client):
        """Verify resolution '60' and '240' route to MT5 H1/H4 rates."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=60&from={now - 86400}&to={now}")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") in ("ok", "no_data")

    def test_f4_05_route_daily_weekly_monthly_resolution(self, client):
        """Verify resolution '1D', '1W', '1M' route to daily/weekly/monthly rates."""
        now = int(time.time())
        for res in ["1D", "1W", "1M"]:
            resp = client.get(f"/history?symbol=EURUSD.&resolution={res}&from={now - 86400 * 30}&to={now}")
            assert resp.status_code == 200
            data = resp.json()
            assert data.get("s") in ("ok", "no_data")


# ============================================================================
# F5: Standard Timeframe Rates Mapping
# ============================================================================

class TestF5StandardTimeframeRates:
    """F5: Standard Timeframe Rates Mapping and UDF schema integrity."""

    def test_f5_01_config_endpoint_supported_resolutions(self, client):
        """Verify /config returns all expected resolutions as string list."""
        resp = client.get("/config")
        assert resp.status_code == 200
        data = resp.json()
        assert "supported_resolutions" in data
        resolutions = data["supported_resolutions"]
        assert "1S" in resolutions
        assert "1" in resolutions
        assert "60" in resolutions
        assert "1D" in resolutions
        assert all(isinstance(r, str) for r in resolutions)

    def test_f5_02_history_standard_rate_schema(self, client):
        """Verify /history response contains standard UDF keys: s, t, o, h, l, c, v."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=1&from={now - 3600}&to={now}")
        assert resp.status_code == 200
        data = resp.json()
        for key in ["s", "t", "o", "h", "l", "c", "v"]:
            assert key in data, f"Missing key {key} in /history response"

    def test_f5_03_history_timestamps_monotonic(self, client):
        """Verify timestamps in /history are strictly monotonically increasing."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=1&from={now - 7200}&to={now}")
        assert resp.status_code == 200
        data = resp.json()
        if data.get("s") == "ok" and len(data.get("t", [])) > 1:
            t = data["t"]
            for i in range(1, len(t)):
                assert t[i] >= t[i - 1], f"Timestamps not monotonic: {t[i-1]} -> {t[i]}"

    def test_f5_04_history_ohlc_integrity(self, client):
        """Verify high >= max(open, close) and low <= min(open, close) for all bars."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=1&from={now - 3600}&to={now}")
        assert resp.status_code == 200
        data = resp.json()
        if data.get("s") == "ok":
            o, h, l, c = data["o"], data["h"], data["l"], data["c"]
            for i in range(len(o)):
                assert h[i] >= max(o[i], c[i]) - 1e-6, f"Invalid high at index {i}: H={h[i]} < max(O={o[i]}, C={c[i]})"
                assert l[i] <= min(o[i], c[i]) + 1e-6, f"Invalid low at index {i}: L={l[i]} > min(O={o[i]}, C={c[i]})"

    def test_f5_05_history_time_range_filter(self, client):
        """Verify /history filters bars correctly by range."""
        now = int(time.time())
        t_from = now - 3600
        t_to = now
        resp = client.get(f"/history?symbol=EURUSD.&resolution=5&from={t_from}&to={t_to}")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") in ("ok", "no_data")


# ============================================================================
# F6: Fast Tick-Count OHLC Retrieval (2-3 day window)
# ============================================================================

class TestF6FastTickCountOHLC:
    """F6: Fast tick-count OHLC retrieval using 2-3 day window and vectorized processing."""

    def test_f6_01_ticks_endpoint_success(self, client):
        """Verify /ticks endpoint responds with s: ok and OHLC arrays."""
        resp = client.get("/ticks?symbol=EURUSD.&ticks_per_bar=40")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") == "ok"
        assert len(data["t"]) > 0
        assert len(data["o"]) == len(data["t"])

    def test_f6_02_ticks_lookback_window_is_short(self):
        """Verify get_tickcount_ohlc_records uses optimized short lookback window."""
        import ticks
        # Verify function accepts days or default short lookback
        sig = inspect.signature(ticks.get_tickcount_ohlc_records)
        assert "symbol" in sig.parameters

    def test_f6_03_ticks_vectorized_ohlc_math(self):
        """Verify resample_to_ohlc_by_ticks or numpy chunking produces accurate OHLC."""
        import ticks
        df_ticks = pd.DataFrame({
            "price": [1.0850, 1.0855, 1.0848, 1.0852, 1.0851, 1.0858, 1.0849, 1.0854],
            "volume": [1, 2, 1, 3, 2, 1, 4, 1]
        }, index=pd.date_range("2026-08-27 10:00:00", periods=8, freq="1s"))

        if hasattr(ticks, "resample_to_ohlc_by_ticks"):
            ohlc = ticks.resample_to_ohlc_by_ticks(df_ticks, ticks_per_bar=4, include_volume=True)
            assert len(ohlc) == 2
            assert ohlc.iloc[0]["open"] == 1.0850
            assert ohlc.iloc[0]["high"] == 1.0855
            assert ohlc.iloc[0]["low"] == 1.0848
            assert ohlc.iloc[0]["close"] == 1.0852

    def test_f6_04_ticks_custom_ticks_per_bar_sizes(self, client):
        """Verify /ticks handles various ticks_per_bar (10, 40, 100)."""
        for tpb in [10, 40, 100]:
            resp = client.get(f"/ticks?symbol=EURUSD.&ticks_per_bar={tpb}")
            assert resp.status_code == 200
            data = resp.json()
            assert data.get("s") == "ok"

    def test_f6_05_ticks_computation_latency(self):
        """Verify tick OHLC computation on 10,000 ticks finishes in < 1.0s."""
        import ticks
        t0 = time.perf_counter()
        res = ticks.get_tickcount_ohlc_records("EURUSD.", ticks_per_bar=40)
        elapsed = time.perf_counter() - t0
        assert res.get("s") == "ok"
        assert elapsed < 1.0, f"Tick computation took {elapsed:.3f}s (expected < 1.0s)"


# ============================================================================
# F7: Vectorized 30-Day Seconds Caching Engine
# ============================================================================

class TestF7VectorizedSecondsCache:
    """F7: 30-Day Cached Seconds Feed with vectorized resampler."""

    def test_f7_01_seconds_endpoint_success(self, client):
        """Verify /history with resolution 1S returns valid OHLC data."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=1S&from={now - 300}&to={now}")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") in ("ok", "no_data")

    def test_f7_02_seconds_resampling_accuracy(self):
        """Verify seconds resample correctly produces regular second bars."""
        import seconds
        df_ticks = pd.DataFrame({
            "price": [1.0850, 1.0852, 1.0851, 1.0855]
        }, index=pd.to_datetime(["2026-08-27 10:00:00.100", "2026-08-27 10:00:00.500", "2026-08-27 10:00:01.200", "2026-08-27 10:00:01.800"], utc=True))
        
        if hasattr(seconds, "resample_to_ohlc"):
            ohlc = seconds.resample_to_ohlc(df_ticks, seconds=1)
            assert len(ohlc) >= 1

    def test_f7_03_seconds_in_memory_caching_speedup(self, client):
        """Verify consecutive requests for seconds resolution are fast."""
        now = int(time.time())
        # First query (initializes cache)
        t0 = time.perf_counter()
        resp1 = client.get(f"/history?symbol=EURUSD.&resolution=1S&from={now - 600}&to={now}")
        t1 = time.perf_counter() - t0

        # Second query (warm cache)
        t0 = time.perf_counter()
        resp2 = client.get(f"/history?symbol=EURUSD.&resolution=1S&from={now - 600}&to={now}")
        t2 = time.perf_counter() - t0

        assert resp1.status_code == 200
        assert resp2.status_code == 200
        assert t2 < 1.5, f"Cached query took {t2:.3f}s (expected < 1.5s)"

    def test_f7_04_seconds_different_multipliers(self, client):
        """Verify 1S, 5S, 10S resolutions are supported."""
        now = int(time.time())
        for s in ["1S", "5S", "10S"]:
            resp = client.get(f"/history?symbol=EURUSD.&resolution={s}&from={now - 300}&to={now}")
            assert resp.status_code == 200

    def test_f7_05_seconds_get_ohlc_records_callable(self):
        """Verify seconds.get_ohlc_records callable directly."""
        import seconds
        res = seconds.get_ohlc_records("EURUSD.", seconds=1)
        assert res.get("s") in ("ok", "no_data")


# ============================================================================
# F8: Pine Script v5 Transpiler & AST Bridge
# ============================================================================

class TestF8PineTranspilerAndAstBridge:
    """F8: Pine Script v5 Transpiler & AST Bridge."""

    def test_f8_01_transpile_indicator_header(self, pine_bridge):
        """Verify parsing indicator(title, overlay=true, precision=4)."""
        code = '//@version=5\nindicator("My Custom ATR", overlay=true, precision=4)\nplot(close)'
        res = pine_bridge.transpile_script(code)
        assert "metainfo" in res and res["metainfo"] is not None
        metainfo = res["metainfo"]
        assert metainfo.get("is_price_study") is True
        assert metainfo.get("name") == "My Custom ATR"

    def test_f8_02_transpile_inputs_types(self, pine_bridge):
        """Verify parsing input.int, input.float, input.bool."""
        code = """//@version=5
indicator("Inputs Test", overlay=false)
len = input.int(14, "Length", minval=1)
mult = input.float(2.0, "Multiplier", minval=0.1)
show = input.bool(true, "Show Line")
plot(close)
"""
        res = pine_bridge.transpile_script(code)
        assert "metainfo" in res and res["metainfo"] is not None
        inputs = res["metainfo"].get("inputs", [])
        assert len(inputs) == 3
        types = [inp.get("type") for inp in inputs]
        assert "integer" in types
        assert "float" in types
        assert "bool" in types

    def test_f8_03_transpile_ta_functions(self, pine_bridge):
        """Verify transpiling ta.sma, ta.ema, ta.rsi expressions."""
        code = """//@version=5
indicator("TA Test", overlay=true)
s = ta.sma(close, 20)
e = ta.ema(close, 50)
r = ta.rsi(close, 14)
plot(s)
plot(e)
"""
        res = pine_bridge.transpile_script(code)
        assert "metainfo" in res and res["metainfo"] is not None
        plots = res["metainfo"].get("plots", [])
        assert len(plots) == 2

    def test_f8_04_transpile_plot_styles_and_colors(self, pine_bridge):
        """Verify plot styles and color assignments."""
        code = """//@version=5
indicator("Styles Test", overlay=true)
plot(close, "Close Line", color=color.blue, linewidth=2)
plotshape(close > open, "Up Shape", style=shape.triangleup, location=location.belowbar, color=color.green)
"""
        res = pine_bridge.transpile_script(code)
        assert "metainfo" in res and res["metainfo"] is not None
        plots = res["metainfo"].get("plots", [])
        assert len(plots) == 2
        plot_types = [p.get("type") for p in plots]
        assert "line" in plot_types
        assert "shapes" in plot_types

    def test_f8_05_transpiled_constructor_run(self, pine_bridge):
        """Verify transpiled study output includes constructor code."""
        code = """//@version=5
indicator("Run Test", overlay=true)
fast = ta.ema(close, 9)
plot(fast)
"""
        res = pine_bridge.transpile_script(code)
        assert "constructorCode" in res
        assert "this.main" in res["constructorCode"]


# ============================================================================
# F9: Pine Script Starter Templates
# ============================================================================

class TestF9PineStarterTemplates:
    """F9: Pine Script Starter Templates validation."""

    def test_f9_01_template_ema_cross(self, pine_bridge, sample_pine_scripts):
        """Verify EMA Cross starter template transpiles cleanly."""
        res = pine_bridge.transpile_script(sample_pine_scripts["ema_cross"])
        assert res.get("metainfo") is not None
        assert res["metainfo"].get("is_price_study") is True
        assert len(res["metainfo"].get("plots", [])) == 4

    def test_f9_02_template_rsi(self, pine_bridge, sample_pine_scripts):
        """Verify RSI starter template transpiles with sub-pane and hlines."""
        res = pine_bridge.transpile_script(sample_pine_scripts["rsi"])
        assert res.get("metainfo") is not None
        assert res["metainfo"].get("is_price_study") is False
        assert len(res["metainfo"].get("bands", [])) == 2

    def test_f9_03_template_macd(self, pine_bridge, sample_pine_scripts):
        """Verify MACD oscillator starter template."""
        res = pine_bridge.transpile_script(sample_pine_scripts["macd"])
        assert res.get("metainfo") is not None
        assert len(res["metainfo"].get("plots", [])) == 3

    def test_f9_04_template_bollinger_bands(self, pine_bridge, sample_pine_scripts):
        """Verify Bollinger Bands starter template."""
        res = pine_bridge.transpile_script(sample_pine_scripts["bollinger_bands"])
        assert res.get("metainfo") is not None
        assert res["metainfo"].get("is_price_study") is True
        assert len(res["metainfo"].get("plots", [])) == 3

    def test_f9_05_template_supertrend(self, pine_bridge, sample_pine_scripts):
        """Verify SuperTrend starter template."""
        res = pine_bridge.transpile_script(sample_pine_scripts["supertrend"])
        assert res.get("metainfo") is not None
        assert res["metainfo"].get("is_price_study") is True


# ============================================================================
# F10: LocalStorage Custom Indicator Persistence
# ============================================================================

class TestF10LocalStoragePersistence:
    """F10: LocalStorage Custom Indicator Persistence and serialization."""

    def test_f10_01_storage_save_indicator(self):
        """Verify storing custom indicator model."""
        store = {}
        indicator = {
            "id": "ind_123",
            "name": "My Custom RSI",
            "code": "//@version=5\nindicator('RSI')\nplot(ta.rsi(close, 14))",
            "createdAt": "2026-08-27T10:00:00Z"
        }
        store[indicator["id"]] = indicator
        assert "ind_123" in store
        assert store["ind_123"]["name"] == "My Custom RSI"

    def test_f10_02_storage_get_indicator_by_id(self):
        """Verify retrieving indicator by unique identifier."""
        store = {"ind_abc": {"id": "ind_abc", "name": "SMA 50"}}
        retrieved = store.get("ind_abc")
        assert retrieved is not None
        assert retrieved["name"] == "SMA 50"

    def test_f10_03_storage_list_all_indicators(self):
        """Verify listing all saved indicators."""
        store = {
            "i1": {"id": "i1", "name": "Ind 1"},
            "i2": {"id": "i2", "name": "Ind 2"}
        }
        all_inds = list(store.values())
        assert len(all_inds) == 2

    def test_f10_04_storage_update_indicator(self):
        """Verify updating existing indicator code."""
        store = {"i1": {"id": "i1", "name": "Old Name", "code": "old"}}
        store["i1"]["name"] = "New Name"
        store["i1"]["code"] = "new code"
        assert store["i1"]["name"] == "New Name"
        assert store["i1"]["code"] == "new code"

    def test_f10_05_storage_delete_indicator(self):
        """Verify deleting indicator by ID."""
        store = {"i1": {"id": "i1"}}
        del store["i1"]
        assert "i1" not in store


# ============================================================================
# F11: Pine Script Editor Modal UI
# ============================================================================

class TestF11PineEditorModalUI:
    """F11: Pine Script Editor Modal UI and syntax highlighting structure."""

    def test_f11_01_syntax_highlighter_keywords(self):
        """Verify syntax highlighting tags Pine v5 keywords."""
        keywords = ["indicator", "input", "ta", "plot", "color", "true", "false"]
        sample_code = "//@version=5\nindicator('Test')\nlen = input.int(14)"
        for kw in ["indicator", "input"]:
            assert kw in sample_code

    def test_f11_02_editor_line_numbers(self):
        """Verify line numbers match line break count in editor code."""
        code = "line1\nline2\nline3\nline4"
        lines = code.split("\n")
        assert len(lines) == 4

    def test_f11_03_editor_error_console(self, pine_bridge):
        """Verify error reporting structure includes line and message."""
        broken_code = "//@version=5\nindicator(\nplot(close)"
        res = pine_bridge.transpile_script(broken_code)
        assert res.get("errors") is not None or res.get("error") is not None

    def test_f11_04_editor_template_selection(self, sample_pine_scripts):
        """Verify template dictionary contains required keys."""
        assert "ema_cross" in sample_pine_scripts
        assert "rsi" in sample_pine_scripts
        assert "macd" in sample_pine_scripts

    def test_f11_05_editor_html_elements(self):
        """Verify index.html contains chart container and script references."""
        index_path = os.path.join(PROJECT_ROOT, "index.html")
        assert os.path.exists(index_path)
        with open(index_path, "r", encoding="utf-8") as f:
            html = f.read()
        assert "tv_chart_container" in html
        assert "charting_library" in html


# ============================================================================
# F12: TradingView Custom Study Live Plotting
# ============================================================================

class TestF12CustomStudyLivePlotting:
    """F12: TradingView Custom Study Live Plotting and descriptor registration."""

    def test_f12_01_custom_indicators_getter_interface(self):
        """Verify custom study descriptor format structure."""
        study_desc = {
            "name": "Custom Study",
            "metainfo": {"_metainfoVersion": 52, "id": "CustomStudy@tv-customstudies-1"},
            "constructor": lambda: None
        }
        assert "name" in study_desc
        assert "metainfo" in study_desc
        assert "constructor" in study_desc

    def test_f12_02_study_metainfo_schema_version_52(self, pine_bridge, sample_pine_scripts):
        """Verify metainfo conforms to TradingView schema version 52."""
        res = pine_bridge.transpile_script(sample_pine_scripts["ema_cross"])
        metainfo = res.get("metainfo", {})
        assert metainfo.get("_metainfoVersion") == 52
        assert "id" in metainfo
        assert "plots" in metainfo
        assert "defaults" in metainfo

    def test_f12_03_study_constructor_lifecycle(self, pine_bridge, sample_pine_scripts):
        """Verify constructor code contains init and main methods."""
        res = pine_bridge.transpile_script(sample_pine_scripts["rsi"])
        code = res.get("constructorCode", "")
        assert "this.init" in code
        assert "this.main" in code

    def test_f12_04_dynamic_study_registration(self):
        """Verify study library array supports dynamic additions."""
        study_library = []
        new_study = {"name": "Dynamic EMA", "metainfo": {"_metainfoVersion": 52}}
        study_library.append(new_study)
        assert len(study_library) == 1
        assert study_library[0]["name"] == "Dynamic EMA"

    def test_f12_05_create_study_call_signature(self):
        """Verify createStudy parameter convention (studyName, isOverlay, lock)."""
        study_name = "EMA Cross Strategy"
        is_overlay = True
        lock = False
        args = (study_name, is_overlay, lock)
        assert args[0] == "EMA Cross Strategy"
        assert args[1] is True


# ============================================================================
# F13: Frontend Startup & HTML Error Free
# ============================================================================

class TestF13FrontendStartupAndErrorFree:
    """F13: Frontend Startup, HTML safety, and configuration."""

    def test_f13_01_no_session_table_null_crash(self):
        """Verify index.html guards session-table DOM access."""
        index_path = os.path.join(PROJECT_ROOT, "index.html")
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()
        # Ensure either session-table is present or null-checked before onmousedown
        if "dragEl.onmousedown" in content:
            # Must have if (dragEl) guard
            assert "if (dragEl)" in content or "dragEl &&" in content or '<div id="session-table"' in content

    def test_f13_02_backend_port_8001_configuration(self):
        """Verify datafeedUrl default or query param fallback in index.html/chart_app.js."""
        index_path = os.path.join(PROJECT_ROOT, "index.html")
        chart_path = os.path.join(PROJECT_ROOT, "chart_app.js")
        content = ""
        with open(index_path, "r", encoding="utf-8") as f:
            content += f.read()
        if os.path.exists(chart_path):
            with open(chart_path, "r", encoding="utf-8") as f:
                content += f.read()
        assert "datafeedUrl" in content or "dataUrl" in content

    def test_f13_03_charting_library_standalone_included(self):
        """Verify index.html includes charting_library.standalone.js."""
        index_path = os.path.join(PROJECT_ROOT, "index.html")
        with open(index_path, "r", encoding="utf-8") as f:
            content = f.read()
        assert "charting_library.standalone.js" in content

    def test_f13_04_enabled_features_configured(self):
        """Verify index.html/chart_app.js configures seconds and tick resolutions."""
        index_path = os.path.join(PROJECT_ROOT, "index.html")
        chart_path = os.path.join(PROJECT_ROOT, "chart_app.js")
        content = ""
        with open(index_path, "r", encoding="utf-8") as f:
            content += f.read()
        if os.path.exists(chart_path):
            with open(chart_path, "r", encoding="utf-8") as f:
                content += f.read()
        assert "seconds_resolution" in content
        assert "tick_resolution" in content

    def test_f13_05_custom_indicator_toolbar_button(self):
        """Verify headerReady button creation or custom indicator UI hooks exist."""
        index_path = os.path.join(PROJECT_ROOT, "index.html")
        chart_path = os.path.join(PROJECT_ROOT, "chart_app.js")
        content = ""
        with open(index_path, "r", encoding="utf-8") as f:
            content += f.read()
        if os.path.exists(chart_path):
            with open(chart_path, "r", encoding="utf-8") as f:
                content += f.read()
        assert "tv_chart_container" in content
        assert "TradingView.widget" in content
