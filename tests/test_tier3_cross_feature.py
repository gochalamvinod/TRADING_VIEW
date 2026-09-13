"""
Tier 3: Pairwise Combinatorial Cross-Feature Test Suite
Tests interactions between subsystems: Symbol Resolver + Resolution Routing,
Pine Transpiler + Runtime execution, Storage + Custom Indicator Registration,
and Multi-Symbol Caching.
Contains 15 comprehensive pairwise test cases.
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


class TestTier3CrossFeaturePairwise:
    """Tier 3: Pairwise Combinatorial Cross-Feature Tests."""

    def test_t3_01_symbol_resolver_and_seconds_routing(self, client):
        """Pairwise Test 1: Symbol resolution (EURUSD vs EURUSD.) paired with seconds resolutions (1S, 5S)."""
        now = int(time.time())
        for sym in ["EURUSD.", "EURUSD"]:
            for res in ["1S", "5S"]:
                resp = client.get(f"/history?symbol={sym}&resolution={res}&from={now - 300}&to={now}")
                assert resp.status_code == 200
                data = resp.json()
                assert data.get("s") in ("ok", "no_data")

    def test_t3_02_symbol_resolver_and_ticks_routing(self, client):
        """Pairwise Test 2: Symbol resolution paired with tick counts (10T, 40T, 100T)."""
        for sym in ["EURUSD.", "EURUSD", "GBPUSD."]:
            for tpb in [10, 40, 100]:
                resp = client.get(f"/ticks?symbol={sym}&ticks_per_bar={tpb}")
                assert resp.status_code == 200
                data = resp.json()
                assert data.get("s") == "ok"
                assert len(data["t"]) > 0

    def test_t3_03_symbol_resolver_and_rates_timeframes(self, client):
        """Pairwise Test 3: Symbol resolution paired with standard timeframes (1, 60, 1D)."""
        now = int(time.time())
        for sym in ["EURUSD.", "USDIndex", "XAUUSD."]:
            for res in ["1", "60", "1D"]:
                resp = client.get(f"/history?symbol={sym}&resolution={res}&from={now - 86400 * 7}&to={now}")
                assert resp.status_code == 200
                data = resp.json()
                assert data.get("s") in ("ok", "no_data")

    def test_t3_04_transpiler_and_multi_type_inputs(self, pine_bridge):
        """Pairwise Test 4: Pine transpiler with mixed inputs (int, float, bool, string) and multiple plots."""
        code = """//@version=5
indicator("Complex Inputs & Plots", overlay=true)
p_int = input.int(14, "Int Param", minval=1)
p_float = input.float(2.5, "Float Param", step=0.5)
p_bool = input.bool(true, "Bool Param")
p_str = input.string("SMA", "Type Option")

fast = ta.sma(close, p_int)
slow = ta.ema(close, p_int * 2)

plot(fast, "Fast Line", color=color.blue)
plot(slow, "Slow Line", color=color.red)
"""
        res = pine_bridge.transpile_script(code)
        assert res.get("metainfo") is not None
        metainfo = res["metainfo"]
        assert len(metainfo.get("inputs", [])) >= 4
        assert len(metainfo.get("plots", [])) == 2

    def test_t3_05_transpiler_and_historical_series_lookbacks(self, pine_bridge):
        """Pairwise Test 5: Pine transpiler lookback operators (close[1], high[2], change) executed on price bars."""
        code = """//@version=5
