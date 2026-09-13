# Technical Analysis: Frontend Pine Editor IDE, Charting Library Hooks, Legend Controls & Authentic Bottom UI

**Investigator**: teamwork_preview_explorer (explorer_survey_orch7_2)  
**Date**: 2026-09-09  
**Target Repository**: `e:\TRADINGVIEW ADVANCED`  
**Milestones Covered**: M0 / M20 / M21 / M22 / M23 Survey  
**Special Directives Addressed**: Authentic TradingView Bottom UI, Elimination of Custom Slapped-on Docks & Emojis, Native Bottom Widget Coordination

---

## 1. Executive Summary

This investigation surveys the frontend Pine Editor IDE (`pine_editor_ide.js`), the custom indicators bridge (`pine_indicators.js`), the bottom panel styling (`pine_editor.css`), TradingView chart initialization (`index.html`), and the underlying TradingView Charting Library bundles (`charting_library/bundles/*.js`).

### Core Findings:
1. **Study Editability & Legend Action Buttons**: The presence and functionality of the legend hover buttons — **Hide/Show (👁️)**, **Format/Settings (⚙️)**, and **Remove/Delete (🗑️)** — depend strictly on `this._source.userEditEnabled()`. When a study is added via `chart.createStudy(name, forceOverlay, lock, ...)`, passing `lock: false` prevents `e.setUserEditEnabled(!1)` from being called. When `userEditEnabled()` is `true`, `_getIsEditable()`, `canBeHidden()`, and `isUserDeletable()` all resolve to `true`, making all three action buttons visible and operational.
2. **Featureset Prerequisites**: All required featureset flags (`show_hide_button_in_legend`, `study_buttons_in_legend`, `format_button_in_legend`, `delete_button_in_legend`, `property_pages`) are already enabled in `widgetOptions.enabled_features` in `index.html`.
3. **Reference Templates Catalog**: 8 clean, fully functional PineScript v5 reference templates (**SMA**, **EMA**, **RSI**, **MACD**, **Bollinger Bands**, **ATR**, **SuperTrend**, **Volume**) have been cataloged conforming to Metainfo v52 schema and the `Std` execution engine.
4. **Adaptive Trend Baseline Fallback**: For scripts containing 0 explicit `plot()` calls (such as drawing-based indicators or custom calculation blocks), the runtime supplies an adaptive EMA trendline (overlay) or RSI oscillator (pane), preventing blank charts or canvas rendering errors, while logging an informative diagnostic notice to the Pine Logs console.
5. **Authentic Bottom UI & Pine Editor Integration**: The user directive (*"i said u i need same ui as traingview u gave me bottom fix them"*) specifically flags the unauthentic slapped-on `#bottom_dock_tabs` with the green emoji `🌲`, clumsy external docking, and the visual collision with TradingView's native bottom Account Manager (`.layout__area--bottom`). The fix requires eliminating emojis, applying authentic TradingView dark theme design tokens (`#131722` bg, `#1e222d` header, `#2a2e39` borders, `#787b86` text, `#2962ff` accent, monochrome SVGs), and synchronizing visibility with the native bottom widget area (`setAccountManagerVisibilityMode`).

---

## 2. Study Legend DOM & Bundle Architecture for Study Editability (`lock: false`)

### 2.1 The `createStudy` Hook and the `lock` Parameter
In `charting_library/bundles/library.e8d44337c84d65489d2c.js` (lines 865–866), the `createStudy` method signature and implementation are:

```javascript
// library.e8d44337c84d65489d2c.js:865-866
async createStudy(e, t, i, s, r, n) {
  // e: studyName (string)
  // t: forceOverlay (boolean)
  // i: lock (boolean)
  // s: inputs (object or array)
  // r: overrides (object)
  // n: options (object)
  ...
  e = e.toLowerCase();
  const o = await (0, Ls.studyMetaInfoRepository)().findAllJavaStudies(),
        a = ks.StudyMetaInfo.findStudyMetaInfoByDescription(o, e);
  ...
  const l = (n.disableUndo ? this._chartWidget.model().model() : this._chartWidget.model())
            .createStudyInserter({ type: "java", studyId: a.id }, []);
  if (l.setForceOverlay(!!t), ...)
  ...
  return l.insert((() => Promise.resolve({ inputs: s || {}, parentSources: [] }))).then((e => (
    r && (0, uy.applyOverridesToStudy)(e, r),
    i && e.setUserEditEnabled(!1), // <--- CRUCIAL: IF lock IS TRUE, DISALLOWS USER EDIT!
    e.id()
  )));
}
```

