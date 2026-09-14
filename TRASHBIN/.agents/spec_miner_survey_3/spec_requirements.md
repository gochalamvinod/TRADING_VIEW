# Specification Requirements: High-Resolution Timekeeping, MT5 Synchronization & Real-Time Bar Countdown

**Author**: Spec Miner (Survey 3 - Timekeeping & Timescale Specialist)  
**Date**: 2026-09-08  
**Target Milestone**: R1, R2, R3 (High-Resolution Server Time, Smooth Countdown Timer, Automated Verification Suite)  
**Context**: High-Frequency Trading (HFT) Priority Directive — Sub-Millisecond Precision (< 1ms Drift) & Zero Truncation Delay.

---

## 1. Executive Summary

A comprehensive investigation into the TradingView Charting Library (v29.6.0 Standalone), the UDF Datafeed Protocol, the MetaTrader 5 API (v5.0.6147), and the underlying Windows NT time subsystem was conducted. 

### Root Causes of Clock Drift & Countdown Jumping Identified:
1. **Integer-Second Truncation in Backend `/time`**:
   `server.py` (Line 442) returns `str(int(time.time()))`. This truncates the system clock to an integer second, injecting an artificial clock skew of up to **±999 milliseconds** into TradingView's timescale.
2. **Integer Truncation in Default UDF Datafeed Bundle**:
   In `datafeeds/udf/dist/bundle.js`, `UdfCompatibleDatafeed.prototype.getServerTime` performs `const t = parseInt(s); isNaN(t) || e(t);`. Even if the server returns a floating-point timestamp, `parseInt` discards fractional seconds, locking in truncation jitter.
3. **One-Time Frozen Initialization**:
   TradingView's internal engine (`Ke` in `library.e8d44337c84d65489d2c.js`, line 151) invokes `getServerTime` only once at chart boot. Without continuous drift compensation, browser clock drift and initial network round-trip latency (RTT) permanently bias `_serverTimeOffset`.
4. **Stale Polling via `_dataPulseProvider`**:
   The chart's main series bars and internal close timers are refreshed via HTTP `/history` polling on a timer (`setInterval(this._updateData, updateFrequency)`) rather than being pushed instantly via WebSocket ticks. When a bar closes, the chart waits for the next HTTP poll round-trip before drawing the new bar, resulting in 1-second visual freezes and countdown hesitation.
5. **Windows OS Timer Resolution Default**:
   On Windows NT, standard clock resolution is 15.625 ms (64 Hz) unless `timeBeginPeriod(1)` is explicitly engaged, causing timer sleep jitter in async loops.

---

