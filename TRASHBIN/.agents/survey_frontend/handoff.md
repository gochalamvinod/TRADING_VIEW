# Handoff Report: TradingView Frontend & Pine Indicators Architecture

**Agent**: Survey Explorer (`survey_frontend`)  
**Parent Agent**: `122cf2b0-2d49-42fd-ad49-479d43f6c242`  
**Timestamp**: 2026-09-09T07:22:00Z  
**Handoff Type**: Hard (Task Complete)  

---

## 1. Observation

1. **Charting Library Candlestick Renderer**:
   - In `charting_library/bundles/library.e8d44337c84d65489d2c.js`:
     `class Ke` renders candle series when `Ht(metaInfo, plotIndex)` evaluates to true.
     Function `Ht` checks:
     ```javascript
     function Ht(metaInfo, plotIndex) {
         var target = metaInfo.plots[plotIndex].target;
         var ohlcPlot = metaInfo.defaults.ohlcPlots && metaInfo.defaults.ohlcPlots[target];
         return ohlcPlot && isOhlcPlotStyleCandles(ohlcPlot.plottype);
     }
     ```
     Here `isOhlcPlotStyleCandles` returns true if and only if `ohlcPlot.plottype === "ohlc_candles"`.
   - In `charting_library/bundles/library.e8d44337c84d65489d2c.js` (module `589637`):
     Dynamic colors under `isRGB: true` are decoded via:
     ```javascript
     function rgbaFromInteger(colorInt) {
         var r = Math.round(colorInt) % 256;
         var g = Math.floor(colorInt / 256) % 256;
         var b = Math.floor(colorInt / 65536) % 256;
         var a = Math.floor(colorInt / 16777216) / 255;
         return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
     }
     ```

2. **Legend Actions & Settings Gear Requirements**:
   - In `charting_library/bundles/chart-widget-gui.373398f680e71823f0f1.js` line 34:
     ```javascript
     e.prototype._updateActions = function() {
         var canEdit = this._source.userEditEnabled() && this._source.hasUserEditableOptions();
         ...
     };
     ```
     `userEditEnabled()` returns true when `!this._source.isLocked()`. `createStudy(name, isOverlay, lock)` sets locked state. When `lock` is `false`, user edits, delete, and visibility toggles are enabled.
     `hasUserEditableOptions()` returns true if `metaInfo.inputs.length > 0` or `metaInfo.styles` / `metaInfo.ohlcPlots` are user-configurable.
     When clicked, `legend-settings-action` triggers `this._source.showPropertiesDialog()`, which invokes `new-edit-object-dialog.4d64cf5237fd0734deb8.js`.

3. **PineTS AST Metadata for Inputs**:
   - Executed `Indicator.from(code)` with authoritative `Custom Symbol Candles` in Node via `PineTS-main/dist/pinets.min.cjs`:
     `ind.getInputsMeta()` outputs 9 inputs:
     - `sym` (`type: "symbol"`, `defval: "AAPL"`)
     - `res` (`type: "timeframe"`, `defval: "D"`)
     - `upColor` (`type: "color"`, `defval: "#4caf50"`)
     - `downColor` (`type: "color"`, `defval: "#f44336"`)
     - `wickColor` (`type: "color"`, `defval: "#787b86"`)
     - `borderUpColor` (`type: "color"`, `defval: "#4caf50"`)
     - `borderDownColor` (`type: "color"`, `defval: "#f44336"`)
     - `showBorders` (`type: "bool"`, `defval: true`)
     - `showWicks` (`type: "bool"`, `defval: true`)
   - `PineTS` indicator execution on sample candles returned `ctx.plots['Candles']` with `style: 'candle'`, values array `[open, high, low, close]`, and options `{ color, wickcolor, bordercolor }`.

4. **UI Artifacts in `pine_indicators.js`**:
   - Line 926: `<span style="font-size:16px;">🌲</span> <strong>Pine Script Editor v5</strong>`
   - Line 928: `<button id="pine_editor_close" ...>&times;</button>`
   - Line 959: `<button id="pine_editor_add" ...>&#10010; Add to Chart</button>`
   - Line 967: `<button id="pine_editor_run" ...>⚡ Test Run</button>`
   - These emoji elements form an unauthentic modal dialog that conflicts with the side-by-side dock in `pine_editor_ide.js`.

5. **Legend Layout Defects in DOM**:
   - The element `[data-name="legend-interval-show-hide-action"]` / `.intervalEye` appears when `isMTFResolution: true` is set.
   - Values wrappers `[class*="valuesWrapper"]` wrap onto multiple lines when study outputs multiple values, colliding with indicator titles and candle body rendering.

---

## 2. Logic Chain

