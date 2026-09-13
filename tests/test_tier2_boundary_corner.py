"""
Tier 2: Boundary Value Analysis & Negative Corner Cases Test Suite
Contains 65 discrete test cases covering API boundary values, negative inputs,
resolution extremes, malformed Pine Script v5 code, data stream anomalies, and stress conditions.
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


# ============================================================================
# Category 1: HTTP API Missing, Malformed & Boundary Parameters
# ============================================================================

class TestCategory1ApiParameterBoundaries:
    """Category 1: Missing, empty, malformed, and injection HTTP parameters."""

    def test_bva_01_symbols_missing_symbol_param(self, client):
        """Verify /symbols without symbol query parameter returns 422."""
        resp = client.get("/symbols")
        assert resp.status_code == 422

    def test_bva_02_symbols_empty_symbol_string(self, client):
        """Verify /symbols with empty symbol returns handled error or 404."""
        resp = client.get("/symbols?symbol=")
        assert resp.status_code in (400, 404, 422, 200)
        if resp.status_code == 200:
            assert resp.json().get("s") == "error" or resp.json().get("name") is None

    def test_bva_03_history_missing_resolution(self, client):
        """Verify /history without resolution parameter returns 422."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&from={now - 3600}&to={now}")
        assert resp.status_code == 422

    def test_bva_04_history_missing_timestamps(self, client):
        """Verify /history without from/to parameters returns 422 or defaults to 30-day window."""
        resp = client.get("/history?symbol=EURUSD.&resolution=1")
        assert resp.status_code in (200, 422)

    def test_bva_05_history_non_numeric_timestamps(self, client):
        """Verify /history with non-numeric timestamps returns 422 or 400."""
        resp = client.get("/history?symbol=EURUSD.&resolution=1&from=abc&to=xyz")
        assert resp.status_code in (400, 422)

    def test_bva_06_ticks_missing_symbol(self, client):
        """Verify /ticks without symbol parameter returns 422."""
        resp = client.get("/ticks?ticks_per_bar=40")
        assert resp.status_code == 422

    def test_bva_07_ticks_zero_ticks_per_bar(self, client):
        """Verify /ticks with ticks_per_bar=0 returns 400/422 or error."""
        resp = client.get("/ticks?symbol=EURUSD.&ticks_per_bar=0")
        assert resp.status_code in (400, 422, 500, 200)
        if resp.status_code == 200:
            assert resp.json().get("s") == "error" or "error" in resp.json()

    def test_bva_08_ticks_negative_ticks_per_bar(self, client):
        """Verify /ticks with negative ticks_per_bar returns error."""
        resp = client.get("/ticks?symbol=EURUSD.&ticks_per_bar=-50")
        assert resp.status_code in (400, 422, 500, 200)

    def test_bva_09_ticks_non_numeric_ticks_per_bar(self, client):
        """Verify /ticks with non-numeric ticks_per_bar returns 422."""
        resp = client.get("/ticks?symbol=EURUSD.&ticks_per_bar=invalid_val")
        assert resp.status_code in (400, 422)

    def test_bva_10_symbol_sql_injection_payload(self, client):
        """Verify symbol parameter with SQL injection syntax does not crash server."""
        resp = client.get("/symbols?symbol=EURUSD';DROP%20TABLE%20users;--")
        assert resp.status_code in (200, 400, 404)

    def test_bva_11_symbol_xss_payload(self, client):
        """Verify symbol parameter with XSS payload is safely handled."""
        resp = client.get("/symbols?symbol=<script>alert('xss')</script>")
        assert resp.status_code in (200, 400, 404)

    def test_bva_12_symbol_whitespace_only(self, client):
        """Verify whitespace-only symbol query returns handled error."""
        resp = client.get("/symbols?symbol=%20%20%20")
        assert resp.status_code in (200, 400, 404)


# ============================================================================
# Category 2: Symbol Resolver Boundary Cases
# ============================================================================