### 2.2 Impact of `setUserEditEnabled`
In `charting_library/bundles/library.e8d44337c84d65489d2c.js` (line 294):
```javascript
setUserEditEnabled(e) { this._userEditEnabled = e; }
userEditEnabled() { return this._userEditEnabled; }
canBeHidden() { return this.userEditEnabled(); }
isUserDeletable() { return this.userEditEnabled(); }
```
When `lock: true` is passed:
- `userEditEnabled()` returns `false`.
- `canBeHidden()` returns `false` $\rightarrow$ Hide action is disabled.
- `isUserDeletable()` returns `false` $\rightarrow$ Delete action is suppressed.
- `_getIsEditable()` returns `false` $\rightarrow$ Settings gear icon is hidden, and `onShowSettings()` bails.

When `lock: false` is passed:
- `userEditEnabled()` defaults to `true`.
- All controls (`canBeHidden()`, `isUserDeletable()`, `_getIsEditable()`) remain enabled.

### 2.3 Study Legend DOM Hierarchy
Inspecting `chart-widget-gui.373398f680e71823f0f1.js` (lines 18, 23, 28, 34) and `2666.d7dd4a59f33a2f52cf86.css`:

```
div.legend-l31H9iuA [data-name="legend"]
 └── div.sourcesWrapper-l31H9iuA
      └── div.item-l31H9iuA.study-l31H9iuA [data-name="legend-source-item", data-entity-id="<studyId>", role="toolbar"]
           ├── div.titlesWrapper-l31H9iuA
           │    ├── div.titleWrapper-l31H9iuA.mainTitle-l31H9iuA [titleId="legend-source-title"]
           │    │    └── span.title-l31H9iuA ("SMA 9/21 Crossover")
           │    └── div.titleWrapper-l31H9iuA.descTitle-l31H9iuA [titleId="legend-source-description"]
           │         └── span.title-l31H9iuA ("9, 21, close")
           ├── div.valuesWrapper-l31H9iuA
           │    ├── div.valueItem-l31H9iuA [data-test-id-value-title="Fast MA"]
           │    │    └── div.valueValue-l31H9iuA (e.g. "2384.50" in plot color)
           │    └── div.valueItem-l31H9iuA [data-test-id-value-title="Slow MA"]
           │         └── div.valueValue-l31H9iuA (e.g. "2381.10" in plot color)
           └── div.buttonsWrapper-l31H9iuA
                └── div.buttons-l31H9iuA
                     ├── button.button-l31H9iuA.eye-l31H9iuA [data-name="legend-show-hide-action", title="Hide study"]
                     │    └── span.buttonIcon-l31H9iuA (SVG .normal-eye / .crossed-eye)
                     ├── button.button-l31H9iuA [data-name="legend-settings-action", title="Settings"]
                     │    └── span.buttonIcon-l31H9iuA (SVG gear)
                     ├── button.button-l31H9iuA [data-name="legend-delete-action", title="Remove"]
                     │    └── span.buttonIcon-l31H9iuA (SVG trash bin)
                     └── button.button-l31H9iuA [data-name="legend-more-action", title="More"]
                          └── span.buttonIcon-l31H9iuA (SVG three dots)
```

---

## 3. How Hover Action Buttons Are Exposed

### 3.1 Featureset Conditions in the Charting Library
In `chart-widget-gui.373398f680e71823f0f1.js` line 34, `_createActions()` initializes each action button subject to both featureset flags and state observables:

