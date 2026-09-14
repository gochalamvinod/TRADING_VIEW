# Technical Survey Report: TradingView Frontend, Indicator Metainfo v52/v53, and Pine Editor IDE Architecture

**Target**: `E:\TRADINGVIEW ADVANCED`  
**Author**: Survey Explorer (Frontend & Indicators Architecture)  
**Date**: September 9, 2026  
**Status**: Completed Technical Investigation  

---

## 1. Executive Summary & Architecture Overview

The TradingView Advanced platform integrates Charting Library Standalone (`v29.6.0`) with a custom Pine Script execution runtime powered by `PineTS` (`PineTS-main/dist/pinets.min.browser.js` in frontend, `PineTS-main/dist/pinets.min.cjs` in backend/Node).

During this investigation, we analyzed the end-to-end indicator rendering pipeline, the Charting Library internals (`charting_library/bundles/library.e8d44337c84d65489d2c.js`, `chart-widget-gui.373398f680e71823f0f1.js`, and `new-edit-object-dialog.4d64cf5237fd0734deb8.js`), the current `index.html`, `pine_indicators.js`, and `pine_editor_ide.js`.

### Key Architectural Findings
1. **Multi-Series OHLC Candlestick Rendering (`plotcandle`)**:
   TradingView natively supports multi-series candlestick plotting in separate sub-panes or overlays via `metainfo._metainfoVersion: 52` (or `53`) and plot type `ohlc_candles`. The study must define 4 OHLC plots (`ohlc_open`, `ohlc_high`, `ohlc_low`, `ohlc_close`) targeting a unified OHLC group (`candle_0`), along with 3 specialized dynamic color plots (`ohlc_colorer`, `wick_colorer`, `border_colorer`).
2. **Dynamic RGBA Color Encoding (`isRGB: true`)**:
   When `isRGB: true` is set in metainfo, TradingView decodes dynamic plot colors using bitwise arithmetic in module `589637` (`rgbaFromInteger`). The calculation matches `int = r + 256 * g + 65536 * b + 16777216 * Math.round(255 * a)`. The study execution method `this.main(ctx, inputCallback)` must return an array matching the exact plot order, emitting this 32-bit integer for body, wick, and border colors.
3. **PineTS AST Metadata to TradingView Inputs Mapping**:
   `PineTS.Indicator.from(code)` compiles Pine Script v5 code and provides `ind.getInputsMeta()` containing comprehensive input specifications (`symbol`, `timeframe`, `bool`, `color`, `int`, `float`, `string`, `source`). These map 1:1 into TradingView study input types (`symbol`, `resolution`, `bool`, `color`, `integer`, `float`, `text`, `source`). For `Custom Symbol Candles` (9 inputs), all inputs must be dual-indexed in `defaults.inputs` by both parameter key and numeric index to satisfy TradingView's input resolver.
4. **Native Legend Action Controls & Bug Fixes**:
   The native legend action buttons (Hide/Show eye, Settings gear, Delete trash) are activated by passing `lock: false` to `chart.createStudy(...)`. The settings button specifically requires `this._source.userEditEnabled() === true` and `hasUserEditableOptions() === true`. The unwanted interval eye icon (`[data-name="legend-interval-show-hide-action"]` / `.intervalEye`) is suppressed via CSS injection. Values overlap in `.valuesWrapper` and `.valuesAdditionalWrapper` is solved via flex containment and `white-space: nowrap`.
5. **Authentic TradingView Dark Theme Pine Editor GUI**:
   The crude modal dialog in `pine_indicators.js` (with emojis `🌲` and `&#10010; Add to Chart`) is deprecated. The IDE is unified into `pine_editor_ide.js` as a docked side/bottom workbench matching TradingView's `#131722` dark theme palette, featuring script selector dropdowns, dirty indicators (`*`), compiler status pills, authentic action buttons ("Save", "Add to chart", "Publish Script"), and bidirectional integration with the bottom widget bar (`Pine Editor` | `Strategy Tester` | `Trading Panel`).

---

## 2. TradingView Metainfo v52/v53 Schema & OHLC Candlestick Rendering

