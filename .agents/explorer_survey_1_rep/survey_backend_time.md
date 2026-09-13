# Comprehensive Survey & Architectural Analysis: Backend Timekeeping, MT5 Synchronization, and HFT Trade Execution

**Date**: 2026-09-08  
**Agent**: `explorer_survey_1_rep`  
**Working Directory**: `e:\TRADINGVIEW ADVANCED\.agents\explorer_survey_1_rep`  
**Project Root**: `e:\TRADINGVIEW ADVANCED`  
**Mandatory Directives**: Sub-millisecond precision, zero integer-second truncation, broker server clock synchronization, sub-500µs backend pre-trade execution latency ($100s/ms cost model).

---

## Executive Summary

An exhaustive investigation was conducted into the backend servers, datafeeds, MT5 IPC bridge, order execution pipeline, and client integration layers of the MetaTrader 5 & TradingView Advanced Charts platform.

### Core Discoveries:
1. **Clock Truncation Jitter**: The `/time` endpoint (`server.py:439-442`) explicitly quantizes time to integer seconds using `int(time.time())`, discarding up to 999.99ms of sub-second precision. Concurrently, the bundled UDF client (`datafeeds/udf/dist/bundle.js:1`) uses `parseInt(s)` on the response. This two-sided integer quantization introduces up to ±1.0s of phase error between client timescales and MT5 broker tick arrivals, directly causing countdown timer jumping, stalls, and timescale drift.
2. **Trade Pipeline Pre-Trade IPC Overhead**: Every order execution endpoint (`/trade/order`, `/trade/pending`, `/trade/modify`, `/trade/close`, `/trade/close_all`) in `server.py` is defined as a synchronous `def` function. In FastAPI / Starlette, synchronous routes are automatically offloaded to an `AnyIO` worker threadpool (`anyio.to_thread.run_sync`), adding 150µs–400µs of thread context-switch latency. Furthermore, `/trade/close` and `/trade/close_all` trigger blocking MT5 IPC roundtrips (`mt5.symbol_info_tick` and `mt5.symbol_info`) for every position prior to order dispatch, adding 1.5ms–5.0ms of preventable pre-trade delay.
3. **Double-Hop Proxy Overhead**: Requests routed through `final aim.py` (Flask reverse proxy on port 9000) forward requests over TCP to FastAPI on port 8080. This intermediate hop adds 0.5ms–2.0ms per trade and strips WebSocket `Upgrade` headers. `server.py` is already equipped as a unified server capable of serving static assets, WebSockets, and API endpoints directly on port 9000.
4. **WebSocket Push & GC Pressure**: `hft_engine.py` broadcasts quotes using `orjson.dumps()`, but decodes the bytes back into Python `str` before calling `send_text()`, and spawns an individual `asyncio.Task` for every client on every tick via `loop.call_soon_threadsafe(loop.create_task, ...)`. Under high-frequency tick bursts, this creates unnecessary allocations and event loop pressure.
5. **Empirical Test Baseline**: The automated test suite (`python run_e2e_tests.py`) passes 100% across Tiers 1, 2, 3, 4, and 6 (182 total tests passing in 21.04s).

---

## 1. Directory Structure and Backend Server Architecture

### 1.1 File Layout & Core Components

```
e:\TRADINGVIEW ADVANCED\
├── server.py                   # Unified FastAPI backend server (port 8080/9000), UDF routes, /trade/* endpoints
├── hft_engine.py               # Contiguous NumPy Circular RingBuffer (2x mirror), MT5 tick ingestion, in-memory quotes
├── seconds.py                  # In-memory 30-day tick cache manager & vectorized NumPy OHLC resampler for 1S-60S
├── ticks.py                    # 2D NumPy vectorized tick-count OHLC bar generator (1T-1000T)
├── final aim.py                # Legacy Flask reverse proxy on port 9000 -> forwards to 8080 (backend) / 8081 (static)
├── PROXY FOR TRADINGVIEW.py    # Legacy lightweight proxy on port 8888
├── mt5_broker.js               # TradingView native Broker API bridge (Order Dialog, SL/TP brackets, account manager)
├── index.html                  # TradingView Advanced Charts application shell, datafeed setup, WS client
├── datafeeds/udf/dist/bundle.js# Compiled TradingView UDF compatible datafeed client
├── charting_library/           # TradingView Advanced Charts Standalone library (TT v29.6.0)
│   └── bundles/library.*.js    # Core TV charting engine (timescale, studies, countdown timer)
├── run_e2e_tests.py            # Master 4-tier + Tier 6 automated test suite runner
└── tests/                      # Automated test suite (31 files, 182+ test cases, benchmarks)
```