## 2. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | UDF Endpoint | `/config` | Returns datafeed capabilities, resolutions, and feature flags (`supports_time: true`). | `GET /config` | JSON object with `supports_time`, `supported_resolutions`, `seconds_multipliers` | HTTP 500 on internal failure | `server.py:410`, TV UDF Spec |
| 2 | UDF Endpoint | `/time` | Returns authoritative server time in UTC seconds for chart timescale alignment. | `GET /time` | High-res float seconds (e.g. `1788861301.868993`) | Returns current epoch fallback if MT5 disconnected | `server.py:439`, TV UDF Spec |
| 3 | UDF Endpoint | `/symbols` | Resolves symbol specifications (pricescale, session, minmov, timezone). | `GET /symbols?symbol=XAUUSD.` | Symbol metadata JSON | HTTP 404 / `{"s": "error"}` on invalid symbol | `server.py:589`, TV UDF Spec |
| 4 | UDF Endpoint | `/history` | Returns historical OHLCV bars for given symbol, resolution, and time range. | `symbol`, `resolution`, `from`, `to`, `countback` | `{"s": "ok", "t": [...], "o": [...], "h": [...], "l": [...], "c": [...], "v": [...]}` | `{"s": "no_data", "nextTime": ...}` | `server.py:666`, TV UDF Spec |
| 5 | UDF Endpoint | `/quotes` | High-frequency quote snapshot for watchlist, quote summary, and DOM. | `GET /quotes?symbols=XAUUSD.,EURUSD.` | `{"s": "ok", "d": [{...}]}` | `{"s": "error", "errmsg": "..."}` | `server.py:445`, TV UDF Spec |
| 6 | UDF Endpoint | `/ticks` | Direct access to raw ticks and custom tick-count bars. | `symbol`, `count`, `from`, `to` | Array of tick/tick-bar records | Empty array if no ticks available | `server.py:865`, `ticks.py` |
| 7 | TV Library | `getServerTime(cb)` | Datafeed method called by TV library to calculate server-client clock offset. | Callback function `(serverTimeSec: number) => void` | Invokes callback with UTC seconds | Silent failure or fallback to client clock | `library.e8d44337c84d65489d2c.js:151`, `bundle.js` |
| 8 | TV Library | `_serverTimeOffset` | Internal TV state variable: `_serverTimeOffset = e - (new Date).valueOf() / 1e3`. | Float seconds `e` from `getServerTime` | Stored offset in seconds (float) | Defaults to 0 if `getServerTime` missing | `library.e8d44337c84d65489d2c.js:151` |
| 9 | TV Library | `getCurrentUTCTime()` | Computes current chart UTC time in seconds: `(Date.now() / 1e3) + _serverTimeOffset`. | None | UTC seconds (float) | Relies on `_serverTimeOffset` | `library.e8d44337c84d65489d2c.js:151` |
| 10 | TV Library | `serverTime()` | Computes current chart server time in ms: `1e3 * getCurrentUTCTime()`. | None | Milliseconds epoch (float) | None | `library.e8d44337c84d65489d2c.js:151` |
| 11 | TV Library | `_countdownText()` | Formats remaining time until bar close: `Math.round((n - currentTime()) / 1e3)`. | Interval, last bar open time, server time | String: `MM:SS` or `HH:MM:SS` | Returns `""` for 1S, ticks, DWM, or expired | `library.e8d44337c84d65489d2c.js:419` |
| 12 | TV Library | `updateCountdown()` | Periodic method triggering canvas redraw if `_countdownText()` changes. | None | Fires price scale source change event | None | `library.e8d44337c84d65489d2c.js:419,455` |
| 13 | TV Library | Countdown Timer Interval | Internal timer running at **500 ms** calling `updateCountdown()`. | None | Price scale invalidation every 500ms | Stopped when `showCountdown` is false | `library.e8d44337c84d65489d2c.js:455` |
| 14 | TV Library | `subscribeBars()` | Subscribes to real-time candle bar updates for active series. | `symbolInfo`, `resolution`, `onRealtimeCallback` | Callback receives new/updated `Bar` objects | Falls back to polling if no realtime feed | TV Charting Library Spec |
| 15 | MT5 API | `MqlTick` | Raw tick structure from MT5 terminal IPC containing sub-second timestamp. | None | `time` (int sec), `time_msc` (int64 ms), bid, ask, last, volume | Returns `None` if terminal disconnected | MT5 Python API, `mql5.com` |
| 16 | MT5 API | Broker Timezone Offset | Hour difference between broker server time and true UTC (e.g. UTC+3 = 10800s). | Symbol tick time vs system UTC time | Integer seconds (quantized to 1800s/3600s) | Falls back to cached offset | `server.py:174`, `seconds.py:27` |
| 17 | OS Subsystem | Windows Multimedia Timer | Kernel multimedia timer setting via `ctypes.windll.winmm.timeBeginPeriod(1)`. | Period = 1 ms | Sets interrupt granularity to 1ms | Fails silently on non-Windows | Windows NT Multimedia API |
| 18 | OS Subsystem | High-Res Hardware Clock | Nanosecond-level CPU performance counter (`QueryPerformanceCounter`). | None | Monotonic nanoseconds / 0.1µs resolution | None | Python `time.perf_counter`, `time.time_ns` |
| 19 | WebSocket | `/ws/quotes` | TCP_NODELAY WebSocket stream for real-time tick and quote broadcasts. | Client JSON subscription message | Broadcasts `{"type": "quote", "data": ...}` | Auto-reconnects on disconnection | `server.py:2056`, `hft_engine.py:443` |
| 20 | WebSocket | Real-Time Bar Push | Push real-time bar events (`type: "bar"`) directly into `subscribeBars` callback. | Live MT5 tick | `Bar` object `{ time, open, high, low, close, volume }` | None | Engineered Protocol Extension |
| 21 | Trade Execution | `POST /trade/order` | Direct execution of market BUY/SELL deals on MT5 without threadpool delay. | JSON `MarketOrderRequest` | Pre-serialized `orjson` JSON with deal/order ticket and latency stats | HTTP 400/503 or MT5 error retcode | `server.py:1153` |
| 22 | Trade Execution | `POST /trade/close` | Direct position liquidation deal on MT5. | JSON `{ ticket, volume, deviation }` | Pre-serialized `orjson` JSON with close deal ticket | MT5 retcode error details | `server.py:1495` |
| 23 | Trade Execution | `POST /trade/close_all` | Emergency concurrent position flatten across all open positions. | None | JSON summary with total closed and failure counts | Aggregated partial failure list | `server.py:1626` |
| 24 | Trade Execution | RAM Price Cache | Lockless memory lookup of live Bid/Ask before order execution. | Symbol name | In-memory prices (`ask`, `bid`) in $< 10\ \mu\text{s}$ | Fallback to MT5 IPC if cold | `hft_engine.py`, `server.py` |
| 25 | Trade Execution | Orjson Zero-Copy Return | Direct `Response(content=orjson.dumps(resp))` avoiding Pydantic serializer lag. | Result dict | Microsecond JSON bytes response | Falls back to standard error handling | FastAPI + orjson |

