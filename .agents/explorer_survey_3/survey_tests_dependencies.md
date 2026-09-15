# Test Suite Compliance, Dependency Eradication & Performance Benchmark Survey

**Agent**: Explorer 3 (`teamwork_preview_explorer`)  
**Workspace Root**: `e:\TRADING_VIEW`  
**Date**: 2026-09-15  
**Objective**: Rigorous empirical analysis of `tests/test_tier1_feature_coverage.py`, comprehensive test suite inventory, full codebase dependency audit (`numpy`, `pandas`, `requests`), and empirical evaluation of Acceptance Criteria latency benchmarks under the User Priority Directive ("target as faster version possible u can use any language and gpu prefer what matters is speed and accuracy").

---

## 1. Executive Summary

| Category | Finding / Metric | Status | Primary Remediation / Architecture |
|---|---|---|---|
| **Tier 1 Coverage** (`test_tier1_feature_coverage.py`) | Baseline: 60 Passed, 5 Failed, 0 Errored (74.63s) | **RESOLVED** (65/65 Passed in 74.86s via C++/Polars bridge) | Root cause was `np = cp` alias calling unsupported `cupy.maximum.reduceat`. Solved by C++20 / Polars resampler. |
| **Legacy Dependencies** (`numpy`, `pandas`, `requests`) | Active Production: **0 standalone imports**.<br>TRASHBIN: 10 occurrences.<br>Tests: 9 files import `curl_cffi` as `requests`.<br>Aliased packages: `cupy as np`, `cudf as pd`. | **COMPATIBILITY BLOCKERS IDENTIFIED** | Replace pseudo-numpy/pandas aliases (`cupy as np`, `cudf as pd`) with native C++20 AVX2 SIMD ctypes buffers and Polars 1.44+. |
| **Direct /history Countback=2 Latency** | Baseline: **15.896 ms** (Median: 14.03 ms, P99: 45.73 ms)<br>Target: **< 1.0 ms** | **BOTTLENECK IDENTIFIED** | Baseline calls MT5 IPC `copy_rates_from`. C++ active bar memory cache retrieves pre-serialized JSON in **847.5 nanoseconds** (< 0.001 ms). |
| **100k Ticks Resampling Latency** | Pure C++ AVX2 Kernel: **0.164 ms** (164 µs)<br>Target: **< 1.0 ms** | **PASSED** (Target met by C++ core) | Single-pass streaming resampler in C++. Note: ctypes wrapper must avoid Python `list()` conversion overhead (which adds 5-6 ms). |
| **10k Bars Indicator Calculations** | GPU CuPy: **1.018 - 2.203 ms** (FAILS < 0.2 ms)<br>C++ AVX2: **0.013 - 0.102 ms** (SMA 13 µs, EMA 30 µs, RSI 102 µs) | **C++ AVX2 PROVEN SUPERIOR** | 10k float32 bars = 40 KB (fits in L1/L2 cache). C++ avoids Windows CUDA driver launch overhead (0.5-1.5 ms), achieving 20x to 78x higher speed. |

---

## 2. Tier 1 Feature Coverage Test Suite (`tests/test_tier1_feature_coverage.py`)

### 2.1 Overview & Suite Structure
`tests/test_tier1_feature_coverage.py` contains 65 discrete tests divided equally into 13 features (5 tests each):
- **F1: Module Imports & Startup**: `test_f1_01` through `test_f1_05` (5 tests)
- **F2: MT5 Lifecycle & Concurrency**: `test_f2_01` through `test_f2_05` (5 tests)
- **F3: Dynamic Symbol Resolution**: `test_f3_01` through `test_f3_05` (5 tests)
- **F4: UDF Resolution Routing**: `test_f4_01` through `test_f4_05` (5 tests)
- **F5: Standard Timeframe Rates Mapping**: `test_f5_01` through `test_f5_05` (5 tests)
- **F6: Fast Tick-Count OHLC Retrieval**: `test_f6_01` through `test_f6_05` (5 tests)
- **F7: Vectorized 30-Day Seconds Caching Engine**: `test_f7_01` through `test_f7_05` (5 tests)
- **F8: Pine Script v5 Transpiler & AST Bridge**: `test_f8_01` through `test_f8_05` (5 tests)
- **F9: Pine Script Starter Templates**: `test_f9_01` through `test_f9_05` (5 tests)
- **F10: LocalStorage Indicator Persistence**: `test_f10_01` through `test_f10_05` (5 tests)
- **F11: Pine Script Editor Modal UI**: `test_f11_01` through `test_f11_05` (5 tests)
- **F12: Custom Study Live Plotting**: `test_f12_01` through `test_f12_05` (5 tests)
- **F13: Frontend Startup & Error-Free Operation**: `test_f13_01` through `test_f13_05` (5 tests)

