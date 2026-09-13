# Handoff Report: Pine Script Runtime Engine, Metainfo v52/v53 & 0-Plot Architecture

**Identity**: teamwork_preview_spec_miner (`spec_miner_survey_orch7_1`)  
**Type**: Hard Handoff (Task Complete)  
**Parent Conversation ID**: `629ecdbb-bdd9-4267-83c2-050d30aba17d`  
**Working Directory**: `e:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_orch7_1`  
**Date**: 2026-09-09  

---

## 1. Observation

1. **TradingView Custom Study Execution Loop**:
   Inspected `charting_library/bundles/library.e8d44337c84d65489d2c.js` (lines 890, class `V`, class `E`):
   - `custom_indicators_getter: function(PineJS)` passes `{ Std: Yy.Std }` and expects a Promise resolving an array of study descriptors.
   - The execution engine calls `this._body.main(t, this._inputCallback, e)` on every bar update where `t` is `ctx` (instance of class `E`) and `this._inputCallback` is the input resolver function.
   - Result processing in class `V`:
     `this._out && e && (!isNaN(t.symbol.time) || B(e)) && (B(e) ? ... : !function(e){return !Array.isArray(e) && ("non_series_bars" === e.type || "projection" === e.type)}(e) ? this._out(t.symbol, e) : e.bars.forEach(...))`
     Verbatim: `this.main` must return an Array of numeric values matching `metainfo.plots`.