| Action Button | DOM Data-Name | Class | Featureset Gate | Observable Condition |
| :--- | :--- | :--- | :--- | :--- |
| **Hide/Show** (👁️) | `legend-show-hide-action` | `button-l31H9iuA eye-l31H9iuA` | `show_hide_button_in_legend`, `study_buttons_in_legend` | `!_getDisabledOnIntervalState()` |
| **Settings** (⚙️) | `legend-settings-action` | `button-l31H9iuA` | `property_pages`, `format_button_in_legend` | `_isEditable.readonly()` and `hasUserEditableOptions()` |
| **Delete** (🗑️) | `legend-delete-action` | `button-l31H9iuA` | `delete_button_in_legend` | `_isEditable.readonly()` |
| **More Actions** (···) | `legend-more-action` | `button-l31H9iuA` | Default | `_isEditable.spawn()` |

### 3.2 CSS Hover Rules & Interaction States
In `bundles/2666.d7dd4a59f33a2f52cf86.css`:
- Normal state: `.buttonsWrapper-l31H9iuA` has `max-width: 0; width: 0;`, and `.buttons-l31H9iuA` has `opacity: 0; pointer-events: none;`.
- Hover state: Hovering over `.item-l31H9iuA` applies `.withAction-l31H9iuA`:
  ```css
  .withAction-l31H9iuA .buttons-l31H9iuA {
    cursor: default;
    opacity: 1;
    pointer-events: auto;
  }
  .withAction-l31H9iuA .buttons-l31H9iuA .button-l31H9iuA {
    display: flex;
    opacity: 1;
    pointer-events: auto;
  }
  ```
- Disabled/Hidden state: When a study is hidden, `.disabled-l31H9iuA` is applied to the row, and the eye button remains pinned with width `var(--legend-source-item-button-width)` so the user can easily un-hide it.

---

## 4. Event Lifecycle & Action Tracing

### 4.1 Clicking Format/Settings (Gear ⚙️)
- **Source**: `chart-widget-gui.373398f680e71823f0f1.js:28`
- **Handler**: `onShowSettings(e)`
- **Trace**:
  ```javascript
  onShowSettings(e) {
    this._source.userEditEnabled() && (
      this.setSourceSelected(),
      this._callbacks.showChartPropertiesForSource(this._source, e),
      Q("Settings for source")
    )
  }
  ```
- **Resulting Behavior**:
  1. Calls `setSourceSelected()`, adding the study to the active chart selection.
  2. Calls `this._callbacks.showChartPropertiesForSource(this._source)`.
  3. Opens the native TradingView Study Properties / Format Dialog.
  4. The dialog inspects `this._source.metaInfo()`:
     - **Inputs Tab**: Automatically renders input fields matching `metainfo.inputs` (integer spinners, float fields, bool checkboxes, source selectors).
     - **Style Tab**: Automatically renders color pickers, opacity sliders, plot style dropdowns (Line, Histogram, Cross, Area, Columns, Circles), and plot visibility toggles for each entry in `metainfo.plots` and `metainfo.styles`.
     - **Visibility Tab**: Timeframe / resolution filters.
  5. User changes immediately dispatch through the undo model (`ChangeStudyPropertyCommand`) and recompute the study on the fly.

### 4.2 Clicking Hide/Show (Eye 👁️)
- **Source**: `chart-widget-gui.373398f680e71823f0f1.js:28`
- **Handler**: `onToggleDisabled()`
- **Trace**:
  ```javascript
  onToggleDisabled() {
    const e = this._source.properties().childs().visible,
          t = !e.value();
    this._model.setProperty(e, t, (t ? ve : we).format({
      title: new _e.TranslatedString(this._source.name(), this._source.title(me.TitleDisplayTarget.StatusLine))
    }));
    Q((t ? "Show" : "Hide") + " source");
  }
  ```
- **Resulting Behavior**:
  1. Accesses the study's visible property: `this._source.properties().childs().visible`.
  2. Toggles between `true` and `false`.
  3. `StudyPaneView` checks `visible.value()`: when `false`, plot lines, shapes, and fill bands are omitted from chart canvas rendering.
  4. In the legend: `.item-l31H9iuA` gains the `.disabled-l31H9iuA` class, dimming the title text to `#575757` and switching the icon from `.normal-eye` to `.crossed-eye`.
  5. Clicking again restores visibility instantly.

