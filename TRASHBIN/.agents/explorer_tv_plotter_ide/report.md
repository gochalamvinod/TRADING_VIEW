# TradingView Charting Library Plotter Engine, Native Shapes API & Pine Editor IDE Integration

## Executive Summary

This investigation surveys the TradingView Charting Library (v29.6.0 Standalone), its internal study registration mechanism (`custom_indicators_getter`, `JSServer.studyLibrary`, Metainfo v52/v53), the plotter engine rendering pipeline, native shape primitives (`createMultipointShape`, `createShape`), and the Pine Editor IDE integration drawer (`pine_editor_ide.js`, `pine_indicators.js`, `index.html`, `custom.css`).

The primary objective is to define the exact technical architecture required to execute Pine Script v6 scripts (such as the LuxAlgo Sessions indicator in `scratch_luxalgo.pine`) with **100% visual parity** to TradingView's native cloud platform:
1. Complete Metainfo v52/v53 schema mapping for all Pine plot types (`plot`, `plotcandle`, `plotbar`, `plotshape`, `plotchar`, `plotarrow`, `hline`, `fill`).
2. Zero visual diversion: strict `NaN` invariance preventing artificial line bridging across inactive intervals (via `LineStudyPlotStyle.LineWithBreaks` / `skipHoles: false`) and suppressing unwanted price scale badges (via `display` bitmask `11`).
3. Native shape synchronization: direct mapping of Pine drawing primitives (`box.new`, `line.new`, `polyline.new`, `label.new`, `table.new`) to TradingView LineTools (`LineToolRectangle`, `LineToolTrendLine`, `LineToolVertLine`, `LineToolTextAbsolute`, HTML DOM table overlays), with lifecycle tracking and cleanup.
4. LuxAlgo Sessions & multi-day divider case study: zero timescale distortion, perfect UTC session boundary detection, and session high/low bounding box projection.
5. Pine Editor IDE drawer: Monaco/Ace-style editor integration, real-time AST/syntax diagnostics, interactive error jump (`jumpToLineAndCol`), one-click compilation and chart injection, full legend controls (Hide/Show, Settings Modal, Remove), and streaming bar updates.

---

## 1. TradingView Study Registration & Metainfo Schema (v52 / v53)

### 1.1 Study Registration Pipeline

In TradingView Charting Library Standalone, custom indicators are registered through the widget constructor options via `custom_indicators_getter`. 

#### Code Verification (`index.html:968`):
```javascript
custom_indicators_getter: function(PineJS) {
    return Promise.resolve(window.getPineIndicators ? window.getPineIndicators(PineJS) : []);
}
```

#### TradingView Internal Engine Processing (`charting_library/bundles/library.e8d44337c84d65489d2c.js:890`):
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
When `chart.createStudy(studyName, isOverlay, false)` is invoked:
1. The chart engine queries `Kv.JSServer.studyLibrary` (and `chart.studyMetaInfoRepository()`).
2. It instantiates the custom study object by executing its `constructor`.
3. It initializes the study state using `this.init(ctx, inputCallback)`.
4. It iterates over historical bars, calling `this.main(ctx, inputCallback)` for each bar index.
5. It streams outputs into internal plot data buffers for WebGL / Canvas rendering.

### 1.2 Study Object Specification

A valid TradingView study descriptor conforms to:
```javascript
{
    name: "Study Name",
    metainfo: {
        _metainfoVersion: 52, // or 53
        id: "StudyId@tv-basicstudies-1",
        description: "Study Description",
        shortDescription: "Short Name",
        is_price_study: false, // true = overlay on main pane, false = separate pane
        is_hidden_study: false,
        isRGB: true, // Enables dynamic per-bar 32-bit ARGB/hex colors
        format: {
            type: "price", // "price" | "volume" | "inherit"
            precision: 2
        },
        plots: [ /* array of plot descriptors */ ],
        styles: { /* plot visual configuration */ },
        defaults: {
            styles: { /* default style properties */ },
            inputs: { /* default input values */ },
            precision: 2
        },
        inputs: [ /* array of input descriptors */ ]
    },
    constructor: function() {
        this.init = function(ctx, inputCallback) { /* memory initialization */ };
        this.main = function(ctx, inputCallback) { /* evaluation per bar, returns plot values */ };
    }
}
```