---

## 3. Edge Cases & Failure Modes

| # | Feature | Input / Condition | Observed Behavior | Expected / Desired Specification |
|---|---------|-------------------|-------------------|----------------------------------|
| 1 | `_countdownText()` | Resolution `"1S"` (`1 === multiplier()`) | Returns `""` (no countdown displayed) | Native TV Charting Library behavior: 1S bars close every second; countdown is suppressed by design. |
| 2 | `_countdownText()` | Tick resolutions (`"1T"`, `"10T"`, `"100T"`) | Returns `""` (no countdown displayed) | Correct: Tick bars are transaction-count-based, not elapsed-time-based. |
| 3 | `_countdownText()` | Daily / Weekly / Monthly (`"1D"`, `"1W"`, `"1M"`) | Returns `""` (no countdown displayed) | Correct: DWM bars rely on session breaks, not continuous intraday countdown. |
| 4 | `_countdownText()` | Bar duration elapsed ($\text{rem} \le 0$) | Returns `""` | The countdown disappears for up to 500ms if the next bar is delayed or tick is missing. Must transition smoothly to next bar. |
| 5 | `/time` Endpoint | High Network Latency (RTT > 50ms) | Client sets offset without RTT adjustment, creating $\text{RTT}/2$ bias. | Must implement Cristian's algorithm: client measures $T_1$ and $T_2$, adjusting offset by $RTT / 2$. |
| 6 | `/time` Endpoint | Integer truncation (`int(time.time())`) | Server truncates to whole second, losing 0–999ms of sub-second precision. | Must return IEEE 754 float seconds with $\ge 6$ decimal places (microsecond resolution). |
| 7 | `datafeed.getServerTime` | Bundled `bundle.js` parses with `parseInt` | Even with float `/time`, `parseInt("1788861301.868")` yields `1788861301`. | Frontend `index.html` MUST override `datafeed.getServerTime` using `parseFloat` or WebSocket sync. |
| 8 | MT5 Broker Time | Market Closed / Weekend (no fresh ticks) | `mt5.symbol_info_tick` returns stale tick from Friday. | Drift estimator must not compute offset from stale ticks; must fall back to cached broker offset + host hardware clock. |
| 9 | MT5 Broker Time | Daylight Saving Time (DST) Transition | Broker shifts from UTC+2 (winter) to UTC+3 (summer) (7200s to 10800s). | Dynamic offset detector detects 3600s shift upon first post-transition tick without requiring restart. |
| 10 | Client Host Clock | Client clock is wrong by minutes/hours | Client `Date.now()` is desynchronized. | `_serverTimeOffset = server_time - client_time` naturally absorbs arbitrary client skew. |
| 11 | Bar Close Rollover | No tick arrives at exact second boundary (e.g. 0 ticks between 12:00:00 and 12:00:02) | Bar does not close until next tick arrives; countdown can sit at `""` or 00:00. | Real-time synthetic bar generator must project bar rollover based on synchronized server time. |

---

## 4. TradingView Charting Library & UDF Specification

### 4.1 UDF Endpoint Specifications

