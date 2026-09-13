# Plan — Project Orchestrator (orchestrator_12)

## Goal
Implement 4 major features for the TradingView Advanced Pine Script IDE with 100% 1:1 visual parity to TradingView:
1. R1: Authentic Indicator Settings Dialog (tabbed modal, group headers, inline flex row, session pickers, color pickers, bool/string/source pickers, tooltip icons, defaults dropdown, 1:1 dark theme)
2. R2: Pine Script Version Converter with Floating Lightbulb & Side-by-Side Diff Modal (bulb on //@version=N < 6, Quick Fix menu, full v1->v6 migration engine, synchronized diff modal, apply/recompile action)
3. R3: Unified Dark/Light Theme Architecture with Settings Integration (CSS custom properties, zero hardcoded hex/!important, Editor Settings dialog from ••• menu, PineEditorIDE.setTheme API, chart+editor sync, localStorage persistence)
4. R4: Universal Multi-Version Pine Script Runtime (v1-v6 compatibility layer in pine_indicators.js, bare functions, bare colors, study->indicator, security->request.security, tostring, input bare, plot/plotshape/plotcandle/hline/fill, historical series indexing)

## Step-by-Step Execution Plan

### Phase 1: Survey & Discovery (Parallel Explorers & Spec Miner)
- Explorer 1 (R1 Settings Dialog): Investigate `pine_indicators.js` (lines 862-999 parsePineMetadata, getInputsMeta), indicator execution, and UI dialog patterns.
- Explorer 2 (R2 Version Converter): Investigate CodeMirror gutter setup in `pine_editor.js`, quick-fix floating menu mechanics, diff modal architecture, and `pinescriptv6_complete_reference.md`.
- Explorer 3 (R3 Theme Architecture): Investigate `pine_editor.css`, `index.html` setAppTheme, TradingView widget theme change, and settings modal triggers.
- Explorer 4 (R4 Multi-Version Runtime): Investigate `pine_indicators.js` runtime evaluator around line 1862, barEvaluator injection, bare functions/colors, series indexing.
- Spec Miner (E2E & Test Strategy): Examine existing test harnesses, test scripts, and define test tier requirements.

### Phase 2: Implementation & Dual-Track Execution (Concurrent Workers)
- Worker 1 (R1 Dialog UI & Logic): Implement settings modal HTML/CSS/JS in `pine_indicators.js` / `pine_editor.js`.
- Worker 2 (R2 Version Converter & Diff): Implement `PineVersionConverter`, gutter bulb marker, Quick Fix popover, and side-by-side diff modal.
- Worker 3 (R3 Theme System & Settings Modal): Refactor `pine_editor.css` to CSS custom properties, implement Editor Settings modal replacing alert, update `setTheme` API.
- Worker 4 (R4 Runtime Compatibility): Enhance `pine_indicators.js` runtime to support v1-v6 bare functions, colors, series indexing, and study/security aliases.
- Test Writer (Test Infra & Test Suite): Create automated Node.js and browser test suites verifying all 4 features.

### Phase 3: Verification & Auditing
- Reviewer 1 (Frontend & UI Parity): Verify 1:1 TradingView aesthetic, styling, CSS variables, and interaction behaviors.
- Reviewer 2 (Runtime & Transpiler Logic): Verify PineScript conversion logic and multi-version runtime execution.
- Challenger 1 (Adversarial Edge Cases): Test complex Pine scripts (LuxAlgo, v1-v6 edge cases, malformed scripts, theme switches).
- Challenger 2 (Diff & Conversion Stress): Test chained upgrades v1->v6, diff modal scrolling, line mapping.
- Forensic Auditor: Conduct integrity audit (ensure no dummy/facade implementations, genuine parsing and execution).

### Phase 4: Final Synthesis & Sentinel Notification
- Verify all E2E tests pass.
- Write handoff and detailed completion report to Sentinel.
