# Technical Specification Mining Report: PineTS Indicator Engine

**Author**: Survey Spec Miner (`survey_pinets`)  
**Date**: 2026-09-09  
**Source Path**: `E:\TRADINGVIEW ADVANCED\PineTS-main`  
**Distribution Targets**: `PineTS-main/dist/pinets.min.browser.js`, `PineTS-main/dist/pinets.min.cjs`  

---

## Executive Summary

This report delivers an exhaustive technical analysis of LuxAlgo's `PineTS` (version `0.9.33`) indicator runtime and transpiler engine to support replacing the legacy transpiler in `E:\TRADINGVIEW ADVANCED`. The investigation covered the source code (`PineTS-main/src`), production distribution bundles (`pinets.min.browser.js`, `pinets.min.cjs`), Rollup configuration, test suites, and live runtime execution.

Key discoveries include:
1. **Global Window Exports**: `pinets.min.browser.js` is bundled as a UMD module with global root `window.PineTSLib`. While `window.PineTS` is created via an explicit footer script, `window.PineTS.Indicator` is **undefined**; the Indicator class is mounted exclusively at `window.PineTSLib.Indicator`.
2. **`Indicator.from(source)`**: The core entry point normalizes strings, functions, or existing Indicator instances, exposing `.getInputsMeta()`, `.getPropsMeta()`, `.prepare()`, `.usesVisibleRange()`, and live Proxies `.input` and `.prop`.
3. **`ind.getInputsMeta()`**: Fully extracts Pine v5/v6 inputs (`symbol`, `timeframe`, `bool`, `color`, `int`, `float`, `string`, `source`, `enum`, etc.) with normalized default values (including 8-character `#RRGGBBAA` hex colors), stable `varId` handles, and display attributes.
4. **`plotcandle(...)` Output**: Renders OHLC data to `context.plots[plotKey]` with `options.style = 'candle'` and per-bar data containing 4-element value tuples `[open, high, low, close]` and color options `{ color, wickcolor, bordercolor }`.
5. **`request.security(...)` Multi-Value Tuples**: PineTS features full AST and runtime support for multi-variable tuple destructuring (e.g. `[o, h, l, c] = request.security(sym, tf, [open, high, low, close])`). Tuple arrays are unpacked via transpiler temporary variables and matched to 2D array unpacking in `Context.init`.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Runtime Entry | `Indicator.from(arg)` | Normalizes Pine script string, JS function, or Indicator into an Indicator instance | `Indicator \| Function \| string` | `Indicator` instance | Throws on unparseable syntax during `prepare()` | `src/Indicator/Indicator.class.ts:95` |
| 2 | Input Discovery | `ind.getInputsMeta()` | Lazily AST-parses script declarations into structured input metadata | None | `IPineInput[]` | Returns `[]` for JS function source or invalid Pine | `src/Indicator/Indicator.class.ts:156` |
| 3 | Input Proxy | `ind.input` | Live Proxy for reading and overriding script inputs before or between runs | Keyed by `varId` or `title` | Input value | Throws on unknown key, container replacement, type mismatch, or min/max violation | `src/Indicator/Indicator.class.ts:69` |
| 4 | Props Discovery | `ind.getPropsMeta()` | Extracts schema metadata for `indicator()` or `strategy()` declaration arguments | None | `IPineProp[]` | Defaults to indicator schema if no declaration found | `src/Indicator/Indicator.class.ts:166` |
| 5 | Declaration Sniffing | `ind.getDeclarationType()` | Statically inspects AST to identify script kind | None | `'indicator' \| 'strategy' \| null` | Returns `null` if neither is present | `src/Indicator/Indicator.class.ts:191` |
| 6 | Transpilation & Caching | `ind.prepare(opts)` | Idempotent transpile and viewport dependency detection; caches `PreparedScript` | `{ debug?: boolean, ln?: boolean }` | `{ fn, inputs, usesVisibleRange, ltfSlices }` | Throws syntax or parse error if Pine script is invalid | `src/Indicator/Indicator.class.ts:108` |
| 7 | Viewport Detection | `ind.usesVisibleRange()` | Statically checks whether script calls viewport built-ins (e.g. `chart.left_visible_bar_time`) | None | `boolean` | None (safe regex scan) | `src/Indicator/Indicator.class.ts:126` |
| 8 | Runtime Inputs | `ind.getRuntimeInputs()` | Merges legacy constructor inputs and explicit `.input` overrides | None | `Record<string, unknown>` | VarId overrides take precedence over title keys | `src/Indicator/Indicator.class.ts:143` |
| 9 | Execution Engine | `PineTS.run(code, periods, pageSize)` | Executes script over market data series, returning populated Context | `Indicator \| Function \| string`, `periods?`, `pageSize?` | `Promise<Context>` (or `AsyncGenerator<Context>` if paginated) | Rejects Promise on runtime calculation error | `src/PineTS.class.ts:321` |
| 10 | Streaming Engine | `PineTS.stream(code, opts)` | Event-based execution for live data feeds (`data`, `warning`, `alert`, `error`) | `code`, `{ pageSize, live, interval }` | `{ on(event, cb), stop() }` | Emits `error` event on execution failure | `src/PineTS.class.ts:344` |
| 11 | Secondary Context Rollback | `PineTS.updateTail(ctx)` | Restores var/let/const Series state from snapshot before re-executing forming bar | `context: Context` | `Promise<boolean>` | Returns `false` if no market data updated | `src/PineTS.class.ts:834` |
| 12 | Candlestick Plotting | `plotcandle(...)` | Renders OHLC candlestick series to `ctx.plots` with body, wick, and border colors | `open, high, low, close, title, color, wickcolor, bordercolor, ...` | Plot dictionary registered in `ctx.plots[plotKey]` | Silently suppresses plotting in secondary contexts | `src/namespaces/Plots.ts:378` |
| 13 | Multi-Value Security | `request.security(...)` | Fetches series from different symbol/timeframe, including multi-element tuples | `symbol, timeframe, expression, gaps, lookahead, ...` | Evaluated series value or 2D-wrapped tuple array | Throws `'Invalid timeframe'` if resolution unknown | `src/namespaces/request/methods/security.ts:108` |
| 14 | Tuple Destructuring | `[a, b, ...] = expr` | Parses array pattern destructuring for tuple-returning calls | Tuple assignment expression | AST `VariableDeclaration` with temp variable and index projections | Syntax error if closing bracket or `=` is missing | `src/transpiler/pineToJS/parser.ts:1419` |
| 15 | Lower Timeframe Security | `request.security_lower_tf(...)` | Returns array of LTF bars within HTF bar boundaries | `symbol, timeframe, expression, ...` | Array of LTF values | Silently suppresses in secondary contexts | `src/namespaces/request/methods/security_lower_tf.ts:277` |
| 16 | UMD Global Window Attachment | `pinets.min.browser.js` | Exports full library namespace to `window.PineTSLib` and aliases `window.PineTS` | Browser global context | `window.PineTSLib` and `window.PineTS` | `window.PineTS.Indicator` is undefined without explicit alias | `rollup.config.js:233` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `window.PineTS.Indicator` | Calling `window.PineTS.Indicator.from(...)` | Throws `TypeError: Cannot read properties of undefined (reading 'from')` because Rollup footer only mapped `PineTS`, `PineTS.Provider`, and `PineTS.Context`. |
| 2 | `input.color` Normalization | Script with `color.green`, `color.red`, `#ff0000` | Normalized to 8-character uppercase `#RRGGBBAA` string (e.g. `#4CAF50FF`, `#F23645FF`, `#FF0000FF`) in `ind.getInputsMeta()`. |
| 3 | Duplicate Input Titles | Two inputs declared with same title: `a = input(10, "Len")`, `b = input(20, "Len")` | Both appear in `ind.getInputsMeta()` with unique `varId` handles (`a` and `b`). `.input['Len']` writes to `a`, while `.input['b']` writes to `b`. |
| 4 | Positional Overload on `input.int` | Positional 3rd argument is an array `input.int(10, "Len", [5, 10, 20])` vs number `input.int(10, "Len", 5, 50, 1)` | PineTS type-sniffs the 3rd arg: if `ArrayExpression`, decoded as `options`; if number, decoded as `minval`, `maxval`, `step`. |
| 5 | `plotcandle` 0 Explicit Plots | Script uses calculations or drawing primitives without `plot()` or `plotcandle()` | `ctx.plots` contains only drawing objects (`__labels__`, `__lines__`, etc.); TradingView metainfo generator must provide adaptive trend baseline. |
| 6 | `plotcandle` Dynamic Colors | `plotcandle(..., color = close >= open ? color.green : color.red)` | Dynamic expression evaluated per bar; `data[i].options.color` contains the evaluated hex `#4CAF50` or `#F23645`. |
| 7 | `request.security` Same Symbol & TF | `request.security(syminfo.tickerid, timeframe.period, close)` | Evaluated immediately on the primary context without creating a secondary `PineTS` instance (no network or secondary loop overhead). |
| 8 | `request.security` Infinite Recursion | Secondary context executing script that itself contains `request.security` | `context.isSecondaryContext` flag intercepts recursive call and returns expression directly without spawning tertiary instances. |
| 9 | `request.security` Tuple Destructuring | `[o, h, l, c] = request.security(sym, tf, [open, high, low, close])` | Expression evaluated to tuple array `[o, h, l, c]`, wrapped in 2D array `[[o, h, l, c]]` per precision convention, and unpacked into Series variables. |
| 10 | Secondary Context Plot Suppression | Indicator calling `plot()` or `plotcandle()` running inside a `request.security` secondary instance | Suppressed via `@silentInSecondary` decorator so secondary contexts never pollute or duplicate plots in the primary chart context. |