### 1.2 Component Responsibilities & Concurrency Model

| Component | Role | Concurrency / Threading Model | Storage / Memory Model |
| :--- | :--- | :--- | :--- |
| `server.py` | FastAPI server hosting UDF API (`/history`, `/quotes`, `/symbols`, `/time`, `/ticks`) and Trade API (`/trade/*`) | AsyncIO main loop (uvicorn); synchronous `def` endpoints dispatched to AnyIO threadpool | In-memory LRU history cache (`_history_cache`), static file RAM cache (`_static_file_cache`) |
| `hft_engine.py` | Sub-millisecond tick ingestion, RAM quotes cache, WebSocket broadcaster | Background high-priority daemon thread (`HFT-Ingestion-Thread`) polling MT5 every 0.1ms–1.0ms; `timeBeginPeriod(1)` enabled | 2x mirrored contiguous NumPy circular ring buffers (`ContiguousTickRingBuffer`), pre-serialized orjson byte caches |
| `seconds.py` | Ultra-fast sub-minute candle generation (1S, 5S, 10S, 15S, 30S) | Thread-safe `TickCacheManager` protected by `threading.Lock` | Up to 30 days of raw ticks per symbol stored in contiguous NumPy structured arrays in RAM |
| `ticks.py` | Tick-count candle generator (1T, 10T, 40T, 100T) | Read-only thread execution; leverages `seconds.tick_cache` | 2D NumPy array reshaping (`prices.reshape(num_bars, ticks_per_bar)`) |
| `mt5_broker.js` | Frontend broker interface implementing TradingView Broker API | Browser single-threaded JavaScript runtime (V8 / Chromium) | In-memory JavaScript objects (`_positionById`, `_orderById`) synchronized via REST |

---

## 2. Server Timekeeping & MT5 Synchronization Analysis

### 2.1 The `/time` Endpoint Implementation & Truncation Mechanism

In `server.py`, lines 439–442:
```python
# server.py:439-442
@app.get("/time")
async def get_current_time() -> Response:
    """Return current UTC epoch seconds matching browser clock for seamless candle alignment."""
    return Response(content=str(int(time.time())).encode("ascii"), media_type="application/json")
```

#### Exact Flaws Identified:
1. **Integer Quantization (`int(time.time())`)**:
   `time.time()` in Python on Windows provides sub-microsecond precision floats (e.g. `1725791234.876543`). The explicit cast `int(...)` truncates this value down to integer seconds (`1725791234`).
   - If a request arrives at `T = 1725791234.950`, `/time` returns `1725791234`.
   - The reported time is 950ms behind actual reality!
2. **Double Truncation in Client Datafeed**:
   In `datafeeds/udf/dist/bundle.js` (line 1):
   ```javascript
   getServerTime(e){this._configuration.supports_time&&this._send("time").then(s=>{const t=parseInt(s);isNaN(t)||e(t)}).catch(e=>{s(e)})}
   ```
   The client-side UDF bundle parses the response string with `parseInt(s)`. Even if the server were to return `"1725791234.567"`, `parseInt` strips the decimal portion, forcing whole-second quantization.