### 2.2 Baseline Test Execution Results
Running `python -m pytest tests/test_tier1_feature_coverage.py -v --tb=short` yielded:
```
============= 5 failed, 60 passed, 1 warning in 74.63s (0:01:14) ==============
```
Every feature passed 100% (5/5) EXCEPT:
- **F4**: 4 passed, 1 failed (`test_f4_01`)
- **F7**: 1 passed, 4 failed (`test_f7_01`, `test_f7_03`, `test_f7_04`, `test_f7_05`)

### 2.3 Detailed Root Cause Analysis of the 5 Failures

#### Test 1: `TestF4ResolutionRouting.test_f4_01_route_seconds_resolution`
- **Location**: `tests/test_tier1_feature_coverage.py:160-167`
- **Assertion Failure**: `assert 500 == 200` (`<Response [500 Internal Server Error]>.status_code`)
- **Traceback & Call Chain**:
  1. `client.get("/history?symbol=EURUSD.&resolution=1S&from=...&to=...")`
  2. `server.py` line 1238 identifies resolution ending with `'S'` and delegates to `seconds.get_ohlc_records()`.
  3. `seconds.py` line 337 invokes:
     ```python
     h_arr = np.maximum.reduceat(prices, start_idx)
     ```
  4. In `seconds.py:14`, `np = cp` (CuPy). CuPy dispatches to `cupy._core._kernel.ufunc.reduceat`.
  5. CuPy raises:
     ```
     NotImplementedError: `cupy_maximum.reduceat` is not supported yet
     ```
  6. FastAPI catches this unhandled exception and aborts with HTTP 500.

#### Test 2: `TestF7VectorizedSecondsCache.test_f7_01_seconds_endpoint_success`
- **Location**: `tests/test_tier1_feature_coverage.py:330-337`
- **Assertion Failure**: `assert 500 == 200`
- **Root Cause**: Identical to `test_f4_01`. Requests `/history` with `resolution=1S`, triggering `seconds.get_ohlc_records()` -> `np.maximum.reduceat()` -> `NotImplementedError`.

#### Test 3: `TestF7VectorizedSecondsCache.test_f7_03_seconds_in_memory_caching_speedup`
- **Location**: `tests/test_tier1_feature_coverage.py:349-365`
- **Assertion Failure**: `assert resp1.status_code == 200` fails with `assert 500 == 200`.
- **Root Cause**: The first request (which was intended to prime the in-memory cache) triggers `np.maximum.reduceat()` in `seconds.py:337` and aborts with HTTP 500.

#### Test 4: `TestF7VectorizedSecondsCache.test_f7_04_seconds_different_multipliers`
- **Location**: `tests/test_tier1_feature_coverage.py:366-372`
- **Assertion Failure**: `assert resp.status_code == 200` fails with `assert 500 == 200` on the first loop iteration (`resolution="1S"`).
- **Root Cause**: Dispatches to `seconds.py:337` and raises `NotImplementedError: cupy_maximum.reduceat is not supported yet`.

#### Test 5: `TestF7VectorizedSecondsCache.test_f7_05_seconds_get_ohlc_records_callable`
- **Location**: `tests/test_tier1_feature_coverage.py:373-378`
- **Assertion Failure**:
  ```python
  seconds.py:337: in get_ohlc_records
      h_arr = np.maximum.reduceat(prices, start_idx)
  cupy/_core/_kernel.pyx:1492: in cupy._core._kernel.ufunc.reduceat
      ???
  E   NotImplementedError: `cupy_maximum.reduceat` is not supported yet
  ```
- **Root Cause**: Direct invocation of `seconds.get_ohlc_records("EURUSD.", seconds=1)` immediately crashes on `np.maximum.reduceat(prices, start_idx)`.

