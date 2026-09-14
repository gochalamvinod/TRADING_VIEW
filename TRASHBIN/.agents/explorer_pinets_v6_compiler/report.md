# PineTS v6 Compiler, AST Engine & Runtime Architecture Report

**Explorer**: `explorer_pinets_v6_compiler`  
**Date**: 2026-09-10  
**Target Repository**: `E:\TRADINGVIEW ADVANCED\`  
**Key Codebases Investigated**:
- `PineTS-main/src/` (Lexer, Parser, Codegen, Transformers, Namespaces, Evaluator)
- `pinets.bundle.js` / `pinets.min.cjs`
- `server.py` (`/pine/transpile`, `/pine/indicators/catalog`)
- `pine_indicators.js` (Metainfo generator, study constructor, visual bridge)
- `pine_editor_ide.js` (Pine Editor GUI, compiler drawer, diagnostics navigation)

---

## Executive Summary

An exhaustive survey of the PineTS compiler, AST engine, runtime evaluator, and TradingView integration was conducted.

1. **Compiler & Version 6 Support**: PineTS natively supports `//@version=6` (as well as `//@version=5`). Pine v6 fractional division semantics are already version-gated and active. The compiler supports User-Defined Types (`type`), custom methods (`method`), tuple declarations and reassignments (`[a, b] = ...`, `[a, b] := ...`), and all 9 official Pine Script v6 `input.*` functions plus `enum`, `text_area`, and `time`.
2. **Input Metadata Extraction**: `Indicator.from(source).getInputsMeta()` extracts rich metadata for all inputs (`varId`, `type`, `title`, `options`, `defval`, `minval`, `maxval`, `step`, `group`, `inline`).
3. **Diagnostics & Error Navigation**: The lexer and parser embed exact `line` and `column` numbers in all syntax error exceptions (`at ${line}:${column}`). Regex extractors in `pine_indicators.js` and `server.py` parse these into `{ line, column, severity, message }` which `pine_editor_ide.js` utilizes for interactive click-to-jump navigation in the editor.
4. **Runtime Evaluator & Visual Primitives**: PineTS features a complete bar-by-bar execution loop supporting 64 technical analysis functions, 37 math functions, array/matrix/map data structures, and drawing primitives (`box.new`, `line.new`, `polyline.new`, `label.new`, `table.new`, `table.cell`). Drawing objects are serialized into `context.plots` under dedicated keys: `__boxes__`, `__lines__`, `__polylines__`, `__labels__`, `__tables__`.
5. **The Critical Integration Gap**: While PineTS has complete representations for drawing primitives and custom indicators, `pine_indicators.js`'s TradingView `basicstudy` adapter (`this.main`) currently uses an ad-hoc shim that hardcodes a few standard formulas (`Std.sma`, `Std.rsi`) and has a bespoke renderer only for `Sessions [LuxAlgo]`. General Pine scripts creating boxes, lines, polylines, labels, or tables currently lack a generic renderer bridge to TradingView's `chart.createMultipointShape`, `chart.createShape`, and HTML table overlays.

---

## 1. AST & Lexer / Parser Implementation (`PineTS-main/src`)

### 1.1 Architecture & Pipeline
PineTS employs a two-stage compilation pipeline:
```
Pine Script Source Code (v5/v6)
           │
           ▼
   [ Lexer (lexer.ts) ]  ───► Token Stream (INDENT/DEDENT, literals, keywords)
           │
           ▼
  [ Parser (parser.ts) ] ───► Pine AST (TypeDefinition, FunctionDeclaration, ...)
           │
           ▼
 [ Codegen (codegen.ts) ]───► Intermediate JavaScript string
           │
           ▼
[ Acorn Parser (acorn) ] ───► Standard ESTree AST
           │
           ▼
   [ Semantic Passes ]   ───► ScopeManager, AnalysisPass, TypeInferencePass
           │
           ▼
  [ AST Transformers ]   ───► MainTransformer, StatementTransformer, ExpressionTransformer
           │                  (Rewrites variables to Context $ accesses, loops with guards)
           ▼
[ Code Generator (astring) ]─► Final Executable JavaScript Function (Wrapped in Context)
```

### 1.2 Lexer Implementation (`lexer.ts`)
- **Indentation Tracking**: Emits `INDENT` and `DEDENT` tokens (Python-style layout) by maintaining `indentStack: number[]` (4 spaces = 1 indent level).
- **Line Continuations**: Detects multiline continuations across operators, commas, colons, and logical operators (`isContinuationFromPrevToken()`, lines 207–223) without pushing spurious indentation levels.
- **Token Coordinates**: Every token carries `line` and `column` (line 514: `new Token(type, value, this.line, this.column, ...)`).
- **Keywords**: Supported keywords defined in `tokens.ts` (lines 41–70):
  `if`, `else`, `for`, `while`, `switch`, `break`, `continue`, `var`, `varip`, `type`, `and`, `or`, `not`, `to`, `by`, `in`, `import`, `export`, `method`, `extends`, `enum`.