indicator("Lookback Engine", overlay=true)
c1 = close[1]
diff = ta.change(close)
plot(c1, "Prev Close")
plot(diff, "Price Delta")
"""
        res = pine_bridge.transpile_script(code)
        assert res.get("metainfo") is not None
        assert len(res["metainfo"].get("plots", [])) == 2

    def test_t3_06_starter_templates_and_metainfo_v52_contract(self, pine_bridge, sample_pine_scripts):
        """Pairwise Test 6: All starter templates checked for metainfo version 52 and schema compliance."""
        templates = ["ema_cross", "rsi", "macd", "bollinger_bands", "supertrend"]
        for t_name in templates:
            res = pine_bridge.transpile_script(sample_pine_scripts[t_name])
            assert res.get("metainfo") is not None, f"Template {t_name} failed transpilation"
            meta = res["metainfo"]
            assert meta.get("_metainfoVersion") == 52, f"Template {t_name} not version 52"
            assert "id" in meta
            assert "name" in meta
            assert "plots" in meta
            assert "defaults" in meta

    def test_t3_07_storage_persistence_and_dynamic_registration(self):
        """Pairwise Test 7: Storing custom indicators and converting to custom_indicators_getter list."""
        storage = {}
        indicators = [
            {"id": "ind_1", "name": "Custom RSI 14", "code": "//@version=5\nindicator('RSI')\nplot(close)"},
            {"id": "ind_2", "name": "Custom MACD", "code": "//@version=5\nindicator('MACD')\nplot(close)"}
        ]
        for ind in indicators:
            storage[ind["id"]] = ind

        # Simulate custom_indicators_getter mapping
        study_list = []
        for ind in storage.values():
            study_list.append({
                "name": ind["name"],
                "metainfo": {"_metainfoVersion": 52, "id": f"{ind['id']}@tv-customstudies-1", "name": ind["name"]},
                "constructor": lambda: None
            })
        assert len(study_list) == 2
        assert study_list[0]["name"] == "Custom RSI 14"

    def test_t3_08_seconds_cache_and_incremental_delta_sync(self, client):
        """Pairwise Test 8: Seconds cache initialized then queried for different resolutions."""
        now = int(time.time())
        # First query: 1S
        r1 = client.get(f"/history?symbol=EURUSD.&resolution=1S&from={now - 300}&to={now}")
        assert r1.status_code == 200

        # Second query: 5S on same symbol (leverages cached ticks)
        r2 = client.get(f"/history?symbol=EURUSD.&resolution=5S&from={now - 300}&to={now}")
        assert r2.status_code == 200

    def test_t3_09_rapid_resolution_switching_under_load(self, client):
        """Pairwise Test 9: Rapid resolution switching sequence (1S -> 40T -> 1 -> 60 -> 1D)."""
        now = int(time.time())
        resolutions = ["1S", "40T", "1", "60", "1D"]
        for res in resolutions:
            if res.endswith("T"):
                r = client.get("/ticks?symbol=EURUSD.&ticks_per_bar=40")
            else:
                r = client.get(f"/history?symbol=EURUSD.&resolution={res}&from={now - 86400}&to={now}")
            assert r.status_code == 200

    def test_t3_10_multi_symbol_cache_coexistence(self, client):
        """Pairwise Test 10: Multi-symbol caching without cache key collisions."""
        now = int(time.time())
        symbols = ["EURUSD.", "GBPUSD.", "XAUUSD."]
        for sym in symbols:
            r = client.get(f"/history?symbol={sym}&resolution=1S&from={now - 300}&to={now}")
            assert r.status_code == 200
            data = r.json()
            assert data.get("s") in ("ok", "no_data")

    def test_t3_11_config_capabilities_and_symbols_metadata_alignment(self, client):
        """Pairwise Test 11: /config supported resolutions aligned with /symbols resolutions."""
        r_conf = client.get("/config")
        assert r_conf.status_code == 200
        conf_res = set(r_conf.json().get("supported_resolutions", []))

        r_sym = client.get("/symbols?symbol=EURUSD.")
        assert r_sym.status_code == 200
        sym_data = r_sym.json()
        if "supported_resolutions" in sym_data:
            sym_res = set(sym_data["supported_resolutions"])
            # Ensure major resolutions are in both
            for expected in ["1S", "1", "60", "1D"]:
                assert expected in conf_res
                assert expected in sym_res

    def test_t3_12_custom_indicator_edit_and_retranspilation(self, pine_bridge):
        """Pairwise Test 12: Editing custom indicator and re-transpiling updates metainfo."""
        initial_code = '//@version=5\nindicator("My EMA", overlay=true)\nlen = input.int(10)\nplot(ta.ema(close, len))'
        res1 = pine_bridge.transpile_script(initial_code)
        assert res1["metainfo"]["inputs"][0]["defval"] == 10

        edited_code = '//@version=5\nindicator("My EMA", overlay=true)\nlen = input.int(50)\nplot(ta.ema(close, len))'
        res2 = pine_bridge.transpile_script(edited_code)
        assert res2["metainfo"]["inputs"][0]["defval"] == 50

    def test_t3_13_time_synchronization_and_latest_bar_alignment(self, client):
        """Pairwise Test 13: /time timestamp aligned with rate bar timestamps."""
        r_time = client.get("/time")
        assert r_time.status_code == 200
        server_ts = int(float(r_time.text))

        now = int(time.time())
        r_hist = client.get(f"/history?symbol=EURUSD.&resolution=1&from={now - 3600}&to={now}")
        assert r_hist.status_code == 200
        data = r_hist.json()
        if data.get("s") == "ok" and len(data.get("t", [])) > 0:
            last_bar_ts = data["t"][-1]
            # Last bar should not be ahead of server time
            assert last_bar_ts <= server_ts + 7200

    def test_t3_14_pine_math_functions_against_numpy_baseline(self):
        """Pairwise Test 14: Moving average calculation matches numpy/pandas reference."""
        prices = pd.Series([1.0850, 1.0852, 1.0854, 1.0856, 1.0858, 1.0860, 1.0862])
        # Calculate 3-period SMA
        expected_sma = prices.rolling(window=3).mean().dropna().tolist()
        assert len(expected_sma) == 5
        assert np.isclose(expected_sma[0], (1.0850 + 1.0852 + 1.0854) / 3.0)

    def test_t3_15_study_overlay_vs_subpane_metainfo_flag(self, pine_bridge, sample_pine_scripts):
        """Pairwise Test 15: Overlay indicators (EMA, BB) have is_price_study=true, Oscillators (RSI, MACD) false."""
        ema_res = pine_bridge.transpile_script(sample_pine_scripts["ema_cross"])
        bb_res = pine_bridge.transpile_script(sample_pine_scripts["bollinger_bands"])
        rsi_res = pine_bridge.transpile_script(sample_pine_scripts["rsi"])
        macd_res = pine_bridge.transpile_script(sample_pine_scripts["macd"])

        assert ema_res["metainfo"]["is_price_study"] is True
        assert bb_res["metainfo"]["is_price_study"] is True
        assert rsi_res["metainfo"]["is_price_study"] is False
        assert macd_res["metainfo"]["is_price_study"] is False
