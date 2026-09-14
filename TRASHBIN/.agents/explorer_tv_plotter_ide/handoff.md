# Handoff Report: TradingView Plotter Engine, Native Shapes & Pine Editor IDE Integration

## 1. Observation

Direct observations from the codebase, TradingView Charting Library bundles, and Pine Script source:

### 1.1 Study Registration & Metainfo Schema
- **`index.html:968`**:
  ```javascript
  custom_indicators_getter: function(PineJS) {
      return Promise.resolve(window.getPineIndicators ? window.getPineIndicators(PineJS) : []);
  }
  ```
- **`charting_library/bundles/library.e8d44337c84d65489d2c.js:890`**:
  ```javascript
  const iS = Yv.getCustomIndicators;
  if ("function" == typeof iS) {
      const e = iS({ Std: Yy.Std });
      if (e && "function" == typeof e.then) {
          e.then((e => {
              const t = Kv.JSServer;
              t.studyLibrary.push.apply(t.studyLibrary, e);
              sS.resolve();
          }));
      }
  }
  ```
- **Metainfo Schema Requirements**:
  Custom studies require an object conforming to `_metainfoVersion: 52` (or `53`), containing `id`, `name`, `description`, `shortDescription`, `is_price_study`, `isRGB: true`, `plots: []`, `styles: {}`, `defaults: { styles: {}, inputs: {} }`, and `inputs: []`.
  The companion `constructor` must implement `this.init(ctx, inputCallback)` and `this.main(ctx, inputCallback)`.

### 1.2 Plot Evaluation & Artificial Line Prevention (`skipHoles`)
- **`charting_library/bundles/library.e8d44337c84d65489d2c.js:491`**:
  ```javascript
  skipHoles: [
      I.LineStudyPlotStyle.Line,
      I.LineStudyPlotStyle.Area,
      I.LineStudyPlotStyle.Cross,
      I.LineStudyPlotStyle.Circles,
      I.LineStudyPlotStyle.StepLine,
      I.LineStudyPlotStyle.StepLineWithDiamonds
  ].includes(y)
  ```
  `LineStudyPlotStyle.Line` is index `0`, which has `skipHoles: true`. When a plot returns `NaN` for inactive periods, the library interpolates across the gap, drawing an artificial continuous line across multi-hour session intervals.
  `LineStudyPlotStyle.LineWithBreaks` is index `7`, which has `skipHoles: false`. When a plot returns `NaN`, the line breaks cleanly without bridging.

### 1.3 Price Scale Badge Display Mask
- **`charting_library/bundles/library.e8d44337c84d65489d2c.js:509`**:
  The price scale label visibility checks `(plot.display & 4) !== 0 && !lastValueData.noData`.
  Bit values:
  - `1`: Pane (render on canvas)
  - `2`: DataWindow
  - `4`: PriceScale (price axis badge)
  - `8`: StatusLine
  Setting `display: 11` ($15 - 4$) explicitly suppresses price axis badge creation while preserving canvas and status line visibility.

### 1.4 Native Chart Shapes API
- **`charting_library/bundles/library.e8d44337c84d65489d2c.js:854-869`**:
  Shape mapping registry links:
  - `"rectangle"` to `LineToolRectangle`
  - `"trend_line"` to `LineToolTrendLine`
  - `"vertical_line"` to `LineToolVertLine`
  - `"horizontal_line"` to `LineToolHorzLine`
  - `"ray"` to `LineToolRay`
  - `"polyline"` / `"path"` to `LineToolPolyline` / `LineToolPath`
  - `"text"` / `"callout"` to `LineToolText` / `LineToolCallout`
- Chart methods exposed: `chart.createMultipointShape(points, options)`, `chart.createShape(point, options)`, `chart.removeEntity(entityId)`, `chart.getAllShapes()`.

### 1.5 Pine Editor IDE Integration
- **`pine_editor_ide.js`**:
  - Contains `#pine_editor_textarea`, `#pine_editor_gutter`, and `#pine_compiler_drawer`.
  - Implements `jumpToLineAndCol(line, col)` to position cursor and scroll to errors.
  - Implements `runCompilation()` using `PineTSLib.pineToJS(source)` and AST validation.
  - Implements `addStudyToChart()` calling `chart.createStudy(studyName, isOverlay, false, [], { lock: false })`. Passing `{ lock: false }` enables standard legend hover controls (Eye, Cogwheel Settings modal, Trash).

### 1.6 LuxAlgo Sessions (`scratch_luxalgo.pine`)
- Script utilizes:
  - Multi-session detection (NY 13:00-22:00, London 07:00-16:00, Tokyo 00:00-09:00, Sydney 21:00-06:00).
  - High/low session bounding boxes (`box.new`).
  - Session midline plots (`plot.style_linebr`).
  - Session info table (`table.new`, `table.cell`).
  - Multi-day vertical dividers (`isnewday` detection at UTC midnight).

---

## 2. Logic Chain

1. **Study Discovery to Chart Execution**:
   - TradingView loads `custom_indicators_getter` during widget boot (`index.html:968`).
   - The returned array of study descriptors is merged into `Kv.JSServer.studyLibrary` (`library.e8d44337c84d65489d2c.js:890`).
   - Therefore, any dynamically transpiled Pine script registered into `window._customPineStudies` and added to `JSServer.studyLibrary` / `chart.studyMetaInfoRepository()` can be immediately instantiated on chart without reloading.