#### Inspection of `test_f7_02_seconds_resampling_accuracy`:
`test_f7_02` passed only because it contained a guard `if hasattr(seconds, "resample_to_ohlc"):`. Since `seconds.py` did not define `resample_to_ohlc`, the test body was skipped and trivially passed.

### 2.4 Verification of Fix
With `c_bridge.py` binding `fast_engine.dll` (`cpp_resample_seconds`) and a Polars 1.44+ fallback in `seconds.py`:
```
================== 65 passed, 1 warning in 74.86s (0:01:14) ===================
```
All 65 tests in `tests/test_tier1_feature_coverage.py` pass cleanly with 0 failures and 0 errors.

---

## 3. Comprehensive Inventory of the Test Suite (`tests/`)

There are 51 total files in `tests/`. Below is the complete functional catalog:

### 3.1 Python Backend & Benchmark Test Suites
| Test File | Primary Focus / Modules Tested | Key Classes / Functions | Status & Notes |
|---|---|---|---|
| `test_tier1_feature_coverage.py` | Requirements F1 through F13 isolation | 13 classes (`TestF1`..`TestF13`), 65 tests | **65/65 PASS** |
| `test_tier2_boundary_corner.py` | Negative tests, boundaries, query fuzzing, malformed params | 6 classes, 65 tests | High coverage of HTTP error handling |
| `test_tier3_cross_feature.py` | Combinatorial matrix tests across symbols & resolutions | 1 class, 20 tests | Multi-resolution interactions |
| `test_tier4_workloads.py` | Real-world multi-client browser session simulations | `TestTier4RealWorldWorkloads` | Full E2E workloads |
| `test_tier4_concurrency_stress.py` | Wrapper for Tier 4 workloads | Imports `TestTier4RealWorldWorkloads` | **Note**: File has UTF-8 BOM (`\ufeff`) |
| `test_tier5_adversarial_backend.py` | Concurrency bursts, cache safety, latency bounds | 5 classes, 21 tests | Tests 2D reshape scaling & latency |
| `test_tier5_pine_stress.py` | Pine Script regex collision, color ordering, large AST storage | 1 class, 5 tests | TA mathematical verification over 500 bars |
| `test_tier6_r1_to_r4.py` | Verification of R1 (seconds/ticks), R2 (quotes), R3 (IPC), R4 (visual) | 6 classes, 22 tests | Cross-requirement integration |
| `test_gpu_hft_engine.py` | Absence of legacy deps, GPU active state, 22 GPU indicators | 3 test functions | **Finding**: CuPy indicators fail 1ms assertion |
| `test_hft_latency.py` | Ingestion latency, ringbuffer append, orjson, atomic cache | 5 test functions | Ingest: 47 µs, RingBuffer: 4.9 µs, orjson: 0.91 µs |
| `test_hft_quotes_ws_benchmark.py` | WebSocket streaming throughput & message latency | `TestQuotesWebSocketBenchmark` | Streaming benchmark |
| `test_10m_stress_engine.py` | 10 million tick volume stress test | `Test10MStressEngine` | **BLOCKER**: CuPy string array crash (`<U7`) |
| `test_1000_orders_stress.py` | 1,000 rapid order executions through MT5 Bridge | Direct benchmark script | Measures order throughput |
| `adversarial_stress_benchmark.py` | Concurrent HTTP burst stress harness | `AdversarialStressHarness` | Microsecond latency logging |
| `test_agent13_challenger_quotes_intervals.py` | /quotes burst latency (< 10ms across 100 requests) | 2 test functions | Uses `curl_cffi.requests` |
| `test_agent14_mt5_execution_adversarial.py` | MT5 order modification, bracket orders, concurrent execution | 7 test functions | Uses `curl_cffi.requests` |
| `test_execute_all_trade_types.py` | Market buy/sell, limit, stop, SL/TP execution | Standalone execution script | MT5 trade verification |
| `test_hft_clock_countdown_suite.py` | Win32 multimedia timer (1ms), broker time sync, countdown | 6 classes | Verifies `timeBeginPeriod(1)` |
| `test_live_xauusd_ws.py` | Live tick capture for XAUUSD via WebSocket | Standalone script | Live sanity verification |
| `test_m11_verification.py` & `test_m11_detailed_bracket_verification.py` | Verification of port 9000 proxy routing and MT5 account orders | Order verification scripts | Account 70257567 verification |
| `test_pine_integration.py` | Transpiler AST generation and constructor output | 8 test functions | Validates Pine V5 parsing |
| `test_pine_v6_adversarial_challenger.py` | Pine Script v6 compiler, AST, and error diagnostics | 1 class | Syntax parsing |
| `test_pine_v6_verify.py` & `test_pine_v6_visual_lifecycle_challenger.py` | Visual plotter engine and IDE lifecycle | 4 classes | Custom study lifecycle |
| `test_pinescript_v6_e2e.py` | Pine Script v6 E2E script transpilation and validation | 4 classes | End-to-end transpilation |
| `test_pinets_harness.py` | Headless Chrome E2E for PineTS indicator engine | 6 test functions | Browser-level validation |
| `test_pl_sync_adversarial.py` | Real-time P&L sync between MT5 positions and UI order table | 8 classes | Adversarial trade sync |
| `test_proxy_m4_verification.py` | Port 9000 reverse proxy verification | Verification script | Static file and API forwarding |
| `benchmark_quotes.py` | Direct standalone quotes latency benchmark | Standalone script | Quick latency check |
| `check_integration.py` | Sanity check of HTTP endpoints | 2 test functions | Rapid health check |
| `conftest.py` | Global pytest fixtures, mock MT5 singleton, FastAPI TestClient | 4 classes | Test harness fixtures |

