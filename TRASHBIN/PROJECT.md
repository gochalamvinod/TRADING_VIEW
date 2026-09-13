# Project: MetaTrader 5 Backend & TradingView Advanced Charts with Custom Pine Script Engine

## Architecture
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             TradingView Frontend                                 │
│                                                                                  │
│  ┌─────────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐ │
│  │   TradingView Widget    │  │  Pine Script v5 Modal  │  │  PineJS Transpiler │ │
│  │  (TT v29.6.0 Standalone)│  │   Code Editor & UI     │  │   & AST Runtime    │ │
│  └────────────┬────────────┘  └───────────┬────────────┘  └──────────┬─────────┘ │
│               │                           │                          │           │
│               │ custom_indicators_getter  │ "Apply to Chart"         │           │
│               ▼                           ▼                          │           │
│  ┌───────────────────────────────────────────────────────────────────▼─────────┐ │
│  │       pine_engine.js (Transpiler, Storage, Metainfo, Templates, UI)        │ │
│  └────────────────────────────────────────┬───────────────────────────────────┘ │
└───────────────────────────────────────────┼──────────────────────────────────────┘
                                            │ HTTP :9000 (Proxy)
┌───────────────────────────────────────────▼──────────────────────────────────────┐
│                    final aim.py (Flask Reverse Proxy on :9000)                  │
│                                                                                  │
│  API requests (/config, /symbols, /history, /time, /ticks, etc.)                 │
│    └─────────► Forward to FastAPI Backend (:8080)                                │
│                                                                                  │
│  Static assets (/index.html, /charting_library/, /pine_engine.js, etc.)          │
│    └─────────► Forward to http-server (:8081) -> fallback TradingView CDN        │
└───────────────────────────────────────────┬──────────────────────────────────────┘
                                            │
