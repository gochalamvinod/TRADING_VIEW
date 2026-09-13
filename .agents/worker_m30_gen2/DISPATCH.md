# DISPATCH — worker_m30_gen2

## Mission: M30 — Pine Script v6 Compiler & AST Engine

You are `worker_m30_gen2`. Your working directory is:
`E:\TRADINGVIEW ADVANCED\.agents\worker_m30_gen2`

### Exclusive File Ownership:
- `E:\TRADINGVIEW ADVANCED\PineTS-main\` (all source and tests)
- `E:\TRADINGVIEW ADVANCED\server.py` (FastAPI /pine/ endpoints)
- `E:\TRADINGVIEW ADVANCED\pinets.bundle.js` (root distribution bundle)

### Reference & Context Files (Read-only):
- `E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md` (Authoritative user request)
- `E:\TRADINGVIEW ADVANCED\.agents\orchestrator_11\PROJECT.md` (Project architecture & contracts)
- `E:\TRADINGVIEW ADVANCED\.agents\explorer_pinets_v6_compiler\handoff.md` (Compiler investigation findings)
- `E:\TRADINGVIEW ADVANCED\.agents\explorer_pinets_v6_compiler\report.md` (Detailed AST & runtime analysis)
- `E:\TRADINGVIEW ADVANCED\.agents\spec_miner_pinescript_v6\report.md` (Pine v6 manual & syntax spec)

### Objectives & Deliverables:
1. **Fix Typed Tuple Destructuring**:
   - In `PineTS-main/src/transpiler/pineToJS/parser.ts`, update `isTupleDestructuring()` and `parseTupleDestructuring()` to support typed tuple declarations (e.g. `[int a, float b] = ...` or `[float o, float c] = request.security(...)`).
   - Run tests in `PineTS-main/tests/transpiler/pine-v6-features.test.ts`.
2. **Version 6 Headers & Directives**:
   - Ensure `//@version=6` and directives (`indicator`, `strategy`, `library`) are parsed and processed cleanly.
   - Verify fractional division preservation in v6 (`5 / 2 = 2.5` vs v5 integer division).
3. **All 9 Input Types Extraction**:
   - In `PineTS-main/src/Indicator/scanInputs.ts`, ensure all 9 input functions (`input.int`, `input.float`, `input.bool`, `input.string`, `input.color`, `input.timeframe`, `input.symbol`, `input.session`, `input.source`) extract cleanly via `Indicator.from(source).getInputsMeta()` with proper types, min, max, step, defval, options.
4. **UDTs, Custom Methods, Namespaces**:
   - Ensure `type` (UDTs) and `method` definitions compile and execute without errors.
5. **Accurate Error Diagnostics**:
   - Ensure parse/lex/compile errors produce exact `line` and `column` numbers, message, and severity.
6. **Rebuild Bundles**:
   - Run build in `PineTS-main` (e.g., `npm run build`) to produce updated `dist/pinets.min.browser.js`, `dist/pinets.min.cjs`, and copy bundle to `E:\TRADINGVIEW ADVANCED\pinets.bundle.js` and `PineTS-main/dist/`.
7. **FastAPI Server Integration**:
   - Verify `server.py` `/pine/transpile` and `/pine/indicators/catalog` use the updated `pinets.min.cjs`.
8. **Run Build & Tests**:
   - Run `npx vitest run` in `PineTS-main` for v6 feature tests and UDT tests.
   - Run Tier 1 compiler tests from `tests/test_pinescript_v6_e2e.py` (via pytest or python).
   - Document all test commands and exact outputs in `handoff.md`.

### MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Protocol:
- Update `progress.md` after each step with `Last visited: [timestamp]`.
- Write `handoff.md` with Observation, Logic Chain, Caveats, Conclusion, and Verification commands + outputs.
- Notify orchestrator (`parent`) via `send_message` when done.

## 2026-09-10T04:48:29Z
You are worker_m30_gen2. Your working directory is:
E:\TRADINGVIEW ADVANCED\.agents\worker_m30_gen2

Core Tasks:
1. Fix typed tuple destructuring in PineTS parser (`PineTS-main/src/transpiler/pineToJS/parser.ts`: `isTupleDestructuring()` and `parseTupleDestructuring()`) so typed declarations like `[int a, float b] = ...` parse cleanly. Run `tests/transpiler/pine-v6-features.test.ts`.
2. Ensure full support for `//@version=6` and compiler directives (`indicator`, `strategy`, `library`), and fractional division preservation in v6.
3. Ensure all 9 input types extract cleanly via `Indicator.from(source).getInputsMeta()` with parameters and defaults.
4. Ensure UDTs (`type`), custom methods (`method`), tuples, and namespaces compile and evaluate cleanly.
5. Ensure error diagnostics report exact line and column numbers.
6. Rebuild bundles (`npm run build` in PineTS-main) and copy bundle to `pinets.bundle.js`.
7. Verify `server.py` `/pine/transpile` and `/pine/indicators/catalog` endpoints.
8. Run vitest in PineTS-main and Tier 1 compiler tests from `tests/test_pinescript_v6_e2e.py`.
9. Document results in `handoff.md` with verification commands and outputs, and send completion message via `send_message` to parent.