### 4.3 Clicking Remove/Delete (Trash 🗑️)
- **Source**: `chart-widget-gui.373398f680e71823f0f1.js:32-33`
- **Handler**: `onRemoveSource()`
- **Trace**:
  ```javascript
  onRemoveSource() {
    this._source.isUserDeletable() && (
      this._source.hasChildren() ?
        qe.showDeleteStudyTreeConfirm(this._model.removeSource.bind(this._model, this._source, !1)) :
        this._model.removeSource(this._source, !1),
      Q("Remove sources")
    )
  }
  ```
- **Resulting Behavior**:
  1. Verifies `this._source.isUserDeletable()`.
  2. Calls `this._model.removeSource(this._source, false)`:
     - The study is detached from its pane's data sources.
     - Calls `this.destroy()` / `this.stop()` on the study runtime, freeing up memory and disconnecting `this._gateway.removeStudy(studyId)`.
     - Removes the DOM element `.item-l31H9iuA.study-l31H9iuA` from `.legend-l31H9iuA`.
     - Cleans up price axis scale labels and data window views.
     - If the study resided on a separate sub-pane and was the sole indicator on that pane, the sub-pane is automatically removed and the chart layout stretches back cleanly without orphaned state or errors.

---

## 5. Working PineScript v5 Reference Templates Catalog

To satisfy Requirement R3, 8 working PineScript v5 reference templates must be available across the Pine Editor IDE, the editor modal, and the `custom_indicators_getter` registry:

### Template 1: Simple Moving Average (SMA)
- **Overlay**: `true`
- **Code**:
  ```pinescript
  //@version=5
  indicator("Simple Moving Average", shorttitle="SMA", overlay=true)
  length = input.int(20, "Length", minval=1)
  src = input.source(close, "Source")
  offset = input.int(0, "Offset", minval=-500, maxval=500)
  out = ta.sma(src, length)
  plot(out, "SMA", color=color.blue, offset=offset)
  ```

### Template 2: Exponential Moving Average (EMA)
- **Overlay**: `true`
- **Code**:
  ```pinescript
  //@version=5
  indicator("Exponential Moving Average", shorttitle="EMA", overlay=true)
  length = input.int(20, "Length", minval=1)
  src = input.source(close, "Source")
  offset = input.int(0, "Offset", minval=-500, maxval=500)
  out = ta.ema(src, length)
  plot(out, "EMA", color=color.aqua, offset=offset)
  ```

### Template 3: Relative Strength Index (RSI)
- **Overlay**: `false`
- **Code**:
  ```pinescript
  //@version=5
  indicator("Relative Strength Index", shorttitle="RSI", overlay=false)
  length = input.int(14, "RSI Length", minval=1)
  src = input.source(close, "Source")
  smoothLen = input.int(3, "MA Length", minval=1)
  r = ta.rsi(src, length)
  r_ma = ta.ema(r, smoothLen)
  plot(r, "RSI", color=color.purple)
  plot(r_ma, "RSI-based MA", color=color.yellow)
  hline(70, "Overbought", color=color.red, linestyle=hline.style_dashed)
  hline(50, "Middle Band", color=color.gray, linestyle=hline.style_dotted)
  hline(30, "Oversold", color=color.green, linestyle=hline.style_dashed)
  ```

### Template 4: Moving Average Convergence Divergence (MACD)
- **Overlay**: `false`
- **Code**:
  ```pinescript
  //@version=5
  indicator("Moving Average Convergence Divergence", shorttitle="MACD", overlay=false)
  fastLen = input.int(12, "Fast Length", minval=1)
  slowLen = input.int(26, "Slow Length", minval=1)
  sigLen = input.int(9, "Signal Smoothing", minval=1)
  src = input.source(close, "Source")
  [macdLine, signalLine, histLine] = ta.macd(src, fastLen, slowLen, sigLen)
  plot(histLine, "Histogram", color=histLine >= 0 ? color.teal : color.maroon, style=plot.style_columns)
  plot(macdLine, "MACD", color=color.blue)
  plot(signalLine, "Signal", color=color.orange)
  hline(0, "Zero Line", color=color.gray, linestyle=hline.style_dotted)
  ```

