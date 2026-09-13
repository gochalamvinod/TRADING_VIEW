# DISPATCH — worker_m31_gen2

## Mission: M31 — Authentic Visual Output & Plotter Engine (Zero Diversion)

You are `worker_m31_gen2`. Your working directory is:
`E:\TRADINGVIEW ADVANCED\.agents\worker_m31_gen2`

### Exclusive File Ownership:
- `E:\TRADINGVIEW ADVANCED\pine_indicators.js`

### Reference & Context Files (Read-only):
- `E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md` (Authoritative user request)
- `E:\TRADINGVIEW ADVANCED\.agents\orchestrator_11\PROJECT.md` (Project architecture & visual invariance contracts)
- `E:\TRADINGVIEW ADVANCED\.agents\explorer_tv_plotter_ide\handoff.md` (Plotter & shapes API investigation findings)
- `E:\TRADINGVIEW ADVANCED\.agents\explorer_tv_plotter_ide\report.md` (Detailed metainfo, shape mapping, and display bitmask analysis)
- `E:\TRADINGVIEW ADVANCED\scratch_luxalgo.pine` (Reference LuxAlgo Sessions Pine Script v6)

### Objectives & Deliverables:
1. **Metainfo v52/53 Schema for all 8 Plot Types**:
   - In `pine_indicators.js`, support Metainfo descriptors for `plot`, `plotcandle`, `plotbar`, `plotshape`, `plotchar`, `plotarrow`, `hline`, `fill`.
   - Set `isRGB: true` so packed 32-bit ARGB colors (`0xAARRGGBB`) render with exact opacity and color fidelity.
2. **Strict na/NaN Invariance (Zero Visual Diversion)**:
   - Configure `plottype: 7` (`LineStudyPlotStyle.LineWithBreaks`) on broken/session line plots so `skipHoles: false` strictly prevents artificial flat horizontal lines connecting bars across time gaps.
   - Set `display: 11` ($15 - 4$, unsetting bit 4 `PriceScale`) on auxiliary, midline, or inactive plots so exactly 0 stacked price badges appear on the price axis.
   - When a plot has no data on a bar, return `NaN` in `this.main()`.
3. **Native Shapes & Drawings Dispatcher**:
   - Extract drawing objects populated by PineTS into `ctx.plots`:
     - `ctx.plots['__boxes__']` -> instantiate via `chart.createMultipointShape(points, { shape: 'rectangle', ... })`
     - `ctx.plots['__lines__']` -> instantiate via `chart.createShape(point, { shape: 'trend_line' | 'vertical_line', ... })`
     - `ctx.plots['__polylines__']` -> instantiate via `chart.createMultipointShape(points, { shape: 'polyline', ... })`
     - `ctx.plots['__labels__']` -> instantiate via `chart.createShape(point, { shape: 'text', ... })`
     - `ctx.plots['__tables__']` -> render into authentic HTML overlay container within `#tv_chart_container`.
   - Implement deterministic shape lifecycle tracking:
     - Keep a registry of shape entity IDs mapped to `studyId`.
     - Provide `clearStudyShapes(studyId)` and invoke it whenever a study is recalculated, updated, or removed from chart, preventing shape memory leaks or duplicated shapes.
4. **LuxAlgo Sessions Shading & Day Dividers**:
   - Accurately render session bounding boxes for London, New York, Tokyo, Sydney.
   - Render multi-day vertical dividers at UTC midnight using native shapes without distorting the candlestick timescale (strictly anchor to bar timestamps).
5. **PineTS Execution Bridge in `this.main`**:
   - Connect transpiled PineTS indicators to `this.main(ctx, inputCallback)` so calculated numerical series and drawing primitives are executed and emitted properly.
6. **Verify and Test**:
   - Run node/browser checks to verify metainfo generation and shapes dispatch.
   - Verify against Tier 2 tests from `tests/test_pinescript_v6_e2e.py`.
   - Document all verification commands and outputs in `handoff.md`.

### MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Protocol:
- Update `progress.md` after each step with `Last visited: [timestamp]`.
- Write `handoff.md` with Observation, Logic Chain, Caveats, Conclusion, and Verification commands + outputs.
- Notify orchestrator (`parent`) via `send_message` when done.