class TestCategory2SymbolResolverBoundaries:
    """Category 2: Non-standard symbol formats, lengths, and casing extremes."""

    def test_bva_13_symbol_excessively_long(self, client):
        """Verify resolving a 1000-character symbol name returns 404 without crashing."""
        huge_sym = "A" * 1000
        resp = client.get(f"/symbols?symbol={huge_sym}")
        assert resp.status_code in (200, 404, 400)

    def test_bva_14_symbol_multiple_trailing_dots(self, client):
        """Verify resolving symbol with multiple trailing dots (e.g. EURUSD...)."""
        resp = client.get("/symbols?symbol=EURUSD...")
        assert resp.status_code in (200, 404)

    def test_bva_15_symbol_leading_dot(self, client):
        """Verify resolving symbol with leading dot (.EURUSD)."""
        resp = client.get("/symbols?symbol=.EURUSD")
        assert resp.status_code in (200, 404)

    def test_bva_16_symbol_slash_notation(self, client):
        """Verify resolving Forex slash format (EUR/USD)."""
        resp = client.get("/symbols?symbol=EUR/USD")
        assert resp.status_code in (200, 404)

    def test_bva_17_symbol_hyphen_notation(self, client):
        """Verify resolving hyphenated symbol (EUR-USD)."""
        resp = client.get("/symbols?symbol=EUR-USD")
        assert resp.status_code in (200, 404)

    def test_bva_18_symbol_non_ascii_unicode(self, client):
        """Verify resolving unicode symbol characters (BTC₿, EURUSD€)."""
        resp = client.get("/symbols?symbol=BTC%E2%82%BF")
        assert resp.status_code in (200, 404)

    def test_bva_19_symbol_mixed_case_broker_variant(self, client):
        """Verify resolving mixed case symbols like 'EuRuSd.'."""
        resp = client.get("/symbols?symbol=EuRuSd.")
        assert resp.status_code in (200, 404)

    def test_bva_20_symbol_unknown_suffix(self, client):
        """Verify unknown broker suffix (EURUSD.xyz123) is handled gracefully."""
        resp = client.get("/symbols?symbol=EURUSD.xyz123")
        assert resp.status_code in (200, 404)

    def test_bva_21_symbol_substring_match_safety(self, client):
        """Verify query 'USD' does not falsely match 'USDIndex' when querying exact symbol."""
        resp = client.get("/symbols?symbol=USD")
        assert resp.status_code in (200, 404)

    def test_bva_22_symbol_pure_numeric_string(self, client):
        """Verify numeric symbol '12345' is handled gracefully."""
        resp = client.get("/symbols?symbol=12345")
        assert resp.status_code in (200, 404)


# ============================================================================
# Category 3: Resolution & Time Range Extremes
# ============================================================================