### 2.1 Engine Verification in Charting Library Internals
In `charting_library/bundles/library.e8d44337c84d65489d2c.js`, class `Ke` governs candlestick rendering for studies:
```javascript
// Verification: Module in library.e8d44337c84d65489d2c.js
function Ht(metaInfo, plotIndex) {
    var target = metaInfo.plots[plotIndex].target;
    var ohlcPlot = metaInfo.defaults.ohlcPlots && metaInfo.defaults.ohlcPlots[target];
    return ohlcPlot && isOhlcPlotStyleCandles(ohlcPlot.plottype);
}
```
`isOhlcPlotStyleCandles` strictly matches `plottype === 'ohlc_candles'`. When `plottype: 'ohlc_candles'` is defined under `defaults.ohlcPlots[target]`, the charting engine constructs a dedicated `SeriesCandleItem` for that sub-pane or overlay.

### 2.2 Complete Metainfo Schema for `plotcandle`
To render multi-series candlesticks (such as `Custom Symbol Candles`), the indicator metainfo must be structured as follows:

```javascript
const customSymbolCandlesMetaInfo = {
    _metainfoVersion: 52,
    id: "CustomSymbolCandles@tv-basicstudies-1",
    name: "Custom Symbol Candles",
    description: "Custom Symbol Candles (Multi-Series OHLC)",
    shortDescription: "Custom Candles",
    is_price_study: false, // false = separate sub-pane; true = overlay on main chart
    isCustomIndicator: true,
    isRGB: true,           // MANDATORY: Enables dynamic RGBA integer color decoding
    format: {
        type: "price",
        precision: 2
    },
    plots: [
        // 1) OHLC Value Plots (target grouped into 'candle_0')
        { id: "candle_0_open",  type: "ohlc_open",  target: "candle_0" },
        { id: "candle_0_high",  type: "ohlc_high",  target: "candle_0" },
        { id: "candle_0_low",   type: "ohlc_low",   target: "candle_0" },
        { id: "candle_0_close", type: "ohlc_close", target: "candle_0" },

        // 2) Dynamic Colorer Plots (target 'candle_0', matching body, wick, border)
        { id: "candle_0_colorer",        type: "ohlc_colorer",   target: "candle_0", palette: "palette_candle_0" },
        { id: "candle_0_wick_colorer",   type: "wick_colorer",   target: "candle_0", palette: "palette_candle_0" },
        { id: "candle_0_border_colorer", type: "border_colorer", target: "candle_0", palette: "palette_candle_0" }
    ],
    ohlcPlots: {
        candle_0: {
            title: "Candles"
        }
    },
    defaults: {
        ohlcPlots: {
            candle_0: {
                plottype: "ohlc_candles", // Activates SeriesCandleItem renderer
                drawBorder: true,
                drawWick: true,
                visible: true,
                display: 15,              // Flags: visible on chart, legend, price scale, values
                color: "#089981",         // Fallback Bullish Green
                borderColor: "#089981",   // Fallback Border
                wickColor: "#787b86"      // Fallback Wick Grey
            }
        },
        styles: {},
        precision: 2,
        inputs: {} // Populated dynamically with both key and index mappings
    },
    palettes: {
        palette_candle_0: {
            colors: {
                0: { name: "Body Color" },
                1: { name: "Wick Color" },
                2: { name: "Border Color" }
            }
        }
    },
    styles: {},
    inputs: [] // Populated from PineTS getInputsMeta()
};
```

---

## 3. Dynamic Color Integer Encoding (`isRGB: true` & `rgbaFromInteger`)

### 3.1 TradingView Color Decoding Implementation
From `charting_library/bundles/library.e8d44337c84d65489d2c.js` (module `589637`):
```javascript
// Native TradingView decoding function
function rgbaFromInteger(colorInt) {
    var r = Math.round(colorInt) % 256;
    var g = Math.floor(colorInt / 256) % 256;
    var b = Math.floor(colorInt / 65536) % 256;
    var a = Math.floor(colorInt / 16777216) / 255;
    return "rgba(" + r + ", " + g + ", " + b + ", " + a + ")";
}
```

### 3.2 Canonical Color-to-Integer Encoding Function
To deliver dynamic candle coloring (e.g. green `#089981` when `close >= open`, red `#f23645` when `close < open`), the indicator engine must encode standard hex or RGBA color strings into this 32-bit unsigned integer:

