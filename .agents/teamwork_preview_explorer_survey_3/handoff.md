# Handoff Report: Requirement R5 Button & Subbutton Regression Suite with Screenshot Verification

**Agent**: `teamwork_preview_explorer_survey_3`  
**Working Directory**: `e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_3`  
**Timestamp**: 2026-09-11T13:11:00Z  
**Recipient**: `orchestrator_14` (ID: `0660eeb7-cf9a-4416-bdec-e3267ee45261`)

---

## 1. Observation

1. **User Mandate (ORIGINAL_REQUEST.md, lines 725-744)**:
   - "### R5. Complete Button & Subbutton Regression Suite with Screenshot Verification"
   - "Systematically test EVERY button and subbutton across:
     1. Chart Legend: Title click (Symbol Search), Eye button (show/hide), Gear button (Indicator Settings dialog), { } button (Open script in Pine Editor), 3-dots button (Context menu).
     2. Floating Toolbar: Title, Eye, Hexagon/Settings, { } (Open script in Pine Editor), Trash, 3-dots.
     3. Pine Editor: Script title dropdown, New Script modal, Save Script, Add to Chart, Publish Script modal, 3-dots more menu (all 7 sub-items), Settings modal, Version Converter lightbulb & Diff modal, Window controls (_ □ ✕), Console toggle drawer.
     4. Top Toolbar: Symbol search, interval tabs, candle types, fx Indicators button.
     5. Bottom Dock: Pine Editor tab, Strategy Tester tab, Account Manager tab.
   - Capture proof screenshots for each button/interaction and output full audit matrix."
   - Acceptance criteria require 0 native browser dialogs, screenshot proof for all surfaces, dark theme verification, and 100% regression pass rate.

2. **Test Infrastructure Inspection**:
   - `run_e2e_tests.py`: Standard unified test runner defining `TIER_CONFIG` with Tiers 1 through 8 (lines 40-83), using `pytest.main()`, ANSI color output, and summary table formatting.
   - `tests/test_pinescript_v6_e2e.py`: Uses `playwright.sync_api` (`sync_playwright()`), launches Chromium in headless mode, connects to `http://127.0.0.1:9000`, evaluates JS in the page and iframe, and asserts DOM/canvas state.
   - `scratch/test_all_buttons_regression.js`: Implements a 28-step browser regression runner using raw Chrome DevTools Protocol (`fetch('http://127.0.0.1:9222/json/new?...')` and WebSocket), intercepts native dialogs via `Page.javascriptDialogOpening`, and captures screenshots via `Page.captureScreenshot`.
   - Python environment verification: `playwright.sync_api` and `pytest 9.1.1` are fully installed and available (`python -c "from playwright.sync_api import sync_playwright; ..."` exited with 0).
   - Node environment verification: `node -v` returned `v26.3.0`.

3. **DOM & Code Implementation Locations**:
   - **Chart Legend**: In `charting_library/bundles/chart-widget-gui.373398f680e71823f0f1.js` and `pine_editor_ide.js` (lines 5845-5873). Hover actions: `[data-name="legend-show-hide-action"]`, `[data-name="legend-settings-action"]`, `[data-name="legend-more-action"]`, and injected `{ }` button `[data-name="legend-source-code-action"]` (`.tv-legend-code-btn`). Main series title click hook is in `pine_editor_ide.js` (lines 5923-5945) triggering `activeChart.executeActionById('symbolSearch')`.
   - **Floating Toolbar**: In `charting_library/bundles/floating-toolbars.435f06c307950384d090.js` (`.tv-floating-toolbar`) and `pine_editor_ide.js` (lines 5875-5920). Contains drag handle, `[data-name="toggle-visibility"]`, `[data-name="settings"]`, injected `{ }` button `[data-name="source-code"]` (`.tv-floating-code-btn`), `[data-name="remove"]`, and `[data-name="more"]`.
   - **Pine Editor IDE**: In `pine_editor_ide.js` (`#pine_editor_dock`). Contains `#pine_script_dropdown_trigger`, `#pine_menu_create_new` (`#tv_new_script_modal`), `#pine_save_btn`, `#pine_add_to_chart_btn`, `#pine_publish_btn` (`#tv_confirm_modal_overlay`), `#pine_more_btn` (with all 7 sub-items: `#pine_menu_editor_settings`, `#pine_menu_open_new_window`, `#pine_menu_open_new_tab`, `#pine_profiler_switch`, `#pine_menu_pine_logs`, `#pine_menu_release_notes`, `#pine_menu_help`), `#pine_editor_settings_modal`, `.pine-version-bulb` & `#tv_diff_modal_overlay`, window controls (`#pine_win_minimize`, `#pine_win_maximize`, `#pine_win_close`), and `#pine_console_toggle_btn`.
   - **Top Toolbar**: Inside iframe `.layout__area--top`: `button[aria-label="Symbol Search"]`, interval tabs, `button[aria-label="Candles"]`, `button[data-name="open-indicators-dialog"]`.
   - **Bottom Dock**: Inside iframe `#footer-chart-panel`: `#tv_footer_pine_editor_tab button`, `#tv_footer_strategy_tester_tab button`, and `button[data-name="paper_trading"]`.

