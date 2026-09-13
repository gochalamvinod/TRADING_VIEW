# Worker M31 Dispatch: Authentic Visual Output & Plotter Engine (Zero Diversion)

## Objective
Implement high-fidelity visual output and plotter engine in `pine_indicators.js` ensuring 100% TradingView parity with zero visual diversion:
1. File Write Ownership: Exclusively `pine_indicators.js`. (Do NOT edit `PineTS-main/`, `server.py`, or `pine_editor_ide.js`).
2. Metainfo v52/53 Schema:
   - Implement metainfo descriptors for all 8 plot types: `plot`, `plotcandle`, `plotbar`, `plotshape`, `plotchar`, `plotarrow`, `hline`, `fill`.
   - Enforce packed 32-bit ARGB integer colors with `isRGB: true`.
3. Strict `na`/`NaN` Invariance:
   - For all line/series plots, configure `plottype: 7` (`LineStudyPlotStyle.LineWithBreaks`) where `skipHoles: false`.
   - When plots evaluate to `na`/`NaN`, ensure zero continuous line segments bridge across inactive periods or session gaps.
   - For auxiliary, session, or inactive plots, configure `display: 11` (unsetting bit 4 / PriceScale) so exactly 0 synthetic price scale badges are created on the price scale.
4. Native Shapes & Drawing Dispatcher:
   - Connect PineTS runtime evaluation output (`context.plots['__boxes__']`, `__lines__`, `__polylines__`, `__labels__`, `__tables__`) to TradingView's native shapes API:
     - `box.new` -> `chart.createMultipointShape(points, { shape: 'rectangle', ... })`
     - `line.new` -> `chart.createShape(point, { shape: 'vertical_line' | 'trend_line', ... })`
     - `polyline.new` -> `chart.createMultipointShape(points, { shape: 'polyline' | 'path', ... })`
     - `label.new` -> `chart.createShape(point, { shape: 'text' | 'callout', ... })`
     - `table.new` / `table.cell` -> render in viewport-anchored HTML DOM container matching TradingView UI.
   - Shape Lifecycle: Maintain shape registry by `studyId`. On study removal, symbol change, or resolution recalculation, call `clearStudyShapes(studyId)` to remove old shapes cleanly via `chart.removeEntity(id)`.
5. Session Shading & Multi-day Dividers (LuxAlgo Sessions):
   - Support `scratch_luxalgo.pine` session boxes (London, New York, Tokyo, Sydney) and vertical dashed day dividers.
   - Anchor strictly to bar timestamps (`time: bar.time`) without distorting candlestick timescales or generating inactivity gaps.
6. Execution Bridge:
   - In `this.main(ctx, inputCallback)`, evaluate the transpiled PineTS function or execute PineTS runtime across historical bars, feeding genuine values to TradingView.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Run tests, document results in `handoff.md`, and notify the orchestrator when complete.

## 2026-09-10T04:31:00Z
You are worker_m31_plotter, an expert TradingView Charting Library plotter and visual output engineer.
Your working directory is: E:\TRADINGVIEW ADVANCED\.agents\worker_m31_plotter
MANDATORY FIRST STEP: Read the authoritative user request at: E:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md
Read your dispatch instructions at: E:\TRADINGVIEW ADVANCED\.agents\worker_m31_plotter\DISPATCH.md
Also read the survey reports:
- E:\TRADINGVIEW ADVANCED\.agents\explorer_tv_plotter_ide\report.md
- E:\TRADINGVIEW ADVANCED\.agents\spec_miner_pinescript_v6\report.md
- E:\TRADINGVIEW ADVANCED\.agents\explorer_pinets_v6_compiler\report.md

Your scope and write ownership:
You EXCLUSIVELY own and modify:
- E:\TRADINGVIEW ADVANCED\pine_indicators.js
(DO NOT touch PineTS-main/, server.py, or pine_editor_ide.js).

Tasks:
1. Metainfo v52/53 Schema: Implement metainfo descriptors for all 8 plot types: `plot`, `plotcandle`, `plotbar`, `plotshape`, `plotchar`, `plotarrow`, `hline`, `fill`. Enforce packed 32-bit ARGB integer colors with `isRGB: true`.
2. Strict na/NaN Invariance:
   - For all line/series plots, configure `plottype: 7` (`LineStudyPlotStyle.LineWithBreaks`) where `skipHoles: false`.
   - When plots evaluate to `na`/`NaN`, ensure zero continuous line segments bridge across inactive periods or session gaps.
   - For auxiliary, session, or inactive plots, configure `display: 11` (unsetting bit 4 / PriceScale) so exactly 0 synthetic price scale badges are created on the price scale.
3. Native Shapes & Drawing Dispatcher:
   - Connect PineTS runtime evaluation output (`context.plots['__boxes__']`, `__lines__`, `__polylines__`, `__labels__`, `__tables__`) to TradingView's native shapes API:
     - `box.new` -> `chart.createMultipointShape(points, { shape: 'rectangle', ... })`
     - `line.new` -> `chart.createShape(point, { shape: 'vertical_line' | 'trend_line', ... })`
     - `polyline.new` -> `chart.createMultipointShape(points, { shape: 'polyline' | 'path', ... })`
     - `label.new` -> `chart.createShape(point, { shape: 'text' | 'callout', ... })`
     - `table.new` / `table.cell` -> render in viewport-anchored HTML DOM container matching TradingView UI.
   - Shape Lifecycle: Maintain shape registry by `studyId`. On study removal, symbol change, or resolution recalculation, call `clearStudyShapes(studyId)` to remove old shapes cleanly via `chart.removeEntity(id)`.
4. Session Shading & Multi-day Dividers (LuxAlgo Sessions):
   - Support `scratch_luxalgo.pine` session boxes (London, New York, Tokyo, Sydney) and vertical dashed day dividers.
   - Anchor strictly to bar timestamps (`time: bar.time`) without distorting candlestick timescales or generating inactivity gaps.
5. Execution Bridge:
   - In `this.main(ctx, inputCallback)`, evaluate the transpiled PineTS function or execute PineTS runtime across historical bars, feeding genuine values to TradingView.