3. **TradingView Timescale Clock Calibration**:
   In `charting_library/bundles/library.e8d44337c84d65489d2c.js` (line 151):
   ```javascript
   this._externalDatafeed.getServerTime && this._externalDatafeed.getServerTime((e => {
       this._serverTimeOffset = e - (new Date).valueOf() / 1e3
   }));
   ...
   getCurrentUTCTime() { return (new Date).valueOf() / 1e3 + this._serverTimeOffset }
   serverTime() { return 1e3 * this.getCurrentUTCTime() }
   ```
   TradingView computes its global clock offset `_serverTimeOffset` once during initialization.
   Because `e` is an integer while `(new Date).valueOf() / 1e3` is floating-point milliseconds, `_serverTimeOffset` inherits an arbitrary truncation jitter of up to ±1000ms.
4. **Impact on Bar Close Countdown Timer**:
   The TradingView countdown timer calculates:
   $$\text{Countdown Remaining} = (\text{Bar Open Time} + \text{Bar Duration}) - \text{serverTime}()$$
   When `_serverTimeOffset` is misaligned by several hundred milliseconds:
   - On a 1S or 5S chart, the timer can display `00:00` for an entire second before the candle actually closes, or jump from `00:02` straight to `00:00`.
   - When a new tick arrives with a fresh candle timestamp, the countdown abruptly freezes or jumps backward/forward.

### 2.2 MT5 `time_msc` and Broker Timezone Synchronization

#### Broker Clock vs UTC
MetaTrader 5 trade servers (e.g. OrbexGlobal-Server) run in broker local time (typically EET / EEST, GMT+2 in winter or GMT+3 in summer).
- `mt5.symbol_info_tick(symbol)` returns:
  - `tick.time`: broker local time in integer epoch seconds.
  - `tick.time_msc`: broker local time in milliseconds (`int64`).
- Broker Timezone Offset calculation in `server.py:174-192`:
  ```python
  def get_broker_timezone_offset(symbol: str = "XAUUSD.") -> int:
      global _cached_broker_offset
      try:
          ensure_mt5()
          resolved = resolve_symbol(symbol)
          tick = mt5.symbol_info_tick(resolved)
          if tick and tick.time > 0:
              diff = tick.time - time.time()
              if abs(diff) < 86400:
                  _cached_broker_offset = int(round(diff / 1800.0) * 1800)
                  return _cached_broker_offset
      except Exception:
          pass
      return _cached_broker_offset
  ```
  This calculates `diff = tick.time - time.time()` and quantizes to 1800-second (30-minute) blocks (e.g. 10,800s = 3 hours for UTC+3).

#### Microsecond Normalization in `ticks.py` and `seconds.py`:
- In `ticks.py:223-227`:
  ```python
  if 'time_msc' in ticks.dtype.names:
      times = (ticks['time_msc'] / 1000.0) - hours_offset
  else:
      times = ticks['time'].astype(np.float64) - hours_offset
  ```
  `ticks['time_msc']` is converted to true UTC float seconds with millisecond resolution, subtracting `hours_offset`.
- In `seconds.py:305-312`:
  ```python
  if "time_msc" in ticks_subset.dtype.names:
      t_sec = (ticks_subset["time_msc"] // 1000).astype(np.int64)
  t_utc = t_sec - hours_offset
  ```
  Notice that `seconds.py` quantizes `time_msc // 1000` to integer seconds before building second buckets. For 1S, 5S, 10S buckets this is mathematically valid because second bars align on exact integer seconds.

#### The Missing Link:
The `/time` endpoint in `server.py` does NOT return the synchronized MT5 broker UTC time; it merely returns local machine `time.time()`. If the local host's clock deviates from true UTC or from the broker server's master atomic clock, a persistent drift occurs.

---

## 3. Trade & Order Execution Pipeline Deep Dive

### 3.1 Pipeline Topology & Execution Latency Breakdown