---

## Deep Technical Analysis

### 1. PineTS Module Architecture & Global Window Exports

The production build artifacts are generated via Rollup (`rollup.config.js`):

```javascript
// rollup.config.js lines 230-241
const BrowserConfigProd = {
    input: './src/index.ts',
    output: {
        file: './dist/pinets.min.browser.js',
        format: 'umd',
        name: 'PineTSLib',
        exports: 'auto',
        sourcemap: true,
        banner: LicenseHeader,
        footer:
            ';var PineTS = PineTSLib.PineTS;PineTS.Provider = PineTSLib.Provider;PineTS.Context = PineTSLib.Context;',
    },
    ...
};
```

#### Observable Behavior in Browser:
- **`window.PineTSLib`**: Contains all exports from `src/index.ts`:
  - `Indicator` (Class constructor with static `from()`)
  - `PineTS` (Main engine class)
  - `Context` (Execution context class)
  - `Provider` (Market data provider registry)
  - `transpile` & `pineToJS` (AST & JavaScript transpilers)
  - `INDICATOR_PROPS` & `STRATEGY_PROPS` (Schema definitions)
- **`window.PineTS`**: Initialized to `window.PineTSLib.PineTS`. Its static properties are populated with:
  - `PineTS.Provider = PineTSLib.Provider`
  - `PineTS.Context = PineTSLib.Context`
