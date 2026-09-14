# DISPATCH — worker_m32_gen2

## Mission: M32 — Pine Editor IDE Integration & Lifecycle Sync

You are `worker_m32_gen2`. Your working directory is:
`E:\TRADINGVIEW ADVANCED\.agents\worker_m32_gen2`

### Exclusive File Ownership:
- `E:\TRADINGVIEW ADVANCED\pine_editor_ide.js`

### Reference & Context Files (Read-only):
- `E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md` (Authoritative user request)
- `E:\TRADINGVIEW ADVANCED\.agents\orchestrator_11\PROJECT.md` (Project architecture & interface contracts)
- `E:\TRADINGVIEW ADVANCED\.agents\explorer_tv_plotter_ide\handoff.md` (Plotter & IDE investigation findings)
- `E:\TRADINGVIEW ADVANCED\.agents\explorer_tv_plotter_ide\report.md` (Detailed IDE drawer, createStudy options, and lifecycle analysis)

### Objectives & Deliverables:
1. **Interactive Click-to-Jump Line/Col Diagnostics Drawer**:
   - In `pine_editor_ide.js`, ensure compiler error diagnostics cleanly render error messages with exact `line` and `column` numbers in the bottom compiler drawer (`#pine_compiler_drawer`).
   - Clicking an error entry in the drawer must invoke `jumpToLineAndCol(line, column)`, positioning the editor cursor, scrolling into view, and highlighting the error line.
2. **One-Click Compile & "Add to Chart" with Full Legend Controls**:
   - In `pine_editor_ide.js`, ensure "Add to chart" button compiles the active editor script via `window.PineTSLib.pineToJS` (or backend proxy), dynamically registers the study descriptor with TradingView's `Kv.JSServer.studyLibrary`, and invokes `chart.createStudy(studyName, isOverlay, false, [], { lock: false })`.
   - The `{ lock: false }` option is mandatory so that hovering over the study in the chart legend reveals all three standard action buttons:
     - Hide/Show (👁️): toggles series visibility.
     - Format/Settings (⚙️): opens native TradingView study properties modal.
     - Remove/Delete (🗑️): completely removes the study from the chart and invokes `clearStudyShapes` to purge all associated shapes and tables.
3. **Real-Time Chart Lifecycle Sync**:
   - Ensure the indicator engine synchronizes with chart lifecycle events:
     - On symbol change: re-evaluate script on new symbol history and re-render shapes.
     - On timeframe/resolution change: re-evaluate script on new resolution data.
     - On streaming ticks: update active bar calculations smoothly.
4. **Verify and Test**:
   - Verify against Tier 3 tests from `tests/test_pinescript_v6_e2e.py`.
   - Document all verification commands and outputs in `handoff.md`.

### MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

### Protocol:
- Update `progress.md` after each step with `Last visited: [timestamp]`.
- Write `handoff.md` with Observation, Logic Chain, Caveats, Conclusion, and Verification commands + outputs.
- Notify orchestrator (`parent`) via `send_message` when done.