2. **Metainfo Schema & Package Requirement**:
   Inspected `charting_library/bundles/library.e8d44337c84d65489d2c.js`:
   `getPackageName(e)` uses regex `/^[^@]+@([^-]+-[^-]+)/.exec(e||"")`.
   Study `id` must follow `<name>@<packageId>-<version>`, e.g., `SMA Crossover@tv-basicstudies-1`.
   Metainfo version is 52 (migrated to 53 by TradingView's internal migrator).

3. **Empirical 0-Plot Audit of All 29 Examples**:
   Executed `node scan_plots.js` across all 29 scripts in `Pine-A-Script-master/examples/`.
   Verbatim output:
   - Exactly 11 out of 29 scripts (37.9%) have 0 explicit `plot()`, `plotshape()`, `plotchar()`, or `plotcandle()` calls.
   - Prominent examples: `Golden_Pocket_Zones.pine` (1 box primitive, 0 plots), `Smart_Trader_Episode_03_by_Ata_Sabanci_Candles_and_Tradelines.pine` (8 drawing primitives, 0 plots), `3D_MACD_Bar_Plot_LuxAlgo.pine` (3 drawing primitives, 0 plots, `overlay = false`).

4. **Global State Pollution & Concurrent Script Collision**:
   Inspected `pine_indicators.js` lines 437–475:
   `globalThis.__pineRuntime = { plots: {}, plotshapes: {}, alerts: [], bars: 1000, inputs: {} };`
   `globalThis.open = O; globalThis.high = H; globalThis.low = L; globalThis.close = C;`
   When multiple indicators are instantiated, every subsequent study destroys the global runtime of prior studies.

5. **Study Creation Lock Flag**:
   Inspected `pine_indicators.js` line 1003 and `pine_editor_ide.js` line 707:
   `await chart.createStudy(studyName, isOverlay, false);`
   The third argument `lock = false` is required to display the hover action buttons (👁️ Hide/Show, ⚙️ Format Settings, 🗑️ Delete) in the TradingView chart legend.

6. **Backend FastAPI Pine Endpoints**:
   Inspected `server.py` lines 2434–2530:
   - `GET /pine/catalog` returns 29 pre-converted scripts.
   - `POST /pine/transpile` invokes Node subprocess with `pine_transpiler.bundle.js` with a 15-second timeout.
   - `GET /pine/source/{filename:path}` and `GET /pine/js/{filename:path}` serve files directly.

7. **Parent Directive Regarding Bottom UI**:
   Dispatch message received 2026-09-09T06:16:33Z quotes user directive:
   `"i said u i need same ui as traingview u gave me bottom fix them"`
   Mandating removal of unauthentic emoji buttons and clunky floating bottom dock tabs, unifying Pine Editor and Pine Logs into TradingView's authentic dark theme bottom dock tabs.

---

## 2. Logic Chain

1. **From Observation 1 & 2**: TradingView requires every custom indicator to have a valid Metainfo v52 object registered in `JSServer.studyLibrary` whose `plots` array is non-empty and whose constructor implements `this.main(ctx, inputCallback)` returning an array of numbers.
2. **From Observation 3**: 11 out of 29 library scripts (including `Golden Pocket Zones` and `Smart Trader`) contain 0 `plot()` statements because they are drawing-based. If registered with empty plots or unpopulated series, TradingView cannot draw a series or renders a blank canvas, confusing users into thinking the indicator is broken.
3. **From Observation 4**: Because `pine_indicators.js` currently stores execution state on `globalThis`, adding multiple indicators produces severe race conditions and `NaN` cascades as runtime buffers are clobbered.
4. **From Observations 1, 3, and 5**: Providing an **Adaptive Trend Baseline Fallback Plot** (21-period EMA of close for overlays seeded with `ctx.symbol.close` on bar 0; 14-period RSI seeded with 50.0 on bar 0 for subpanes):
   - Guarantees 100% non-NaN numeric series arrays on every single bar from bar 0 onwards.
   - Populates `metainfo.plots` and `defaults.styles`.
   - Enables native TradingView legend controls (Hide, Settings, Delete) via `lock: false`.
   - Prevents blank chart canvases while preserving the indicator's core identity.
5. **From Observations 6 and 7**: The Pine Logs console must inform the user when an adaptive fallback is engaged, and must dock cleanly into the bottom panel without competing external HTML elements.

---

## 3. Caveats

1. **Drawing Primitives Rendering**: Pine drawing primitives (`box.new`, `line.new`, `polyline.new`, `table.new`) are separate from TradingView's study plot pipeline. The adaptive trend baseline plot solves the study visibility, series plotting, and legend controls, but drawing primitives themselves require either Charting Library `createMultipointShape` / `LineTool` APIs or a dedicated WebGL drawing layer for full geometry reproduction.
2. **Strategy Backtesting**: TradingView basic studies do not execute Pine strategy order fills directly in the chart canvas; strategies render entry/exit shape markers via `plotshape` and summary stats in the Strategy Tester.

---

## 4. Conclusion

The Pine Script runtime and compiler architecture is fully mapped:
1. **Transpilation & Schema**: Scripts transpile via `pine_transpiler.bundle.js` and map to Metainfo v52 schema (`id: "<Name>@tv-basicstudies-1"`, `plots`, `styles`, `inputs`, `defaults`) with `this.main(ctx, inputCallback)` returning ordered numeric arrays.
2. **Elimination of Continuous NaNs**:
   - Encapsulate runtime state inside the study constructor instance closure (eliminate `globalThis` pollution).
   - Sanitize plot key extraction with regex supporting named parameters (`title="..."`).
   - Implement zero-warmup cold-start seeding (`c` for EMA on bar 0, `50.0` for RSI on bar 0).
3. **0-Plot Adaptive Trend Baseline Architecture**:
   - Detect 0-plot indicators in `parsePineMetadata` (`hasAdaptiveFallback = true`).
   - Inject `"Adaptive Trend Baseline"` (EMA-21, `#2962FF`, width 2) for overlays or `"Adaptive Oscillator"` (RSI-14, `#FF9800`, width 2) for subpanes.
   - Emit clear notice in Pine Logs: `"[Pine Logs] Notice: Script '<title>' contains 0 explicit plot() statements. Engaged adaptive trend baseline fallback plot to guarantee visible charting and active legend controls."`
   - Create study with `lock = false` to guarantee interactive legend buttons.
4. **UI Harmonization**:
   - Remove slapped-on `#bottom_dock_tabs` and emoji icons.
   - Unify tabs with authentic TradingView Dark Theme styling (`Pine Editor`, `Strategy Tester`, `Trading Panel`, `Pine Logs`).

---

## 5. Verification Method

To independently verify these findings:

1. **Run Batch Example Inspection**:
   ```powershell
   node scan_plots.js
   ```
   Confirms 11 scripts contain 0 explicit plot calls and identify their exact drawing primitives.

2. **Verify Transpilation & Execution**:
   ```powershell
   node test_pine_batch.js
   ```
   Confirms that passing valid data objects `{ open, high, low, close, volume, time }` to `run()` executes cleanly and extracts plots/shapes without throwing.

3. **Verify Backend Endpoints**:
   ```powershell
   curl http://127.0.0.1:9000/pine/catalog
   ```
   Confirms JSON array of 29 cataloged indicators is returned with HTTP 200.

4. **Inspect Key Source Files**:
   - `pine_indicators.js` lines 176–283, 376–542, 666–671.
   - `pine_editor_ide.js` lines 260–285, 648–724, 741–750.
   - `charting_library/bundles/library.e8d44337c84d65489d2c.js` lines 890, 152442.
   - `server.py` lines 2434–2530.
