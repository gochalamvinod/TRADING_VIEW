# TradingView MT5 Platform - Bugs & Pending Tasks Register

## I. Architectural Directives & Inviolable Constraints

1. **Strict Zero-Dependency Mandate**:
   - **Absolute Rule**: NO `numpy`, NO `pandas`, NO `requests` across any active production codebase files.
   - **Permitted / Preferred Technologies**: Native standard library (`array.array`, `urllib.request`, `ctypes`, `struct`), Polars, CuPy / GPU compute, pure C++ AVX2 shared libraries (`fast_engine.dll`).
   - Any indirect or lingering reference to legacy libraries must be purged.

2. **Single Batch File Execution**:
   - Only `advanced bat runner.bat` must be maintained and used to launch the entire platform stack (FastAPI Backend, Reverse Proxy, Frontend).
   - No separate or duplicate `.bat` files.

3. **PineTS Official Engine Integration**:
   - PineTS files moved directly from `Downloads` into the project root:
     - `pinets.min.browser.js` (Frontend browser library loaded in `index.html`)
     - `pinets.min.browser.es.js`
     - `pinets.min.cjs` (Node.js engine)
     - `pinets.min.es.js`
   - Must be moved (not copied) and integrated for fast client-side Pine Script transpilation and evaluation.
4. **Bar Replay Lifecycle**:
   - **Entering Replay**: Must turn OFF WebSocket tick streaming FIRST, flush all active timers, enforce an 80ms settling guard, and complete replay setup formalities before serving cutoff bars.
   - **Exiting Replay**: Must turn ON WebSocket tick streaming and resume sub-millisecond real-time quotation delivery.

5. **Ultra-Low Latency Streaming**:
   - Target sub-millisecond (1ms) real-time tick streaming without sluggish polling delays.
   - WebSocket streaming on `ws://127.0.0.1:9999/ws/quotes` with 0ms buffering delay.

6. **Codebase Memory Knowledge Graph (codebase-memory-mcp)**:
     Successfully integrated and indexed: 54,450 nodes and 225,657 edges in `.codebase-memory/graph.db.zst`.
     Prefer MCP graph tools (`search_graph`, `trace_path`, `get_code_snippet`) over legacy grep/glob for code discovery.

---

## II. Codebase Bugs & Defects Register

### Bug 1: [CRITICAL] Indicator Candles Frozen in Real-Time (No Live Movement)
- **Status**: Identified - In Progress
- **Files**: `e:\TRADING_VIEW\pine_indicators.js` (Lines 2098-2141, 2400-2448), `e:\TRADING_VIEW\chart_app.js`
- **Symptoms**: Candles plotted by custom Pine indicators (e.g. `plotcandle` using `request.security("OANDA:XAGUSD", ...)` or `request.security(symbol, ...)` on `XAUUSD` chart) do not move or update as live ticks arrive. They remain frozen until the user manually reloads the browser page.
- **Root Cause**:
  1. `secSymbolBarsCache` caches historical bars for secondary symbols once at startup. As time advances and new ticks arrive on the main chart, the secondary symbol cache is never updated with the live forming bar.
  2. The WebSocket quote receiver in `chart_app.js` dispatches ticks to the main chart series but does not trigger `model.lightUpdate()` on active custom studies or notify the Pine runtime of live tick price updates for secondary symbols.
- **Fix Required**:
  1. In `pine_indicators.js`, implement live bar updating for secondary symbols in `getSecBars` / `evalSecurity`: update the latest candle (O, H, L, C, V) using real-time quotes from `/quotes` or `/ticks` for that symbol.
  2. In `chart_app.js`, on WebSocket tick arrival, call `model.lightUpdate()` so all custom study plots recalculate and render in real time.

---

### Bug 2: [CRITICAL] Indicator Input Changes Ignored (Settings Modal Broken)
- **Status**: Identified - In Progress
- **Files**: `e:\TRADING_VIEW\pine_indicators.js` (Lines 1780-1797, 2288-2350)
- **Symptoms**: In the indicator Settings dialog (e.g., "XAGUSD Candles"), changing the input parameter (such as modifying the symbol input from `OANDA:EURUSD` to `GOLDMANS` or `XAGUSD`) has no effect. The indicator continues plotting the initial default value.
- **Root Cause**:
  1. `baseInput` and `evalInput` were implemented as static closures outside `this.main`, returning `defval` unconditionally.
  2. When `barEvaluator` ran `symbol = input.symbol("OANDA:EURUSD", "Symbol")`, it called `evalInput.symbol`, which completely ignored the runtime `inputCallback` and active study properties, always returning `"OANDA:EURUSD"`.
- **Fix Required**:
  1. Move or bind `evalInput` inside `this.main` (or provide an active context reference) so that `input.symbol`, `input.int`, `input.float`, `input.string`, `input.bool`, `input.timeframe`, etc., query `inputCallback` by input title, ID, and variable name.
  2. Look up the live property value from TradingView's study property tree (`study.properties().childs().inputs`) so user edits in the settings dialog immediately take effect.