### 1.3 Parser Implementation (`parser.ts`)
- **Version Detection**:
  - `extractPineScriptVersion(sourceCode)` (`pineToJS.index.ts:17-33`):
    Uses regex `^\s*\/\/\s*@version\s*=\s*(\d+)\s*$` to extract version.
    Accepts any version `>= 5` (`//@version=5` and `//@version=6` are both valid).
  - Version 6 Fractional Division: Gated in `transpiler/index.ts:146`:
    ```typescript
    if (pineVersion !== null && pineVersion < 6) {
        runTypeInferencePass(ast, scopeManager);
    }
    ```
    For Pine v6, the integer division truncation pass is skipped, preserving authentic float division `5 / 2 = 2.5`.
- **Directives**:
  - `indicator(...)` and `strategy(...)` are parsed as top-level function calls (`CallExpression`).
  - Statically analyzed by `Indicator/scanDeclaration.ts` to extract properties (`title`, `overlay`, `format`, `precision`, etc.).
  - `library(...)` directive is currently NOT handled as a declaration type; `scanDeclaration` only supports `'indicator' | 'strategy'`.
- **User-Defined Types (UDT)**:
  - `parseTypeDefinition()` (`parser.ts:489-529`):
    Parses `type Name [=>]` followed by indented fields `fieldType fieldName [= defaultValue]`.
    Supports generic types (`array<float>`, `map<string, int>`) and dotted types (`chart.point`).
  - `codegen.ts:378-401` generates: `const Name = Type({ field: ['type', defaultExpr] });`.
  - Evaluated in runtime by `Core.Type(...)` (`Core.ts:488-571`), returning an object with `new(...)` and `copy(...)` factories creating `PineTypeObject`.
- **Methods**:
  - `parseMethodDeclaration()` (`parser.ts:894-950`):
    Parses `method name(Type this, ...params) => ...`.
  - `ExpressionTransformer.ts:1670-1740`:
    Detects method calls `receiver.methodName(args)` and transforms them to `$.call(methodName, callId, receiver, ...args)`.
- **Tuples**:
  - Declaration: `[a, b] = calc()` parsed via `parseTupleDestructuring()` (`parser.ts:1419-1443`) into `VariableDeclaration` with `ArrayPattern`.
  - Reassignment: `[a, b] := [x, y]` is supported in statements.
  - **Syntax Limitation**: Typed tuple declarations like `[float a, float b] = ...` fail in `isTupleDestructuring()` because the parser expects identifiers followed immediately by commas or `]`.
- **All 9 Input Types**:
  - All 9 official input types (`int`, `float`, `bool`, `string`, `color`, `timeframe`, `symbol`, `session`, `source`) plus `enum`, `price`, `time`, and `text_area` are parsed cleanly without syntax errors.

---

## 2. Input Metadata Extraction (`ind.getInputsMeta()`)

### 2.1 Extraction Mechanism (`scanInputs.ts`)
- **Two-Pass Static Analyzer**:
  - **Pass 1 (`collectEnumTable`)**: Collects all enum declarations (`enum tz { utc = "UTC" }`) into an enum lookup table.
  - **Pass 2 (`decodeInputCall`)**: Walks top-level `VariableDeclaration` AST nodes whose initializer is a call to `input.<fn>(...)` or bare `input(...)`.
- **Parameter Mapping**:
  - Decodes positional arguments using `POSITIONAL_BY_FN` maps (lines 36–50) and merges named arguments from trailing `ObjectExpression`.
  - Handles `input.int` and `input.float` dual overloads (options array vs minval/maxval/step) via type sniffing (`decodeIntFloatPositionals`).
- **Resolved Metadata (`IPineInput`)**:
  ```typescript
  export interface IPineInput {
      type: 'int' | 'float' | 'bool' | 'string' | 'source' | 'color' | 'enum' | 'price' | 'time' | 'session' | 'symbol' | 'timeframe' | 'text_area';
      defval: unknown;
      varId?: string;       // Variable name (e.g. "length")
      title?: string;       // Display title
      tooltip?: string;
      group?: string;
      inline?: string;
      confirm?: boolean;
      active?: boolean;
      display?: 'none' | 'data_window' | 'status_line' | 'all';
      options?: unknown[];
      minval?: number;
      maxval?: number;
      step?: number;
  }
  ```

