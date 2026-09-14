# Dispatch Assignment — Worker M21 (UI & Authentic Bottom Dock)

**Identity**: teamwork_preview_worker (worker_m21_ui_dock)
**Working Directory**: e:\TRADINGVIEW ADVANCED\.agents\worker_m21_ui_dock
**Parent**: orchestrator_7 (Conversation ID: 629ecdbb-bdd9-4267-83c2-050d30aba17d)
**Authoritative Request**: e:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md and e:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md
**Scope Document**: e:\TRADINGVIEW ADVANCED\.agents\orchestrator_7\PROJECT.md
**Investigation Findings**: e:\TRADINGVIEW ADVANCED\.agents\explorer_survey_orch7_2\handoff.md and e:\TRADINGVIEW ADVANCED\.agents\explorer_survey_orch7_2\analysis.md

## Exclusive File Ownership:
You own EXCLUSIVELY:
- `e:\TRADINGVIEW ADVANCED\pine_editor_ide.js`
- `e:\TRADINGVIEW ADVANCED\pine_editor.css`
- `e:\TRADINGVIEW ADVANCED\index.html`
You must NOT modify any other files.

## Mandatory Integrity Warning:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Tasks & Implementation Requirements:
1. **Enforce Study Editability (`lock: false`)**:
   - In `pine_editor_ide.js` and `index.html`, ensure study creation passes `lock: false` (`await chart.createStudy(studyName, isOverlay, false)`) so `userEditEnabled() === true`.
   - Verify hover action buttons (👁️ Hide/Show, ⚙️ Settings/Format, 🗑️ Delete) are active.
2. **Authentic TradingView Bottom UI Overhaul ("bottom fix them")**:
   - CRITICAL USER DIRECTIVE: Remove any slapped-on `#bottom_dock_tabs`, remove tree emoji `🌲` and emoji buttons.
   - Integrate Pine Editor and Pine Logs into TradingView's native bottom dock tab area with authentic dark theme styling (`#131722` bg, `#1e222d` gutter, `#2a2e39` border, monochrome SVGs).
   - Coordinate visibility cleanly with Account Manager (`.layout__area--bottom`, `setAccountManagerVisibilityMode`) so they do not clash or stack clunky double bottom bars.
3. **All 8 Reference Templates in Editor**:
   - Add all 8 Pine v5 templates to the Pine Editor dropdown ("Built-in Templates"): SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume.
4. **Validation**:
   - Verify syntax with `node -c pine_editor_ide.js`.

Write your report to `handoff.md` in your working directory and notify parent via `send_message`.