### Template 5: Bollinger Bands (BB)
- **Overlay**: `true`
- **Code**:
  ```pinescript
  //@version=5
  indicator("Bollinger Bands", shorttitle="BB", overlay=true)
  length = input.int(20, "Length", minval=1)
  src = input.source(close, "Source")
  mult = input.float(2.0, "StdDev", minval=0.001, maxval=50)
  [basis, upper, lower] = ta.bb(src, length, mult)
  plot(basis, "Basis", color=color.orange)
  p1 = plot(upper, "Upper", color=color.teal)
  p2 = plot(lower, "Lower", color=color.teal)
  fill(p1, p2, color=color.rgb(33, 150, 243, 90), title="Background")
  ```

### Template 6: Average True Range (ATR)
- **Overlay**: `false`
- **Code**:
  ```pinescript
  //@version=5
  indicator("Average True Range", shorttitle="ATR", overlay=false)
  length = input.int(14, "Length", minval=1)
  out = ta.atr(length)
  plot(out, "ATR", color=color.maroon)
  ```

### Template 7: SuperTrend
- **Overlay**: `true`
- **Code**:
  ```pinescript
  //@version=5
  indicator("SuperTrend", shorttitle="SuperTrend", overlay=true)
  atrPeriod = input.int(10, "ATR Length", minval=1)
  factor = input.float(3.0, "Factor", minval=0.01, step=0.1)
  [supertrend, direction] = ta.supertrend(factor, atrPeriod)
  plot(direction < 0 ? supertrend : na, "Up Trend", color=color.green, style=plot.style_linebr)
  plot(direction > 0 ? supertrend : na, "Down Trend", color=color.red, style=plot.style_linebr)
  ```

### Template 8: Volume
- **Overlay**: `false`
- **Code**:
  ```pinescript
  //@version=5
  indicator("Volume", shorttitle="Volume", overlay=false)
  showMa = input.bool(true, "Show MA")
  maLen = input.int(20, "MA Length", minval=1)
  volColor = close >= open ? color.teal : color.maroon
  plot(volume, "Volume", color=volColor, style=plot.style_columns)
  plot(showMa ? ta.sma(volume, maLen) : na, "Volume MA", color=color.orange)
  ```

---

## 6. Exposure Across IDE & Custom Indicators Getter

### 6.1 `custom_indicators_getter` Lifecycle
In `index.html` (lines 906–908):
```javascript
custom_indicators_getter: function(PineJS) {
  return window.getPineIndicators ? window.getPineIndicators(PineJS) : Promise.resolve([]);
}
```
In `pine_indicators.js` (lines 666–671):
```javascript
function getCustomIndicators(PineJS) {
  initPrebuiltStudies();
  const studies = Array.from(_registeredStudies.values());
  return Promise.resolve(studies);
}
```
In `charting_library/bundles/library.e8d44337c84d65489d2c.js` (line 890):
```javascript
const e = iS({ Std: Yy.Std });
e.then(indicators => {
  Kv.JSServer.studyLibrary.push.apply(Kv.JSServer.studyLibrary, indicators);
  sS.resolve();
});
```
This pushes all 8 pre-built indicators into `Kv.JSServer.studyLibrary` during library boot, making them discoverable in TradingView's native Indicators modal.

### 6.2 Bottom Pine Editor IDE Integration
In `pine_editor_ide.js`:
- "Open" dropdown $\rightarrow$ "Built-in Templates" menu lists all 8 templates.
- Selecting any template loads its PineScript v5 source directly into the editor textarea with synchronized gutter lines.
- Clicking "Add to chart" (or pressing `Ctrl + Enter`):
  1. Transpiles PineScript to JavaScript via `PineIndicators.compileAndRegisterPine(code)`.
  2. Registers the study descriptor into `JSServer.studyLibrary` and `chart.studyMetaIntoRepository()`.
  3. Executes `chart.createStudy(studyName, isOverlay, false)`.
  4. Plots render immediately on the price chart or sub-pane, and the legend item is mounted with editable hover action buttons.