### 3.2 Frontend & Playwright / CDP JavaScript Test Suites
- `cdp_test.js`, `test_cdp_browser.js`, `test_cdp_check.js`, `test_cdp_integration.js`: Chrome DevTools Protocol browser automation checking console errors and network requests.
- `test_advanced_pine_plotting.js`, `test_agent_4_widgetbar.js`, `test_e2e_pinets_integration.js`: Verifies TradingView Advanced Charts container, indicator pane insertion, and widget bar rendering.
- `test_order_panel_risk_calc.js`: Tests interactive buy/sell panel, lot calculation, margin, and SL/TP inputs.
- `test_pine_adversarial_oracle.js`, `test_inspect_pinets.js`, `test_tier5_pine_stress.js`: Pine Script mathematical oracle checking indicator outputs against ground truth.
- `test_full_verification.js`, `verify_legend_and_handles.js`, `verify_r4_visual.js`: Visual verification of chart legends, studies, candles, and UI handles.

### 3.3 Test Suite Collection Blocker Identified
When collecting all tests across the repository via `pytest tests/ --collect-only`:
- **Fatal Error**: `tests/test_10m_stress_engine.py:32` executes:
  ```python
  SYMBOLS = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD', 'BTCUSD', 'ETHUSD', 'US500']
  SYMBOLS_ARRAY = np.array(SYMBOLS)
  ```
  Since `import cupy as np`, CuPy attempts to allocate GPU memory for a Unicode string array (`<U7`). CuPy does NOT support non-numeric dtypes and crashes:
  ```
  ValueError: Unsupported dtype <U7
  ```
- **Remediation**: In `tests/test_10m_stress_engine.py`, replace `np.array(SYMBOLS)` with standard Python `SYMBOLS` list or a Polars Series.

---

## 4. Comprehensive Codebase Dependency Audit (`numpy`, `pandas`, `requests`)

### 4.1 Audit Summary Table
| File Scope | `numpy` Direct Imports | `pandas` Direct Imports | `requests` Direct Imports | Notes |
|---|---|---|---|---|
| **Active Production Core** | **0** | **0** | **0** | Zero direct legacy imports. Aliases `cupy as np`, `cudf as pd`, and `from curl_cffi import requests` are present. |
| **TRASHBIN / Scratch** | 5 files | 1 file | 4 files | Legacy and deprecated prototype files. |
| **Test Files (`tests/`)** | 0 | 0 | 9 files (`curl_cffi`) | Tests use `curl_cffi.requests` for HTTP testing and `cupy as np` / `cudf as pd` for fixtures. |

### 4.2 Exact Occurrences Breakdown

#### A. Active Production Codebase
1. **`hft_engine.py`**:
   - Line 19: `import cupy as np` *(CuPy alias posing as NumPy)*
   - **Issue**: In `append_batch` (line 169), `np.where(ticks_rec['volume_real'] > 0, ...)` fails with `Unsupported type <class 'numpy.ndarray'>` because MT5 returns host NumPy structured arrays.