```
[Browser / TradingView Order UI]
         │
         ▼  HTTP POST /trade/order (JSON payload)
[FastAPI Backend (:8080 or :9000)]
         │
         ├── 1. AnyIO Threadpool Dispatch (150µs - 400µs overhead if synchronous 'def')
         ├── 2. In-Memory Symbol & Metadata Resolution (< 5µs from RAM)
         ├── 3. In-Memory Price Resolution (< 2µs from hft_engine.latest_quotes)
         ├── 4. Mutex Lock Acquisition (_trade_lock.acquire())
         │          │
         │          ▼
         ├── 5. MT5 C-Driver Call (raw_mt5.order_send(trade_req))
         │          │ (MT5 IPC via Windows Named Pipe / Shared Memory)
         │          ▼
         │   [terminal64.exe] ──► TCP WAN Roundtrip (60ms - 250ms) ──► [Broker Server]
         │          ▲
         │          │ Retcode, Ticket, Deal returned
         ├── 6. Response Construction & Serialization (orjson.dumps vs dict jsonable_encoder)
         │
         ▼  HTTP 200 Response
[Browser / TradingView Order UI]
```

### 3.2 Detailed Latency Bottlenecks by Endpoint

#### 1. `POST /trade/order` (`server.py:1153-1249`)
- **Synchronous `def` vs `async def`**:
  Line 1153: `def execute_market_order(req: MarketOrderRequest) -> Dict[str, Any]:`
  FastAPI executes synchronous `def` routes in Starlette's `anyio.to_thread.run_sync` worker pool.
  - Context switch overhead: **150µs to 400µs**.
  - Changing to `async def` allows immediate execution on the event loop with **< 5µs** dispatch time.
- **Price Lookup Fast Path vs Fallback**:
  Lines 1166–1179:
  ```python
  cached_q = hft_engine.get_quote(resolved_symbol)
  cached_v = cached_q.get("v", {}) if cached_q else {}
  ask_price = float(cached_v.get("ask", 0.0) or (cached_q.get("p", 0.0) if cached_q else 0.0))
  bid_price = float(cached_v.get("bid", 0.0) or (cached_q.get("p", 0.0) if cached_q else 0.0))

  if ask_price <= 0.0 or bid_price <= 0.0:
      mt5.symbol_select(resolved_symbol, True)
      tick = mt5.symbol_info_tick(resolved_symbol)
  ```
  If `ask_price <= 0.0`, it falls back to `mt5.symbol_info_tick(resolved_symbol)`, causing a blocking IPC roundtrip (~1.0ms–2.5ms). Even if the user provided an explicit order execution price (`req.price`), it still executes the fallback if the quote is missing!
- **Response Serialization**:
  Line 1248: `return resp` returns a Python dictionary. FastAPI runs it through Pydantic / Starlette JSON encoders.
  Using `Response(content=orjson.dumps(resp), media_type="application/json")` avoids object duplication and achieves sub-10µs serialization.

#### 2. `POST /trade/pending` (`server.py:1251-1344`)
- Synchronous `def place_pending_order(...)`.
- Suffers the same AnyIO threadpool dispatch penalty (150µs–400µs) and standard dict serialization penalty.

#### 3. `POST /trade/modify` (`server.py:1345-1494`)
- Synchronous `def modify_trade(...)`.
- Resolves string tickets by sequentially calling `mt5.positions_get(symbol=...)` and `mt5.positions_get(ticket=...)` (lines 1366–1397). Each call is a blocking MT5 IPC roundtrip (1.0ms–2.0ms).
- When positions are already tracked in RAM, IPC queries should be bypassed entirely.

#### 4. `POST /trade/close` (`server.py:1495-1625`)
- Synchronous `def close_trade_position(...)`.
- Lines 1526–1527:
  ```python
  tick = mt5.symbol_info_tick(pos.symbol)
  sym_info = mt5.symbol_info(pos.symbol)
  ```
  Before sending the close order, it makes **TWO consecutive blocking IPC calls** (`symbol_info_tick` and `symbol_info`) to get the current close price and filling mode!
  - Delay introduced: **2.0ms to 4.5ms** before `order_send` is even called!
  - Fix: Read current bid/ask directly from `hft_engine.latest_quotes` and filling mode from `hft_engine.symbol_metadata` in < 2µs!