---

### Bug 3: [HIGH] Secondary Symbol Indicators Plotting Main Chart Prices ("Same Candles" Bug)
- **Status**: Partially Fixed - Needs Full Verification
- **Files**: `e:\TRADING_VIEW\pine_indicators.js` (Lines 2143-2180)
- **Symptoms**: An indicator requesting Silver (`request.security("OANDA:XAGUSD", ...)` on a Gold `XAUUSD` chart) plotted identical candles and price scale (~$4,286) instead of Silver (~$63.14).
- **Root Cause**: Line 2165 previously had a dummy stub `(sym, tf, expr) => (Array.isArray(expr) ? expr : expr)` that returned the main chart's OHLCV series.
- **Fix Implemented**: Implemented dynamic secondary bar fetching via synchronous XHR to `/history` and binary search time-alignment. Needs completion with real-time tick integration.

---

### Bug 4: [CRITICAL] HFT Engine Warmup Crash on CuPy / NumPy Type Collision
- **Status**: Identified - In Progress
- **Files**: `e:\TRADING_VIEW\hft_engine.py` (Lines 18-20, 160-176)
- **Symptoms**: HFT engine warmup failed for monitored symbols (`GBPUSD.`, `XAUUSD.`, `USDJPY.`, `XAGUSD.`, `BTCUSD.`) with `TypeError: Unsupported type <class 'numpy.ndarray'>`.
- **Root Cause**: `import cupy as np` was aliased at module scope, but MetaTrader5 returns a CPU structured record array. Calling CuPy functions like `np.where(ticks_rec['volume_real'] > 0, ...)` on CPU arrays raised a fatal exception, aborting tick buffer initialization.
- **Fix Required**:
  1. Purge all CuPy/NumPy collision calls.
  2. Use pure Python standard library (`array.array` / `memoryview`), Polars, or native C++ (`fast_engine.dll`) in `append_batch` to ingest ticks at sub-microsecond speed without importing NumPy, Pandas, or Requests.

---

### Bug 5: [HIGH] Bar Replay Multi-Timeframe Future Bar Leak: 
- **Status**: Identified - Pending Verification
- **Files**: `e:\TRADING_VIEW\chart_app.js` (`syncReplayFutureBars`, `getBars` datafeed hook)
- **Symptoms**: Switching resolutions during Bar Replay (e.g. from 1m to 1S or 15m) could query or render candles past the cutoff timestamp.
- **Root Cause**: Timezone and millisecond boundary discrepancies allowed `to` query ranges to exceed `_replayCutoffTimestamp`.
- **Fix Required**: Enforce a strict clamp on all `getBars` requests in replay mode so no timestamp strictly greater than `_replayCutoffTimestamp` is ever returned.

---

### Bug 6: [MEDIUM] Pine Editor Format Modal Event Sync Detachment
- **Status**: Identified - Pending Integration
- **Files**: `e:\TRADING_VIEW\pine_editor_ide.js` (Lines 1478-1512, `setupFormatModalSync`)
- **Symptoms**: When the user edits input values inside TradingView's iframe format modal, the changes do not immediately trigger re-evaluation of the running study.
- **Root Cause**: `handleModalChange` did not map input names to study property indices or notify the PineTS runtime of changed symbols.
- **Fix Required**: Synchronize format dialog change events directly into study property values and call `triggerStudyReEvaluation`.

---

### Bug 7: [MEDIUM] High-Frequency Datafeed Polling vs. WebSocket Stream Coordination
- **Status**: Identified - In Progress
- **Files**: `e:\TRADING_VIEW\chart_app.js`
- **Symptoms**: Polling interval was previously set to 10,000ms, causing laggy candle updates when WebSocket was inactive or reconnecting.
- **Fix Required**: Set adaptive polling interval (150ms-250ms) and ensure seamless fallback between WebSocket tick streaming and adaptive countback polling.

---

## III. Pending Tasks Checklist

- [ ] **Task 1**: In `pine_indicators.js`, wire `evalInput` dynamically to `inputCallback` and study properties so symbol changes (e.g. to `GOLDMANS` or `XAGUSD`) immediately take effect.
- [ ] **Task 2**: In `pine_indicators.js` and `chart_app.js`, implement real-time secondary symbol tick updates so indicator candles move live on every tick without page refresh.
- [ ] **Task 3**: In `hft_engine.py`, fix `append_batch` to eliminate CuPy/NumPy collisions and ensure zero imports of `numpy`, `pandas`, or `requests`.
- [ ] **Task 4**: Verify zero dependencies across all Python files (`server.py`, `hft_engine.py`, `c_bridge.py`) and run full regression tests.
- [ ] **Task 5**: Verify smooth Bar Replay lifecycle (WS turns OFF on enter, turns ON on exit).
- [ ] **Task 6**: Ensure `advanced bat runner.bat` starts all services cleanly and verify end-to-end functionality on `http://127.0.0.1:9999`.