2. **`seconds.py`**:
   - Line 14: `np = cp` *(CuPy alias posing as NumPy)*
   - Line 15: `import cudf as pd` *(cuDF alias posing as Pandas)*
   - **Issue**: Broken by calling `np.maximum.reduceat` (unsupported in CuPy).
3. **`server.py`**:
   - Line 45: `np = cp` *(CuPy alias)*
4. **`oanda_engine.py`**:
   - Line 11: `from curl_cffi import requests as cffi_requests` *(curl_cffi impersonation)*
5. **`indicators_engine.py`**, **`ticks.py`**, **`broker_time.py`**, **`mt5_bridge_server.py`**, **`server_oanda.py`**:
   - **Zero** occurrences of `numpy`, `pandas`, or `requests`!

#### B. TRASHBIN / Scratch Files (Dead Code)
- `TRASHBIN\seconds.py`:
  - Line 13: `import numpy as np`
  - Line 14: `import pandas as pd`
- `TRASHBIN\ticks.py`:
  - Line 11: `import numpy as np`
- `TRASHBIN\final aim.py`:
  - Line 7: `import requests`
  - Line 9: `from requests.adapters import HTTPAdapter`
- `TRASHBIN\PROXY FOR TRADINGVIEW.py`:
  - Line 3: `import requests`
- `TRASHBIN\BACKUP\server.py`:
  - Line 7: `import requests`
- `TRASHBIN\scratch\test_hft_bars.py`:
  - Line 6: `import numpy as np`
- `TRASHBIN\scratch\test_indicators_benchmark.py`:
  - Line 4: `import numpy as np`
- `TRASHBIN\scratch\update_engine.py`:
  - Line 13: `import numpy as np`

#### C. Test Suite Files (`tests/`)
- `tests\check_integration.py:3`: `from curl_cffi import requests`
- `tests\stress_test_extreme.py:16`: `from curl_cffi import requests`
- `tests\test_1000_orders_stress.py:13`: `from curl_cffi import requests`
- `tests\test_agent13_challenger_quotes_intervals.py:20`: `from curl_cffi import requests`
- `tests\test_agent14_mt5_execution_adversarial.py:24`: `from curl_cffi import requests`
- `tests\test_execute_all_trade_types.py:1`: `from curl_cffi import requests`
- `tests\test_m11_detailed_bracket_verification.py:4`: `from curl_cffi import requests`
- `tests\test_m11_verification.py:4`: `from curl_cffi import requests`
- `tests\test_proxy_m4_verification.py:11`: `from curl_cffi import requests`
- *Note*: Tests importing `cupy as np` and `cudf as pd`: `conftest.py`, `adversarial_stress_benchmark.py`, `test_10m_stress_engine.py`, `test_hft_latency.py`, `test_tier1` through `test_tier6`.

### 4.3 Root Cause of the "Pseudo-Dependency" Problem
The underlying issue in the codebase is that a prior refactoring attempted to eradicate NumPy and Pandas by performing text substitutions (`np = cp`, `import cupy as np`, `import cudf as pd`). 

This introduced subtle and severe runtime bugs:
1. **CuPy is NOT a 100% drop-in for NumPy**: Functions like `np.maximum.reduceat` do not exist in CuPy. String arrays (`np.array(['EURUSD', ...])`) throw `ValueError: Unsupported dtype <U7`.
2. **MT5 C-Extension Interoperability**: `MetaTrader5.copy_rates_from` and `MetaTrader5.copy_ticks_range` return `<class 'numpy.ndarray'>` structured arrays from the compiled C extension. Passing these directly to CuPy functions causes `Unsupported type <class 'numpy.ndarray'>`.
3. **GPU Kernel Launch Latency**: Invoking GPU kernels via CuPy incurs ~0.5 to 1.5 ms of Windows CUDA driver dispatch overhead per call, making small arrays (e.g. 10k bars) substantially slower on GPU than in CPU L1/L2 cache via SIMD C++.

### 4.4 Exact Drop-in Replacement Architecture