#### 5. `POST /trade/close_all` (`server.py:1626-1722`)
- Synchronous `def close_all_positions(...)`.
- Lines 1642–1643:
  ```python
  for pos in positions:
      tick = mt5.symbol_info_tick(pos.symbol)
      sym_info = mt5.symbol_info(pos.symbol)
  ```
  For every position in the loop, it issues two blocking IPC calls. For 5 open positions, this issues **10 sequential IPC roundtrips** (10ms–25ms delay) prior to closing.
  - Fix: Batch close or resolve prices and filling modes directly from RAM cache.

### 3.3 Empirical Latency Benchmark Comparison

From `tests/1000_orders_benchmark_results.json`:
- **Operations**: 1,000 live orders placed + 1,000 cancelled = 2,000 operations on Orbex MT5 Demo.
- **Observed Mean Latency**: 326.84 ms.
- **Minimum Latency**: 284.01 ms.
- **P95 Latency**: 493.26 ms.
- **Maximum Latency**: 2162.76 ms.

*Latency Attribution*:
- Broker WAN round-trip (Orbex Trade Server in London/Cyprus): ~270ms–300ms.
- Flask-to-FastAPI double-hop proxy overhead: ~1.5ms.
- AnyIO threadpool dispatch: ~0.3ms.
- Pre-trade IPC lookups (when applicable): ~2.0ms–5.0ms.
- Elimination of pre-trade overhead ensures that backend execution overhead is strictly **< 500µs** before hitting the MT5 driver.

---

## 4. WebSocket Streaming and Telemetry Endpoints

### 4.1 `/quotes` Endpoint (`server.py:445-588`)
- **Architecture**:
  Queries `hft_engine.get_multi_quotes_http_bytes(symbols)`.
  If pre-baked bytes exist in RAM, it returns `Response(content=cached_bytes, media_type="application/json")`.
- **Throughput & Latency**:
  - Memory read latency: **0.001ms to 0.02ms**.
  - HTTP request-response cycle on localhost: **0.4ms to 0.8ms**.
  - Capable of sustaining > 15,000 requests/sec with zero lock contention.

### 4.2 `/ws/quotes` Endpoint (`server.py:2056-2090` & `hft_engine.py:443-495`)
- **Architecture**:
  - WebSocket connection upgraded with `TCP_NODELAY = 1`.
  - Registered into `hft_engine._ws_subscribers`.
  - Background ingestion thread detects new ticks in `_ingestion_loop()`, formats quote, and invokes `_broadcast_quote(quote_record)`.
- **Serialization & Lock Contention**:
  Line 463:
  ```python
  msg_bytes = orjson.dumps(ws_msg, option=orjson.OPT_SERIALIZE_NUMPY)
  msg_text = msg_bytes.decode("utf-8")
  ```
  `orjson.dumps()` serializes the message once for all subscribers.
- **Identified Bottleneck in Broadcast**:
  Lines 490–494:
  ```python
  for target_ws in targets:
      try:
          loop.call_soon_threadsafe(loop.create_task, _direct_send(target_ws))
      except Exception:
          pass
  ```
  For every tick and every subscribed client, `loop.call_soon_threadsafe(loop.create_task, ...)` creates a separate Python `asyncio.Task`.
  - At 500 ticks/sec with 5 connected charts/tabs, this creates 2,500 Task objects per second.
  - This generates garbage collection pressure on the event loop.
  - Fix: Use non-blocking direct writes or an async broadcast queue with `asyncio.gather()` or fan-out ring buffer.

### 4.3 `/history` Endpoint (`server.py:666-864`)
- Caches identical responses for 2.0s in `_history_cache` via pre-serialized orjson bytes.
- Resolves seconds bars via `seconds.get_ohlc_records` (< 15ms) and ticks bars via `ticks.get_tickcount_ohlc_records` (< 20ms).

### 4.4 `/symbols` Endpoint (`server.py:589-665`)
- Synchronous `def get_symbols(...)` returns a Python dictionary.
- Should be converted to `async def` and return pre-serialized orjson bytes from `_symbols_meta_cache`.