#### 1. Endpoint: `GET /config`
- **Purpose**: Informs TradingView Charting Library of datafeed capabilities.
- **Request**: No parameters.
- **Authoritative JSON Response Schema**:
```json
{
  "supports_search": true,
  "supports_group_request": false,
  "supports_marks": false,
  "supports_timescale_marks": false,
  "supports_time": true,
  "supports_quotes": true,
  "supported_resolutions": [
    "1S", "5S", "10S", "15S", "30S",
    "1T", "3T", "10T", "20T", "40T", "100T",
    "1", "2", "3", "4", "5", "6", "10", "12", "15", "20", "30", "45",
    "60", "120", "180", "240",
    "1D", "1W", "1M"
  ],
  "has_seconds": true,
  "seconds_multipliers": ["1", "5", "10", "15", "30"],
  "has_ticks": true,
  "is-tickbars-available": true,
  "is_tickbars_available": true,
  "ticks_multipliers": ["1", "3", "10", "20", "40", "100"],
  "has_intraday": true,
  "intraday_multipliers": ["1", "3", "5", "15", "30", "60", "120", "240"],
  "has_daily": true,
  "daily_multipliers": ["1"],
  "has_weekly_and_monthly": true,
  "weekly_multipliers": ["1"],
  "monthly_multipliers": ["1", "3", "6", "12"]
}
```

#### 2. Endpoint: `GET /time` (High-Resolution Specification)
- **Purpose**: Synchronizes TradingView client timescale with broker/server UTC clock.
- **Request**: Optional query parameter `?t1=<client_perf_timestamp>` for Cristian's algorithm.
- **Contract Format Requirements**:
  - **Content-Type**: `application/json`
  - **Body Format**: Plain numeric float or JSON structure:
    ```json
    1788861301.868993
    ```
    Or structured high-resolution envelope:
    ```json
    {
      "epoch_seconds": 1788861301.868993,
      "time_msc": 1788861301868,
      "time_ns": 1788861301868993000,
      "broker_offset_sec": 10800,
      "t1": 12458.210
    }
    ```
  - **Precision Requirement**: Double precision floating point representing seconds since UNIX epoch UTC with **at least 6 decimal places (microsecond resolution)**. Integer quantization is strictly forbidden.

#### 3. Endpoint: `GET /symbols`
- **Purpose**: Provides symbol resolution data.
- **Parameters**: `symbol` (e.g. `XAUUSD.`).
- **Response Schema**:
```json
{
  "name": "XAUUSD.",
  "ticker": "XAUUSD.",
  "description": "Gold vs US Dollar",
  "type": "metal",
  "session": "24x7",
  "exchange": "OrbexGlobal",
  "listed_exchange": "OrbexGlobal",
  "timezone": "Etc/UTC",
  "minmov": 1,
  "pricescale": 100,
  "minmove2": 0,
  "fractional": false,
  "has_intraday": true,
  "supported_resolutions": ["1S", "5S", "15S", "30S", "1", "5", "15", "60", "240", "1D"],
  "intraday_multipliers": ["1", "5", "15", "30", "60"],
  "has_seconds": true,
  "seconds_multipliers": ["1", "5", "10", "15", "30"],
  "has_ticks": true,
  "is-tickbars-available": true,
  "is_tickbars_available": true,
  "ticks_multipliers": ["1", "3", "10", "100"],
  "has_daily": true,
  "has_weekly_and_monthly": true,
  "currency_code": "USD",
  "original_currency_code": "USD",
  "format": "price"
}
```

#### 4. Endpoint: `GET /history`
- **Parameters**: `symbol`, `resolution`, `from`, `to`, `countback`.
- **Response Schema**:
```json
{
  "s": "ok",
  "t": [1788861280, 1788861285, 1788861290, 1788861295, 1788861300],
  "o": [2345.50, 2345.52, 2345.58, 2345.60, 2345.59],
  "h": [2345.55, 2345.60, 2345.62, 2345.65, 2345.61],
  "l": [2345.48, 2345.51, 2345.55, 2345.58, 2345.57],
  "c": [2345.52, 2345.58, 2345.60, 2345.59, 2345.60],
  "v": [12.5, 18.0, 9.2, 14.1, 5.0]
}
```
*Note*: `t` elements are bar start times in **seconds** UTC. In JS, TradingView multiplies `t[i] * 1000` to construct milliseconds.

---

### 4.2 TradingView Internal Clock & Countdown Architecture

#### Authoritative Code Inspection: `library.e8d44337c84d65489d2c.js`