1. **Candle Plotting Mechanism**:
   - From Observation 1, TradingView checks `isOhlcPlotStyleCandles(defaults.ohlcPlots[target].plottype)` where target is defined in `plots`.
   - Therefore, metainfo must have `defaults.ohlcPlots['candle_0'].plottype = 'ohlc_candles'`, with 4 plots targeting `candle_0` (`ohlc_open`, `ohlc_high`, `ohlc_low`, `ohlc_close`), plus colorer plots (`ohlc_colorer`, `wick_colorer`, `border_colorer`).
   - From Observation 1, TradingView unpacks dynamic colors via `rgbaFromInteger` when `isRGB: true`. Therefore, `colorToInt` must encode `r + 256*g + 65536*b + 16777216*Math.round(255*a)`.
   - In `this.main(ctx, inputCallback)`, the returned array must match the exact 7-element plot sequence: `[open, high, low, close, bodyColorInt, wickColorInt, borderColorInt]`.

2. **Input Resolution Mechanism**:
   - From Observation 3, `PineTS` produces 9 typed inputs (`symbol`, `timeframe`, `color`, `bool`).
   - TradingView requires `timeframe` mapped to `type: "resolution"`, `symbol` to `type: "symbol"`, `color` to `type: "color"`, `bool` to `type: "bool"`.
   - TradingView's input resolver inspects `defaults.inputs[varId]` and `defaults.inputs[index]`. Populating both ensures `inputCallback(id)` or `inputCallback(index)` works reliably.

3. **Legend Controls & CSS Injections**:
   - From Observation 2, `createStudy` must be called with `lock = false` to satisfy `!this._source.isLocked()` and `userEditEnabled()`.
   - With 9 inputs defined, `hasUserEditableOptions()` is true, which makes the Settings gear button appear on hover.
   - From Observation 5, injecting targeted CSS hides `[data-name="legend-interval-show-hide-action"]` and sets `white-space: nowrap` on `[class*="valuesWrapper"]`, resolving overlapping elements without breaking chart interactions.

4. **IDE Modernization**:
   - From Observation 4, `pine_indicators.js`'s floating emoji modal is redundant with `pine_editor_ide.js`.
   - Deprecating `openPineEditorModal` and redirecting invocation to `window.PineEditorIDE.toggle()` unifies the interface into a single, authentic side-by-side dock adhering to the TradingView dark theme palette (`#131722`, `#1e222d`, `#2a2e39`, `#2962ff`).

---

## 3. Caveats

- **Iframe CSS Injection Timing**: When injecting CSS rules into the chart iframe, ensure it executes inside `widget.onChartReady(...)` so the iframe's DOM is fully loaded.
- **Symbol Data Resolution in PineTS**: Pine Script `request.security(sym, res, ...)` requires access to historical bar feeds for the requested symbol. In the standalone frontend runtime, if the custom symbol matches the active chart symbol, bars can be sourced directly from `ctx.symbol.candles`. For other symbols, mock or feed cache resolution must be provided.

---

## 4. Conclusion

1. Multi-series candlestick rendering in sub-panes/overlays (`plotcandle`) is fully supported natively using `_metainfoVersion: 52`, `plottype: 'ohlc_candles'`, `isRGB: true`, and 7-element OHLC+colorer arrays.
2. PineTS AST input metadata maps directly to TradingView study input types with dual key/index default registration.
3. Native legend action buttons (Hide, Format gear, Delete) work reliably when `lock: false` is passed to `createStudy`. Unwanted interval eye and text wraps are resolved cleanly with standard CSS rules.
4. The Pine Editor GUI should be standardized on the side-by-side dock in `pine_editor_ide.js`, eliminating emojis and aligning with TradingView dark theme tokens.

---

## 5. Verification Method

To independently verify these findings:
1. **Schema and Metainfo Inspection**:
   Examine `charting_library/bundles/library.e8d44337c84d65489d2c.js` for `isOhlcPlotStyleCandles` and `rgbaFromInteger` in module `589637`.
2. **PineTS AST Extraction**:
   Run `node -e "const { Indicator } = require('./PineTS-main/dist/pinets.min.cjs'); const ind = Indicator.from('//@version=5\nindicator(\"Custom Symbol Candles\", overlay=false)\nsym = input.symbol(\"AAPL\", \"Symbol\")\nres = input.timeframe(\"D\", \"Resolution\")\nupColor = input.color(color.green, \"Bullish Body Color\")\ndownColor = input.color(color.red, \"Bearish Body Color\")\nwickColor = input.color(color.gray, \"Wick Color\")\nborderUpColor = input.color(color.green, \"Bullish Border Color\")\nborderDownColor = input.color(color.red, \"Bearish Border Color\")\nshowBorders = input.bool(true, \"Show Borders\")\nshowWicks = input.bool(true, \"Show Wicks\")\nplotcandle(open, high, low, close, \"Candles\", upColor, wickColor, showBorders ? borderUpColor : na)'); console.log(ind.getInputsMeta());"` to confirm 9 inputs.
3. **Legend Actions Check**:
   In browser console on `http://localhost:8000`:
   Call `tvWidget.activeChart().createStudy('Custom Symbol Candles', false, false)` and hover over the study legend in the sub-pane. Confirm presence of eye (hide), gear (settings), and trash (delete) icons.
4. **Full Architecture Report**:
   Inspect `E:\TRADINGVIEW ADVANCED\.agents\survey_frontend\report.md` for complete technical specifications.