- **CRITICAL FINDING**: `PineTS.Indicator` is **NOT** attached by the footer script. In `index.html` or `pine_indicators.js`, engineers must use either:
  ```javascript
  const Indicator = window.PineTSLib.Indicator;
  // OR alias it globally:
  window.PineTS.Indicator = window.PineTSLib.Indicator;
  ```

---

### 2. `Indicator.from(source)` & Lifecycle Methods

The `Indicator` class (`src/Indicator/Indicator.class.ts`) manages script parsing, metadata extraction, input overriding, and execution preparation.

#### A. Instantiation & Factory
```typescript
public static from(arg: Indicator | Function | string): Indicator {
    if (arg instanceof Indicator) return arg;
    return new Indicator(arg);
}
```
- Accepts a raw Pine Script v5/v6 string, transpiled JavaScript function, or an existing `Indicator` instance.
- Avoids redundant AST parsing when passing pre-constructed indicators.

#### B. Preparation & Caching (`ind.prepare(opts)`)
- Invokes `transpile(this.source, { debug, ln })` to convert Pine Script to an executable JS function.
- Scans the function body with `detectViewportUsage` against `VIEWPORT_DEPENDENT_BUILTINS` (`chart.left_visible_bar_time`, `chart.right_visible_bar_time`).
- Attaches `ltfSlices` from `(fn as any)._ltfSlices` for lower-timeframe security execution.
- Returns `PreparedScript`:
  ```typescript
  interface PreparedScript {
      fn: Function;
      inputs: Record<string, unknown>;
      usesVisibleRange: boolean;
      ltfSlices?: any[];
  }
  ```