---

## 2. Logic Chain

1. **From User Request to Scope**:
   - The user requires testing every button and subbutton across 5 specified UI surfaces with screenshot verification, 0 native dialogs, and a complete audit matrix.
   - Therefore, the test suite must systematically trigger every button, wait for the expected visual state or modal, assert DOM and styling invariants, capture a PNG screenshot, and record the result into a test report.

2. **From Infrastructure Inspection to Runner Strategy**:
   - Python Playwright is already installed and proven in `tests/test_pinescript_v6_e2e.py`.
   - `run_e2e_tests.py` is the official test runner for the project.
   - Therefore, implementing `tests/test_button_regression_suite.py` in Python Playwright and registering it as **Tier 9** in `run_e2e_tests.py` ensures seamless integration with the master test runner and automated CI passes.
   - In parallel, maintaining a standalone Node.js CDP test harness (`scripts/run_button_regression.js`) guarantees fast direct headless execution with real-time JSON and Markdown matrix generation.

3. **From UI Component Inspection to Test Selectors**:
   - Every single button across all 5 surfaces has a confirmed selector (either native TradingView `data-name` attributes, specific classes, or explicit IDs added in `pine_editor_ide.js`).
   - Specifically, `{ }` buttons in both Legend and Floating Toolbar invoke `openScriptForStudy(name)` which opens the dock (`setDockOpen(true)`), loads code into `#pine_code_input`, and focuses the editor without native alerts.
   - Version Converter lightbulb `.pine-version-bulb` opens `#pine_quickfix_popover`, which in turn launches `#tv_diff_modal_overlay` with side-by-side diff panes.
   - Every step can be cleanly triggered and asserted using deterministic DOM queries.

4. **From Safety Invariants to Assertion Design**:
   - Native dialogs can be trapped at both the browser engine level (`page.on('dialog')` / CDP `Page.javascriptDialogOpening`) and the JavaScript runtime level (`window.alert` monkey-patching).
   - Visibility can be asserted using both computed styles (`display !== 'none'`, `visibility !== 'hidden'`, `opacity > 0`) and bounding box dimensions.
   - Dark theme can be verified by checking computed RGB values to ensure no pure white (`#ffffff`) background flash occurs on the dock or editor surfaces.

---

## 3. Caveats

1. **FastAPI Backend Dependency**:
   - The browser tests require the backend server to be running on `http://127.0.0.1:9000` to serve `index.html`, quotes, and Pine endpoints. If the server is stopped, tests cannot load the chart.
2. **Chart Ready Timing**:
   - The TradingView Charting Library takes between 5 to 10 seconds to fully initialize the WebGL canvas, load historical bars, and mount the inner iframe. Test scripts must await `window.widget.onChartReady` before attempting to interact with legend or toolbar elements.
3. **Modal Stacking**:
   - Opening multiple modals sequentially requires cleanly closing each modal (e.g., via Escape key, Cancel button, or close icon) before triggering the next button, preventing backdrop blocking.

---

## 4. Conclusion

1. **Complete Automation Feasibility**: All 38 buttons and subbuttons across the 5 target surfaces (Chart Legend, Floating Toolbar, Pine Editor, Top Toolbar, Bottom Dock) have been mapped to precise selectors, proven trigger mechanisms, and deterministic assertions.
2. **Execution Plan**:
   - Build `tests/test_button_regression_suite.py` using Playwright `sync_api`.
   - Wire `run_e2e_tests.py` to include **Tier 9: Button & Subbutton Regression Suite (R5)** with 38 required test cases.
   - Provide standalone Node.js CDP script `scripts/run_button_regression.js` generating `button_regression_audit_matrix.json` and `button_regression_audit_matrix.md`.
   - Store all verified screenshots in `screenshots/` with sequenced filenames `00_baseline_chart_loaded.png` through `38_bottom_dock_account_manager_tab.png`.

---

## 5. Verification Method

1. **Inspection of Survey Deliverables**:
   - View detailed analysis report:
     ```bash
     cat "e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_3\analysis.md"
     ```
   - View handoff report:
     ```bash
     cat "e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_3\handoff.md"
     ```

2. **Execution Commands for Implementation Agent**:
   - Start backend server:
     ```powershell
     python server.py --port 9000
     ```
   - Run existing E2E test suite to verify baseline:
     ```powershell
     python run_e2e_tests.py
     ```
   - Run Playwright Pine Script test suite:
     ```powershell
     pytest tests/test_pinescript_v6_e2e.py -v
     ```
   - Execute button regression suite once implemented:
     ```powershell
     python run_e2e_tests.py --tier 9
     # or standalone
     node scratch/test_all_buttons_regression.js
     ```

3. **Invalidation Conditions**:
   - Any test step triggering a native browser `alert()`, `confirm()`, or `prompt()`.
   - Any failure of `{ }` button to expand the editor dock or load the script.
   - Missing or incomplete Diff Modal during Version Converter testing.
   - Regression pass rate below 100%.