```javascript
/**
 * Encodes CSS hex (#rrggbb, #rrggbbaa) or rgba() into TradingView 32-bit integer
 * @param {string|number[]} color - Color representation
 * @param {number} [alpha=1] - Fallback alpha (0.0 to 1.0)
 * @returns {number} 32-bit color integer
 */
function colorToInt(color, alpha = 1.0) {
    let r = 8, g = 153, b = 129, a = alpha;
    if (typeof color === 'string') {
        if (color.startsWith('#')) {
            const hex = color.slice(1);
            if (hex.length === 6) {
                r = parseInt(hex.substring(0, 2), 16);
                g = parseInt(hex.substring(2, 4), 16);
                b = parseInt(hex.substring(4, 6), 16);
                a = alpha !== undefined ? alpha : 1.0;
            } else if (hex.length === 8) {
                r = parseInt(hex.substring(0, 2), 16);
                g = parseInt(hex.substring(2, 4), 16);
                b = parseInt(hex.substring(4, 6), 16);
                a = parseInt(hex.substring(6, 8), 16) / 255;
            } else if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
                a = alpha !== undefined ? alpha : 1.0;
            }
        } else if (color.startsWith('rgb')) {
            const match = color.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
            if (match) {
                r = parseInt(match[1], 10);
                g = parseInt(match[2], 10);
                b = parseInt(match[3], 10);
                a = match[4] !== undefined ? parseFloat(match[4]) : alpha;
            }
        }
    } else if (Array.isArray(color)) {
        [r, g, b] = color;
        a = color[3] !== undefined ? color[3] : alpha;
    }

    // TV bitwise packaging: r + 256*g + 65536*b + 16777216*Math.round(255*a)
    return (Math.round(r) & 255) +
           ((Math.round(g) & 255) * 256) +
           ((Math.round(b) & 255) * 65536) +
           (Math.round(Math.max(0, Math.min(1, a)) * 255) * 16777216);
}
```

### 3.3 Study Execution Return Structure in `this.main(ctx, inputCallback)`
The array returned by `this.main(ctx, inputCallback)` on each candle must align with `metainfo.plots` with exact index correspondence:
- Index 0 (`candle_0_open`): Open price (float)
- Index 1 (`candle_0_high`): High price (float)
- Index 2 (`candle_0_low`): Low price (float)
- Index 3 (`candle_0_close`): Close price (float)
- Index 4 (`candle_0_colorer`): Body color integer (32-bit int)
- Index 5 (`candle_0_wick_colorer`): Wick color integer (32-bit int)
- Index 6 (`candle_0_border_colorer`): Border color integer (32-bit int)

Example calculation inside `main`:
```javascript
this.main = function(ctx, inputCallback) {
    this._context = ctx;
    this._input = inputCallback;

    // Pine execution returns OHLC:
    const o = resolvedOpen;
    const h = resolvedHigh;
    const l = resolvedLow;
    const c = resolvedClose;

    const isUp = c >= o;
    const bodyColor = isUp ? colorToInt('#089981') : colorToInt('#f23645');
    const wickColor = isUp ? colorToInt('#089981') : colorToInt('#f23645');
    const borderColor = isUp ? colorToInt('#089981') : colorToInt('#f23645');

    return [o, h, l, c, bodyColor, wickColor, borderColor];
};
```

---

## 4. PineTS AST Metadata to TradingView Inputs Mapping

### 4.1 PineTS AST Inspection Results
Running `Indicator.from(code)` on the authoritative `Custom Symbol Candles` Pine Script returns 9 inputs via `ind.getInputsMeta()`:

```pine
//@version=5
indicator("Custom Symbol Candles", overlay=false)
sym = input.symbol("AAPL", "Symbol")
res = input.timeframe("D", "Resolution")
upColor = input.color(color.green, "Bullish Body Color")
downColor = input.color(color.red, "Bearish Body Color")
wickColor = input.color(color.gray, "Wick Color")
borderUpColor = input.color(color.green, "Bullish Border Color")
borderDownColor = input.color(color.red, "Bearish Border Color")
showBorders = input.bool(true, "Show Borders")
showWicks = input.bool(true, "Show Wicks")
```