### 2.2 Frontend Metainfo Mapping (`pine_indicators.js`)
- `pine_indicators.js` calls `ind.getInputsMeta()` (lines 504–565) and maps inputs into TradingView Charting Library's Study Metainfo schema:
  - `symbol` -> `{ type: 'symbol', defval: 'EURUSD.' }`
  - `timeframe` / `resolution` -> `{ type: 'resolution', isMTFResolution: true }`
  - `bool` -> `{ type: 'bool', defval: Boolean(...) }`
  - `color` -> `{ type: 'color', defval: '#RRGGBB' }` (9-character `#RRGGBBAA` is safely sliced to 7 characters for TradingView color picker compatibility)
  - `int` / `integer` -> `{ type: 'integer', defval: N, min, max, step }`
  - `float` -> `{ type: 'float', defval: N, min, max, step }`
  - `source` -> `{ type: 'source', defval: 'close' }`
- **Gap Identified**:
  - `input.session` is unhandled in the `switch`/`if` cascade, defaulting to `type: 'text'`.
  - Fallback regex in `pine_indicators.js:568` omits `.session`.

---

## 3. Diagnostic & Error Collection

### 3.1 PineTS Error Reporting
- The lexer and parser throw standard `Error` objects containing formatted string messages:
  - Lexer: `throw new Error(\`Unexpected character '${ch}' at ${this.line}:${this.column}\`);`
  - Parser: `throw new Error(\`Expected ${type} but got ${token.type} at ${token.line}:${token.column}\`);`
  - Parser: `throw new Error(\`Indentation error at ${this.line}:${this.column} - misaligned dedent\`);`
- `ASTNode` instances do not store full source ranges or coordinates (with the exception of an ad-hoc `IfStatement._line` property).
- `pineToJS()` catches errors and returns:
  ```json
  {
    "success": false,
    "version": 6,
    "error": "Expected RPAREN but got IDENTIFIER at 4:5",
    "stack": "..."
  }
  ```

### 3.2 Error Extraction & Jump-to-Code Navigation
- Both `pine_indicators.js` (`compilePineScript`, lines 1383, 1397, 1425) and `server.py` (lines 2521, 2535, 2565) parse error messages using regex:
  ```javascript
  const lineColMatch = (err.message || '').match(/(?:at|line)\s*(\d+)(?::|,?\s*col(?:umn)?\s*)(\d+)?/i);
  const line = lineColMatch ? parseInt(lineColMatch[1], 10) : 1;
  const col = (lineColMatch && lineColMatch[2]) ? parseInt(lineColMatch[2], 10) : 1;
  ```
- In `pine_editor_ide.js` (lines 880–915):
  - Populates the Pine Editor Compiler Drawer with clickable error items:
    `<div class="pine-compiler-error-item" data-line="${err.line}" data-col="${err.column}">`
  - Marks gutter lines with red error dots (`.pine-gutter-line.error`).
  - Clicking an error item focuses the editor textarea, moves the caret (`setSelectionRange`), and scrolls the line into view.

---

## 4. Runtime Evaluator & Visual Primitives

### 4.1 Series & Bar Evaluation Loop (`PineTS.class.ts`)
- **Execution Architecture**:
  - `PineTS.run(ind, periods)` executes `_executeIterations(context, transpiledFn, startIdx, endIdx)`.
  - For each bar `i` from `startIdx` to `endIdx`:
    1. Sets `context.idx = i`.
    2. Appends OHLCV values to `context.data.open`, `high`, `low`, `close`, `volume`, `hl2`, `hlc3`, `ohlc4`, `openTime`, `closeTime`, `bar_index`.
    3. Evaluates strategy orders if strategy context.
    4. Executes the transpiled script function `await transpiledFn(context)`.
    5. Calls `helper.syncToPlot()` for all registered drawing helpers (`_drawingHelpers`).
    6. Shifts context variables (`var`, `let`, `params` Series).
- **Historical Lookback**:
  - `Series.get(offset)` retrieves the value from `offset` bars ago (`offset = 0` is current bar).

### 4.2 Standard Visual Plots (`Plots.ts`)
- `Plots.ts` implements:
  - `plot()`: Line/histogram/area/columns plot. Pushes per-bar points to `context.plots[plotKey].data`.
  - `plotcandle()`: Candlestick plot. Pushes 4 prices `[open, high, low, close]` and color options `{ color, wickcolor, bordercolor }` with `style: 'candle'`.
  - `plotbar()`: Bar plot. Pushes `[open, high, low, close]` with `style: 'bar'`.
  - `plotshape()`, `plotchar()`, `plotarrow()`: Shape/char/arrow markers.
  - `bgcolor()`, `barcolor()`: Background and candle body color tinting.
  - `hline()`, `fill()`: Static horizontal levels and shaded channels between two plots.