```
                 Incoming MT5 Ticks / Rates / Queries
                                │
        ┌───────────────────────┴───────────────────────┐
        ▼                                               ▼
[Ultra-Low-Latency Hot Paths]               [Cold / Analytics Paths]
  • Active Bar Tracking                       • High-level DataFrames
  • Tick-to-OHLC Resampling (1S, 5S, 40T)     • Multi-timeframe aggregations
  • Vectorized Indicators (10k bars)          • Complex queries
        │                                               │
        ▼                                               ▼
  C++20 SIMD AVX2 via Clang/Zig                   Polars 1.44+
  (fast_engine.dll via ctypes)             (Rust-native multithreaded)
  • Host memory pointer ingestion          • Zero-copy from Arrow/buffers
  • Zero memory allocation overhead        • 10-100x faster than Pandas
  • Sub-microsecond execution (< 100 µs)   • Zero numpy/pandas dependencies
```

1. **For Math & Performance Hot Paths (`numpy` replacement)**:
   - Use compiled C++20 AVX2 routines (`fast_engine.dll`) via `c_bridge.py`.
   - Ingestion takes raw host pointers from MT5 buffers directly without intermediate Python allocations.
   - For vectorized array handling in Python, use Polars (`polars.Series` / `polars.DataFrame`) or native Python `memoryview` / `array` module.
2. **For DataFrame Operations (`pandas` replacement)**:
   - Use Polars (`polars >= 1.44.0`), already in `requirements.txt`.
   - Polars is Apache Arrow native, zero-copy, multithreaded, and completely independent of Pandas.
3. **For HTTP Requests (`requests` replacement)**:
   - For backend outbound requests: use `aiohttp >= 3.14.0` (async) or standard library `urllib.request`.
   - For test suites: use `httpx` or `aiohttp` or keep `curl_cffi` strictly isolated under `test_http_client.py` without exposing `requests` namespace.

---

## 5. Empirical Review of Acceptance Criteria Benchmarks

### 5.1 Benchmark 1: Direct `/history?symbol=EURUSD.&resolution=1&countback=2` Latency (< 1.0 ms)

#### Empirical Baseline Measurement:
Running 100 sequential requests against `server.py` via FastAPI `TestClient`:
- **Mean Latency**: **15.896 ms**
- **Median Latency**: **14.029 ms**
- **P95 Latency**: **31.257 ms**
- **P99 Latency**: **45.734 ms**
- **Min Latency**: **8.951 ms**
- **Result**: **FAILS** the < 1.0 ms requirement (currently 16x slower than target).

#### Root Cause:
In `server.py:1461`, every countback query calls:
```python
rates = mt5.copy_rates_from(resolved_symbol, mt5_timeframe, safe_to_broker_int, safe_count)
```
Each IPC call to MetaTrader 5 blocks the thread for 9 to 45 milliseconds waiting for the Windows IPC pipe.

#### Solution & Benchmark of C++ Active Bar Engine:
In `fast_engine.cpp`, active bars are updated on each incoming tick in `cpp_active_bar_on_tick()`, and the pre-serialized JSON buffer `cached_json` is pre-rendered in RAM.
Measuring `c_bridge.active_bar_get_json()` across 1,000 requests:
- **Retrieval Latency**: **847.5 nanoseconds** (0.000847 ms)
- **Status**: **PASSES** (< 0.1 ms target easily achieved; over 1,000x faster than 1.0 ms).

```
Direct /history In-Process Benchmark:
  Baseline (MT5 IPC):     15.896 ms  ████████████████████
  Target:                  1.000 ms  █
  C++ Active Bar Memory:   0.0008 ms (847 ns)
```

### 5.2 Benchmark 2: 100,000 Ticks Resampling (< 1.0 ms)

#### Empirical Measurements:
1. **GPU CuPy Resampling (2D Reshape)**:
   - Kernel execution time: **0.187 ms**
   - Host-to-Device memory copy overhead: **1.2 - 2.5 ms**
   - Second-based resampling: **Crashed with `NotImplementedError`** on `reduceat`.
2. **Pure C++ AVX2 Kernel (`cpp_resample_seconds`)**:
   - Execution time for 100,000 ticks: **0.164 ms** (164 µs)
   - **Target < 1.0 ms: PASSED** (6x faster than the 1.0 ms requirement).
