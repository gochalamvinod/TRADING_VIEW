## 2026-09-11T07:48:04Z
You are teamwork_preview_worker_frontend_1.
Your working directory is: e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_worker_frontend_1
Your parent is orchestrator_14.

MANDATORY INSTRUCTION:
Read the authoritative user request at: e:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md (specifically see header ## 2026-09-11T07:10:27Z).
Read the scope document at: e:\TRADINGVIEW ADVANCED\.agents\orchestrator_14\SCOPE.md.
Read the survey findings at:
- e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_1\analysis.md
- e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_1\handoff.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. An auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

EXCLUSIVE WRITE OWNERSHIP:
You exclusively own:
- pine_editor_ide.js
- pine_indicators.js
- pine_editor.css
Do NOT edit any other files.

YOUR MISSION (Milestones M30, M31, M32 - Requirements R1, R2, R3):
1. R1: Floating Toolbar & Legend { } (Open script in Pine Editor):
   - In pine_editor_ide.js (line 6263), export setDockOpen: (open) => setDockOpen(Boolean(open)) on window.PineEditorIDE so window.PineEditorIDE.setDockOpen(true) works without throwing TypeError.
   - In pine_indicators.js (line 3530) and pine_editor_ide.js, reconcile selectors to accept both [data-name="legend-source-code-action"] and [data-name="legend-pine-action"] and .tv-legend-code-btn.
   - Ensure the authentic { } button appears on hover on every indicator/study item in the chart legend and on the floating toolbar (.tv-floating-toolbar) alongside eye and settings buttons.
   - Ensure clicking { } opens/expands the Pine Editor dock (window.PineEditorIDE.setDockOpen(true)), loads the indicator's source code into #pine_code_input, and focuses the editor without native browser popups.
2. R2: Legend Interaction & Defect Polish:
   - In pine_editor_ide.js (line 5930), constrain the titleTarget click hook strictly to main series items using:
     titleTarget.closest('[data-name="legend-series-item"], [class*="series-"]')
     Ensure clicking the main series symbol (XAUUSD.) immediately opens the Symbol Search modal (activeChart.executeActionById('symbolSearch')), while clicking indicator study titles does NOT open symbol search.
   - Ensure 3-dots (•••) button on main series legend item (legend-more-action) is visible on hover and opens the series context menu.
   - Remove duplicate elements: eliminate circular placeholder logo badge ([X]) and remove redundant side-by-side ticker/description (clean "XAUUSD. • 1 • MetaTrader5"). In index.html, ensure layout save/restore uses 'ticker' rather than forcing 'ticker-and-description'.
3. R3: Dark Theme & Zero Browser Popups:
   - In pine_editor.css (lines 2699-2728), replace hardcoded #ffffff and #131722 in .pine-console-toggle-btn-v2 and .pine-status-item-v2 with dark theme tokens (#2a2e39, #363a45, #d1d4dc, #787b86). Ensure the entire Pine Editor workspace, gutter, textarea, minimap, status bar, and console drawer stay authentic dark (#131722 / #1e222d / #2a2e39 / #d1d4dc) without white flashes.
   - Zero native browser alert(), confirm(), prompt() popups. Everything must use in-chart modals/toasts.

VERIFICATION:
- Test your changes using node scratch/test_all_buttons_regression.js or your own verification script.
- Confirm 0 native dialogs triggered.
- Write your completion report to e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_worker_frontend_1\handoff.md.
- Send a completion message to parent when finished.