- **Strict `na` / `NaN` Invariance**:
  - `NAHelper` implements `na` constant (`NaN`) and `na(x)` function (`val !== val`).
  - When plot expressions evaluate to `na`, PineTS pushes `NaN`.
  - In TradingView Charting Library, a value of `NaN` generates 0 line segments and 0 price badges on the price scale.

### 4.3 Drawing Primitives in PineTS Runtime
PineTS implements complete helpers for all Pine drawing objects:
1. **`box.new` (`BoxHelper.ts` & `BoxObject.ts`)**:
   - Supports: `left`, `top`, `right`, `bottom`, `border_color`, `border_width`, `border_style`, `extend`, `xloc` (`bi`/`bt`), `bgcolor`, `text`, `text_size`, `text_color`, `text_halign`, `text_valign`, `text_wrap`, `force_overlay`.
   - Also supports chart point signatures: `top_left`, `bottom_right`.
   - Serializes all active boxes to `context.plots['__boxes__']` (or `__boxes_overlay__` if `force_overlay`).
2. **`line.new` (`LineHelper.ts` & `LineObject.ts`)**:
   - Supports: `x1`, `y1`, `x2`, `y2`, `xloc`, `extend`, `color`, `style`, `width`, `force_overlay`.
   - Serializes to `context.plots['__lines__']`.
3. **`polyline.new` (`PolylineHelper.ts` & `PolylineObject.ts`)**:
   - Supports: `points` (`ChartPointObject[]`), `curved`, `closed`, `xloc`, `line_color`, `fill_color`, `line_style`, `line_width`, `force_overlay`.
   - Serializes to `context.plots['__polylines__']`.
4. **`label.new` (`LabelHelper.ts` & `LabelObject.ts`)**:
   - Supports: `x`, `y`, `text`, `xloc`, `yloc`, `color`, `style`, `textcolor`, `size`, `textalign`, `tooltip`, `force_overlay`.
   - Serializes to `context.plots['__labels__']`.
5. **`table.new` & `table.cell` (`TableHelper.ts` & `TableObject.ts`)**:
   - Supports: `position`, `columns`, `rows`, `bgcolor`, `frame_color`, `frame_width`, `border_color`, `border_width`.
   - `table.cell()` sets: `text`, `bgcolor`, `text_color`, `text_size`, `width`, `height`, `text_halign`, `text_valign`, `tooltip`.
   - Serializes to `context.plots['__tables__']`.

### 4.4 Session Functions & Time Windows (`Time.ts` & `sessionSpec.ts`)
- `time(timeframe, session, timezone)`:
  - Parses session string specifications like `"0930-1600"`, `"0930-1600:23456"`, or multiple windows `"0900-1200,1300-1700"`.
  - Returns bar opening time if timestamp falls inside session window; otherwise returns `NaN`.

---

## 5. Server-Side Transpilation & Execution (`server.py`)

### 5.1 Endpoint `/pine/transpile`
- FastAPI endpoint running on port 9000.
- Spawns a Node.js worker subprocess via `asyncio.to_thread(subprocess.run, ["node", "-e", script])`.
- Passes Pine source code via `stdin` and requires `pinets.min.cjs`.
- Executes:
  ```javascript
  const { Indicator, pineToJS } = require(pinets_cjs_path);
  const pRes = pineToJS(source);
  const ind = Indicator.from(source);
  const inputs = ind.getInputsMeta();
  const props = ind.getPropsMeta();
  const declType = ind.getDeclarationType();
  const usesVis = ind.usesVisibleRange();
  const prep = ind.prepare();
  ```
- Returns JSON containing `{ success: true, code, inputs, meta, props, declarationType, usesVisibleRange }`.
- In case of syntax or compilation error, catches exception and returns `{ success: false, error, line, column, errors: [...] }`.

### 5.2 Endpoint `/pine/indicators/catalog`
- Serves catalog from `pine_indicators_catalog.json` listing available indicator templates.

---

## 6. Comprehensive Gap Analysis: PineTS vs Official Pine Script v6

