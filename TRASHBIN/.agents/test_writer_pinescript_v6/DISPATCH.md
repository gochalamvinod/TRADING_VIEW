# Test Writer Dispatch: Pine Script v6 Automated E2E Test Suite (Tiers 1-4)

## Objective
Design and implement an automated headless browser test suite in `tests/test_pinescript_v6_e2e.py` (and/or Node Playwright script) verifying Pine Script v6 requirements from `ORIGINAL_REQUEST.md`:
1. File Write Ownership: Exclusively `tests/test_pinescript_v6_e2e.py` and test support files in `tests/`. (Do NOT modify application code).
2. Test Suite Structure:
   - **Tier 1 (Compiler & Diagnostics)**:
     - `//@version=6` scripts with all 9 input types (`input.int`, `input.float`, `input.bool`, `input.string`, `input.color`, `input.timeframe`, `input.symbol`, `input.session`, `input.source`) compile cleanly with 0 false-positive errors.
     - Scripts with syntax errors report exact line, col, and message, and interactive jump-to-code navigation in the IDE drawer positions the cursor properly.
     - Fractional division in v6 preserves decimals (`5 / 2 = 2.5`).
     - UDTs (`type`), methods, and tuples compile and execute correctly.
   - **Tier 2 (Visual Parity & Absence of Artifacts)**:
     - Adding `scratch_luxalgo.pine` (Sessions [LuxAlgo]) produces shaded session boxes (London, New York, Tokyo, Sydney) and vertical dashed day dividers.
     - Exactly 0 stacked price badges on the price scale for inactive plots.
     - Exactly 0 artificial flat horizontal price lines across inactive market periods or time gaps (`skipHoles: false` / `LineWithBreaks`).
     - Clean candlestick chart without time distortion.
   - **Tier 3 (IDE Integration & Legend Controls)**:
     - Hovering over indicator in chart legend reveals Hide/Show (👁️), Format/Settings (⚙️), and Remove/Delete (🗑️) buttons.
     - Clicking Settings opens format dialog; clicking Delete removes study and its shapes; clicking Hide toggles visibility.
     - Real-time chart lifecycle sync on symbol/timeframe changes.
   - **Tier 4 (Real-world Workload / Scratch LuxAlgo Verification)**:
     - Full integration run on live or mock datafeed verifying canvas render, shapes count, and absence of errors in browser console.
3. Test Runner & Execution:
   - Provide command to run the suite (e.g. `python tests/test_pinescript_v6_e2e.py` or pytest).
   - Document pass/fail criteria and write `TEST_READY.md` upon completion.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All tests must be genuine and execute against the real browser or server runtime. DO NOT mock out assertions or hardcode passing results. A teamwork_preview_auditor will independently inspect your test harnesses.

Document your test implementation in `handoff.md`.

## 2026-09-10T04:31:04Z
You are test_writer_pinescript_v6, an expert test engineer and automated QA specialist.
Your working directory is: E:\TRADINGVIEW ADVANCED\.agents\test_writer_pinescript_v6

MANDATORY FIRST STEP: Read the authoritative user request at:
E:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md

Read your dispatch instructions at:
E:\TRADINGVIEW ADVANCED\.agents\test_writer_pinescript_v6\DISPATCH.md

Also read the survey reports:
- E:\TRADINGVIEW ADVANCED\.agents\spec_miner_pinescript_v6\report.md
- E:\TRADINGVIEW ADVANCED\.agents\explorer_tv_plotter_ide\report.md
- E:\TRADINGVIEW ADVANCED\.agents\explorer_pinets_v6_compiler\report.md

Your scope and write ownership:
You EXCLUSIVELY own and create:
- E:\TRADINGVIEW ADVANCED\tests\test_pinescript_v6_e2e.py
- Any supporting test fixtures/scripts in E:\TRADINGVIEW ADVANCED\tests\
(DO NOT modify application source code).

Tasks:
Build a comprehensive 4-tier automated test suite:
- Tier 1: Pine Script v6 compiler & diagnostics:
  - All 9 input types compile with 0 false-positive errors.
  - Syntax errors report exact line, col, and message with interactive jump-to-code navigation.
  - Fractional division in v6 preserves decimals (`5 / 2 = 2.5`).
  - UDTs, methods, and tuples compile and execute correctly.
- Tier 2: Visual parity & absence of artifacts:
  - Adding Sessions [LuxAlgo] (`scratch_luxalgo.pine`) produces shaded session boxes (London, New York, Tokyo, Sydney) and vertical dashed day dividers.
  - Exactly 0 stacked price badges on the price scale for inactive plots.
  - Exactly 0 artificial flat horizontal price lines across inactive market periods (`skipHoles: false` / `plottype: 7`).
  - Clean candlestick chart without time distortion.
- Tier 3: IDE integration & legend controls:
  - Study hover action buttons: Hide/Show (👁️), Settings (⚙️), Delete (🗑️).
  - Opening settings opens format modal; clicking delete removes study and its shapes.
  - Real-time chart lifecycle sync on symbol/timeframe changes.
- Tier 4: Real-world workload integration test.

Publish `TEST_READY.md` at project root (`E:\TRADINGVIEW ADVANCED\TEST_READY.md`) summarizing the test suite, test commands, tiers, and coverage.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All tests must be genuine and execute against the real browser or server runtime. DO NOT mock out assertions or hardcode passing results. A teamwork_preview_auditor will independently inspect your test harnesses.

Run tests and document results in:
E:\TRADINGVIEW ADVANCED\.agents\test_writer_pinescript_v6\handoff.md
Send a completion message back to the orchestrator with send_message when done.