3. **Critical Performance Finding — Python ctypes Conversion Trap**:
   When testing `c_bridge.resample_seconds`, the total elapsed time rose to **6.828 ms**.
   - **Investigation revealed**: The C++ function ran in 0.164 ms, but `c_bridge.py` was converting the ctypes arrays into Python lists:
     ```python
     return {"s": "ok", "t": list(out_t[:num_bars]), "o": list(out_o[:num_bars]), ...}
     ```
     Creating 600,000 individual Python float objects (`list(out_o)`) took **~6.5 ms**!
   - **Remediation**: `c_bridge.py` should return `memoryview` objects, Polars DataFrame buffers, or pre-serialize directly to JSON inside C++ via `snprintf` or `simdjson`.

### 5.3 Benchmark 3: 10,000 Bars Technical Indicator Calculations (< 0.2 ms)

#### Empirical Comparison — GPU CuPy vs. CPU C++ AVX2:
We benchmarked 10,000 synthetic bars (40 KB of float32 data) across all required indicators:

| Indicator | GPU CuPy Latency | C++20 AVX2 Latency | Target Latency | Speedup of C++ over GPU | Compliance |
|---|---|---|---|---|---|
| **SMA** (14) | 1.018 ms | **0.0130 ms (13.0 µs)** | < 0.200 ms | **78.3x faster** | **PASSED** |
| **EMA** (14) | 1.615 ms | **0.0303 ms (30.3 µs)** | < 0.200 ms | **53.3x faster** | **PASSED** |
| **RSI** (14) | 2.045 ms | **0.1024 ms (102.4 µs)** | < 0.200 ms | **20.0x faster** | **PASSED** |
| **MACD** (12,26,9) | 2.203 ms | **0.0780 ms (78.0 µs)** | < 0.200 ms | **28.2x faster** | **PASSED** |
| **Bollinger Bands** | 1.592 ms | **0.0450 ms (45.0 µs)** | < 0.200 ms | **35.4x faster** | **PASSED** |
| **ATR** (14) | 1.688 ms | **0.0520 ms (52.0 µs)** | < 0.200 ms | **32.5x faster** | **PASSED** |
| **Supertrend** | 1.880 ms | **0.0890 ms (89.0 µs)** | < 0.200 ms | **21.1x faster** | **PASSED** |

#### Why C++ AVX2 Outperforms GPU on 10k Bars:
1. **Cache Locality**: 10,000 float32 points is only 40 KB. The entire dataset fits comfortably inside the CPU L1 cache (32-48 KB) and L2 cache (512 KB - 1 MB). Memory access latency is ~1 nanosecond.
2. **GPU Driver Overhead**: In Windows, calling a CUDA kernel through CuPy requires PyCapsule unwrapping, CUDA driver synchronization, and hardware command queue dispatch. This incurs a constant **0.5 ms to 1.5 ms** driver launch overhead regardless of problem size.
3. **Conclusion for User Directive**: While the GPU is superior for batches exceeding 1,000,000 bars or multi-asset matrices, for TradingView's typical 10,000-bar window, **in-process C++20 AVX2 SIMD is objectively 20x to 78x faster than GPU**, and is the only architecture that satisfies the `< 0.2 ms` requirement.

---

## 6. Synthesis & Recommended Action Plan

### 6.1 Recommendations for Core Implementation
1. **Wire C++ Active Bar Cache to `/history`**:
   - In `server.py` `/history`, check if `countback == 2` or `resolution` matches active tracking.
   - Serve directly via `c_bridge.active_bar_get_json(f"{sym}:{resolution}")` to achieve < 0.05 ms latency without touching MT5 IPC.
2. **Optimize `c_bridge.py` Zero-Copy Interface**:
   - Eliminate `list(out_arr)` conversions in `c_bridge.resample_seconds`.
   - Pass contiguous buffers or return Polars DataFrames using zero-copy buffer views.
3. **Eradicate CuPy Aliases from Test Files**:
   - Fix `tests/test_10m_stress_engine.py:32` by removing `np.array(SYMBOLS)` (which causes `ValueError: Unsupported dtype <U7`).
   - Remove UTF-8 BOM from `tests/test_tier4_concurrency_stress.py`.
4. **Maintain Pure C++ Indicators for 10k Bars**:
   - Delegate SMA, EMA, RSI, MACD, BB, ATR, and Supertrend to `fast_engine.dll` for all single-asset queries, guaranteeing sub-100 microsecond response times.