- Cached on `this._prepared`; repeated calls do not re-transpile.

#### C. Input and Prop Proxies (`.input` & `.prop`)
- Both `.input` and `.prop` are protected, frozen container Proxies:
  - Attempting to overwrite the container (`ind.input = {}`) throws:  
    `"[Indicator] .input cannot be replaced — mutate individual keys (e.g. ind.input[\"My Title\"] = 20)."`
  - Mutation of recognized keys (e.g. `ind.input["Length"] = 20` or `ind.input["len"] = 20`) validates the value against `type`, `minval`, `maxval`, and `options`.
  - Canonical indexing uses `varId` (e.g. `len`), with `title` (e.g. `Length`) acting as an alias.

---

### 3. `ind.getInputsMeta()` Schema & TradingView Metainfo Mapping

`scanInputs(source)` walks the AST generated by `pineToJS(source)` to discover all `input.*()` and bare `input()` declarations.

#### Output Structure of `IPineInput`:
```typescript
interface IPineInput {
    type: 'int' | 'float' | 'bool' | 'string' | 'source' | 'color' | 'enum' | 'price' | 'time' | 'session' | 'symbol' | 'timeframe' | 'text_area';
    defval: unknown;
    varId?: string;       // Assigned variable name (e.g. "sym", "len")
    title?: string;       // User-facing label (e.g. "Symbol", "Length")
    tooltip?: string;
    group?: string;
    display?: 'none' | 'data_window' | 'status_line' | 'all';
    active?: boolean;
    confirm?: boolean;
    inline?: string;
    options?: unknown[];  // Accepted values array
    minval?: number;      // int/float minimum
    maxval?: number;      // int/float maximum
    step?: number;        // int/float increment
}
```

#### Mapping Table: PineTS `IPineInput` to TradingView Metainfo v52/v53 `inputs`:

| PineTS `type` | TradingView `type` | Default Value Format | TradingView UI Widget |
|---------------|--------------------|----------------------|-----------------------|
| `symbol` | `'symbol'` | String (`"AAPL"`, `"EURUSD"`) | Native Symbol Search Picker |
| `timeframe` | `'resolution'` | String (`"D"`, `"60"`, `"1"`) | Timeframe / Resolution Dropdown |
| `bool` | `'bool'` | Boolean (`true`, `false`) | Checkbox |
| `color` | `'color'` | String (`"#4CAF50FF"`, `#RRGGBBAA`) | Color Palette & Opacity Picker |
| `int` | `'integer'` | Integer number (`14`) | Numeric Spinner (`min`, `max`, `step`) |
| `float` | `'float'` | Float number (`1.5`) | Decimal Spinner (`min`, `max`, `step`) |
| `string` | `'text'` | String | Text Input or Dropdown (if `options`) |
| `source` | `'source'` | String (`"close"`, `"open"`) | Price Series Dropdown |
| `session` | `'session'` | String (`"0930-1600"`) | Trading Session Input |
| `time` | `'time'` | Timestamp / integer | Date/Time Picker |

*Note*: For `options`, TradingView Metainfo requires `options: string[]` and `type: 'text'`.

---

### 4. Candlestick Rendering (`plotcandle`) & Bridge Specification