2. **Visual Parity Without Artificial Gaps**:
   - If `plot()` uses the default `plottype: 0` (`Line`), `skipHoles` is `true` (`library.e8d44337c84d65489d2c.js:491`). Inactive session periods will have synthetic lines drawn between distant bars.
   - Using `plottype: 7` (`LineStudyPlotStyle.LineWithBreaks`) sets `skipHoles: false`.
   - In conjunction with returning `NaN` in `this.main` during non-session hours, TradingView renders isolated session lines without cross-session bridging.

3. **Eliminating Price Scale Badge Artifacts**:
   - Secondary lines or session midlines that evaluate to `NaN` when inactive will suppress badges automatically via `lastValueData.noData === true`.
   - Where a plot holds a value or is decorative, configuring `display: 11` unsets bit 4 (`PriceScale`), preventing synthetic price labels from cluttering the Y-axis.

4. **Rendering 2D Geometric Primitives (Boxes, Dividers, Tables)**:
   - Time-series plot arrays in `this.main` cannot draw 2D rectangular bounding boxes or viewport-anchored HUD tables.
   - TradingView's native `chart.createMultipointShape` and `chart.createShape` APIs directly instantiate `LineToolRectangle` and `LineToolVertLine`.
   - Tracking shape IDs by study instance ID enables deterministic cleanup upon study removal, symbol change, or timeframe alteration (`clearStudyShapes`).
   - HTML DOM overlays inside `#tv_chart_container` provide pixel-perfect dashboard tables matching TradingView's UI layout.

5. **Timescale Integrity**:
   - By anchoring shapes strictly to existing bar timestamps (`time: bar.time`), the candlestick timescale is maintained without injecting artificial or dummy candles.

6. **IDE Workflow & Legend Controls**:
   - Setting `{ lock: false }` on `chart.createStudy` ensures the user can open the format modal, hide/show the indicator, or remove it.
   - Integrating line/column diagnostics with `jumpToLineAndCol` in `pine_editor_ide.js` provides instant feedback and error debugging.

---

## 3. Caveats

1. **`createMultipointShape` Execution Timing**:
   Shapes cannot be created until the chart has completed its initial data load (`chart.onDataLoaded()`). Attempting to add shapes before historical bars are present in the chart model will result in shape points failing to bind to time coordinates.
2. **Chart Layout Persistence**:
   Shapes created via `chart.createMultipointShape` with `disableSave: true` are session-only and will not persist across browser reloads unless re-rendered by the study lifecycle manager.
3. **Datafeed Availability**:
   Multi-day dividers depend on bar timestamps. If the datafeed has missing data across day boundaries (e.g. illiquid assets or holiday closures), the divider will anchor to the first available bar of the new day.
4. **Table DOM vs Canvas**:
   While `LineToolTable` exists in some library builds, the HTML DOM overlay approach is recommended for complex styled tables to ensure uniform styling and font rendering across browsers.

---

## 4. Conclusion

1. **Metainfo & Plot Types**:
   The engine must construct full v52/v53 Metainfo descriptors for all 8 Pine plot types, with `isRGB: true` for 32-bit packed ARGB integer colors.
2. **Strict Invariance**:
   Session levels and broken lines must use `plottype: 7` (`LineWithBreaks`) and return `NaN` when inactive. Non-price plots must set `display: 11` to prevent axis badge pollution.
3. **Native Shapes Integration**:
   `scratch_luxalgo.pine` session boxes and daily vertical dividers must be rendered using `chart.createMultipointShape` (`rectangle`) and `chart.createShape` (`vertical_line`), tracked via a shape registry, and cleaned up on lifecycle events.
4. **Pine Editor IDE**:
   `pine_editor_ide.js` must compile Pine scripts via `PineTSLib`, report AST errors with clickable `jumpToLineAndCol` navigation, inject the transpiled study into `JSServer.studyLibrary`, and add it to the chart with `lock: false` to enable full legend interactions.

---

## 5. Verification Method

### 5.1 Verification Commands
- Check syntax and transpile output from FastAPI backend:
  ```powershell
  Invoke-RestMethod -Uri "http://127.0.0.1:9000/pine/catalog" -Method Get
  ```
- Inspect transpiler endpoint:
  ```powershell
  Invoke-RestMethod -Uri "http://127.0.0.1:9000/pine/source/scratch_luxalgo.pine" -Method Get
  ```

### 5.2 Files to Inspect
- `E:\TRADINGVIEW ADVANCED\.agents\explorer_tv_plotter_ide\report.md` (Detailed architecture specification)
- `E:\TRADINGVIEW ADVANCED\pine_indicators.js` (Study descriptor generator and shape rendering)
- `E:\TRADINGVIEW ADVANCED\pine_editor_ide.js` (IDE drawer and compiler diagnostics)
- `E:\TRADINGVIEW ADVANCED\scratch_luxalgo.pine` (Reference LuxAlgo Sessions Pine Script v6)

### 5.3 Invalidation Conditions
- Any line segment drawn connecting inactive session intervals across time gaps (indicates `plottype !== 7` or non-`NaN` return).
- Price scale displaying badges for inactive plots or midlines (indicates bit 4 not masked in `display` or `NaN` not returned on the last bar).
- Candlestick timescale displaying empty spaces or shifted dates (indicates synthetic candles were erroneously added to the UDF feed).
- Legend hover controls (Eye, Settings, Trash) missing or disabled (indicates `lock: true` was passed to `createStudy`).