1. **Clock Offset Computation (Line 151)**:
```javascript
this._serverTimeOffset = 0;
this._externalDatafeed.getServerTime && this._externalDatafeed.getServerTime((e => {
    this._serverTimeOffset = e - (new Date).valueOf() / 1e3
}));

serverTimeOffset() {
    return this._serverTimeOffset
}
getCurrentUTCTime() {
    return (new Date).valueOf() / 1e3 + this._serverTimeOffset
}
serverTime() {
    return 1e3 * this.getCurrentUTCTime()
}
```

**Key Architectural Invariants**:
- The callback `(e) => { ... }` passed to `getServerTime` expects `e` in **SECONDS**, NOT milliseconds.
- `(new Date).valueOf() / 1e3` represents client time in seconds with fractional milliseconds.
- Therefore, `e` must be a high-resolution float representing seconds (e.g. `1788861301.868993`).
- **Crucial Discovery**: The callback is a persistent closure. Calling it repeatedly dynamically re-calibrates `_serverTimeOffset` at runtime!

2. **Countdown Calculation (Lines 419–420)**:
```javascript
_countdownText() {
    const e = G.Interval.parse(this._source.interval());
    if (e.isDWM() || e.isTicks() || (e.isSeconds() && 1 === e.multiplier())) return "";
    const t = this._source.data().bars().last();
    if (null === t) return "";
    const i = 1e3 * (0, s.ensure)(t.value[0]),
          r = G.Interval.parse(this._source.interval()).inMilliseconds(),
          n = i.valueOf() + r;
    let o = Math.round((n - this._currentTime()) / 1e3);
    if (o <= 0) return "";
    o = Math.min(o, r / 1e3);
    let a = null;
    o >= 3600 && (a = (0, le.addLeadingZero)(Math.floor(o / 3600))),
    o %= 3600;
    const l = (0, le.addLeadingZero)(Math.floor(o / 60));
    o %= 60;
    const c = (0, le.addLeadingZero)(Math.floor(o));
    return null !== a ? `${a}:${l}:${c}` : `${l}:${c}`
}

_currentTime() {
    return window.ChartApiInstance.serverTime()
}
```

3. **Countdown Update Loop (Lines 454–455)**:
```javascript
_onShowCountdownChanged(e) {
    e.value() ?
        this._countdownUpdateTimer = this._model.setInterval((() => {
            this._priceAxisView.updateCountdown?.(),
            this._projectionPriceAxisView.updateCountdown?.()
        }), 500) :
        null !== this._countdownUpdateTimer && (
            this._model.clearInterval(this._countdownUpdateTimer),
            this._countdownUpdateTimer = null
        )
}

updateCountdown() {
    this._countdownText() !== this._previousCountdown && (
        this.update((0, he.sourceChangeEvent)(this._source.id())),
        this._model.updateSourcePriceScale(this._source)
    )
}
```

**Countdown Timing Mechanics**:
- The internal timer ticks every **500 ms**.
- The countdown text is updated on screen whenever `_countdownText()` changes.
- Because `o = Math.round((n - currentTime()) / 1000)`, the integer second changes exactly when the fractional remainder crosses the half-second boundary (`.500s`).
- If `_serverTimeOffset` is jittered by integer truncation, this transition boundary shifts unpredictably, causing visible skips and 1-second stalls.

---

## 5. MetaTrader 5 API Specification & Time Architecture

### 5.1 `MqlTick` Structure and Precision

In MetaTrader 5 (MQL5 / C++ / Python API):
```cpp
struct MqlTick {
    datetime     time;          // Time of last price update in seconds (broker local timezone)
    double       bid;           // Current Bid price
    double       ask;           // Current Ask price
    double       last;          // Price of the last deal
    ulong        volume;        // Volume for the current Last price
    long         time_msc;      // Time of price update in milliseconds since UNIX epoch (broker local)
    uint         flags;         // Tick flags
    double       volume_real;   // Volume with float precision
};
```

#### Field Characteristics:
- `time`: 32-bit/64-bit integer seconds. Truncates all sub-second tick arrival information.
- `time_msc`: 64-bit integer millisecond timestamp. This is the **authoritative timestamp** generated by the broker's trade server matching engine.
- **Precision**: 1 millisecond.

### 5.2 Broker Server Time vs. UTC