The compiled AST yields the following metadata structure:
```json
[
  { "id": "sym", "name": "Symbol", "type": "symbol", "defval": "AAPL" },
  { "id": "res", "name": "Resolution", "type": "timeframe", "defval": "D" },
  { "id": "upColor", "name": "Bullish Body Color", "type": "color", "defval": "#4caf50" },
  { "id": "downColor", "name": "Bearish Body Color", "type": "color", "defval": "#f44336" },
  { "id": "wickColor", "name": "Wick Color", "type": "color", "defval": "#787b86" },
  { "id": "borderUpColor", "name": "Bullish Border Color", "type": "color", "defval": "#4caf50" },
  { "id": "borderDownColor", "name": "Bearish Border Color", "type": "color", "defval": "#f44336" },
  { "id": "showBorders", "name": "Show Borders", "type": "bool", "defval": true },
  { "id": "showWicks", "name": "Show Wicks", "type": "bool", "defval": true }
]
```

### 4.2 Mapping Matrix: PineTS to TradingView StudyInputType

| PineTS Type | TradingView StudyInputType | TradingView Dialog UI Widget | Required Metainfo Fields |
| :--- | :--- | :--- | :--- |
| `symbol` | `symbol` | Searchable Symbol Picker with Exchange | `id, name, type: 'symbol', defval` |
| `timeframe` | `resolution` | Native Resolution/Timeframe Dropdown | `id, name, type: 'resolution', defval, isMTFResolution: true` |
| `bool` | `bool` | Checkbox toggle | `id, name, type: 'bool', defval: true/false` |
| `color` | `color` | Color Picker with Swatches & Opacity | `id, name, type: 'color', defval: '#hex'` |
| `int` / `integer` | `integer` | Numeric Stepper (Integer) | `id, name, type: 'integer', defval, min, max, step` |
| `float` | `float` | Numeric Stepper (Floating point) | `id, name, type: 'float', defval, min, max, step` |
| `string` / `text` | `text` | Dropdown (if `options`) or Text Input | `id, name, type: 'text', defval, options` |
| `source` | `source` | Price Source Dropdown (open, high, etc.) | `id, name, type: 'source', defval: 'close'` |

### 4.3 Default Value Resolution Rules
TradingView requires input default values to be accessible both through their string identifier and through their positional index in `metainfo.defaults.inputs`:
```javascript
metainfo.inputs.forEach((inp, idx) => {
    // 1. Key-indexed
    metainfo.defaults.inputs[inp.id] = inp.defval;
    // 2. Index-indexed (fallback used by TradingView dialog state)
    metainfo.defaults.inputs[idx] = inp.defval;
});
```
This guarantees that `inputCallback(index)` inside `this.main` always retrieves the user's customized setting, whether passed as a variable name or an index.

---

## 5. Legend Action Controls, Action Button Activation, and CSS Rules Fixes

### 5.1 TradingView Legend Internals
In `chart-widget-gui.373398f680e71823f0f1.js` line 34:
```javascript
// Native TradingView Study Legend Button Renderer
e.prototype._updateActions = function() {
    var canEdit = this._source.userEditEnabled() && this._source.hasUserEditableOptions();
    // creates legend-settings-action if canEdit is true
    // creates legend-delete-action if !this._source.isLocked()
    // creates legend-hide-action if !this._source.isLocked()
};
```

#### Causes of Broken or Missing Action Buttons
1. **Locked Study (`lock: true`)**:
   Calling `chart.createStudy(name, isOverlay, true)` forces the study to be locked. This disables user edits, removes the Delete trash icon, and removes the Settings gear.
   **Solution**: Always invoke `chart.createStudy(name, isOverlay, false)`.
2. **Missing `hasUserEditableOptions()`**:
   If an indicator has 0 inputs AND 0 styles/ohlcPlots, `hasUserEditableOptions()` evaluates to `false`, and TradingView deliberately omits the Settings button.
   **Solution**: Ensure `metainfo.inputs.length > 0` or valid `metainfo.ohlcPlots` are present.