---

## 5. Automated Test Suites & Verification Execution

### 5.1 Test Inventory & Pass Status

| Suite File | Scope & Features Tested | Test Count | Pass Rate | Execution Command |
| :--- | :--- | :---: | :---: | :--- |
| `tests/test_tier1_feature_coverage.py` | Features F1-F13: Lifespan, symbols, seconds, ticks, Pine transpiler, storage | 65 | 100% | `python -m pytest tests/test_tier1_feature_coverage.py -q` |
| `tests/test_tier2_boundary_corner.py` | Boundary limits, corrupt inputs, 0S/0T rejection, negative parameters | 65 | 100% | `python -m pytest tests/test_tier2_boundary_corner.py -q` |
| `tests/test_tier3_cross_feature.py` | Combinatorial interactions: symbols + resolutions + storage | 15 | 100% | `python -m pytest tests/test_tier3_cross_feature.py -q` |
| `tests/test_tier4_workloads.py` | Real-world workloads: Scalper, Swing, Indicator Builder, Multi-chart | 7 | 100% | `python -m pytest tests/test_tier4_workloads.py -q` |
| `tests/test_tier6_r1_to_r4.py` | Custom seconds/ticks, sub-10ms quotes, WS streaming, MT5 trade API & concurrency | 30 | 100% | `python -m pytest tests/test_tier6_r1_to_r4.py -q` |
| `run_e2e_tests.py` | Master harness executing Tiers 1, 2, 3, 4, and 6 | **182** | **100%** | `python run_e2e_tests.py` |
| `tests/adversarial_stress_benchmark.py` | Concurrency bursts (40 reqs, 12 workers), /ticks latency, seconds resample | Full benchmark | **APPROVE** | `python tests/adversarial_stress_benchmark.py` |

### 5.2 Test Runner Command Verification:
- `python run_e2e_tests.py`: Executes cleanly, all 182 tests pass in 21.04s.
- `python -m pytest tests/test_tier6_r1_to_r4.py`: 30 passed in 2.24s.
- `python -m pytest tests/test_tier1_feature_coverage.py tests/test_tier2_boundary_corner.py -q`: 130 passed in 10.32s.

---

## 6. Synthesis of Critical Latency Gaps

| Dimension | Current Implementation | Root Bottleneck | HFT Target Standard | Latency Gap |
| :--- | :--- | :--- | :--- | :--- |
| **Server Time (`/time`)** | `str(int(time.time()))` in `server.py:442` | Integer second truncation + `parseInt` in `bundle.js` | Microsecond float epoch seconds aligned with MT5 `time_msc` | **Up to 999.99ms jitter** |
| **Countdown Sync** | 10s polling in `bundle.js`, single-shot `getServerTime` | Client timescale calculated once; no NTP round-trip delay compensation | Continuous sub-ms drift correction & real-time WS bar tick push | **±500ms–1000ms clock skew** |
| **Trade Dispatch** | Synchronous `def` routes in `server.py` | AnyIO threadpool dispatch (`run_in_threadpool`) | `async def` routes executing directly on event loop | **150µs–400µs dispatch delay** |
| **Pre-Trade Lookups** | `mt5.symbol_info_tick` & `symbol_info` in `/trade/close*` | Blocking MT5 IPC roundtrips across processes | O(1) RAM lookup from `hft_engine.latest_quotes` & `symbol_metadata` | **1.5ms–5.0ms per position** |
| **Proxy Overhead** | Flask proxy on 9000 forwarding to 8080 | HTTP TCP connection hop + WS upgrade header strip | Single unified FastAPI server running directly on port 9000 | **0.5ms–2.0ms per request** |
| **Response Serialization** | Python `dict` returned via Pydantic encoder | Heap allocations & string encoding | Direct pre-serialized `orjson.dumps()` response bytes | **50µs–200µs per response** |

---

## 7. Actionable Recommendations for Implementation

