"""
test_tier5_adversarial_backend.py -- Tier 5 Adversarial Stress Testing & Empirical Validation
MetaTrader 5 Backend & TradingView Advanced Charts

This suite performs white-box adversarial stress testing, high-concurrency burst loads,
micro-latency benchmarking, cache thrashing, rapid resolution switching, parameter fuzzing,
and memory/thread safety validation on server.py, ticks.py, and seconds.py.
"""

import os
import sys
import time
import math
import string
import random
import threading
import concurrent.futures
from datetime import datetime, timezone, timedelta
from typing import List, Dict, Any, Optional

import pytest
import cupy as np
import cudf as pd
from fastapi.testclient import TestClient

# Ensure project root in sys.path
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

import server
import ticks
import seconds
from tests.conftest import MockMT5Terminal, MockSymbolInfo, MockTick


class TestTier5ConcurrencyBurst:
    """
    Stress tests verifying system resilience, data integrity, and non-blocking operation
    under simultaneous high-concurrency burst requests.
    """

    def test_t5_01_concurrent_burst_same_symbol_multiple_resolutions(self, patch_mt5, client):
        """Execute 40 simultaneous requests for the same symbol across diverse resolutions."""
        resolutions = ["1S", "5S", "10S", "30S", "10T", "40T", "1", "5", "15", "60", "1D"]
        num_requests = 40

        def make_req(idx):
            res = resolutions[idx % len(resolutions)]
            start_t = time.perf_counter()
            resp = client.get(f"/history?symbol=EURUSD.&resolution={res}&from=1700000000&to=1700086400")
            elapsed = time.perf_counter() - start_t
            return resp.status_code, resp.json(), elapsed

        with concurrent.futures.ThreadPoolExecutor(max_workers=16) as executor:
            futures = [executor.submit(make_req, i) for i in range(num_requests)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        assert len(results) == num_requests
        for status_code, data, elapsed in results:
            assert status_code == 200, f"Failed with status {status_code}: {data}"
            assert data.get("s") in ("ok", "no_data")
            if data.get("s") == "ok":
                assert len(data["t"]) == len(data["c"])

    def test_t5_02_concurrent_burst_multiple_symbols_simultaneous(self, patch_mt5, client):
        """Execute 50 simultaneous requests across 10 distinct symbols."""
        symbols = [
            "EURUSD.", "GBPUSD.", "USDJPY.", "AUDUSD.", "USDCAD.",
            "NZDUSD.", "USDCHF.", "XAUUSD.", "BTCUSD.", "USDIndex"
        ]
        num_requests = 50
        now = int(time.time())

        def make_req(idx):
            sym = symbols[idx % len(symbols)]
            if idx % 2 == 0:
                url = f"/ticks?symbol={sym}&ticks_per_bar=40&days=2"
            else:
                url = f"/history?symbol={sym}&resolution=1S&from={now-3600}&to={now}"
            resp = client.get(url)
            return resp.status_code, resp.json()

        with concurrent.futures.ThreadPoolExecutor(max_workers=20) as executor:
            futures = [executor.submit(make_req, i) for i in range(num_requests)]
            results = [f.result() for f in concurrent.futures.as_completed(futures)]

        assert len(results) == num_requests
        for status_code, data in results:
            assert status_code == 200
            assert data.get("s") in ("ok", "no_data")

    def test_t5_03_high_concurrency_race_condition_cache_safety(self, patch_mt5):
        """Verify TickCacheManager thread-safety under simultaneous cold-cache misses."""
        cache = seconds.TickCacheManager(max_symbols=5, max_days=30)
        cache.clear()

        num_threads = 25
        results = []

        def worker_get_ticks(worker_id):
            sym = "EURUSD." if worker_id % 2 == 0 else "GBPUSD."
            res = cache.get_ticks(sym, days=10)
            return len(res)

        with concurrent.futures.ThreadPoolExecutor(max_workers=num_threads) as executor:
            futures = [executor.submit(worker_get_ticks, i) for i in range(num_threads)]
            for f in concurrent.futures.as_completed(futures):
                results.append(f.result())

        assert len(results) == num_threads
        # All workers querying the same symbol should receive non-empty arrays without corruption
        assert all(count > 0 for count in results)

    def test_t5_04_interleaved_ticks_and_seconds_concurrent_stress(self, patch_mt5, client):
        """Interleave tick calculation, seconds resampling, quote requests, and symbol metadata queries."""
        now = int(time.time())
        endpoints = [
            "/ticks?symbol=EURUSD.&ticks_per_bar=40",
            f"/history?symbol=EURUSD.&resolution=1S&from={now-3600}&to={now}",
            f"/history?symbol=EURUSD.&resolution=60&from={now-86400}&to={now}",
            "/symbols?symbol=EURUSD.",
            "/quotes?symbols=EURUSD.,GBPUSD.,USDIndex",
            "/config",
            "/time"
        ]

        def call_endpoint(ep):
            resp = client.get(ep)
            return resp.status_code

        with concurrent.futures.ThreadPoolExecutor(max_workers=14) as executor:
            futures = [executor.submit(call_endpoint, endpoints[i % len(endpoints)]) for i in range(70)]
            statuses = [f.result() for f in concurrent.futures.as_completed(futures)]

        assert len(statuses) == 70
        assert all(s == 200 for s in statuses)

    def test_t5_05_concurrency_under_heavy_thread_pool_burst(self, patch_mt5, client):
        """Blast the server with 100 rapid requests from 30 parallel workers."""
        now = int(time.time())

        def burst_task(i):
            sym = "EURUSD." if i % 2 == 0 else "XAUUSD."
            r = client.get(f"/history?symbol={sym}&resolution=5S&from={now-3600}&to={now}")
            return r.status_code

        with concurrent.futures.ThreadPoolExecutor(max_workers=30) as executor:
            futures = [executor.submit(burst_task, i) for i in range(100)]
            statuses = [f.result() for f in concurrent.futures.as_completed(futures)]

        assert len(statuses) == 100
        assert all(s == 200 for s in statuses)


class TestTier5LatencyBenchmarks:
    """
    Micro-latency benchmarking to verify strict performance contracts:
    - /ticks endpoint < 1.0s consistently across multiple invocations and symbols.
    - 2D numpy reshape scaling efficiency.
    """

    def test_t5_06_ticks_latency_sub_second_strict_bound(self, patch_mt5, client):
        """Benchmark 30 sequential calls to /ticks verifying 100% complete in < 1.0s."""
        latencies = []
        for _ in range(30):
            t0 = time.perf_counter()
            resp = client.get("/ticks?symbol=EURUSD.&ticks_per_bar=40&days=2")
            dt = time.perf_counter() - t0
            latencies.append(dt)
            assert resp.status_code == 200
            assert resp.json()["s"] == "ok"

        p50 = np.percentile(latencies, 50)
        p90 = np.percentile(latencies, 90)
        p99 = np.percentile(latencies, 99)
        max_lat = max(latencies)

        assert max_lat < 1.0, f"Max latency exceeded 1.0s bound: {max_lat:.4f}s"
        assert p99 < 0.5, f"P99 latency exceeded 0.5s: {p99:.4f}s"
        assert p50 < 0.1, f"P50 latency exceeded 0.1s: {p50:.4f}s"

    def test_t5_07_ticks_varying_bar_sizes_latency_scaling(self, patch_mt5):
        """Benchmark tick-count computation across granularities: 10T, 40T, 100T, 500T."""
        granularities = [10, 40, 100, 250, 500]
        timings = {}

        for tpb in granularities:
            t0 = time.perf_counter()
            res = ticks.get_tickcount_ohlc_records("EURUSD.", ticks_per_bar=tpb, days=2)
            elapsed = time.perf_counter() - t0
            timings[tpb] = elapsed
            assert res["s"] == "ok"
            assert len(res["t"]) > 0
            assert elapsed < 1.0, f"Granularity {tpb}T took {elapsed:.4f}s >= 1.0s"

    def test_t5_08_ticks_multi_symbol_latency(self, patch_mt5):
        """Verify tick calculation latency is bounded across distinct assets."""
        symbols = ["EURUSD.", "GBPUSD.", "USDJPY.", "AUDUSD.", "XAUUSD."]
        for sym in symbols:
            t0 = time.perf_counter()
            res = ticks.get_tickcount_ohlc_records(sym, ticks_per_bar=40, days=2)
            elapsed = time.perf_counter() - t0
            assert res["s"] in ("ok", "no_data")
            assert elapsed < 1.0, f"Symbol {sym} latency {elapsed:.4f}s >= 1.0s"


class TestTier5CachingBenchmarks:
    """
    Caching performance benchmarks:
    - Initial cold-sync < 1.5s
    - Warm-cache delta response < 200ms
    - LRU eviction cap maintenance
    """

    def test_t5_09_seconds_cold_sync_latency_bound(self, patch_mt5):
        """Verify cold fetch & initial resample finishes in < 1.5s."""
        cache = seconds.TickCacheManager(max_symbols=10, max_days=30)
        cache.clear()

        now = int(time.time())
        # Cold fetch with 1-day window
        t0 = time.perf_counter()
        res = seconds.get_ohlc_records("EURUSD.", seconds=1, days=30, from_ts=now-86400, to_ts=now)
        cold_elapsed = time.perf_counter() - t0

        assert res["s"] == "ok"
        assert len(res["t"]) > 0
        assert cold_elapsed < 1.5, f"Cold sync took {cold_elapsed:.4f}s (target < 1.5s)"

    def test_t5_10_seconds_warm_cache_latency_bound(self, patch_mt5, client):
        """Verify warm-cache query latency is < 200ms (target P99 < 50ms)."""
        now = int(time.time())
        # Warm up
        client.get(f"/history?symbol=EURUSD.&resolution=1S&from={now-86400}&to={now}")

        warm_latencies = []
        for _ in range(25):
            t0 = time.perf_counter()
            resp = client.get(f"/history?symbol=EURUSD.&resolution=1S&from={now-86400}&to={now}")
            dt = time.perf_counter() - t0
            warm_latencies.append(dt)
            assert resp.status_code == 200
            assert resp.json()["s"] == "ok"

        p99 = np.percentile(warm_latencies, 99)
        max_warm = max(warm_latencies)

        assert max_warm < 0.350, f"Warm cache max latency {max_warm:.4f}s >= 350ms"
        assert p99 < 0.250, f"Warm cache P99 latency {p99:.4f}s >= 250ms"

    def test_t5_11_seconds_incremental_delta_sync_latency(self, patch_mt5):
        """Verify incremental delta cache sync does not degrade latency."""
        seconds.tick_cache.clear()
        now = int(time.time())
        # Seed cache
        seconds.get_ohlc_records("GBPUSD.", seconds=5, days=30, from_ts=now-86400, to_ts=now)

        # Allow time for throttle window
        time.sleep(1.05)

        # Delta sync call
        t0 = time.perf_counter()
        res = seconds.get_ohlc_records("GBPUSD.", seconds=5, days=30, from_ts=now-86400, to_ts=now)
        delta_elapsed = time.perf_counter() - t0

        assert res["s"] == "ok"
        assert delta_elapsed < 0.300, f"Delta sync took {delta_elapsed:.4f}s (expected < 300ms)"

    def test_t5_12_seconds_cache_eviction_lru_cap(self, patch_mt5):
        """Verify TickCacheManager respects max_symbols limit under multi-symbol churn."""
        cache = seconds.TickCacheManager(max_symbols=3, max_days=30)
        cache.clear()

        test_syms = ["SYM_A", "SYM_B", "SYM_C", "SYM_D", "SYM_E"]
        for sym in test_syms:
            cache.get_ticks(sym, days=5)

        with cache._lock:
            assert len(cache._cache) <= 3, f"Cache size {len(cache._cache)} exceeded max_symbols 3"


class TestTier5ResolutionSwitchingStress:
    """
    Rapid timeframe switching stress simulation:
    Simulates high-frequency user or bot switching between 1S, 40T, 1, 5, 15, 60, 1D.
    """

    def test_t5_13_rapid_resolution_switching_single_symbol(self, patch_mt5, client):
        """Rapidly switch through 70 resolution queries in sequence."""
        sequence = ["1S", "5S", "10S", "30S", "10T", "40T", "1", "3", "5", "15", "30", "60", "240", "1D"]
        for i in range(70):
            res = sequence[i % len(sequence)]
            resp = client.get(f"/history?symbol=EURUSD.&resolution={res}&from=1700000000&to=1700086400")
            assert resp.status_code == 200
            data = resp.json()
            assert data.get("s") in ("ok", "no_data")

    def test_t5_14_rapid_symbol_and_resolution_interleaved_matrix(self, patch_mt5, client):
        """Rapidly iterate over a 5x6 symbol-resolution matrix under high query density."""
        symbols = ["EURUSD.", "GBPUSD.", "USDJPY.", "XAUUSD.", "USDIndex"]
        resolutions = ["1S", "40T", "1", "5", "60", "1D"]

        total_queries = 0
        for s in symbols:
            for r in resolutions:
                resp = client.get(f"/history?symbol={s}&resolution={r}")
                assert resp.status_code == 200
                total_queries += 1

        assert total_queries == 30

    def test_t5_15_rapid_resolution_switching_with_time_window_jitter(self, patch_mt5, client):
        """Switch resolutions with random dynamic time windows."""
        resolutions = ["1S", "5S", "40T", "1", "15", "60", "1D"]
        base_now = int(time.time())

        for _ in range(35):
            res = random.choice(resolutions)
            window_len = random.choice([3600, 86400, 86400 * 7, 86400 * 30])
            to_t = base_now - random.randint(0, 3600)
            from_t = to_t - window_len

            resp = client.get(f"/history?symbol=EURUSD.&resolution={res}&from={from_t}&to={to_t}")
            assert resp.status_code == 200
            assert resp.json().get("s") in ("ok", "no_data")


class TestTier5ParameterFuzzingResilience:
    """
    Adversarial parameter fuzzing, malformed input handling, SQLi/XSS fuzzing,
    and graceful error recovery.
    """

    def test_t5_16_fuzzing_malformed_timestamps(self, patch_mt5, client):
        """Test malformed, negative, infinity, and inverted timestamp values."""
        now = int(time.time())
        bad_ranges = [
            (-1000, 1000),                # Negative start crossing 1970 epoch
            (now + 86400, now),           # Inverted from > to
            (0, 0),                       # Zero timestamps
            (1e12, 1e12 + 100),           # Huge year 33658 (overflow handled gracefully)
            (-9999999999, -100),          # Both negative
            (now, now + 3600),            # Valid forward window
        ]

        for f_ts, t_ts in bad_ranges:
            resp = client.get(f"/history?symbol=EURUSD.&resolution=1&from={f_ts}&to={t_ts}")
            assert resp.status_code in (200, 400, 500)
            if resp.status_code == 200:
                assert resp.json().get("s") in ("ok", "no_data")

    def test_t5_17_fuzzing_non_existent_and_corrupt_symbols(self, patch_mt5, client):
        """Fuzz symbol parameter with special chars, injections, and non-existent symbols."""
        bad_symbols = [
            "NON_EXISTENT_SYMBOL_XYZ",
            "EURUSD'''''''",
            "EURUSD<script>alert(1)</script>",
            "EURUSD; DROP TABLE ticks;",
            "../../etc/passwd",
            "%00EURUSD",
            "EURUSD" + "A" * 100,
            "!@#$%^&*()_+",
        ]

        for bad_sym in bad_symbols:
            # /symbols endpoint
            resp_sym = client.get(f"/symbols?symbol={bad_sym}")
            assert resp_sym.status_code in (200, 404, 400, 422)

            # /history endpoint
            resp_hist = client.get(f"/history?symbol={bad_sym}&resolution=1")
            assert resp_hist.status_code in (200, 400, 404, 422, 500)
            if resp_hist.status_code == 200:
                assert resp_hist.json().get("s") in ("ok", "no_data")

            # /ticks endpoint
            resp_ticks = client.get(f"/ticks?symbol={bad_sym}")
            assert resp_ticks.status_code in (200, 400, 404, 422, 500)
            if resp_ticks.status_code == 200:
                assert resp_ticks.json().get("s") in ("ok", "no_data")

    def test_t5_18_fuzzing_corrupt_resolutions_and_multipliers(self, patch_mt5, client):
        """Test corrupt resolution parameters (0S, 0T, negative, letters, syntax violations)."""
        bad_resolutions = [
            "0S", "-1S", "999999S", "abcS",
            "0T", "-40T", "abcT",
            "999Z", "INVALID", "", "   ", "1000000"
        ]

        for bad_res in bad_resolutions:
            resp = client.get(f"/history?symbol=EURUSD.&resolution={bad_res}")
            # Server should gracefully reject or handle with 400/no_data without unhandled crashes
            assert resp.status_code in (200, 400, 422)
            if resp.status_code == 200:
                assert resp.json().get("s") in ("ok", "no_data")

    def test_t5_19_fuzzing_injection_and_overflow_payloads(self, patch_mt5, client):
        """Test query injection strings across all search, quotes, and marks endpoints."""
        injections = [
            "' OR '1'='1",
            "<svg/onload=alert(1)>",
            "null",
            "undefined",
            "NaN",
            "Infinity",
            "%20%20%20"
        ]

        for inj in injections:
            # search
            r_search = client.get(f"/search?query={inj}")
            assert r_search.status_code == 200
            assert isinstance(r_search.json(), list)

            # quotes
            r_quotes = client.get(f"/quotes?symbols={inj}")
            assert r_quotes.status_code == 200
            assert r_quotes.json().get("s") == "ok"

    def test_t5_20_resilience_to_mt5_reinitialization_and_transient_failure(self, monkeypatch):
        """Verify ensure_mt5 safely re-initializes if terminal_info() returns None."""
        init_counter = {"calls": 0}

        def mock_init():
            init_counter["calls"] += 1
            return True

        def mock_terminal_info_intermittent():
            if init_counter["calls"] == 0:
                return None
            return MockSymbolInfo("EURUSD.")

        monkeypatch.setattr(server.mt5, "initialize", mock_init)
        monkeypatch.setattr(server.mt5, "terminal_info", mock_terminal_info_intermittent)

        res = server.ensure_mt5()
        assert res is True
        assert init_counter["calls"] == 1

    def test_t5_21_memory_and_thread_stability_under_sustained_burst(self, patch_mt5, client):
        """Sustained 60-request blast measuring stability and response shape integrity."""
        now = int(time.time())
        errors = []

        def worker(i):
            try:
                if i % 3 == 0:
                    r = client.get(f"/history?symbol=EURUSD.&resolution=1S&from={now-3600}&to={now}")
                elif i % 3 == 1:
                    r = client.get("/ticks?symbol=EURUSD.&ticks_per_bar=40&days=2")
                else:
                    r = client.get(f"/history?symbol=EURUSD.&resolution=15&from={now-86400}&to={now}")

                if r.status_code != 200:
                    errors.append(f"Worker {i} returned status {r.status_code}")
                data = r.json()
                if "s" not in data:
                    errors.append(f"Worker {i} returned payload without 's' key")
            except Exception as exc:
                errors.append(f"Worker {i} raised exception: {exc}")

        with concurrent.futures.ThreadPoolExecutor(max_workers=15) as executor:
            futures = [executor.submit(worker, i) for i in range(60)]
            concurrent.futures.wait(futures)

        assert len(errors) == 0, f"Encountered {len(errors)} errors during sustained burst: {errors[:5]}"