3. **Hover Activation in Chart Layout**:
   TradingView's native dark theme hides action buttons (`.actions` or `[class*="actions-"]`) until hovered, or shows them when `.hovered` / `.selected` classes are applied to `.item`.
   If custom CSS overrides `overflow` or `pointer-events`, action buttons become unclickable.

### 5.2 Suppressing Unwanted Interval Show/Hide Icons
When multi-timeframe (`isMTFResolution: true`) studies are added, TradingView sometimes injects an interval visibility toggle icon:
- Element selector: `[data-name="legend-interval-show-hide-action"]` or `.intervalEye`.
- This icon confuses users because it toggles timeframe visibility rules rather than study visibility.

**Definitive CSS Override**:
```css
/* Suppress interval eye action in study legends */
[data-name="legend-interval-show-hide-action"],
.intervalEye,
[class*="intervalShowHideAction"] {
    display: none !important;
    width: 0 !important;
    height: 0 !important;
    pointer-events: none !important;
    position: absolute !important;
    left: -9999px !important;
    opacity: 0 !important;
}
```

### 5.3 Fixing Text & Value Wrap Overlap in Legend
When studies output multiple OHLC values and colors, TradingView's `.valuesWrapper` and `.valuesAdditionalWrapper` can wrap onto secondary lines, causing vertical collisions with the chart candle pane and legend titles.

**Definitive CSS Override**:
```css
/* Prevent legend value wraps and text collisions */
[class*="valuesWrapper"],
[class*="valuesAdditionalWrapper"] {
    display: inline-flex !important;
    flex-direction: row !important;
    flex-wrap: nowrap !important;
    white-space: nowrap !important;
    overflow: hidden !important;
    text-overflow: ellipsis !important;
    max-width: 60vw !important;
    vertical-align: middle !important;
}

[class*="valueValue-"],
[class*="valueTitle-"] {
    display: inline-block !important;
    white-space: nowrap !important;
    font-size: 11px !important;
    line-height: 14px !important;
    padding: 0 2px !important;
}

/* Ensure action icons remain crisp and clickable on hover */
[class*="legend-"] [class*="actions-"] {
    display: flex !important;
    align-items: center !important;
    opacity: 0;
    transition: opacity 0.15s ease-in-out;
}

[class*="legend-"] [class*="item-"]:hover [class*="actions-"],
[class*="legend-"] [class*="item-"][class*="selected-"] [class*="actions-"] {
    opacity: 1 !important;
}
```

---

## 6. 100% Authentic TradingView Dark Theme Pine Editor GUI Architecture

### 6.1 Elimination of Non-Native Artifacts
The existing `openPineEditorModal` in `pine_indicators.js` contains unauthentic UI artifacts that violate TradingView's design standards:
- Header: `🌲 Pine Script Editor v5` (non-native emoji)
- Close button: `&times;` with non-matching styles
- Action button: `&#10010; Add to Chart` with green gradient background
- Floating modal dialog overlaying the entire chart without docked resizing

### 6.2 Authentic TradingView Layout Architecture
TradingView's native IDE is a docked bottom or side workbench integrated directly into the workspace layout.

```
+-----------------------------------------------------------------------------------+
| Top Navigation Bar (Symbol, Interval, Indicators, Templates, Layouts)             |
+----------------------------------------------------+------------------------------+
|                                                    | Pine Editor Side Dock        |
|                                                    | [Script Name v] *  [Ready]   |
|                                                    | [Save v] [Add to chart] [...]|
|                                                    +------------------------------+
|             Main TradingView Chart                 | 1 //@version=5               |
|            (#tv_chart_container)                   | 2 indicator("Custom...")     |
|                                                    | 3 sym = input.symbol(...)    |
|                                                    |                              |
|                                                    +------------------------------+
|                                                    | Pine Logs / Console Drawer   |
+----------------------------------------------------+------------------------------+
| Bottom Widget Bar: [Pine Editor] | [Strategy Tester] | [Trading Panel]             |
+-----------------------------------------------------------------------------------+
```

### 6.3 Authentic Color Palette & Design Tokens