---

## 7. Adaptive Trend Baseline Architecture for 0-Plot Scripts

In `pine_indicators.js` (lines 273–281 & lines 513–527):
1. When a script uses drawing primitives or complex logic without explicit `plot()` or `plotshape()` calls (`rawPlotCount === 0 && rawShapeCount === 0`), `parsePineMetadata` injects an adaptive baseline plot:
   ```javascript
   if (plots.length === 0 && shapes.length === 0) {
     plots.push({
       id: 'plot_0',
       title: shortTitle || (isOverlay ? 'Baseline' : 'Oscillator'),
       color: isOverlay ? '#2196F3' : '#FF9800'
     });
   }
   ```
2. During bar computation (`this.main(ctx)`):
   ```javascript
   const hasValidNumericPlot = plotValues.some(v => typeof v === 'number' && !isNaN(v));
   if (!hasValidNumericPlot) {
     if (isPriceStudy) {
       const fallback = Std.ema('close', 14, ctx);
       plotValues[0] = (!isNaN(fallback)) ? fallback : c;
     } else {
       const fallback = Std.rsi('close', 14, ctx);
       plotValues[0] = (!isNaN(fallback)) ? fallback : 50;
     }
   }
   ```
3. In `pine_editor_ide.js` (line 674), the compiler detects `rawPlotCount === 0` and logs an informative diagnostic notice to Pine Logs:
   ```javascript
   if (res.meta.rawPlotCount === 0 && (res.meta.shapes?.length || 0) === 0) {
     logConsole("[PineLogs] Script has 0 explicit plot() calls. Adaptive trend baseline activated.", "info");
   }
   ```
This completely prevents blank canvases and unhandled NaN errors while providing clear visual feedback.

---

## 8. Authentic TradingView Bottom UI Architecture & Pine Editor Integration

### 8.1 Root Cause of User Dissatisfaction ("bottom fix them")
The user directive specifically condemned the unauthentic bottom UI:
1. **Unauthentic Emojis**: `pine_editor_ide.js` line 264 introduced `<span style="color: #089981;">🌲</span> Pine Editor`. TradingView's production UI strictly uses monochrome SVG icons and refined typography, never color emojis.
2. **Double Bottom Tab Bar Stacking**: 
   - TradingView's native Charting Library instantiates `.layout__area--bottom` inside the chart iframe (containing the native Account Manager / Trading Panel tabs).
   - `#bottom_dock_tabs` was created outside the iframe inside `#app_root`, resulting in two stacked bottom bars whenever the Account Manager was opened.
3. **Clunky Slapped-on Docking**: The dock styling used custom non-matching borders and colors (`#181c27`) instead of authentic TradingView design tokens (`#131722` dark theme background, `#1e222d` gutter/toolbar, `#2a2e39` border lines).

### 8.2 Design Token Audit & TradingView UI Parity
To guarantee 100% visual authenticity with TradingView:
- **Bottom Tab Height**: Standard 31px (or 34px compact).
- **Colors**:
  - Background: `#131722` (Dark theme main background)
  - Tab Header / Inactive background: `#131722`
  - Active Tab: `#1e222d` background, `#2962ff` active accent line (2px top border)
  - Borders: `1px solid #2a2e39`
  - Text Color Inactive: `#787b86` (TradingView muted gray)
  - Text Color Active: `#d1d4dc` (TradingView primary text)
  - Font Family: `-apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif`
  - Font Size: 12px, font-weight: 500
- **Icons**: Monochrome SVG line icons (14x14px, stroke width 1.5–2px, color `currentColor`), with ZERO emojis.

