# Worker M32 Dispatch: Seamless Pine Editor IDE Integration & Lifecycle Sync

## Objective
Implement seamless Pine Editor IDE integration and real-time chart lifecycle synchronization:
1. File Write Ownership: Exclusively `pine_editor_ide.js` and `pine_editor.css`. (Do NOT edit `PineTS-main/`, `server.py`, or `pine_indicators.js`).
2. Pine Editor IDE Compiler Drawer & Diagnostics:
   - Catch compiler errors from PineTS/transpiler and display exact line, column, severity, and message in the compiler drawer.
   - Wire interactive jump-to-code navigation: clicking an error in the drawer calls `jumpToLineAndCol(line, col)` to position cursor, focus textarea, and highlight error line.
3. One-Click Compile & "Add to chart":
   - Compile code via PineTS, register transpiled study into `window._customPineStudies` and `JSServer.studyLibrary` (or `chart.studyMetaInfoRepository()`).
   - Call `chart.createStudy(studyName, isOverlay, false, [], { lock: false })`.
   - Passing `{ lock: false }` ensures that when hovering over the indicator in the chart legend, standard TradingView action buttons appear and function cleanly:
     - Hide/Show (👁️) toggles visibility.
     - Settings (⚙️) opens the native format modal.
     - Delete (🗑️) removes the study and triggers cleanup of associated shapes/tables.
4. Real-Time Lifecycle Sync:
   - On symbol change (`chart.onSymbolChanged()`), timeframe/resolution change (`chart.onIntervalChanged()`), or streaming tick arrivals, trigger study re-evaluation and shape re-anchoring.
   - Connect dynamic input changes from the format modal back into the study runtime.

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Run tests, document results in `handoff.md`, and notify the orchestrator when complete.