### 1.3 Plot Type Mapping to Metainfo and `this.main`

| Pine Script Construct | Metainfo `plots` Element | Metainfo `styles` Element | `this.main()` Return Type | Notes & Sub-properties |
|---|---|---|---|---|
| `plot(series, color=c)` | `{ id: 'plot_0', type: 'line' }` | `styles.plot_0 = { title, histogramBase: 0, joinPoints: false, plottype: 0 }` | Float or `NaN` | `plottype: 0` = Line, `1` = Histogram, `2` = Cross, `3` = Area, `4` = Columns, `5` = Circles, `7` = LineWithBreaks |
| `plotcandle(o, h, l, c)` | 7 plots: 4 data plots + 3 colorer plots (see schema below) | `ohlcPlots.candle_0 = { title, plottype: 'candle' }` | `[o, h, l, c, bodyColor, wickColor, borderColor]` | Body, wick, and border colors passed as 32-bit ARGB integer values |
| `plotbar(o, h, l, c)` | 4 data plots + optional colorer plot | `ohlcPlots.bar_0 = { title, plottype: 'bar' }` | `[o, h, l, c, barColor]` | Renders native OHLC bars |
| `plotshape(cond)` | `{ id: 'shape_0', type: 'shapes' }` | `styles.shape_0 = { title, plottype: 'shape_triangle_up', location: 'AboveBar' }` | `1` (draw) or `NaN` (skip) | `location`: `'AboveBar'`, `'BelowBar'`, `'Top'`, `'Bottom'`, `'Absolute'` |
| `plotchar(cond)` | `{ id: 'char_0', type: 'chars' }` | `styles.char_0 = { title, char: '★', location: 'AboveBar' }` | `1` (draw) or `NaN` (skip) | Renders custom Unicode glyph at specified location |
| `plotarrow(series)` | `{ id: 'arrow_0', type: 'arrows' }` | `styles.arrow_0 = { title, location: 'AboveBar' }` | Float > 0 (Up), Float < 0 (Down), `NaN` (None) | Arrow size scales with absolute magnitude |
| `hline(val)` | Handled via `metainfo.bands` | `defaults.bands: [{ color, linestyle, linewidth }]` | Not evaluated in `this.main` (Static horizontal level) | Added to `metainfo.bands: [{ id: 'hline_0', name: 'Upper', value: 70 }]` |
| `fill(p1, p2)` | Handled via `metainfo.filledAreas` | `styles` / `defaults.filledAreasStyle` | Not evaluated in `this.main` (Fills region between 2 plots or hlines) | `filledAreas: [{ id: 'fill_0', objAId: 'plot_0', objBId: 'plot_1', type: 'plot_plot' }]` |

#### Detailed Schema for `plotcandle`:
```javascript
metainfo.plots.push(
    { id: 'candle_open', type: 'ohlc_open', target: 'candle_0' },
    { id: 'candle_high', type: 'ohlc_high', target: 'candle_0' },
    { id: 'candle_low', type: 'ohlc_low', target: 'candle_0' },
    { id: 'candle_close', type: 'ohlc_close', target: 'candle_0' },
    { id: 'candle_color', type: 'ohlc_colorer', target: 'candle_0', palette: 'candle_palette' },
    { id: 'candle_wick_color', type: 'wick_colorer', target: 'candle_0', palette: 'candle_palette' },
    { id: 'candle_border_color', type: 'border_colorer', target: 'candle_0', palette: 'candle_palette' }
);
metainfo.ohlcPlots = {
    candle_0: {
        title: "Candles",
        plottype: "candle"
    }
};
metainfo.defaults.ohlcPlots = {
    candle_0: {
        borderColor: "#378658",
        color: "#26a69a",
        drawBorder: true,
        drawWick: true,
        wickColor: "#26a69a"
    }
};
```

### 1.4 Color Encoding & `isRGB: true`

TradingView's native canvas engine uses packed 32-bit signed/unsigned integer representation for ARGB colors when `isRGB: true` is set on the Metainfo root.

