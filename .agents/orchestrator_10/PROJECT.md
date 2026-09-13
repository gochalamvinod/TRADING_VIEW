# Project: Pine Script v6 Compiler, Runtime Evaluator, and Authentic Plotter Engine

## Architecture
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             TradingView Frontend                                 │
│                                                                                  │
│  ┌─────────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐ │
│  │   TradingView Widget    │  │  Pine Editor IDE Drawer│  │  PineTS v6 AST     │ │
│  │  (TT v29.6.0 Standalone)│  │ (jump-to-code,compile) │  │  Compiler & Runtime│ │
│  └────────────┬────────────┘  └───────────┬────────────┘  └──────────┬─────────┘ │
│               │                           │                          │           │
│               │ custom_indicators_getter  │ "Add to chart"           │           │
│               ▼                           ▼                          │           │
│  ┌───────────────────────────────────────────────────────────────────▼─────────┐ │
│  │   pine_indicators.js (Metainfo v52/53, Main Evaluator, Drawing Dispatcher) │ │
│  │   - plot/plotcandle/plotbar/plotshape/plotchar/plotarrow/hline/fill         │ │
│  │   - plottype: 7 (LineWithBreaks) for strict na/NaN invariance               │ │
│  │   - display: 11 (mask 4) to suppress synthetic price scale badges          │ │
│  │   - Native Shapes: box.new (rectangle), line.new (trend_line/vert_line)    │ │
│  │   - Table: table.new/cell HTML overlay container                           │ │
│  └────────────────────────────────────────┬───────────────────────────────────┘ │
│                                           │ HTTP :9000
┌───────────────────────────────────────────▼───────────────────────────────────┐
│                    FastAPI Backend & Proxy (:9000)                            │
│  - /pine/transpile (PineTS v6 AST transpiler in Node subprocess)              │
│  - /pine/indicators/catalog (v6 catalog)                                      │
└───────────────────────────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|:------:|
| F44 | Pine Script v6 Compiler & AST Engine | Header `//@version=6`, directives `indicator/strategy/library`, 9 inputs, UDTs (`type`), `method`, tuples, line:col compile diagnostics | M30 | ORIGINAL_REQUEST §R1 | **PLANNED** |
| F45 | Authentic Visual Output & Plotter Engine | Metainfo v52/53 descriptors for all 8 plot types, packed 32-bit ARGB colors (`isRGB: true`), strict `na`/`NaN` invariance via `plottype: 7` (`skipHoles: false`) and `display: 11` (suppress axis badges) | M31 | ORIGINAL_REQUEST §R2 | **PLANNED** |
| F46 | Native Shapes, Session Shading & Drawing Primitives | `box.new` (`rectangle`), `line.new` (`trend_line`/`vertical_line`), `polyline.new`, `table.new`/`cell`, `label.new`, multi-day dividers, LuxAlgo Sessions shading | M31 | ORIGINAL_REQUEST §R2 | **PLANNED** |
| F47 | Pine Editor IDE Integration & Lifecycle Sync | Clickable compile diagnostics (`jumpToLineAndCol`), one-click compile & "Add to chart" with `lock: false` for legend hover buttons (Eye, Cogwheel Settings, Delete), symbol/tf/tick sync | M32 | ORIGINAL_REQUEST §R3 | **PLANNED** |
| F48 | Comprehensive E2E Verification & Forensic Integrity Audit | Headless browser automated tests: LuxAlgo Sessions compilation, 0 false positives, shaded session boxes, 0 stacked badges, 0 artificial flat lines, clean candles | M33 | ORIGINAL_REQUEST §Acceptance Criteria | **PLANNED** |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|:------:|
| M30 | Pine Script v6 Compiler & AST Engine | `PineTS-main/`, `server.py`: AST parser for v6, typed tuple fix, 9 inputs metadata extraction, exact line:col diagnostics | none | **IN_PROGRESS** |
| M31 | Authentic Visual Output & Plotter Engine (Zero Diversion) | `pine_indicators.js`, `index.html`: Metainfo v52/53 for all 8 plot types, `plottype: 7` (`LineWithBreaks`), `display: 11`, `chart.createMultipointShape` / `chart.createShape` dispatcher for `box`/`line`/`polyline`/`label`, HTML table container | M30 | **PLANNED** |
| M32 | Pine Editor IDE Integration & Lifecycle Sync | `pine_editor_ide.js`, `index.html`: Compiler drawer error navigation, one-click add to chart with `lock: false`, real-time lifecycle sync on symbol/timeframe/tick | M30, M31 | **PLANNED** |
| M33 | Comprehensive E2E Verification & Forensic Integrity Audit | `tests/test_pinescript_v6_e2e.py`: Automated headless browser verification of LuxAlgo Sessions, 0 false-positive errors, 0 stacked badges, 0 flat lines, clean candles + Forensic Integrity Audit | M30, M31, M32 | **PLANNED** |

## Interface Contracts

### 1. PineTS AST Engine ↔ Pine Editor IDE Drawer
- Compiler result object:
  ```json
  {
    "success": true | false,
    "code": "/* transpiled js */",
    "errors": [
      {
        "line": 4,
        "column": 5,
        "message": "Expected RPAREN but got IDENTIFIER",
        "severity": "error"
      }
    ],
    "inputs": [ ... ],
    "plots": { ... },
    "declarationType": "indicator" | "strategy" | "library"
  }
  ```
- Jump-to-code navigation: `pine_editor_ide.js` calls `jumpToLineAndCol(line, column)` on click of error drawer entry.

### 2. PineTS Runtime Evaluator ↔ TradingView Plotter (`pine_indicators.js`)
- Context plot output:
  - Series plots: numerical arrays in `context.plots[plotName]`. If inactive/undefined, outputs `NaN`.
  - `context.plots['__boxes__']`: array of `{ left, top, right, bottom, bgcolor, border_color, border_width, border_style, xloc }`.
  - `context.plots['__lines__']`: array of `{ x1, y1, x2, y2, color, width, style, extend, xloc }`.
  - `context.plots['__polylines__']`: array of `{ points, curved, closed, line_color, fill_color }`.
  - `context.plots['__tables__']`: array of `{ position, columns, rows, cells: { [r_c]: { text, bgcolor, text_color, text_size, text_halign, text_valign } } }`.
  - `context.plots['__labels__']`: array of `{ x, y, text, color, textcolor, style, size }`.

### 3. Visual Invariance Contracts
- `plottype: 7` (`LineStudyPlotStyle.LineWithBreaks`) for all piecewise and session plots.
- `display: 11` ($15 - 4$) to strictly suppress price axis badge creation for non-price or inactive plots.
- All shapes instantiated via `chart.createMultipointShape` / `chart.createShape` tagged with `studyId` and cleared deterministically via `clearStudyShapes(studyId)` on recalculation, symbol change, or study removal.