Brokers typically operate in Cyprus / Eastern European Time (EET / EEST):
- Winter: UTC+2 (+7200 seconds)
- Summer: UTC+3 (+10800 seconds)

#### Mathematical Conversions:
Let $T_{msc}$ be `tick.time_msc` from MT5.  
Let $\Delta_{tz}$ be the broker timezone offset in seconds (e.g. 10800 for UTC+3).  
The true UTC millisecond timestamp $T_{utc\_msc}$ is:
$$T_{utc\_msc} = T_{msc} - (\Delta_{tz} \times 1000)$$

And in floating-point seconds:
$$T_{utc\_sec} = \frac{T_{msc}}{1000.0} - \Delta_{tz}$$

### 5.3 Sub-Millisecond Timekeeping Infrastructure on Windows

To achieve sub-millisecond precision on Windows without kernel timer jitter:
1. **Windows Multimedia Timer Granularity (`timeBeginPeriod`)**:
   ```python
   import ctypes
   ctypes.windll.winmm.timeBeginPeriod(1)  # Set system timer interrupt to 1.0 ms
   ```
2. **Nanosecond Hardware Performance Counters**:
   - `time.perf_counter()` / `time.perf_counter_ns()`: Backed by the CPU's invariant TSC (Time Stamp Counter) via `QueryPerformanceCounter()`. Frequency is typically 10 MHz ($\approx 100\text{ ns}$ resolution). Monotonic, non-adjustable.
   - `time.time_ns()`: Backed by `GetSystemTimePreciseAsFileTime()` on Windows 8+, providing sub-microsecond wall-clock UTC.

---

## 6. Sub-Millisecond Clock Synchronization Protocol

To eliminate all clock skew between MT5 broker ticks, backend server, and the client browser:

```
[ Client Browser ]                              [ Backend FastAPI / MT5 ]
       │                                                    │
       │─── 1. Record T_client_start = performance.now() ──►│
       │    Send GET /time?t1=T_client_start                │
       │                                                    │─── 2. Sample high-res UTC
       │                                                    │    T_server = time.time()
       │                                                    │    T_msc = latest MT5 time_msc
       │◄── 3. Return JSON: { t_server, t1 } ───────────────│
       │                                                    │
       │─── 4. Record T_client_end = performance.now()      │
       │    RTT = T_client_end - T_client_start             │
       │    Theta = T_server - (Date.now() - RTT/2) / 1000  │
       │    _serverTimeOffset = Theta                       │
```

### 6.1 Mathematical Formulation (Cristian's Algorithm)

1. Client sends request at high-precision client time $t_1$.
2. Server receives and timestamps at server UTC time $T_{server}$.
3. Client receives response at client time $t_2$.
4. Total Round-Trip Time (RTT):
   $$RTT = t_2 - t_1$$
5. Assuming symmetric network latency, the server timestamp corresponded to client time:
   $$t_{client\_mid} = t_1 + \frac{RTT}{2} = \frac{t_1 + t_2}{2}$$
6. The exact clock offset $\theta$ is:
   $$\theta = T_{server} - \frac{t_{client\_mid}}{1000}$$
7. **Error Bound Guarantee**:
   The maximum possible synchronization error $\epsilon$ is strictly bounded by:
   $$\epsilon \le \frac{RTT}{2}$$
   Over localhost or high-speed local network:
   - HTTP `/time` RTT: $0.4\text{ ms} \text{ to } 1.2\text{ ms} \implies \epsilon \le 0.6\text{ ms} < 1.0\text{ ms}$.
   - WebSocket ping RTT: $0.1\text{ ms} \text{ to } 0.3\text{ ms} \implies \epsilon \le 0.15\text{ ms} \ll 1.0\text{ ms}$.

### 6.2 Continuous Kalman / Exponential Moving Average (EMA) Filter

To prevent single-request network spikes from disturbing the clock, client-side offset smoothing uses a minimum-RTT filter with EMA:
$$\theta_{opt} = \theta_k \quad \text{where } RTT_k = \min_{1 \le i \le N}(RTT_i)$$
$$\bar{\theta}_{new} = \alpha \cdot \theta_{opt} + (1 - \alpha) \cdot \bar{\theta}_{prev} \quad (\alpha = 0.2)$$

---

## 7. Real-Time Bar Countdown Interpolator & Event Pipeline