#### The `colorToInt` Algorithm:
Given RGBA color values (`0 <= r, g, b <= 255`, `0.0 <= a <= 1.0`):
```javascript
function colorToInt(r, g, b, a = 1.0) {
    const alpha = Math.round(a * 255) & 0xFF;
    const red = Math.round(r) & 0xFF;
    const green = Math.round(g) & 0xFF;
    const blue = Math.round(b) & 0xFF;
    // 32-bit integer: (A << 24) | (R << 16) | (G << 8) | B
    return ((alpha << 24) | (red << 16) | (green << 8) | blue) >>> 0;
}
```
If a hex string `"#RRGGBB"` or `"#RRGGBBAA"` is used:
```javascript
function hexToInt(hex, defaultAlpha = 1.0) {
    let str = hex.replace('#', '');
    let r = 0, g = 0, b = 0, a = defaultAlpha;
    if (str.length === 6) {
        r = parseInt(str.slice(0, 2), 16);
        g = parseInt(str.slice(2, 4), 16);
        b = parseInt(str.slice(4, 6), 16);
    } else if (str.length === 8) {
        r = parseInt(str.slice(0, 2), 16);
        g = parseInt(str.slice(2, 4), 16);
        b = parseInt(str.slice(4, 6), 16);
        a = parseInt(str.slice(6, 8), 16) / 255;
    }
    return colorToInt(r, g, b, a);
}
```

---

## 2. Strict na / NaN Invariance & Visual Fidelity

### 2.1 The Artificial Line Bridging Defect (`skipHoles`)

In Pine Script, when an indicator evaluates to `na` on bar $i$, no line segment should be rendered connecting bar $i-1$ to bar $i+1$. 
However, in TradingView's Charting Library, plot styles have internal hole-skipping behaviors.

