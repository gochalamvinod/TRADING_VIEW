# Explorer 1 Dispatch: PineTS Compiler, AST, and Runtime Architecture

## Objective
Perform an in-depth codebase survey of PineTS compiler, AST engine, and runtime evaluator in `E:\TRADINGVIEW ADVANCED\PineTS-main\`, `pinets.bundle.js`, `pinets.min.cjs`, `server.py`, and related scripts:
1. Examine `PineTS-main/src/` to map:
   - Lexer, parser, AST definition, visitor patterns, code generation/transpilation.
   - Current handling of `//@version=5` vs `//@version=6`.
   - Support for directives (`indicator`, `strategy`, `library`).
   - Support for all 9 `input.*` functions and how metadata is extracted (`ind.getInputsMeta()`).
   - Support for User-Defined Types (`type`), custom methods (`method`), tuples, and namespaces.
   - How compile errors are caught and whether line, column, severity, and AST node locations are preserved.
2. Evaluate runtime evaluator and built-in functions:
   - Built-in series (`open`, `high`, `low`, `close`, `time`, `bar_index`, etc.).
   - Support for `box.new`, `line.new`, `polyline.new`, `table.new`, `table.cell`, `label.new` in PineTS runtime.
   - Built-in session functions (`time(timeframe, session)`, etc.).
3. Analyze `server.py` endpoints (`/pine/transpile`, `/pine/indicators/catalog`) and determine how PineTS is executed on Node/browser.
4. Detail exact gaps between current PineTS state and full Pine Script v6 official spec.

Write your findings to `report.md` and complete `handoff.md`.