#### A. PineTS Runtime Structure (`Plots.ts`)
When Pine Script invokes:
```pinescript
plotcandle(open, high, low, close, title="Candles", color=c >= o ? upColor : dnColor, wickcolor=wickColor, bordercolor=borderColor)
```
PineTS executes `PlotHelper.plotcandle(...)`:
1. Resolves `plotKey` from `title` (defaults to `'Candles'`).
2. Initializes `context.plots[plotKey]`:
   ```javascript
   {
     title: "Candles",
     _plotKey: "Candles",
     _callsiteId: "p26",
     options: {
       style: "candle",
       overlay: false,
       color: "#4CAF50",
       wickcolor: "#787B86",
       bordercolor: "#363A45"
     },
     data: [
       {
         title: "Candles",
         time: 1704067200000,
         value: [100, 105, 95, 102], // 4-element OHLC array
         options: {
           color: "#4CAF50",
           wickcolor: "#787B86",
           bordercolor: "#363A45"
         }
       },
       ...
     ]
   }
   ```

#### B. TradingView Charting Library Native OHLC Plot Contract
To render genuine candlestick bars on TradingView, the study's `metainfo` must declare:
```javascript
{
  plots: [
    { id: 'candle_0_open', type: 'ohlc_open', target: 'candle_0' },
    { id: 'candle_0_high', type: 'ohlc_high', target: 'candle_0' },
    { id: 'candle_0_low', type: 'ohlc_low', target: 'candle_0' },
    { id: 'candle_0_close', type: 'ohlc_close', target: 'candle_0' },
    { id: 'candle_0_colorer', type: 'ohlc_colorer', target: 'candle_0' },
    { id: 'candle_0_wick_colorer', type: 'wick_colorer', target: 'candle_0' },
    { id: 'candle_0_border_colorer', type: 'border_colorer', target: 'candle_0' }
  ],
  ohlcPlots: {
    candle_0: { title: 'Candles' }
  },
  defaults: {
    ohlcPlots: {
      candle_0: {
        borderColor: '#089981',
        color: '#089981',
        drawBorder: true,
        drawWick: true,
        plottype: 'ohlc_candles',
        visible: true,
        wickColor: '#787b86'
      }
    }
  },
  isRGB: true
}
```

#### C. `this.main(ctx, inputCallback)` Return Values
TradingView expects `this.main` to return an array matching `plots` order for each bar:
```javascript
// Order: [open, high, low, close, colorInt, wickColorInt, borderColorInt]
return [
  candleData.value[0], // Open
  candleData.value[1], // High
  candleData.value[2], // Low
  candleData.value[3], // Close
  parseRgbaToInt(candleData.options.color),
  parseRgbaToInt(candleData.options.wickcolor),
  parseRgbaToInt(candleData.options.bordercolor)
];
```

---

### 5. Multi-Series Security Handling (`request.security`)

#### A. AST Slicing & Parsing
- In `parser.ts`, `isTupleDestructuring()` detects `[o, h, l, c] = ...` and produces an `ArrayPattern`.
- `AnalysisPass.ts` unpacks the pattern:
  ```javascript
  // Pine:
  // [o, h, l, c] = request.security(sym, tf, [open, high, low, close])

  // Transpiled JS:
  const temp_15 = await request.security(p18, p19, p20);
  $.let.glb1_temp_1 = $.init($.let.glb1_temp_1, temp_15);
  $.let.glb1_o = $.init($.let.glb1_o, $.get($.let.glb1_temp_1, 0)[0]);
  $.let.glb1_h = $.init($.let.glb1_h, $.get($.let.glb1_temp_1, 0)[1]);
  $.let.glb1_l = $.init($.let.glb1_l, $.get($.let.glb1_temp_1, 0)[2]);
  $.let.glb1_c = $.init($.let.glb1_c, $.get($.let.glb1_temp_1, 0)[3]);
  ```

#### B. Tuple Preservation in Runtime
- In `param.ts`, `param(context)` checks:
  ```typescript
  const hasAnySeries = source.some(elem => elem instanceof Series);
  const hasOnlyScalars = source.every(elem => !(elem instanceof Series) && !Array.isArray(elem));
  const isTuple = (hasAnySeries || hasOnlyScalars) && source.length >= 1;
  if (isTuple) {
      val = source.map(elem => elem instanceof Series ? elem.get(0) : elem);
  }
  ```
- In `security.ts`, return values are wrapped in a 2D array:
  `return Array.isArray(value) ? [value] : value;`