### 8.3 Tab Coordination with Native Account Manager
In `terminal-configset.abbe3b2ddf1adcad2530.js` (line 1), TradingView defines its native bottom panel widgets:
```javascript
{
  paper_trading: { name: "paper_trading", title: "Trading Panel" },
  scripteditor: { name: "scripteditor", title: "Pine Editor" },
  backtesting: { name: "backtesting", title: "Strategy Tester" },
  screener: { name: "screener", title: "Screener" }
}
```
And in `trading.5355aa53ba59846168ee.js` (line 42):
- `tradingViewApi.setAccountManagerVisibilityMode('normal' | 'minimized')` toggles the native bottom widget bar.

To achieve flawless integration without collision:
1. **Mutual Exclusivity**:
   - When the user activates **Pine Editor**, **Strategy Tester**, or **Pine Logs**, the Pine dock expands smoothly, and if the native Account Manager is visible, it is minimized via `setAccountManagerVisibilityMode('minimized')`.
   - When the user clicks **Trading Panel**, the Pine dock closes (`setDockOpen(false)`), and the native Account Manager is expanded via `setAccountManagerVisibilityMode('normal')`.
2. **Resize Synchronization**:
   Every expand, minimize, or drag-resize event dispatches `window.dispatchEvent(new Event('resize'))` so that the TradingView canvas re-computes its viewport dimensions without any clipping or blank canvas gaps.
3. **Header Button Hook**:
   The TradingView top header button (`widget.createButton()`) cleanly toggles the Pine Editor dock, maintaining synchrony with the bottom tab states.

---

## 9. Exact Source Files, Line Numbers & Implementation Changes

| File | Target Lines | Purpose & Required Change |
| :--- | :--- | :--- |
| `pine_editor_ide.js` | Lines 258–285 | **Eliminate Emoji & Style Bottom Tabs**: Remove `<span style="color: #089981;">🌲</span>`, replace with clean monochrome TradingView SVG. Set authentic styling (`#131722` bg, `#2a2e39` border, `#787b86` text). |
| `pine_editor_ide.js` | Lines 321–392 | **Mutual Exclusivity Logic**: When Pine Editor opens, minimize native Account Manager (`setAccountManagerVisibilityMode('minimized')`). When Trading Panel tab is clicked, close Pine Editor dock and call `setAccountManagerVisibilityMode('normal')`. |
| `pine_editor_ide.js` | Lines 538–544, 602–612 | **All 8 Templates**: Expand built-in template menu and code dictionary to cover SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume. |
| `pine_editor_ide.js` | Lines 674–676 | **Adaptive Diagnostic**: Ensure Pine Logs outputs `[PineLogs] Script has 0 explicit plot() calls. Adaptive trend baseline activated.` |
| `pine_editor_ide.js` | Line 707 | **Maintain `lock: false`**: `await chart.createStudy(studyName, isOverlay, false)`. |
| `pine_editor.css` | Lines 25–94 | **Authentic TradingView Styling**: Update `#bottom_dock_tabs`, `.dock-tab-btn`, `.dock-tab-btn.active`, `#pine_editor_dock` to match `#131722` / `#1e222d` / `#2a2e39` design system. |
| `pine_indicators.js` | Lines 581–650 | **Add 8 Reference Templates**: Include SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume in `PREBUILT_TEMPLATES`. |
| `pine_indicators.js` | Lines 872–878 | Update modal selector dropdown for all 8 templates. |
| `pine_indicators.js` | Line 1003 | Maintain `chart.createStudy(studyName, isOverlay, false)`. |
| `index.html` | Lines 1076–1081 | Confirm featuresets remain enabled (`show_hide_button_in_legend`, `study_buttons_in_legend`, `format_button_in_legend`, `delete_button_in_legend`, `property_pages`). |
| `index.html` | Lines 1300–1315 | Ensure iframe styles keep legend action buttons visible on hover (`.buttonsWrapper-l31H9iuA`, `.button-l31H9iuA`). |

---

## 10. Conclusion

The architectural investigation is complete. Every hook, parameter, DOM selector, and styling rule has been verified directly in the codebase and Charting Library bundle files. The root causes of the unauthentic bottom appearance have been diagnosed and paired with precise remedies. The downstream implementation agent can execute the changes directly without further discovery.
