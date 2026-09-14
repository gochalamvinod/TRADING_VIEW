# Milestone M18 Handoff Report

## 1. Observation
- **Master Regression Status**: `python run_e2e_tests.py` ran 182 tests across Tier 1, 2, 3, 4, 6 and passed 100% (182 passed in 24.59s).
- **Backend Time Service**: `GET http://127.0.0.1:9000/time` returns microsecond precision float (e.g. `1788863563.286437`), and `GET /time?format=json` returns `{"time":1788863563.2949505,"broker_time_msc":1788874363124,"broker_offset_sec":10800,"precision":"microsecond"}`.
- **Frontend `index.html`**:
  - Lines 444–553: `ServerTimeSyncEngine` calculates Cristian's offset `sampleOffset = t_server - (t_send + t_recv) / 2000`.
  - Lines 536–546: `injectIntoTradingView()` checks `if (window.ChartApiInstance)`. In the browser, TradingView standalone renders inside an `<iframe>`, so `window.ChartApiInstance` on the parent window is `undefined`.
  - Lines 609–650: In `datafeed.getBars`, `activeBarSubscribers` is empty on initial load because `subscribeBars` is invoked after `getBars`. Consequently, `sub.currentBar` starts as `null` in `subscribeBars`, and the first WebSocket quote tick overwrites the forming candle's open, high, and low.
- **Datafeed Bundle `datafeeds/udf/dist/bundle.js`**:
  - Line 1: `getServerTime(e){this._send("time").then(s=>{const t=parseFloat(typeof s==="object"&&s!==null?(s.time||s.server_time||s):s);e(t)}).catch(()=>e(this.getCalibratedServerTime()))}`: passes uncompensated raw `t` to callback `e(t)`.
  - Line 1: `_syncServerTime()` runs every 10 minutes (`6e5` ms).
- **TradingView Core Bundle `charting_library/bundles/library.e8d44337c84d65489d2c.js`**:
  - Line 419: `_countdownText(){const e=G.Interval.parse(this._source.interval());if(e.isDWM()||e.isTicks())return"";...}`: suppresses all countdown text on tick charts (`e.isTicks()`). For 1S bars, it evaluates integer seconds `Math.ceil((n-this._currentTime())/1e3)` displaying `00:01` instead of `0.9s...0.1s`.
  - Line 454–455: `this._countdownUpdateTimer=this._model.setInterval((()=>{this._priceAxisView.updateCountdown?.(),this._projectionPriceAxisView.updateCountdown?.()}),100)`: hardcodes 100ms update rate (10 FPS) instead of 16ms (60 FPS).
- **Countdown HUD Widget**:
  - `index.html` lines 236–241 & 920–1033: contains only a flat horizontal progress bar, not an SVG circular progress ring. On tick charts, line 984 sets `progressEl.style.width = "100%"` and line 983 sets text to `"TICK " + ticksCount` rather than `${curTicks}/${nTicks}T`.

## 2. Logic Chain
1. **From Observation 2.1 to Timescale Drift**:
   - `injectIntoTradingView()` in `index.html` writes to `window.ChartApiInstance`, which is `undefined` because TradingView runs inside an `<iframe>`.
   - Therefore, continuous EWMA offset recalibrations from WebSocket ticks never reach TradingView's internal timekeeper, causing the chart timescale to drift as the browser clock experiences local skew.
2. **From Observation 2.2 to Network Latency Jitter**:
   - `datafeeds/udf/dist/bundle.js` passes uncompensated `t` in `getServerTime(e)`.
   - When TradingView initializes, its base offset receives raw server time without subtracting $RTT / 2$, introducing network round-trip skew.
3. **From Observation 2.3 to Forming Candle Reset**:
   - `getBars()` loads historical bars before `subscribeBars()` registers subscribers.
   - Because `lastBar` is not cached, `sub.currentBar` is null when the first WebSocket tick arrives, causing `dispatchTickToBar` to construct `newBar` with `open = price`, discarding the true opening price and extremes of the open bar.
4. **From Observation 2.4 to Timer Stutter and Missing Tick/1S Countdown**:
   - `library.e8d44337c84d65489d2c.js` line 455 sets interval to 100ms, capping updates at 10 FPS.
   - `_countdownText()` returns `""` when `e.isTicks()` is true and computes integer seconds for 1S bars.
   - Therefore, the price axis countdown stalls at 10 FPS, cannot show tick progress (`23/40T`), and cannot display sub-second decimals (`0.9s...0.1s`).
5. **From Observation 2.5 to HUD Deficiencies**:
   - The HUD widget in `index.html` lacks an SVG circular ring with `will-change: stroke-dashoffset` GPU acceleration, and tick progress is hardcoded to 100%.

## 3. Caveats
- Read-only constraint enforced: no source code files outside `.agents/explorer_m18/` were modified.
- Full E2E master test suite (182 tests) was verified passing before analysis.
- The proposed patches for `library.e8d44337c84d65489d2c.js` can be applied either directly to the bundle or via runtime monkey-patching in `index.html` during `widget.onChartReady` (both approaches are detailed in `report.md`).

## 4. Conclusion
Milestone M18 is thoroughly analyzed and ready for implementation by the Worker. The 6 target features (F29–F34) require specific updates in `index.html`, `datafeeds/udf/dist/bundle.js`, and `library.e8d44337c84d65489d2c.js`. Implementing these changes will eliminate timescale clock drift (< 0.5ms bound), prevent open candle wipeout on subscription, accelerate the countdown timer loop to 60 FPS, enable 1S decimal (`0.9s...0.1s`) and tick (`23/40T`) countdowns, and provide an SVG hardware-accelerated progress ring.

## 5. Verification Method
1. **Master Test Suite**:
   Run `python run_e2e_tests.py` — assert 100% pass across all 182 tests.
2. **CDP Verification on Port 9000**:
   - Check `window.serverTimeSync.getDriftBoundMs() < 0.5`.
   - Check `widget._innerWindow().ChartApiInstance.serverTime()` matches `window.serverTimeSync.nowServerMs()`.
   - On resolution `1S`: verify price scale badge decrements as `0.9s...0.1s`.
   - On resolution `40T`: verify price scale badge and HUD display `1/40T...40/40T`.
   - Verify `#tv_hud_ring_circle` updates `stroke-dashoffset` smoothly at 60 FPS without DOM stutter.
