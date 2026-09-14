# BRIEFING — 2026-09-10T04:35:00Z

## Mission
Implement seamless Pine Editor IDE integration and real-time chart lifecycle synchronization across pine_editor_ide.js and pine_editor.css.

## 🔒 My Identity
- Archetype: worker
- Roles: implementer, qa, specialist
- Working directory: E:\TRADINGVIEW ADVANCED\.agents\worker_m32_ide_sync
- Original parent: 25e28c44-8e5d-46a0-82d2-727cfcc254e4
- Milestone: M32 - Pine Editor IDE Integration & Lifecycle Sync

## 🔒 Key Constraints
- Exclusively own and modify:
  - `E:\TRADINGVIEW ADVANCED\pine_editor_ide.js`
  - `E:\TRADINGVIEW ADVANCED\pine_editor.css`
- DO NOT touch `PineTS-main/`, `server.py`, or `pine_indicators.js`.
- No fake/dummy implementations; strictly genuine AST/compiler error catching, interactive jump-to-line, study registration with `{ lock: false }`, and real-time chart lifecycle hooks.

## Current Parent
- Conversation ID: 25e28c44-8e5d-46a0-82d2-727cfcc254e4
- Updated: not yet

## Task Summary
- **What to build**:
  1. Pine Editor IDE Compiler Drawer & Diagnostics:
     - Catch compiler errors from PineTS/transpiler and display exact line, column, severity, and message in the compiler drawer.
     - Interactive jump-to-code navigation: `jumpToLineAndCol(line, col)` to position cursor, focus textarea, and highlight error line.
  2. One-Click Compile & "Add to chart":
     - Compile code via PineTS, register transpiled study into `window._customPineStudies` and `JSServer.studyLibrary` (or `chart.studyMetaInfoRepository()`).
     - Call `chart.createStudy(studyName, isOverlay, false, [], { lock: false })`.
     - Passing `{ lock: false }` ensures that hovering over the indicator in the chart legend shows standard TradingView action buttons: Hide/Show (👁️), Settings (⚙️), Delete (🗑️), triggering cleanup of associated shapes/tables.
  3. Real-Time Lifecycle Sync:
     - On symbol change (`chart.onSymbolChanged()`), timeframe/resolution change (`chart.onIntervalChanged()`), or streaming tick arrivals, trigger study re-evaluation and shape re-anchoring.
     - Connect dynamic input changes from the format modal back into the study runtime.
- **Success criteria**: Genuine integration passing test verification and end-to-end audit.

## Key Decisions Made
- Expose `window.jumpToLineAndCol(line, col)` and `PineEditorIDE.jumpToLineAndCol(line, col)` as global and module methods.
- Implement robust error extraction supporting all PineTS / Lexer / Parser / Backend error string formats.
- Enforce `window._customPineStudies` array registration and dual `JSServer.studyLibrary` / `chart.studyMetaInfoRepository()` synchronization.
- Implement shape tracking in `window.PineStudyShapeRegistry` and hook cleanup on study deletion.
- Wire chart lifecycle subscriptions (`onSymbolChanged`, `onIntervalChanged`, and tick monitoring) directly to study recalculation and shape re-anchoring.

## Artifact Index
- `pine_editor_ide.js` — Pine Editor IDE dock, compiler drawer, jump navigation, add to chart, lifecycle sync
- `pine_editor.css` — Styling for compiler drawer, error badges, jump highlight animations
- `tests/test_m32_ide_sync.js` — Automated test suite verifying compiler diagnostics, jump-to-code, study registration with `{ lock: false }`, and lifecycle sync hooks.