### 7.1 Real-Time WebSocket Bar Push Architecture

Rather than relying on `_dataPulseProvider` polling `/history` every 10 seconds (or 200–350ms):
1. When MT5 produces a tick, `hft_engine.py` updates the current in-progress bar in RAM.
2. The bar snapshot is pre-serialized via `orjson.dumps` (lockless zero-copy).
3. The bar is pushed over `/ws/quotes` or `/ws/bars` with payload:
   ```json
   {
     "type": "bar",
     "symbol": "XAUUSD.",
     "resolution": "5S",
     "bar": {
       "time": 1788861300000,
       "open": 2345.50,
       "high": 2345.62,
       "low": 2345.48,
       "close": 2345.60,
       "volume": 14.2
     }
   }
   ```
4. In `index.html`, the custom datafeed forwards this bar immediately to `onRealtimeCallback(msg.bar)`.
5. **Result**:
   - Zero HTTP round-trip latency.
   - Zero-second freeze at bar close.
   - Immediate creation of the next bar.

---

## 8. Verification Suite Specification (R3)

### 8.1 Acceptance Criteria Test Matrix

| Test ID | Metric | Target Specification | Validation Method |
|---------|--------|----------------------|-------------------|
| **V1.1** | Server Time Endpoint Precision | Float seconds with $\ge 6$ decimals; 0 integer truncation | HTTP GET `/time` 1000x; verify `typeof val === "number"` and `val % 1 !== 0`. |
| **V1.2** | Server Time vs MT5 Tick Clock Drift | $|\Delta| < 1.0\text{ ms}$ (99.9th percentile) | Sample `mt5.symbol_info_tick().time_msc` and `/time` concurrently; compute delta. |
| **V1.3** | Client-Server Timescale Offset Precision | Max estimation error $\epsilon \le RTT / 2 < 1.0\text{ ms}$ | Cristian's algorithm RTT check on localhost over 100 pings. |
| **V2.1** | Countdown Timer Monotonicity | $R_k \le R_{k-1}$ within bar lifetime; zero backward jumps | Sample `_countdownText()` every 50ms over 60s; assert monotonic decrement. |
| **V2.2** | Countdown Stall Freedom | No integer countdown second displays for $> 1200\text{ ms}$ or $< 800\text{ ms}$ | Measure duration $\Delta t(S)$ for each second $S$; assert $800\text{ms} \le \Delta t \le 1200\text{ms}$. |
| **V2.3** | Countdown Rollover Liveness | Time between countdown $00:00$ and new bar arrival $\le 50\text{ ms}$ | Correlate bar close timestamp with new bar emission timestamp. |
| **V3.1** | Sub-Second Chart Resolutions | 1S, 5S, 10S, 15S, 30S charts update and draw properly | Automated headless browser render test on port 9000. |
| **V3.2** | Regression Pass Rate | 100% pass on all existing 152 E2E tests (`run_e2e_tests.py`) | Execute pytest suite; assert exit code 0. |

### 8.2 Test Harness Requirements

1. **Headless Browser Test Harness (Playwright / Chrome DevTools Protocol)**:
   - Must launch headless Chromium and navigate to `http://127.0.0.1:9000/`.
   - Must access `window.widget.activeChart()` and evaluate:
     - `window.ChartApiInstance.serverTime()`
     - `window.ChartApiInstance.serverTimeOffset()`
     - Active price axis countdown label DOM / canvas state.
   - Must sample values at 20 Hz (every 50ms) for at least 15 seconds (covering multiple 5S bars).
2. **High-Frequency Python Benchmark Harness**:
   - Must use `time.perf_counter_ns()` and `ctypes.windll.winmm.timeBeginPeriod(1)`.
   - Must execute 1,000 concurrent `/time` queries and calculate jitter, mean latency, and 99.9th percentile RTT.
   - Must query `mt5.symbol_info_tick()` and compute millisecond alignment against `time.time()`.
3. **WebSocket Listener Benchmark**:
   - Connects to `ws://127.0.0.1:9000/ws/quotes`.
   - Measures packet inter-arrival times and timestamp difference:
     $$\Delta = \text{local\_arrival\_ms} - (\text{tick.time\_msc} - \Delta_{tz} \times 1000)$$
   - Confirms latency $< 1.0\text{ ms}$.

---

## 9. Trade & Order Execution Latency Specification (HFT Extension)