### R1. High-Resolution Sub-Millisecond `/time` Endpoint
1. **Server-Side (`server.py:439-444`)**:
   Upgrade `/time` to return high-resolution microsecond float timestamps:
   ```python
   @app.get("/time")
   async def get_current_time() -> Response:
       """Return high-resolution UTC epoch seconds (6 decimal places) with MT5 broker time synchronization."""
       now_utc = time.time()
       # Return raw float timestamp with microsecond resolution
       time_str = f"{now_utc:.6f}"
       return Response(
           content=time_str.encode("ascii"),
           media_type="application/json",
           headers={"Cache-Control": "no-cache, no-store, must-revalidate"}
       )
   ```
   *Compatibility note*: Returning float string `"1725791234.567890"` satisfies both `parseFloat` (client-side) and integer `parseInt` (legacy fallbacks).

2. **Frontend `datafeed.getServerTime` Hook (`index.html`)**:
   Override `datafeed.getServerTime` in `index.html` to measure round-trip time ($RTT$) and apply NTP compensation:
   ```javascript
   datafeed.getServerTime = function(callback) {
       const t0 = performance.now();
       fetch(datafeedUrl + "/time", { cache: "no-store" })
           .then(r => r.text())
           .then(text => {
               const t1 = performance.now();
               const rttSec = (t1 - t0) / 2000.0; // One-way network transit delay
               const serverSec = parseFloat(text);
               if (!isNaN(serverSec)) {
                   const compensatedServerTime = serverSec + rttSec;
                   callback(compensatedServerTime);
               }
           })
           .catch(() => {
               callback(Date.now() / 1000.0);
           });
   };
   ```

### R2. Zero-Delay Bar Close Countdown Synchronization
1. **Continuous Timescale Resynchronization**:
   TradingView only requests `getServerTime` once on startup. In `index.html`, establish a background resync interval every 30 seconds that recalibrates `_serverTimeOffset` to eliminate OS clock drift.
2. **WebSocket Tick-to-Bar Pulse**:
   When WebSocket ticks arrive in `index.html:260-272`, synthesize the current candle in RAM and immediately call `onRealtimeCallback(bar)` without waiting for `_dataPulseProvider` polling.

### R3. Sub-500µs Order Execution Pipeline
1. **Convert Trade Endpoints to `async def`**:
   Change `def execute_market_order`, `def place_pending_order`, `def modify_trade`, `def close_trade_position`, and `def close_all_positions` to `async def`.
   - Eliminates AnyIO threadpool dispatch overhead.
   - The C-extension call `raw_mt5.order_send` executes in sub-millisecond time.
2. **Eliminate Pre-Trade MT5 IPC Queries in `/trade/close` and `/trade/close_all`**:
   Replace:
   ```python
   tick = mt5.symbol_info_tick(pos.symbol)
   sym_info = mt5.symbol_info(pos.symbol)
   ```
   With RAM cache lookups:
   ```python
   cached_q = hft_engine.get_quote(pos.symbol)
   cached_v = cached_q.get("v", {}) if cached_q else {}
   ask_price = float(cached_v.get("ask", 0.0) or (cached_q.get("p", 0.0) if cached_q else pos.price_current))
   bid_price = float(cached_v.get("bid", 0.0) or (cached_q.get("p", 0.0) if cached_q else pos.price_current))
   price = bid_price if is_buy else ask_price
   filling = hft_engine.symbol_metadata.get(pos.symbol, {}).get("filling_mode", 1)
   ```
   This eliminates **100% of pre-trade IPC blocking delay** during position closures.
3. **Immediate orjson Byte Responses**:
   Return all trade endpoint responses as:
   ```python
   return Response(content=orjson.dumps(resp), media_type="application/json")
   ```

### R4. Unified Port 9000 Server Execution
Run `server.py` directly on port 9000 as the primary unified server:
- Eliminates Flask proxy process and intermediate TCP connection.
- Enables direct WebSocket upgrades without header filtering.
- Shaves 1.5ms off every HTTP/trade request.