#### TradingView Internal Deobfuscation (`charting_library/bundles/library.e8d44337c84d65489d2c.js:491`):
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
- When `plottype: 0` (`LineStudyPlotStyle.Line`), `skipHoles` evaluates to `true`. The library **interpolates across `NaN` values**, drawing an artificial continuous line across multi-hour session gaps!
- When `plottype: 7` (`LineStudyPlotStyle.LineWithBreaks`, corresponding to Pine Script's `plot.style_linebr`), `skipHoles` evaluates to `false`. The renderer strictly terminates the line at `NaN` and starts a new path only when a valid numeric value appears.

#### Architectural Mandate:
1. Any plot representing session levels, gaps, midlines, or disjointed Pine lines **must** be declared with `plottype: 7`:
   ```javascript
   metainfo.styles[plotId] = {
       title: "Session Midline",
       histogramBase: 0,
       joinPoints: false,
       plottype: 7 // LineStudyPlotStyle.LineWithBreaks
   };
   ```
2. When the condition is false or inactive, `this.main` **must return `NaN`** (never `0`, never `null`, never retain the previous bar's value).

### 2.2 Price Scale Badges & Status Line Polishing (`display` Bitmask)

Indicators with multiple inactive plots frequently cause unsightly badge clutter on the price axis (e.g. badges pinned to price 0 or stale levels).

#### TradingView Price Axis Check (`library.e8d44337c84d65489d2c.js:509`):
The price axis label visibility for each study plot evaluates:
$$\text{isVisible} = (\text{plot.display} \;\&\; 4) \neq 0 \quad \land \quad \neg \text{lastValueData.noData}$$

The bitmask values for `display` in TradingView Charting Library:
- `1` (Bit 0): `Pane` (render on chart canvas)
- `2` (Bit 1): `DataWindow` (display in Data Window inspect panel)
- `4` (Bit 2): `PriceScale` (display price badge on right Y-axis)
- `8` (Bit 3): `StatusLine` (display value in indicator legend title)
- `15`: `All` ($1 + 2 + 4 + 8$)

#### Suppression of Unwanted Price Scale Badges:
1. For session ranges, background highlights, or secondary levels where an axis badge is visually distracting, configure `display: 11` ($15 - 4$):
   ```javascript
   metainfo.styles[plotId].display = 11; // Display in Pane, DataWindow, StatusLine, but NOT PriceScale
   ```
2. On bars where the plot is inactive, returning `NaN` causes `lastValueData` to report `noData: true`, which natively suppresses both the axis badge and the status line value.

---

## 3. Native Shapes & Drawing Primitives

Pine Script v6 scripts extensively utilize drawing types: `box.new()`, `line.new()`, `polyline.new()`, `label.new()`, and `table.new()`. Because the standard study `this.main` loop only outputs 1D time-series streams, complex 2D geometric boxes and multi-day vertical dividing lines are rendered through TradingView's **Native Chart Shapes API**.

### 3.1 Charting Library Shapes API Verification

TradingView Charting Library exposes shape creation methods on the active chart instance (`widget.chart()`):
- `chart.createMultipointShape(points, options)`
- `chart.createShape(point, options)`
- `chart.createAnchoredShape(point, options)`
- `chart.removeEntity(entityId)`
- `chart.getAllShapes()`

#### Internal Shape Registry (`library.e8d44337c84d65489d2c.js:854-869`):
TradingView maps shape identifier strings to internal `LineTool` classes:
- `"rectangle"` $\rightarrow$ `LineToolRectangle`
- `"trend_line"` $\rightarrow$ `LineToolTrendLine`
- `"vertical_line"` $\rightarrow$ `LineToolVertLine`
- `"horizontal_line"` $\rightarrow$ `LineToolHorzLine`
- `"ray"` $\rightarrow$ `LineToolRay`
- `"polyline"` / `"path"` $\rightarrow$ `LineToolPolyline` / `LineToolPath`
- `"text"` / `"callout"` $\rightarrow$ `LineToolText` / `LineToolCallout`

### 3.2 Pine Drawing Primitive Mapping Specification

#### 1. `box.new(left, top, right, bottom, border_color, border_width, border_style, bgcolor, text, text_size, text_color, text_valign, text_halign)`
- **TradingView Shape**: `"rectangle"`
- **Points**:
  ```javascript
  const points = [
      { time: leftTime, price: topPrice },
      { time: rightTime, price: bottomPrice }
  ];
  ```
- **Overrides**:
  ```javascript
  const overrides = {
      color: borderColorHex, // Border stroke color
      linewidth: borderWidth,
      linestyle: borderStyle === 'dashed' ? 1 : borderStyle === 'dotted' ? 2 : 0,
      backgroundColor: bgcolorHex,
      fillBackground: true,
      transparency: Math.round((1 - bgAlpha) * 100),
      showLabel: Boolean(text),
      text: text || "",
      textColor: textColorHex || "#ffffff",
      fontSize: textSize || 12,
      vertLabelsAlign: textValign || "middle", // "top" | "middle" | "bottom"
      horzLabelsAlign: textHalign || "center"  // "left" | "center" | "right"
  };
  const shapeId = chart.createMultipointShape(points, {
      shape: "rectangle",
      lock: true,
      disableSelection: true,
      disableSave: true,
      overrides: overrides
  });
  ```

#### 2. `line.new(x1, y1, x2, y2, xloc, extend, color, style, width)`
- **TradingView Shape**: `"trend_line"` (or `"ray"` if `extend === extend.right`)
- **Points**:
  ```javascript
  const points = [
      { time: x1Time, price: y1 },
      { time: x2Time, price: y2 }
  ];
  ```
- **Overrides**:
  ```javascript
  const overrides = {
      linecolor: colorHex,
      linewidth: width || 1,
      linestyle: style === 'dashed' ? 1 : style === 'dotted' ? 2 : 0,
      extendLeft: extend === 'both' || extend === 'left',
      extendRight: extend === 'both' || extend === 'right'
  };
  const shapeId = chart.createMultipointShape(points, {
      shape: "trend_line",
      lock: true,
      disableSelection: true,
      overrides: overrides
  });
  ```

#### 3. `polyline.new(points, curved, closed, line_color, fill_color, line_style, line_width)`
- **TradingView Shape**: `"polyline"` or `"path"`
- **Points**: Array of `{ time, price }`.
- **Overrides**: `linecolor`, `linewidth`, `fillBackground`, `backgroundColor`, `filled`.

#### 4. `label.new(x, y, text, xloc, yloc, color, style, textcolor, size, textalign, tooltip)`
- **TradingView Shape**: `"text"` or `"callout"`
- **Point**: `{ time: xTime, price: yPrice }`
- **Overrides**:
  ```javascript
  const overrides = {
      text: text,
      textColor: textcolorHex || "#ffffff",
      fontSize: size || 12,
      backgroundColor: colorHex,
      fillBackground: true,
      bold: true
  };
  const shapeId = chart.createShape({ time: xTime, price: yPrice }, {
      shape: "text",
      lock: true,
      disableSelection: true,
      overrides: overrides
  });
  ```

#### 5. `table.new(position, columns, rows, bgcolor, border_color, border_width, frame_color, frame_width)`
- **Dual Rendering Strategy**:
  1. *Native Canvas Shape*: Some Charting Library builds support `shape: "table"`.
  2. *Viewport-Anchored HTML Overlay*: For 100% precision and zero latency, instantiate a responsive DOM overlay directly inside `#tv_chart_container`:
     ```html
     <div class="tv-pine-table-container" style="position:absolute; top:12px; right:70px; z-index:25; pointer-events:none;">
         <table class="tv-pine-table" style="background:#1e222d; border:1px solid #363c4e; border-collapse:collapse; border-radius:4px;">
             <!-- Dynamic Cells Generated by table.cell() -->
         </table>
     </div>
     ```
     This matches TradingView's floating dashboard tables (e.g. the LuxAlgo Session Info table) with exact cell padding, fonts, and hex colors.

### 3.3 Shape Lifecycle Management & Synchronization

Every study generating native shapes maintains an active entity tracking registry:
```javascript
window.PineStudyShapeRegistry = window.PineStudyShapeRegistry || new Map();
// studyInstanceId -> Set<shapeId>
```
1. **Recalculation / Symbol / Interval Change**:
   Before re-evaluating shapes, purge all previously created entities:
   ```javascript
   function clearStudyShapes(studyId, chart) {
       const registered = window.PineStudyShapeRegistry.get(studyId);
       if (registered) {
           registered.forEach(shapeId => {
               try { chart.removeEntity(shapeId); } catch (e) {}
           });
           registered.clear();
       }
   }
   ```
2. **Study Removal**:
   When the study is deleted from the legend or dialog, the orchestrator triggers `clearStudyShapes(studyId, chart)` and removes any DOM table containers.

---

## 4. LuxAlgo Sessions & Multi-Day Dividers Case Study (`scratch_luxalgo.pine`)

The LuxAlgo Sessions script demonstrates advanced Pine Script v6 capabilities:
- Multi-session detection across standard financial market hours:
  - **New York**: 13:00 - 22:00 UTC
  - **London**: 07:00 - 16:00 UTC
  - **Tokyo**: 00:00 - 09:00 UTC
  - **Sydney**: 21:00 - 06:00 UTC
- Session high/low range bounding boxes (`box.new`).
- Session mean/midline plotting with gap breaks (`plot.style_linebr`).
- Session breakout / range info table (`table.new`, `table.cell`).
- Multi-day vertical dividers (`isnewday` detection).

### 4.1 Zero Timescale Distortion Invariant

**CRITICAL PRINCIPLE**: Under no circumstances should the UDF datafeed or study engine inject dummy/synthetic bars to display session boundaries.
- The Candlestick Timescale must remain **100% pure and untainted**.
- Every session box `left` and `right` coordinate, and every vertical divider coordinate, binds strictly to **real historical bar timestamps** (`bar.time`).
- If a bar falls outside market hours, it simply returns `NaN` in its plot output. TradingView's canvas renderer handles time scaling natively.

### 4.2 Multi-Day Vertical Dividers

In `scratch_luxalgo.pine`, daily dividing lines demarcate 00:00 UTC transitions:
```pine
isnewday = ta.change(time("D")) != 0
```
In the plotter engine:
```javascript
function renderDayDividers(bars, chart, studyId) {
    let prevDay = null;
    for (let i = 0; i < bars.length; i++) {
        const b = bars[i];
        const dt = new Date(b.time);
        const day = dt.getUTCDay();
        if (prevDay !== null && day !== prevDay) {
            // New Day Transition Detected at bar i
            const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
            const dayStr = dayNames[day];
            const shapeId = chart.createShape({ time: b.time, price: b.close }, {
                shape: "vertical_line",
                lock: true,
                disableSelection: true,
                disableSave: true,
                overrides: {
                    linecolor: "rgba(120, 123, 134, 0.4)",
                    linewidth: 1,
                    linestyle: 2, // Dotted
                    showLabel: true,
                    text: dayStr,
                    textColor: "#787b86",
                    fontSize: 10,
                    vertLabelsAlign: "bottom"
                }
            });
            registerShape(studyId, shapeId);
        }
        prevDay = day;
    }
}
```

### 4.3 High/Low Session Bounding Boxes

For each session (e.g. New York):
1. **Bar Iteration**:
   Detect session entry when `isInSession(currentBarTime)` transitions from `false` to `true`. Record `sessionStartBar`.
2. **Track Extremes**:
   While `isInSession` is `true`, track $\max(\text{high})$ and $\min(\text{low})$.
3. **Session Close**:
   When `isInSession` transitions to `false` (or on the last historical bar if session is active):
   ```javascript
   const boxShapeId = chart.createMultipointShape([
       { time: sessionStartBar.time, price: sessionHigh },
       { time: currentBar.time, price: sessionLow }
   ], {
       shape: "rectangle",
       lock: true,
       disableSelection: true,
       overrides: {
           color: sessionBorderColor,
           linewidth: 1,
           linestyle: 0,
           backgroundColor: sessionBgColor,
           fillBackground: true,
           transparency: 85
       }
   });
   registerShape(studyId, boxShapeId);
   ```

---

## 5. Pine Editor IDE Integration & Lifecycle Sync (`pine_editor_ide.js`)

### 5.1 Architecture of the Pine Editor Bottom Dock

The Pine Editor is integrated into `index.html` as a collapsible bottom drawer dock synchronized with TradingView:
- **HTML Container**: `#pine_editor_drawer` (styled via `custom.css`).
- **Editor Area**: `#pine_editor_textarea` with syntax-highlighting overlay and synchronized line gutter (`#pine_editor_gutter`).
- **Compiler Diagnostics**: `#pine_compiler_drawer` with summary status badge and clickable error cards.
- **Top Controls**:
  - Indicator title input (`#pine_script_title`)
  - Compilation button (`#pine_compile_btn`)
  - Add to Chart button (`#pine_add_to_chart_btn`)
  - Close / minimize toggles

```
+-------------------------------------------------------------------------+
| [Pine Editor]  Title: [LuxAlgo Sessions v6    ]  [▶ Compile] [＋ Add to Chart] |
+-------------------------------------------------------------------------+
|  1 | //@version=6                                                       |
|  2 | indicator("Sessions - LuxAlgo", overlay=true)                      |
|  3 | ny_session = input.session("1300-2200", "New York")                |
| ...|                                                                    |
+-------------------------------------------------------------------------+
| ✕ Compilation Diagnostics (1 Error)                                     |
|  Line 42, Col 15: Undeclared identifier 'mid_level'  [Click to jump]    |
+-------------------------------------------------------------------------+
```

### 5.2 Compiler Diagnostics & Error Navigation (`jumpToLineAndCol`)

When the user clicks `#pine_compile_btn`:
1. The source code is parsed using `PineTSLib.pineToJS(source)` and AST validation via `Indicator.from(source)`.
2. If syntax errors or typing errors occur, the compiler extracts the line number, column number, and error message.
3. The diagnostics container `#pine_compiler_body` populates error items:
   ```html
   <div class="pine-error-item" onclick="window.jumpToLineAndCol(42, 15)">
       <span class="error-badge">ERROR</span>
       <span class="error-location">Line 42:15</span>
       <span class="error-message">Undeclared identifier 'mid_level'</span>
   </div>
   ```
4. Clicking an error invokes `jumpToLineAndCol(line, col)`:
   - Calculates character position: $\sum_{i=1}^{\text{line}-1} (\text{lines}[i].\text{length} + 1) + \text{col}$.
   - Sets `textarea.setSelectionRange(targetPos, targetPos + tokenLength)`.
   - Scrolls `textarea` and `#pine_editor_gutter` into view:
     $$\text{scrollTop} = (\text{line} - 3) \times \text{lineHeight}$$
   - Flashes a CSS highlight on the target gutter line.

### 5.3 One-Click Compile & Add to Chart Workflow

When `#pine_add_to_chart_btn` is clicked:
1. **Compilation**: Source transpiled to JavaScript study descriptor.
2. **Library Registration**:
   The study object is pushed to `window._customPineStudies` and injected into `Kv.JSServer.studyLibrary`:
   ```javascript
   if (window.tvWidget && window.tvWidget._ready) {
       const chart = window.tvWidget.chart();
       // Register with repository
       const repo = chart.studyMetaInfoRepository();
       if (repo && repo.addStudyMetaInfo) {
           repo.addStudyMetaInfo(studyDescriptor.metainfo);
       }
   }
   ```
3. **Instantiation on Chart**:
   ```javascript
   chart.createStudy(
       studyDescriptor.metainfo.description, // Study Name
       studyDescriptor.metainfo.is_price_study, // Overlay
       false, // isForceOverlay
       [], // inputs
       { lock: false } // CRITICAL: allows user interaction and legend controls
   ).then(studyId => {
       console.log(`Study successfully attached to chart with ID: ${studyId}`);
   });
   ```

### 5.4 Full TradingView Legend Hover Controls

When `lock: false` is supplied to `chart.createStudy`:
- TradingView displays standard study legend actions on hover:
  1. **Eye Icon (👁️)**: Toggles study visibility (`chart.getStudyById(id).setVisible(state)`).
  2. **Cogwheel Icon (⚙️)**: Opens the native TradingView Format & Inputs modal dialog.
  3. **Trash Icon (🗑️)**: Removes the study and triggers cleanup hooks.
- **Dynamic Format Modal Integration**:
  In `this.main(ctx, inputCallback)`:
  ```javascript
  const userColor = inputCallback(inputColorId);
  const userLength = inputCallback(inputLengthId);
  ```
  When the user adjusts inputs in the modal, TradingView invalidates the study buffer and re-executes `this.main()` instantaneously with zero page reloads.

### 5.5 Streaming Real-Time Bar Synchronization

When new market ticks arrive or the interval changes:
1. Chart updates bar index $N-1$ or appends bar $N$.
2. TradingView invokes `this.main(ctx, inputCallback)` incrementally for the modified bar.
3. For studies with native shapes (like session boxes), a hook on `chart.onIntervalChanged()` and `chart.onSymbolChanged()` triggers an asynchronous refresh of the session shape coordinates, guaranteeing seamless real-time behavior.

---

## 6. Comprehensive Implementation Blueprint

| Component | Responsibility | Source Location | Key Methods / Exports |
|---|---|---|---|
| **Study Metainfo Builder** | Generates v52/v53 schema for all 8 Pine plot types, colors, and inputs | `pine_indicators.js` | `createStudyFromTranspiled()`, `parsePineMetadata()` |
| **Color Packing Utility** | Encodes ARGB colors into unsigned 32-bit integers for `isRGB: true` | `pine_indicators.js` | `colorToInt()`, `hexToInt()` |
| **Hole-Breaking Plotter** | Configures `plottype: 7` (`LineWithBreaks`) and `display: 11` for clean rendering | `pine_indicators.js` | `getPlotStyleConfig()` |
| **Native Shapes Engine** | Maps Pine drawing types (`box`, `line`, `label`) to `createMultipointShape` | `pine_indicators.js` | `renderSessionVisuals()`, `clearStudyShapes()` |
| **Pine Editor IDE** | Manages code editing, gutter line numbers, and keyboard shortcuts | `pine_editor_ide.js` | `initPineEditor()`, `updateGutter()` |
| **Diagnostics Drawer** | Real-time AST validation and click-to-jump error navigation | `pine_editor_ide.js` | `runCompilation()`, `jumpToLineAndCol()` |
| **Chart Injection Bridge** | Compiles script, registers in `studyLibrary`, and attaches study with legend controls | `pine_editor_ide.js` | `addStudyToChart()` |
| **UDF Datafeed Guardian** | Serves pure bar data without synthetic time distortion | `app.py` / `index.html` | `/history`, `/symbols` |

---

## 7. Conclusion

By adhering strictly to:
1. Metainfo v52/v53 object specifications with `isRGB: true`.
2. `LineStudyPlotStyle.LineWithBreaks` (`plottype: 7`) with strict `NaN` returns to eliminate artificial line bridging.
3. Axis `display: 11` bitmask to suppress synthetic price badges.
4. Native Chart Shapes API (`createMultipointShape`, `createShape`) with lifecycle tracking.
5. Interactive Pine Editor IDE drawer with error jumping and full legend controls.

The TradingView Charting Library integration achieves **100% visual and functional parity** with TradingView's native Pine Script execution engine.