┌───────────────────────────────────────────▼──────────────────────────────────────┐
│                             FastAPI Backend Server                               │
│                               (http://127.0.0.1:8080)                            │
│                                                                                  │
│  ┌───────────────────────┐  ┌────────────────────────┐  ┌──────────────────────┐ │
│  │       server.py       │  │        ticks.py        │  │      seconds.py      │ │
│  │  - UDF Endpoint Router│  │  - 2-3 Day Tick Limit  │  │  - 30-Day Tick Cache │ │
│  │  - MT5 App Lifespan   │  │  - 2D Vectorized Numpy │  │  - In-memory Delta   │ │
│  │  - Symbol Resolver    │  │    OHLC Engine (<1s)   │  │  - Fast Resampler    │ │
│  └───────────┬───────────┘  └───────────┬────────────┘  └──────────┬───────────┘ │
│              │                          │                          │             │
└──────────────┼──────────────────────────┼──────────────────────────┼─────────────┘
               ▼                          ▼                          ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│                           MetaTrader 5 Terminal (IPC)                            │
│                     (Orbex Global MT5 / Desktop Instance)                        │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|:------:|
| F1 | Remove Line 218 blocking test execution in `ticks.py` | Eliminate `print(get_tickcount_ohlc_records("GCEG26", 40))` that crashes server startup | M1 | ORIGINAL_REQUEST §R1 | **DONE** |
| F2 | Robust MT5 Application Lifecycle | Initialize MT5 once on FastAPI startup (`lifespan`); eliminate destructive per-request `mt5.shutdown()` | M1 | ORIGINAL_REQUEST §R1 | **DONE** |
| F3 | Dynamic Symbol Resolution | Suffix/case handling (`_ensure_dot_suffix`, broker variants `.`, `m`, `.r`, `symbol_select`) | M1 | ORIGINAL_REQUEST §R1 | **DONE** |
| F4 | Correct UDF Resolution Routing in `/history` | Route seconds `"1S"`/`"5S"` to seconds, `"40T"` to ticks, and pure integers `"1"`/`"60"`/`"1D"` to MT5 rates | M1 | ORIGINAL_REQUEST §R1, Survey | **DONE** |
| F5 | Standard Timeframe Rates Mapping | Map UDF resolutions (`1`, `3`, `5`, `15`, `30`, `60`, `120`, `240`, `1D`, `1W`, `1M`) to MT5 rates | M1 | ORIGINAL_REQUEST §R2 | **DONE** |
| F6 | Fast Tick-Count OHLC Retrieval (2-3 day window) | Limit tick query to 2-3 days + 2D numpy reshape for < 1.0s latency | M2 | ORIGINAL_REQUEST §R2 | **DONE** |
| F7 | Vectorized 30-Day Seconds Caching Engine | In-memory tick cache with delta sync + vectorized numpy/pandas resample | M2 | ORIGINAL_REQUEST §R2 | **DONE** |
| F8 | Pine Script v5 Transpiler & Runtime Bridge | Client-side transpiler supporting `indicator()`, `input.*()`, `ta.*`, `plot*()`, `color.*`, `close[1]` to PineJS | M3 | ORIGINAL_REQUEST §R3 | **DONE** |
| F9 | Pine Script Starter Templates | Built-in 8 templates: EMA Cross, RSI, MACD, Bollinger Bands, SuperTrend, Stoch RSI, TTM Squeeze, Pivot Breakout | M3, M7 | ORIGINAL_REQUEST §R3 | **DONE** |
| F10 | LocalStorage Custom Indicator Persistence | Save, load, update, delete user indicators in `localStorage` | M3, M7 | ORIGINAL_REQUEST §R3 | **DONE** |
| F11 | "Add Custom Indicator" Modal & Code Editor | Dark-mode modal with syntax highlighting, line numbers, template picker, and error console | M4, M7 | ORIGINAL_REQUEST §R3 | **DONE** |
| F12 | TradingView Toolbar & Study Hook Integration | Header toolbar button, `custom_indicators_getter`, and `activeChart().createStudy(...)` live plotting | M4, M7 | ORIGINAL_REQUEST §R3 | **DONE** |
| F13 | Frontend Startup & Resolution Bug Fixes | Fix `session-table` null reference error in `index.html`, set default port `8001` | M4 | ORIGINAL_REQUEST §R1, Survey | **DONE** |
| F14 | Comprehensive 4-Tier E2E Test Suite | Automated test suite covering backend endpoints, performance, resolutions, and Pine compiler | E2E Track, M8 | ORIGINAL_REQUEST §Verification | **DONE** |
| F15 | Adversarial Hardening (Tier 5) | White-box stress-testing, boundary cases, and edge validation | M5, M8 | Project Pattern | **DONE** |
| F16 | Proxy Port 9000 UDF API Routing Fix | Detect API routes (/config, /symbols, /history, /time, /ticks, etc.) and forward to 8080, static to 8081 | M6 | ORIGINAL_REQUEST 2026-09-07 §R1 | **DONE** |
| F17 | Frontend Datafeed Auto-Detection on Port 9000 | Use port 9000 origin when served through proxy instead of probing 8080/8888/8001 directly | M6 | ORIGINAL_REQUEST 2026-09-07 §R1 | **DONE** |
| F18 | Full JS Files Audit & Feature Activation | Activate all 8 templates, modal, local storage, study hooks, layout save/load, theme toggle, TV features | M7 | ORIGINAL_REQUEST 2026-09-07 §R2 | **DONE** |
| F19 | All Test Suites Verification (Python & Node) | Run and pass `run_e2e_tests.py` (152 tests) and all 3 Node test suites with 0 failures | M8 | ORIGINAL_REQUEST 2026-09-07 §R3 | **DONE** |
| F20 | Service Stack Startup & Browser Screenshot Verification | Launch with `advanced bat runner.bat`, capture screenshots on port 9000 showing candles & modal | M9 | ORIGINAL_REQUEST 2026-09-07 §R4 | **DONE** |
| F21 | Native Indicator Architecture Extraction & Engine | Decode TV study library bundles, implement modular engine (`tv_indicator_engine.js` / `pine_engine.js`) conforming to metainfo v52/53 with Std execution context | M10 | ORIGINAL_REQUEST 2026-09-07 §R1 | **PLANNED** |
| F22 | MT5 Backend Trading Endpoints & Proxy Routing | Complete MT5 Python IPC trading API in `server.py` (`/trade/order`, `/trade/pending`, `/trade/modify`, `/trade/close`, `/trade/close_all`, `/trade/positions`, `/trade/orders`, `/trade/account`, `/trade/history`) & proxy in `final aim.py` | M11 | ORIGINAL_REQUEST 2026-09-07 §R5 | **PLANNED** |
| F23 | One-Click Trading Toolbar & Visual SL/TP Lines | Instant Buy/Sell buttons with live spread & lot picker on chart header + draggable SL/TP lines with risk/reward calculation on chart canvas | M12 | ORIGINAL_REQUEST 2026-09-07 §R2 | **PLANNED** |
| F24 | Professional Order Execution Panel & Risk Calculator | Market & Pending order placement drawer with automated Risk & Lot Size calculator based on balance, risk % and SL distance | M13 | ORIGINAL_REQUEST 2026-09-07 §R3 | **PLANNED** |
| F25 | Position Manager, Pending Orders & Account Summary | Bottom docking tabs: Open Positions, Pending Orders, Account Bar (live balance, equity, margin, P&L), and Trade History | M14 | ORIGINAL_REQUEST 2026-09-07 §R4 | **PLANNED** |
| F26 | Full Verification, Live Demo Trade & Browser Screenshots | Run all 152 automated tests, execute 0.01 lot demo order on Orbex MT5 (70257567), capture screenshots on port 9000 | M15, M16 | ORIGINAL_REQUEST 2026-09-07 §R6 | **PLANNED** |
| F27 | High-Resolution `/time` Server Endpoint | Return microsecond floating-point timestamp (`f"{time.time():.6f}"`) and structured MT5 millisecond metadata (`time_msc`, `broker_offset`) | M17 | ORIGINAL_REQUEST §R1 | **PLANNED** |
| F28 | Direct MT5 `time_msc` & Broker UTC Clock Synchronization | Synchronize server clock directly with MT5 broker `time_msc` and true UTC, eliminating clock skew with Windows `timeBeginPeriod(1)` | M17 | ORIGINAL_REQUEST §R1 | **PLANNED** |
| F29 | Frontend `datafeed.getServerTime` RTT Latency Compensation | Override `getServerTime` in `index.html` using Cristian's algorithm ($RTT/2$) to achieve drift bound $\epsilon < 0.5\text{ms}$ | M18 | ORIGINAL_REQUEST §R1, R2 | **PLANNED** |
| F30 | Continuous Timescale Clock Recalibration | Recurring WebSocket/timer recalibration updating `_serverTimeOffset` via EWMA filter to prevent browser clock drift | M18 | ORIGINAL_REQUEST §R1, R2 | **PLANNED** |
| F31 | Direct Zero-Latency WebSocket Bar Push to `subscribeBars` | Push live quote ticks directly into `onRealtimeCallback` with 0ms buffering, eliminating HTTP `/history` polling for forming candles | M18 | ORIGINAL_REQUEST §R2 | **PLANNED** |
| F32 | TradingView PriceAxisView Countdown Timer Optimization | Patch `pe.prototype._countdownText` to use `Math.ceil` (preventing premature 500ms blank-out) and accelerate timer to 60 FPS | M18 | ORIGINAL_REQUEST §R2 | **PLANNED** |
| F33 | High-Frequency 1S Decimal & Tick-Countdown Engine | Support sub-second countdown on 1S bars (`0.9s...0.1s`) and tick countdown (`23/40T`) without stalls or hesitation | M18 | ORIGINAL_REQUEST §R2 | **PLANNED** |
| F34 | Hardware-Accelerated Bar-Close Countdown HUD Widget | Render a high-frequency, sub-millisecond countdown progress ring and live broker clock directly on the chart interface | M18 | ORIGINAL_REQUEST §R2 | **PLANNED** |
| F35 | Async Lockless Order Execution Gateway | Convert `/trade/order`, `/trade/pending`, `/trade/modify`, `/trade/close`, `/trade/close_all` to `async def` to eliminate AnyIO threadpool dispatch | M17 | ORIGINAL_REQUEST §HFT Directive | **PLANNED** |
| F36 | In-Memory RAM Price & Symbol Cache for Pre-Trade | Eliminate blocking MT5 IPC calls in `/trade/close` and `/trade/close_all`, resolving prices directly from `hft_engine.latest_quotes` in RAM (< 2µs) | M17 | ORIGINAL_REQUEST §HFT Directive | **PLANNED** |
| F37 | Zero-Copy `orjson` Trade Response Serialization | Direct pre-serialized `orjson.dumps()` responses for trade actions to achieve gateway latency $< 500\mu\text{s}$ | M17 | ORIGINAL_REQUEST §HFT Directive | **PLANNED** |
| F38 | Automated Sub-Millisecond Clock & Countdown Verification Suite | Programmatic test suite verifying clock drift < 1ms, monotonic smooth countdown, and zero-overhead order execution | M19 | ORIGINAL_REQUEST §R3 | **PLANNED** |
| F39 | PineTS Runtime & Transpiler Integration | Load `pinets.min.browser.js`, export `window.PineTSLib.Indicator`, update `pine_indicators.js` and `server.py` `/pine/transpile` | M26 | ORIGINAL_REQUEST 2026-09-09 §R1 | **DONE** |
| F40 | Authentic Candlestick Rendering for `plotcandle` | TradingView OHLC metainfo v52 (`ohlc_open`, `ohlc_high`, `ohlc_low`, `ohlc_close`, `ohlc_colorer`, `wick_colorer`, `border_colorer`, `isRGB: true`), 32-bit RGBA integer encoding | M27 | ORIGINAL_REQUEST 2026-09-09 §R2 | **DONE** |
| F41 | Multi-Series Security Handling (`request.security`) | Multi-value tuple destructuring `[o,h,l,c] = request.security(...)`, mock/live symbol feeds | M27 | ORIGINAL_REQUEST 2026-09-09 §R3 | **DONE** |
| F42 | Legend Polish & Defect Fixes | Suppress crossed-eye interval icon, enforce `white-space: nowrap` on `.valuesWrapper`, preserve interactive hover buttons (Hide/Show, Settings, Delete) | M28 | ORIGINAL_REQUEST 2026-09-09 §R4 | **DONE** |
| F43 | 100% Authentic TradingView GUI for Pine Editor | Dark theme `#131722`, clean toolbar buttons, side-by-side dock, seamless bottom widget bar tabs integration | M28 | ORIGINAL_REQUEST 2026-09-09 §R5 | **DONE** |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|:------:|
| M1 | Backend Stability, Lifecycle & Routing Fixes | `server.py`, `ticks.py`, `seconds.py`: Remove blocking imports, implement global MT5 lifespan, fix resolution routing | none | **DONE** |
| M2 | Ultra-Fast Ticks & Cached Seconds Engine | `ticks.py`, `seconds.py`: 2-3 day tick limit, 2D numpy reshape (<1s), 30-day cache manager | M1 | **DONE** |
| M3 | Pine Script v5 Transpiler, Templates & Storage | `pine_engine.js`: AST/Regex parser, PineJS.Std bridge, templates, LocalStorage manager | none | **DONE** |
| M4 | Charting UI, Toolbar Integration & Editor Modal | `index.html`, `pine_engine.js`: Header toolbar button, dark mode editor modal, `custom_indicators_getter` | M3 | **DONE** |
| E2E | E2E Testing Track | `tests/`: 4-Tier automated test suite (Tiers 1-4) publishing `TEST_READY.md` | none | **DONE** |
| M5 | Final E2E Pass & Adversarial Hardening | Verify 100% E2E test pass across all tiers; run Tier 5 adversarial stress testing | M1, M2, M4, E2E | **DONE** |
| M6 | Proxy Routing & Datafeed Auto-Detect Fix | `final aim.py`: route UDF API calls to 8080, static to 8081. `index.html`: auto-detect port 9000 | none | **DONE** |
| M7 | Full JS Feature Activation & Audit | `pine_engine.js`, `index.html`, `broker-sample/dist/bundle.js`: all 8 templates, modal, storage, createStudy, TV features | none | **DONE** |
| M8 | Comprehensive Test Suite Run & Remediation | Pass 152 Python tests and 3 Node test suites (plotting, oracle, Tier 5 stress) with 0 failures | M6, M7 | **DONE** |
| M9 | Service Stack Launch & Proxy Visual Verification | Run `advanced bat runner.bat`, capture screenshots of port 9000 showing candles, Pine editor, indicator | M6, M7, M8 | **DONE** |
| M10 | Native Indicator Architecture Extraction & Custom JS Engine | `charting_library/bundles/library.e8d44337c84d65489d2c.js`, `tv_indicator_engine.js`, `pine_engine.js`: Study definitions matching metainfo v52/53 with Std execution context | none | **IN_PROGRESS** |
| M11 | MT5 Backend Trading API & Proxy Routing | `server.py`, `final aim.py`: Python MT5 IPC endpoints (`/trade/order`, `/trade/pending`, `/trade/modify`, `/trade/close`, `/trade/close_all`, `/trade/positions`, `/trade/orders`, `/trade/account`, `/trade/history`, `/trade/lot_calculator`) & proxy routing on port 9000 | none | **IN_PROGRESS** |
| M12 | One-Click Trading Toolbar & Visual SL/TP Adjustments | `index.html`: Header overlay with live Bid/Ask/Spread & quick lots + interactive draggable SL/TP lines on chart canvas | M11 | **IN_PROGRESS** |
| M13 | Professional Order Execution Panel & Risk Calculator | `index.html`: Drawer/modal for Market & Pending orders + integrated automated risk/lot calculator | M11 | **IN_PROGRESS** |
| M14 | Position Manager, Pending Orders & Account Summary Dock | `index.html`: Docking bottom panel with Open Positions (close/close-all), Pending Orders (cancel), Account Info Bar (balance/equity/margin/P&L), and Trade History | M11 | **IN_PROGRESS** |
| M15 | Comprehensive Test Suite & Regression Verification | Python `run_e2e_tests.py` (152 tests) and Node test suites verified 100% passing | M10, M11, M12, M13, M14 | **PLANNED** |
| M16 | Live MT5 Demo Trade Execution & Browser Screenshots | Test real 0.01 lot order placement on demo account 70257567 (OrbexGlobal-Server), capture browser screenshots on port 9000, verify all UI elements | M11, M12, M13, M14, M15 | **PLANNED** |
| M17 | Backend HFT Timekeeping & Ultra-Low Latency Trade Pipeline | `server.py`, `hft_engine.py`: Microsecond `/time` endpoint, `time_msc` broker sync, Windows `timeBeginPeriod(1)`, async lockless order routes, RAM quote cache (<2µs), zero-copy `orjson` (<500µs) | none | **PLANNED** |
| M18 | Frontend Sub-Millisecond Timescale Sync & Smooth Countdown Timer | `index.html`: Cristian's algorithm RTT latency compensation, continuous EWMA recalibration, direct WebSocket bar push to `subscribeBars`, PriceAxisView `Math.ceil` patch, 60 FPS animation loop, 1S decimal countdown, countdown HUD | M17 | **PLANNED** |
| M19 | Automated HFT Verification Suite & Full Regression Pass | `tests/test_hft_clock_countdown_suite.py`, `run_e2e_tests.py`: Clock drift <1ms, monotonic smooth countdown, trade gateway latency <500µs, 100% test pass across all 182+ tests | M17, M18 | **PLANNED** |
| M26 | PineTS Runtime & Transpiler Integration (R1) | `index.html`, `pine_indicators.js`, `server.py`: Load `pinets.min.browser.js`, alias `window.PineTS.Indicator`, update `compileAndRegisterPine`, map 9 input types via `getInputsMeta()`, update backend `/pine/transpile` and `/pine/indicators/catalog` using `pinets.min.cjs` | none | **DONE** |
| M27 | Authentic Candlestick Rendering & Multi-Series Security (R2, R3) | `pine_indicators.js`: Metainfo v52 OHLC plots (`ohlc_open`, `ohlc_high`, `ohlc_low`, `ohlc_close`, `ohlc_colorer`, `wick_colorer`, `border_colorer`), `isRGB: true`, dynamic 32-bit integer color encoding, 7-element main return `[o, h, l, c, color, wick, border]`, tuple destructuring `[o,h,l,c]` | M26 | **DONE** |
| M29 | Comprehensive E2E Test Suite & Adversarial Audit | `tests/test_pinets_harness.py`: Automated headless browser tests for Custom Symbol Candles, plotcandle rendering, 9 inputs in Settings, legend buttons, zero continuous NaNs, backend endpoints | M26, M27, M28 | **DONE** |

## Interface Contracts

### Backend ↔ Proxy ↔ Frontend (UDF Protocol)
- `GET /config`:
  - Route: Port 9000 -> Forwarded to Port 8080 -> FastAPI `/config`
  - Response: `{ supports_search: true, supports_group_request: false, supports_marks: false, supports_timescale_marks: false, supports_time: true, supported_resolutions: ["1S", "5S", "10S", "15S", "30S", "1", "3", "5", "15", "30", "60", "120", "240", "1D", "1W", "1M"], has_seconds: true, seconds_multipliers: ["1", "5", "10", "15", "30"], has_ticks: true }`
- `GET /symbols?symbol=<name>`:
  - Route: Port 9000 -> Forwarded to Port 8080 -> FastAPI `/symbols`
  - Returns symbol metadata (`name`, `description`, `type`, `session`, `timezone`, `ticker`, `minmov`, `pricescale`, `has_intraday: true`, `has_seconds: true`, `has_ticks: true`, `supported_resolutions: [...]`).
- `GET /history?symbol=<name>&resolution=<res>&from=<t1>&to=<t2>`:
  - Route: Port 9000 -> Forwarded to Port 8080 -> FastAPI `/history`
  - If `res` in `["1S", "5S", ...]` -> invokes `seconds.get_ohlc_records(symbol, sec, days=30)`
  - If `res` in `["1T", "40T", ...]` -> invokes `ticks.get_tickcount_ohlc_records(symbol, tpb, days=2)`
  - If `res` in `["1", "5", "15", "60", "1D", ...]` -> invokes `mt5.copy_rates_range(symbol, mt5_timeframe, from_dt, to_dt)`
  - Response: `{ s: "ok", t: [...], o: [...], h: [...], l: [...], c: [...], v: [...] }`
- `GET /ticks?symbol=<name>&ticks_per_bar=<n>`:
  - Route: Port 9000 -> Forwarded to Port 8080 -> FastAPI `/ticks`
  - Returns tick-based OHLC records with `s: "ok"`.
- `GET /time`:
  - Route: Port 9000 -> Forwarded to Port 8080 -> FastAPI `/time`
  - High-Resolution Response: ASCII string `f"{time.time():.6f}"` (e.g. `"1725791234.567890"`)
  - Extended JSON format (`/time?format=json`): `{ "time": 1725791234.567890, "broker_time_msc": 1725802034567, "broker_offset_sec": 10800, "precision": "microsecond" }`

### Real-Time WebSocket Quotes & Bar Streaming (`/ws/quotes`)
- Stream payload: `quote_record = { "s": symbol, "bid": float, "ask": float, "time_msc": int, "time_utc_msc": int, "flags": int }`
- Frontend Integration: Direct feed into `onRealtimeCallback` of `datafeed.subscribeBars`, forming real-time candle bars with 0ms buffering.

### Frontend Timescale Sync & RTT Compensation (`index.html`)
- `datafeed.getServerTime(callback)`:
  - Invokes `GET /time` with high-resolution client timestamp $t_1$.
  - Receives response $T_{server}$ at client timestamp $t_2$.
  - RTT $= t_2 - t_1$. Clock offset $\theta = T_{server} - (t_1 + t_2) / 2000$.
  - Injects calibrated high-precision float seconds into TradingView `_serverTimeOffset`.
  - Recalibrates via EWMA filter on every WebSocket tick or 30-second interval ($\epsilon < 0.5\text{ms}$).

### Pine Script Engine & Native TV Indicators ↔ TradingView Charting Library
- `custom_indicators_getter: (PineJS) => Promise.resolve(studyDescriptors)`
  - Each descriptor: `{ name: string, metainfo: Object (version 52/53), constructor: Function }`
  - Constructor `this.main = function(context, inputCallback) { return [plotValues...]; }`
- Dynamic registration on chart:
  - `widget.activeChart().createStudy(studyName, isOverlay, false)`
  - Modular engine: `tv_indicator_engine.js` (exposes `TVIndicatorEngine` with study library generator, metainfo v52/v53 generator, and indicator constructors).

### MT5 Trading Endpoints ↔ Frontend Trading Suite (HFT Async Zero-Overhead)
- All endpoints implemented with `async def` to eliminate AnyIO threadpool bouncing.
- Prices and symbol specifications resolved directly from RAM (`hft_engine.latest_quotes` & `symbol_metadata`) in $< 2\mu\text{s}$, completely avoiding blocking MT5 IPC queries.
- Response serialization executed directly with `Response(content=orjson.dumps(resp), media_type="application/json")`.
- `POST /trade/order`: Market execution (symbol, action: "BUY"|"SELL", volume, sl, tp) -> returns `{ status: "ok", ticket: 12345, retcode: 10009, comment: "..." }`
- `POST /trade/pending`: Pending orders (symbol, type: "BUY_LIMIT"|"SELL_LIMIT"|"BUY_STOP"|"SELL_STOP", price, volume, sl, tp, expiration) -> returns `{ status: "ok", ticket: 12346, ... }`
- `POST /trade/modify`: Modify open position or pending order (ticket, sl, tp, price) -> returns `{ status: "ok", ... }`
- `POST /trade/close`: Close position (ticket, volume) -> returns `{ status: "ok", ... }`
- `POST /trade/close_all`: Close all open positions -> returns `{ status: "ok", closed_count: N, results: [...] }`
- `GET /trade/positions`: List open positions -> returns `{ status: "ok", positions: [{ ticket, symbol, type, volume, price_open, price_current, sl, tp, profit, pips, ... }] }`
- `GET /trade/orders`: List active pending orders -> returns `{ status: "ok", orders: [{ ticket, symbol, type, volume, price_open, sl, tp, ... }] }`
- `GET /trade/account`: Real-time account status -> returns `{ status: "ok", account: { balance, equity, margin, margin_free, margin_level, profit, leverage, currency, server } }`
- `GET /trade/history?days=7`: Closed deals -> returns `{ status: "ok", deals: [{ ticket, order, symbol, type, volume, price, profit, time, ... }] }`
- `POST /trade/lot_calculator`: Lot calculation -> returns `{ status: "ok", lot_size: 0.05, risk_amount: 1000, pip_value: 10, ... }`

## Code Layout
- `final aim.py`: Flask reverse proxy on port 9000 (routes `/trade/*` and UDF routes to 8080, static to 8081).
- `PROXY FOR TRADINGVIEW.py`: Simple HTTP proxy on port 8888 -> 8080.
- `server.py`: FastAPI server, UDF datafeed, MT5 trading endpoints, MT5 lifespan.
- `ticks.py`: Tick-count OHLC calculation, 2-3 day window, 2D numpy reshape.
- `seconds.py`: Seconds-based OHLC calculation, 30-day in-memory tick cache, pandas/numpy resampler.
- `tv_indicator_engine.js`: Native TradingView study architecture engine (metainfo v52/53, study generator).
- `pine_engine.js`: Pine Script v5 transpiler, PineJS bridge, templates, localStorage persistence, editor modal UI.
- `trading_suite.js`: Modular trading suite containing One-Click Trading toolbar, Visual SL/TP lines, Order Panel, Risk Calculator, and Position Manager bottom dock.
- `index.html`: TradingView Advanced Charts main application page, chart widget initialization, docking container integration.
- `broker-sample/dist/bundle.js`: Broker sample integration bundle.
- `tests/test_trading_api.py`: Automated tests for MT5 trading endpoints.
- `tests/`: Automated test suite (Tiers 1-4 + Tier 5).
- `run_e2e_tests.py`: Master test runner.
- `advanced bat runner.bat`: Launches all 4 services.
- `screenshots/`: Visual verification screenshots captured on port 9000.