| Feature / Area | Official Pine Script v6 Requirement | PineTS Current State | Severity & Recommended Fix |
| :--- | :--- | :--- | :--- |
| **Compiler: Version Header** | `//@version=6` | ✅ Supported (`extractPineScriptVersion` allows `>= 5`) | Complete parity |
| **Compiler: Fractional Division** | Const int division `5 / 2` evaluates to float `2.5` | ✅ Supported (`transpiler/index.ts:146` gates integer truncation to `< 6`) | Complete parity |
| **Compiler: All 9 Inputs** | `int`, `float`, `bool`, `string`, `color`, `timeframe`, `symbol`, `session`, `source` | ✅ Supported in `parser.ts` & `scanInputs.ts` | Complete parity |
| **Compiler: UDTs & Methods** | `type MyType`, `method fn(MyType this)` | ✅ Supported in AST, codegen, and transformer | Complete parity |
| **Compiler: Tuples** | `[a, b] = fn()`, `[a, b] := [x, y]` | ✅ Supported for untyped declarations & reassignments | ⚠️ Gap: `[int a, float b] = ...` fails in `isTupleDestructuring()` |
| **Compiler: Directives** | `indicator()`, `strategy()`, `library()` | ⚠️ `indicator()` and `strategy()` supported; `library()` & `export` are unsupported | ⚠️ Add `library` to `scanDeclaration` and accept `export` in `parser.ts` |
| **Drawing Primitives in Runtime** | `box.new`, `line.new`, `polyline.new`, `label.new`, `table.new` | ✅ Supported in PineTS runtime; serialized into `context.plots` | Complete parity in PineTS engine |
| **Charting Library Bridge (Shapes)** | Render boxes, lines, polylines on chart canvas | ❌ **CRITICAL GAP**: `pine_indicators.js` only has hardcoded shapes for `Sessions [LuxAlgo]`. General indicator drawings are not rendered. | **Bridge needed**: Map `context.plots['__boxes__']`, `__lines__`, `__polylines__` to `chart.createMultipointShape` / `chart.createShape` |
| **Charting Library Bridge (Tables)** | Display on-chart tables | ❌ **CRITICAL GAP**: No table overlay renderer in `pine_indicators.js` | **Bridge needed**: Render `context.plots['__tables__']` into TradingView chart canvas corner overlay |
| **Charting Library Bridge (Plots)** | Run transpiled PineTS function in `this.main` | ❌ **CRITICAL GAP**: `this.main` in `pine_indicators.js` uses keyword heuristic shims (`Std.sma`, `Std.rsi`) rather than executing transpiled PineTS code | **Bridge needed**: Execute compiled PineTS function or evaluate vectorized plot series directly into `this.main` |
| **Input Type Mapping in Metainfo** | All 9 input types mapped to TV Metainfo | ⚠️ `symbol`, `resolution`, `bool`, `color`, `integer`, `float`, `source` mapped; `session` falls back to `text` | **Minor fix**: Map `session` to TradingView Metainfo `session` input |
| **`na` / `NaN` Price Invariance** | `na` plots must output `NaN` without synthetic badges | ⚠️ `pine_indicators.js:1414` has synthetic trend baseline fallback that outputs `c` or `50` | **Fix**: Strictly output `NaN` when plot values are not provided or inactive |

---

## 7. Concrete Implementation Recommendations

1. **Implement Generic Drawing Object Bridge in `pine_indicators.js`**:
   - Hook into the indicator lifecycle (or after execution) to read `context.plots`:
     - For `__boxes__`: iterate boxes and call `chart.createMultipointShape([{ time: b.left, price: b.top }, { time: b.right, price: b.bottom }], { shape: 'rectangle', ... })`.
     - For `__lines__`: call `chart.createMultipointShape([{ time: l.x1, price: l.y1 }, { time: l.x2, price: l.y2 }], { shape: 'trend_line', ... })`.
     - For `__polylines__`: call `chart.createMultipointShape(p.points, { shape: 'polyline', ... })`.
     - For `__labels__`: call `chart.createShape({ time: lbl.x, price: lbl.y }, { shape: 'text', text: lbl.text, ... })`.
2. **Implement Real-time Table Overlay in `pine_indicators.js`**:
   - For `__tables__`: mount a lightweight HTML `div` overlay within `#tv_chart_container`, anchored to the specified position (`top_right`, `bottom_left`, etc.) with dark-themed styling, updating cell contents dynamically.
3. **Connect PineTS Transpiled Execution to `this.main`**:
   - Allow `this.main` to consume genuine per-bar series produced by PineTS execution rather than falling back to keyword heuristic formulas.
4. **Fix Tuple Destructuring with Types in `parser.ts`**:
   - In `isTupleDestructuring()` (`parser.ts:1382`), allow optional type identifiers preceding the variable name (e.g. `[int a, float b] = ...`).
5. **Add `input.session` mapping in `pine_indicators.js`**:
   - Explicitly handle `t === 'session'` -> `tvType = 'session'` with valid session string formatting.