- In `Context.init`:
  ```typescript
  if (Array.isArray(src)) {
      if (Array.isArray(src[0])) {
          value = src[0]; // Unwraps 2D tuple wrapper
      } else {
          value = src[src.length - 1 + idx];
      }
  }
  ```
  This preserves the `[open, high, low, close]` array cleanly inside `temp_15`.

#### C. Secondary Context Lifecycle
1. **Shortcut**: If `_symbol` equals chart symbol and `_timeframe` equals chart timeframe, returns current bar expression directly without creating a secondary context.
2. **Execution**: If different, instantiates `new PineTS(context.source, _symbol, _timeframe, ...)`.
3. **Safety**: Calls `pineTS.markAsSecondary()` so `@silentInSecondary` decorators mute secondary plots.
4. **Caching**: Stored in `context.cache[`${_symbol}_${_timeframe}_${_expression_name}`]`.
5. **Data Streaming**: When new primary bars arrive, `pineTS.updateTail(cached.context)` selectively rolls back the secondary forming bar without recreating the secondary instance.

---

### 6. Backend Integration (`server.py`)

In `server.py`:
- Currently, `/pine/transpile` invokes the legacy bundle:
  ```python
  # server.py line 2465
  script = """
  const pt = require('E:/TRADINGVIEW ADVANCED/pine_transpiler.bundle.js');
  const fs = require('fs');
  const s = fs.readFileSync(0, 'utf-8');
  const r = pt.transpile(s);
  console.log(JSON.stringify(r));
  """
  ```
- To switch to `PineTS-main/dist/pinets.min.cjs`:
  ```javascript
  const { transpile, Indicator } = require('E:/TRADINGVIEW ADVANCED/PineTS-main/dist/pinets.min.cjs');
  const fs = require('fs');
  const source = fs.readFileSync(0, 'utf-8');
  try {
    const ind = Indicator.from(source);
    const meta = ind.getInputsMeta();
    const props = ind.getPropsMeta();
    const declType = ind.getDeclarationType();
    const prep = ind.prepare();
    console.log(JSON.stringify({
      success: true,
      code: prep.fn.toString(),
      inputs: meta,
      props: props,
      declarationType: declType,
      usesVisibleRange: prep.usesVisibleRange
    }));
  } catch (err) {
    console.log(JSON.stringify({
      success: false,
      error: err.message
    }));
  }
  ```

---

## Key Recommendations for Implementation Agents

1. **Global Namespace Alias in `index.html`**:
   Load `pinets.min.browser.js` via `<script src="PineTS-main/dist/pinets.min.browser.js"></script>` or copy to `pinets.bundle.js`. Immediately follow with:
   ```javascript
   if (window.PineTSLib && window.PineTS && !window.PineTS.Indicator) {
     window.PineTS.Indicator = window.PineTSLib.Indicator;
   }
   ```
2. **Metadata Extraction in `pine_indicators.js`**:
   Replace `parsePineMetadata(source)` with `ind.getInputsMeta()`:
   - Map `inp.type === 'symbol'` to `type: 'symbol'`.
   - Map `inp.type === 'timeframe'` to `type: 'resolution'`.
   - Map `inp.type === 'color'` to `type: 'color'`.
   - Map `inp.type === 'bool'` to `type: 'bool'`.
   - Map `inp.type === 'int'` to `type: 'integer'`.
   - Map `inp.type === 'float'` to `type: 'float'`.
3. **Candlestick Study Metainfo**:
   Detect `plotcandle` via `ctx.plots` or AST inspection. If present, emit `plots` with `ohlc_open`, `ohlc_high`, `ohlc_low`, `ohlc_close`, `ohlc_colorer`, `wick_colorer`, and `border_colorer`, with `ohlcPlots` and `isRGB: true`.
4. **`this.main` Execution Loop**:
   Execute `ind.prepare().fn` via a local `PineTS` instance or feeding bars through `Context`. Return numerical arrays for line plots and 7-element OHLC tuples for candle plots.
5. **Legend Control Preservation**:
   Always set `lock: false` when registering custom studies so TradingView displays hover controls: Hide (eye), Settings (gear), and Delete (trash).
6. **Backend Synchronization**:
   Update `server.py` `/pine/transpile` to run `pinets.min.cjs`.

---
*End of Report.*