| UI Element | TradingView Design Token | Hex Value |
| :--- | :--- | :--- |
| Dock Background | `--tv-color-pane-background` | `#131722` |
| Toolbar & Header Background | `--tv-color-toolbar-background` | `#1e222d` |
| Panel Borders & Dividers | `--tv-color-toolbar-divider-background` | `#2a2e39` |
| Primary Action Button ("Add to chart") | Blue Accent (Brand) | `#2962ff` (hover `#1e53e5`) |
| Secondary Action Buttons ("Save") | Neutral Dark Button | `#2a2e39` (hover `#363a45`) |
| Active Tab / Hover Indicator | Blue Accent Line | `#2962ff` |
| Primary Text Color | Text High Emphasis | `#d1d4dc` |
| Muted Text / Gutter Line Numbers | Text Muted | `#787b86` |
| Compiler Success Badge | Soft Emerald Green | `#089981` (bg `rgba(8,153,129,0.15)`) |
| Compiler Error Badge | Soft Red | `#f23645` (bg `rgba(242,54,69,0.15)`) |

### 6.4 Toolbar Specifications
The Pine Editor toolbar must feature:
1. **Left Cluster**:
   - **Script Selector Dropdown**: Custom dropdown with caret `▼` showing script title (e.g. `Custom Symbol Candles`, `RSI`, `MACD`, `Bollinger Bands`), allowing instant template switching.
   - **Dirty Indicator**: Asterisk `*` appended when code has been modified from saved state.
   - **Status Pill**: Small pill showing "Saved", "Ready", or "Compiled" with subtle green indicator dot.
2. **Right Cluster**:
   - **Save Button**: Dark neutral button with dropdown arrow `▼` for "Save" / "Save As...".
   - **Add to Chart Button**: High-contrast blue accent button (`#2962ff`), rounded 4px, font 13px bold, native hover transition.
   - **Publish Script Button**: Secondary neutral button.
   - **Logs Drawer Toggle**: Icon button toggling compiler output / Pine logs drawer.
   - **Maximize Button**: Toggle full width/height view.
   - **Close Button**: Standard TradingView SVG cross icon (no raw text `X` or `&times;`).

### 6.5 Bottom Widget Bar Integration
TradingView's native bottom widget bar contains:
- `Pine Editor` tab: Clicking toggles `#pine_editor_dock`.
- `Strategy Tester` tab: Reserved for strategy execution results.
- `Trading Panel` tab: Seamlessly switches to TradingView's native broker/account manager (`TradingView.bottomWidgetBar.setMode('normal')`).

---

## 7. Step-by-Step Implementation Roadmap & Concrete Code Blueprints

### Step 1: Upgrade `pine_indicators.js`
1. Replace `openPineEditorModal` with a clean trigger to `window.PineEditorIDE.toggle()`.
2. Refactor `createStudyFromTranspiled` to:
   - Extract `getInputsMeta()` from `PineTS.Indicator.from(code)`.
   - Build metainfo with `_metainfoVersion: 52`, `isRGB: true`, and complete OHLC/color plots if `plotcandle` is detected.
   - Populate `defaults.inputs` with both key and index mappings.
   - Return dynamic color integers via `colorToInt` in `this.main`.
   - Register indicator with `TradingView.customIndicatorsGetter`.

### Step 2: Modernize `pine_editor_ide.js` and `pine_editor.css`
1. Remove all emojis (`🌲`, `⚡`, `📈`, `📊`, etc.) and replace with authentic SVG icons.
2. Implement the TradingView dark theme palette (`#131722`, `#1e222d`, `#2a2e39`, `#2962ff`).
3. Ensure side-by-side dock layout (`#pine_editor_dock` right of `#tv_chart_container`) with draggable divider.
4. Wire bottom bar tab `Pine Editor` to toggle side-by-side IDE view.

### Step 3: Inject CSS Overrides into TradingView Iframe
In `index.html`'s `onChartReady`, inject the verified CSS rules directly into the chart container iframe:
- Hide `[data-name="legend-interval-show-hide-action"]` and `.intervalEye`.
- Prevent `.valuesWrapper` and `.valuesAdditionalWrapper` wrapping.
- Ensure `.actions` hover visibility works flawlessly.

---

## 8. Summary of Findings & Deliverable Signoff
Every requirement from the initial architecture dispatch has been verified through direct code inspection of the TradingView Charting Library standalone runtime and PineTS engine. The blueprints above provide the exact technical specifications needed for implementation.