### 9.1 The Financial Cost of Delay
Under live market volatility (e.g. XAUUSD / Gold during NY open or macroeconomic news releases), prices can move 10–50 points per 10 milliseconds. Every 1 millisecond of internal gateway latency directly degrades execution fill prices (slippage), incurring costs of hundreds of dollars per trade on institutional size.

### 9.2 Gateway Latency Bottleneck Analysis

| Component | Legacy / Unoptimized Behavior | HFT Optimized Specification | Target Latency Budget |
|---|---|---|:---:|
| **FastAPI Route Dispatch** | `def endpoint(...)` forces `anyio.to_thread` dispatch, incurring OS thread context switch. | Direct async execution or pinned high-priority execution queue. | $< 150\ \mu\text{s}$ |
| **Pre-Trade Price Lookup** | Blocking `mt5.symbol_info_tick()` IPC call before building `trade_req`. | In-memory atomic quote cache lookup (`hft_engine.latest_quotes[sym]`). | $< 25\ \mu\text{s}$ |
| **Symbol Metadata** | Repeated `mt5.symbol_info()` IPC for digits, minmov, filling mode. | Pre-warmed RAM dictionary cache (`hft_engine.symbol_metadata`). | $< 10\ \mu\text{s}$ |
| **MT5 Driver Execution** | IPC call to `mt5.order_send(trade_req)`. | Direct lockless C IPC call. | Hardware IPC (~0.2–0.5ms) |
| **Response Serialization** | FastAPI Pydantic `jsonable_encoder` / standard `json.dumps`. | `Response(content=orjson.dumps(resp), media_type="application/json")`. | $< 40\ \mu\text{s}$ |
| **Total Gateway Overhead** | **2.5 ms – 6.0 ms** | **Sub-millisecond (< 0.5 ms)** | **$< 500\ \mu\text{s}$** |

### 9.3 Endpoint Schemas & Contracts

#### 1. `POST /trade/order`
- **Request Schema**:
```json
{
  "symbol": "XAUUSD.",
  "action": "BUY",
  "volume": 0.01,
  "price": 0.0,
  "sl": 2340.00,
  "tp": 2360.00,
  "deviation": 20,
  "magic": 234000,
  "comment": "HFT Direct"
}
```
- **Response Schema** (Pre-serialized orjson, `application/json`):
```json
{
  "success": true,
  "retcode": 10009,
  "retcode_name": "TRADE_RETCODE_DONE",
  "retcode_description": "Request completed successfully",
  "order": 123456789,
  "ticket": 123456789,
  "deal": 987654321,
  "volume": 0.01,
  "price": 2345.65,
  "bid": 2345.59,
  "ask": 2345.75,
  "comment": "Request completed successfully",
  "gateway_latency_us": 248.5
}
```

#### 2. `POST /trade/close`
- **Request Schema**:
```json
{
  "ticket": 123456789,
  "volume": 0.01,
  "deviation": 20
}
```
- **Execution Mechanism**: Lockless opposite deal (`TRADE_ACTION_DEAL`) sent immediately to MT5 driver.

#### 3. `POST /trade/close_all` (Panic Flatten)
- **Execution Mechanism**: Parallel execution across all open positions using high-speed non-blocking dispatch; complete position wipe within $\le 5\text{ ms}$.

### 9.4 Trade Execution Latency Acceptance Criteria Matrix

| Metric ID | Criterion | Target Threshold | Validation Method |
|---|---|---|---|
| **E1.1** | Gateway Pre-Trade Overhead | $\le 0.25\text{ ms}$ ($250\ \mu\text{s}$) | `time.perf_counter_ns()` measured from route entry to `mt5.order_send()`. |
| **E1.2** | Response Serialization Latency | $\le 0.05\text{ ms}$ ($50\ \mu\text{s}$) | Benchmark `orjson.dumps()` on trade result payloads over 10,000 iterations. |
| **E1.3** | Total Pre/Post Processing Budget | $\le 0.50\text{ ms}$ ($500\ \mu\text{s}$) | Total server CPU time excluding MT5 driver execution. |
| **E1.4** | Threadpool Bouncing Freedom | 0 thread hops | Route handler executes synchronously on event loop or pinned worker. |
| **E1.5** | Diagnostic Latency Logging | Sub-microsecond reporting | Responses include `"gateway_latency_us"`. |

