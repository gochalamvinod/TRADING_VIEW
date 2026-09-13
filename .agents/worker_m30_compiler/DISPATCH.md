# Worker M30 Dispatch: Pine Script v6 Compiler & AST Engine

## Objective
Implement exhaustive Pine Script v6 compiler and AST engine enhancements:
1. File Write Ownership: Exclusively `PineTS-main/` and `server.py`. (Do NOT edit `pine_indicators.js` or `pine_editor_ide.js`).
2. Implement typed tuple destructuring in `PineTS-main/src/transpiler/pineToJS/parser.ts`: support declarations like `[int a, float b] = ...` in `isTupleDestructuring()` and `parseTupleDestructuring()`.
3. Ensure `//@version=6` is accepted and enforces Pine v6 rules:
   - Preserve fractional division of constants (`5 / 2 = 2.5`).
   - Support `indicator()`, `strategy()`, `library()` declaration statements.
   - Support all 9 input functions: `input.int`, `input.float`, `input.bool`, `input.string`, `input.color`, `input.timeframe`, `input.symbol`, `input.session`, `input.source`, including the v6 `active` parameter.
   - Extract full input metadata via `Indicator.from(source).getInputsMeta()`.
   - Ensure UDTs (`type`), custom methods (`method`), tuples, and namespaces compile cleanly.
4. Compiler diagnostics: Ensure parser and compiler throw errors with exact line and column numbers formatted for easy extraction (`line:col` or structured error objects) so the IDE drawer can jump to exact coordinates.
5. Rebuild `pinets.bundle.js` and `pinets.min.cjs` via `npm run build` in `PineTS-main` (or bundle step) so browser and Node bundles are updated.
6. Verify `/pine/transpile` and `/pine/indicators/catalog` in `server.py` accept Pine v6 scripts (including `scratch_luxalgo.pine`) and return `{ success: true, ... }` or detailed diagnostic errors.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.



## 2026-09-10T04:31:04Z
<USER_REQUEST>
You are worker_m30_compiler, an expert TypeScript/JavaScript and Python systems engineer.
Your working directory is: E:\TRADINGVIEW ADVANCED\.agents\worker_m30_compiler

MANDATORY FIRST STEP: Read the authoritative user request at:
E:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md

Read your dispatch instructions at:
E:\TRADINGVIEW ADVANCED\.agents\worker_m30_compiler\DISPATCH.md

Also read the survey reports:
- E:\TRADINGVIEW ADVANCED\.agents\explorer_pinets_v6_compiler\report.md
- E:\TRADINGVIEW ADVANCED\.agents\spec_miner_pinescript_v6\report.md

Your scope and write ownership:
You EXCLUSIVELY own and modify:
- E:\TRADINGVIEW ADVANCED\PineTS-main/
- E:\TRADINGVIEW ADVANCED\server.py
(DO NOT touch pine_indicators.js or pine_editor_ide.js).

Tasks:
1. Fix typed tuple destructuring in PineTS parser (`PineTS-main/src/transpiler/pineToJS/parser.ts`): allow declarations like `[int a, float b] = ...` in `isTupleDestructuring()` and `parseTupleDestructuring()`.
2. Ensure full support for `//@version=6` and compiler directives (`indicator`, `strategy`, `library`).
3. Ensure all 9 input types (`int`, `float`, `bool`, `string`, `color`, `timeframe`, `symbol`, `session`, `source`) with their parameters and defaults extract cleanly via `Indicator.from(source).getInputsMeta()`.
4. Ensure UDTs (`type`), custom methods (`method`), tuples, and namespaces compile cleanly.
5. Error diagnostics: Ensure parser and compiler report exact line and column numbers formatted for easy extraction (`line:col` or structured error objects) so the IDE drawer can jump to exact coordinates.
6. Rebuild `pinets.bundle.js` and `pinets.min.cjs` via `npm run build` in `PineTS-main` (or bundle step) so browser and Node bundles are updated.
7. Verify `/pine/transpile` and `/pine/indicators/catalog` in `server.py` accept Pine v6 scripts (including `scratch_luxalgo.pine`) and return `{ success: true, ... }` or detailed diagnostic errors.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Run tests and verification commands, document your results in:
E:\TRADINGVIEW ADVANCED\.agents\worker_m30_compiler\handoff.md
Send a completion message back to the orchestrator with send_message when done.
</USER_REQUEST>