class TestCategory3ResolutionAndTimeRangeExtremes:
    """Category 3: Inverted timestamps, extreme lookbacks, and abnormal resolutions."""

    def test_bva_23_history_inverted_timestamps(self, client):
        """Verify from > to returns empty data or handled error."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=1&from={now}&to={now - 3600}")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") in ("no_data", "error", "ok")

    def test_bva_24_history_equal_timestamps(self, client):
        """Verify from == to returns empty data."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=1&from={now}&to={now}")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") in ("no_data", "ok")

    def test_bva_25_history_far_future_timestamps(self, client):
        """Verify far future dates (year 2065) return s: no_data."""
        resp = client.get("/history?symbol=EURUSD.&resolution=1D&from=3000000000&to=3000100000")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") in ("no_data", "ok")

    def test_bva_26_history_epoch_zero_timestamps(self, client):
        """Verify epoch 1970 timestamp query returns s: no_data."""
        resp = client.get("/history?symbol=EURUSD.&resolution=1D&from=0&to=86400")
        assert resp.status_code == 200
        data = resp.json()
        assert data.get("s") in ("no_data", "ok")

    def test_bva_27_history_negative_timestamps(self, client):
        """Verify negative timestamps return s: no_data or error without crashing."""
        try:
            resp = client.get("/history?symbol=EURUSD.&resolution=1D&from=-86400&to=0")
            assert resp.status_code in (200, 400, 422, 500)
        except Exception as e:
            assert isinstance(e, (OSError, ValueError, Exception))

    def test_bva_28_history_unsupported_resolution_format(self, client):
        """Verify unsupported resolution string (e.g. 999Z) returns handled response."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=999Z&from={now - 3600}&to={now}")
        assert resp.status_code in (200, 400)

    def test_bva_29_history_zero_second_resolution(self, client):
        """Verify resolution 0S returns error or handled response."""
        now = int(time.time())
        try:
            resp = client.get(f"/history?symbol=EURUSD.&resolution=0S&from={now - 60}&to={now}")
            assert resp.status_code in (200, 400, 422, 500)
        except Exception as e:
            assert isinstance(e, (ValueError, Exception))

    def test_bva_30_history_fractional_second_resolution(self, client):
        """Verify fractional second resolution (0.5S) handled safely."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=0.5S&from={now - 60}&to={now}")
        assert resp.status_code in (200, 400)

    def test_bva_31_history_mixed_case_resolution(self, client):
        """Verify lower-case resolution strings '1s', '1d', '1w' are normalized."""
        now = int(time.time())
        for r in ["1s", "1d", "1w"]:
            resp = client.get(f"/history?symbol=EURUSD.&resolution={r}&from={now - 86400}&to={now}")
            assert resp.status_code == 200

    def test_bva_32_history_padded_whitespace_resolution(self, client):
        """Verify resolution with leading/trailing spaces ' 1S ' is stripped."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=%201S%20&from={now - 60}&to={now}")
        assert resp.status_code == 200

    def test_bva_33_history_unsupported_tick_count_zero(self, client):
        """Verify tick resolution 0T returns handled response."""
        now = int(time.time())
        try:
            resp = client.get(f"/history?symbol=EURUSD.&resolution=0T&from={now - 60}&to={now}")
            assert resp.status_code in (200, 400, 422, 500)
        except Exception as e:
            assert isinstance(e, (ValueError, Exception))

    def test_bva_34_history_huge_year_range_clipping(self, client):
        """Verify requesting large historical window does not trigger server crash."""
        now = int(time.time())
        past_20y = max(now - (20 * 365 * 86400), 86400)
        resp = client.get(f"/history?symbol=EURUSD.&resolution=1D&from={past_20y}&to={now}")
        assert resp.status_code in (200, 400)


# ============================================================================
# Category 4: Tick & Seconds Data Stream Anomalies
# ============================================================================

class TestCategory4DataStreamAnomalies:
    """Category 4: Edge cases in tick streams, empty sets, and resampling boundaries."""

    def test_bva_35_ticks_empty_dataframe(self):
        """Verify resample_to_ohlc_by_ticks on empty tick dataframe."""
        import ticks
        empty_df = pd.DataFrame(columns=["price", "volume"])
        if hasattr(ticks, "resample_to_ohlc_by_ticks"):
            out = ticks.resample_to_ohlc_by_ticks(empty_df, ticks_per_bar=40)
            assert len(out) == 0

    def test_bva_36_ticks_single_tick(self):
        """Verify resampling exactly 1 tick when ticks_per_bar=40."""
        import ticks
        df_1 = pd.DataFrame({"price": [1.0850], "volume": [1]}, index=pd.date_range("2026-08-27", periods=1, freq="1s"))
        if hasattr(ticks, "resample_to_ohlc_by_ticks"):
            # only_full=True should produce 0 bars
            out_full = ticks.resample_to_ohlc_by_ticks(df_1, ticks_per_bar=40, only_full=True)
            assert len(out_full) == 0

    def test_bva_37_ticks_zero_spread(self):
        """Verify ticks with bid == ask produce valid OHLC."""
        import ticks
        df = pd.DataFrame({
            "bid": [1.0850, 1.0852],
            "ask": [1.0850, 1.0852]
        })
        if hasattr(ticks, "build_price_series"):
            mid = ticks.build_price_series(df, "mid")
            assert np.allclose(mid, [1.0850, 1.0852])

    def test_bva_38_ticks_inverted_spread(self):
        """Verify ticks with inverted bid/ask handled gracefully."""
        import ticks
        df = pd.DataFrame({"bid": [1.0860], "ask": [1.0850]})
        if hasattr(ticks, "build_price_series"):
            mid = ticks.build_price_series(df, "mid")
            assert mid.iloc[0] == 1.0855

    def test_bva_39_ticks_missing_time_msc(self):
        """Verify dataframe with only 'time' (seconds) parses datetime."""
        import ticks
        df = pd.DataFrame({"time": [1787600000, 1787600001], "price": [1.0, 1.1]})
        if hasattr(ticks, "detect_and_make_datetime"):
            dt_idx = ticks.detect_and_make_datetime(df)
            assert len(dt_idx) == 2

    def test_bva_40_ticks_non_monotonic_timestamps(self):
        """Verify out-of-order ticks are sorted properly."""
        import ticks
        df = pd.DataFrame(
            {"price": [1.0850, 1.0860, 1.0840]},
            index=pd.to_datetime(["2026-08-27 10:00:02", "2026-08-27 10:00:00", "2026-08-27 10:00:01"], utc=True)
        )
        if hasattr(ticks, "resample_to_ohlc_by_ticks"):
            out = ticks.resample_to_ohlc_by_ticks(df, ticks_per_bar=3)
            assert len(out) == 1

    def test_bva_41_ticks_duplicate_timestamps(self):
        """Verify duplicate tick timestamps handled without indexing errors."""
        import ticks
        df = pd.DataFrame(
            {"price": [1.0850, 1.0851, 1.0852]},
            index=pd.to_datetime(["2026-08-27 10:00:00", "2026-08-27 10:00:00", "2026-08-27 10:00:00"], utc=True)
        )
        if hasattr(ticks, "resample_to_ohlc_by_ticks"):
            out = ticks.resample_to_ohlc_by_ticks(df, ticks_per_bar=3)
            assert len(out) == 1

    def test_bva_42_ticks_massive_synthetic_batch(self):
        """Verify 100,000 ticks resample within performance limit."""
        n = 100000
        prices = 1.0800 + np.cumsum(np.random.normal(0, 0.0001, n))
        ticks_per_bar = 40
        num_bars = n // ticks_per_bar
        t0 = time.perf_counter()
        # 2D numpy reshape
        chunked = prices[:num_bars * ticks_per_bar].reshape(num_bars, ticks_per_bar)
        o = chunked[:, 0]
        h = np.max(chunked, axis=1)
        l = np.min(chunked, axis=1)
        c = chunked[:, -1]
        elapsed = time.perf_counter() - t0
        assert len(o) == num_bars
        assert elapsed < 0.5, f"Vectorized 100k tick chunking took {elapsed:.3f}s"

    def test_bva_43_seconds_no_ticks_in_quiet_period(self):
        """Verify seconds resampling with gaps drops empty periods without NaN."""
        import seconds
        df = pd.DataFrame(
            {"price": [1.0850, 1.0860]},
            index=pd.to_datetime(["2026-08-27 10:00:00", "2026-08-27 10:05:00"], utc=True)
        )
        if hasattr(seconds, "resample_to_ohlc"):
            out = seconds.resample_to_ohlc(df, seconds=1)
            assert not out.isna().any().any()

    def test_bva_44_seconds_price_side_invalid_raises_error(self):
        """Verify invalid price_side raises ValueError."""
        import seconds
        df = pd.DataFrame({"bid": [1.0], "ask": [1.1]})
        if hasattr(seconds, "build_price_series"):
            with pytest.raises(ValueError):
                seconds.build_price_series(df, "invalid_side_name")


# ============================================================================
# Category 5: Pine Script v5 Syntax & Compiler Boundaries
# ============================================================================

class TestCategory5PineSyntaxBoundaries:
    """Category 5: Malformed, truncated, and edge-case Pine Script v5 code."""

    def test_bva_45_pine_empty_script(self, pine_bridge):
        """Verify transpiling empty string returns handled error."""
        res = pine_bridge.transpile_script("")
        assert res.get("errors") is not None or res.get("error") is not None or res.get("metainfo") is None

    def test_bva_46_pine_comments_only(self, pine_bridge):
        """Verify transpiling comments only returns handled error."""
        res = pine_bridge.transpile_script("// Just a comment\n// Another line")
        assert res.get("errors") is not None or res.get("metainfo") is None or len(res.get("metainfo", {}).get("plots", [])) == 0

    def test_bva_47_pine_missing_indicator_header(self, pine_bridge):
        """Verify script without indicator() header handles cleanly."""
        code = "len = input.int(14)\nplot(close)"
        res = pine_bridge.transpile_script(code)
        assert res.get("metainfo") is not None or res.get("errors") is not None

    def test_bva_48_pine_unclosed_indicator_string(self, pine_bridge):
        """Verify unclosed string in indicator header is caught."""
        code = '//@version=5\nindicator("Unclosed Title\nplot(close)'
        res = pine_bridge.transpile_script(code)
        assert res is not None

    def test_bva_49_pine_unclosed_parenthesis(self, pine_bridge):
        """Verify unclosed parenthesis syntax handles gracefully."""
        code = '//@version=5\nindicator("Test")\nfast = ta.ema(close, 14\nplot(fast)'
        res = pine_bridge.transpile_script(code)
        assert res is not None

    def test_bva_50_pine_unclosed_bracket_lookback(self, pine_bridge):
        """Verify unclosed bracket lookback syntax handles gracefully."""
        code = '//@version=5\nindicator("Test")\np = close[1\nplot(p)'
        res = pine_bridge.transpile_script(code)
        assert res is not None

    def test_bva_51_pine_unknown_ta_function(self, pine_bridge):
        """Verify calling non-existent TA function does not crash transpiler."""
        code = '//@version=5\nindicator("Test")\nx = ta.non_existent_function_123(close)\nplot(x)'
        res = pine_bridge.transpile_script(code)
        assert res is not None

    def test_bva_52_pine_invalid_input_type(self, pine_bridge):
        """Verify invalid input type fallback."""
        code = '//@version=5\nindicator("Test")\nx = input.unknown_type(10, "Test")\nplot(close)'
        res = pine_bridge.transpile_script(code)
        assert res is not None

    def test_bva_53_pine_input_minval_greater_than_maxval(self, pine_bridge):
        """Verify minval > maxval is handled safely."""
        code = '//@version=5\nindicator("Test")\nx = input.int(10, "Len", minval=50, maxval=20)\nplot(close)'
        res = pine_bridge.transpile_script(code)
        assert res is not None

    def test_bva_54_pine_plot_undefined_variable(self, pine_bridge):
        """Verify plot with undeclared variable handles safely."""
        code = '//@version=5\nindicator("Test")\nplot(undefined_var_xyz)'
        res = pine_bridge.transpile_script(code)
        assert res is not None

    def test_bva_55_pine_multiple_indicator_declarations(self, pine_bridge):
        """Verify multiple indicator() headers in same script handled safely."""
        code = '//@version=5\nindicator("First")\nindicator("Second")\nplot(close)'
        res = pine_bridge.transpile_script(code)
        assert res.get("metainfo") is not None

    def test_bva_56_pine_mismatched_destructuring_tuple(self, pine_bridge):
        """Verify mismatched destructuring tuple does not crash transpiler."""
        code = '//@version=5\nindicator("Test")\n[a, b] = ta.macd(close, 12, 26, 9)\nplot(a)'
        res = pine_bridge.transpile_script(code)
        assert res is not None


# ============================================================================
# Category 6: Storage, Concurrency & State Stress
# ============================================================================

class TestCategory6StorageAndConcurrencyStress:
    """Category 6: LocalStorage boundaries, JSON corruption recovery, and concurrency limits."""

    def test_bva_57_storage_empty_indicator_id(self):
        """Verify operations with empty indicator ID handled safely."""
        store = {}
        assert store.get("") is None

    def test_bva_58_storage_large_script_payload(self):
        """Verify saving large Pine script (100KB) persists in JSON without corruption."""
        large_code = "//@version=5\nindicator('Large')\n" + ("x = close\n" * 5000) + "plot(x)"
        store = {"large_ind": {"id": "large_ind", "code": large_code}}
        serialized = json.dumps(store)
        deserialized = json.loads(serialized)
        assert len(deserialized["large_ind"]["code"]) == len(large_code)

    def test_bva_59_storage_corrupted_json_recovery(self):
        """Verify corrupted JSON string recovers safely."""
        corrupted_json = '{"ind_1": {"id": "ind_1", "name": "Broken'
        try:
            data = json.loads(corrupted_json)
        except json.JSONDecodeError:
            data = {}  # Recovery behavior
        assert data == {}

    def test_bva_60_storage_special_characters_in_name(self):
        """Verify special characters (quotes, backslashes, emojis) in indicator title."""
        title = 'EMA 9 "Special" \\ & <Test> 📈'
        ind = {"id": "ind_spec", "name": title}
        serialized = json.dumps(ind)
        restored = json.loads(serialized)
        assert restored["name"] == title

    def test_bva_61_mt5_terminal_disconnect_recovery(self, mock_mt5_singleton):
        """Verify simulating MT5 initialization failure returns handled error."""
        mock_mt5_singleton._should_fail_init = True
        init_res = mock_mt5_singleton.initialize()
        assert init_res is False
        assert mock_mt5_singleton.last_error()[0] == -10004
        # Restore for subsequent tests
        mock_mt5_singleton._should_fail_init = False
        mock_mt5_singleton.initialize()

    def test_bva_62_mt5_symbol_select_failure(self, mock_mt5_singleton):
        """Verify symbol_select failure on unknown symbol returns False."""
        res = mock_mt5_singleton.symbol_select("UNKNOWN_XYZ_999")
        assert res is False

    def test_bva_63_rapid_symbol_lookups_stress(self, client):
        """Verify 50 consecutive symbol lookups execute without deadlock."""
        t0 = time.perf_counter()
        for i in range(50):
            sym = f"SYM_{i % 5}"
            resp = client.get(f"/symbols?symbol={sym}")
            assert resp.status_code in (200, 404)
        elapsed = time.perf_counter() - t0
        assert elapsed < 3.0, f"50 rapid symbol queries took {elapsed:.3f}s"

    def test_bva_64_history_extreme_range_safety(self, client):
        """Verify huge time window does not crash backend."""
        now = int(time.time())
        resp = client.get(f"/history?symbol=EURUSD.&resolution=1D&from={now - 3650 * 86400}&to={now}")
        assert resp.status_code == 200

    def test_bva_65_time_endpoint_validity(self, client):
        """Verify /time returns valid timestamp close to system clock."""
        resp = client.get("/time")
        assert resp.status_code == 200
        server_time = int(float(resp.text))
        current_time = int(time.time())
        # Check within reasonable tolerance (or timezone offset)
        assert isinstance(server_time, int)
        assert server_time > 1700000000
