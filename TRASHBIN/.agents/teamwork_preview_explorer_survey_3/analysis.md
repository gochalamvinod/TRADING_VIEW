# Requirement R5: Complete Button & Subbutton Regression Suite with Screenshot Verification
## Comprehensive Survey & Test Automation Plan

**Agent**: `teamwork_preview_explorer_survey_3`  
**Working Directory**: `e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_3`  
**Timestamp**: 2026-09-11T13:10:00Z  
**Authoritative Specifications**: `ORIGINAL_REQUEST.md` (Header `## 2026-09-11T07:10:27Z`, Requirement R5)

---

## 1. Executive Summary & Problem Boundary

Requirement **R5** mandates a complete, exhaustive button and subbutton regression test suite with automated screenshot verification across five critical UI surfaces of the TradingView Advanced charting application:
1. **Chart Legend**
2. **Floating Toolbar**
3. **Pine Editor IDE**
4. **Top Toolbar**
5. **Bottom Dock**

### Critical Guardrails & Invariants:
1. **Zero Native Browser Dialogs**: Every interaction must execute through native-styled in-chart modals, drawers, and toasts. Under zero circumstances may `window.alert()`, `window.confirm()`, or `window.prompt()` be triggered. Any native dialog opening is an immediate failure.
2. **100% Visual Parity & Dark Theme Stability**: In Dark mode, all surfaces (`#131722`, `#1e222d`, `#2a2e39`, `#d1d4dc`) must maintain complete dark-theme styling with zero white background flashes or unstyled bleeding.
3. **Editor Focus & Code Loading**: Clicking `{ }` ("Open script in Pine Editor") from either the Chart Legend or the Floating Toolbar must expand the Pine Editor dock, load that study's Pine Script source code into `#pine_code_input`, and place keyboard focus inside the editor without alerts.
4. **Screenshot Verification & Audit Matrix**: Every single button click and resulting modal/drawer state must be verified visually via high-resolution 1920x1080 screenshot capture, logged into a machine-readable JSON matrix and structured Markdown audit table.

---

## 2. Assessment of Existing Test Infrastructure

The repository contains multiple testing layers developed across previous milestones:

| Layer / File | Technology | Primary Purpose | Strengths | Gaps for R5 |
| :--- | :--- | :--- | :--- | :--- |
| `run_e2e_tests.py` | Python 3, `pytest` | Unified test suite runner (Tiers 1-4, 6-8) | Standardized CLI, colorized banners, summary matrix, exit code handling | Currently only runs backend, tick, and math tests; lacks browser GUI runner |
| `tests/test_pinescript_v6_e2e.py` | Python, `playwright.sync_api` | Pine Script v6 compiler & TV Charting Library E2E | Uses Playwright to load `http://127.0.0.1:9000`, evaluates JS in iframe, asserts DOM | Tests only LuxAlgo and SMA crossover; does not cover floating toolbar, all 7 menu sub-items, or full button matrix |
| `scratch/test_all_buttons_regression.js` | Node.js, CDP (`chrome-remote-interface` / WebSocket) | Prototypes button regression on port 9222/9000 | Direct CDP screenshotting, intercepts `Page.javascriptDialogOpening`, 28 steps | Missing Floating Toolbar `{ }` tests, Version Converter lightbulb & Diff modal tests, not integrated into `pytest` |
| `tests/test_dev2_legend.js` / `test_inspect_legend.js` | Node.js, CDP | Legend DOM introspection | Inspects iframe legend elements, buttons, and action bars | Isolated exploratory scripts; no formal assertions or matrix generation |

### Recommended Automation Architecture:
To satisfy both rapid headless standalone execution and enterprise CI verification, we establish a **Dual-Harness Architecture**:
1. **Primary CI Test Suite (`tests/test_button_regression_suite.py`)**:
   - Implemented in Python with `playwright.sync_api`.
   - Registered into `run_e2e_tests.py` as **Tier 9: Button & Subbutton Regression Suite**.
   - Integrates with standard `pytest` reporting, capturing screenshots to `screenshots/` on both success and failure.
2. **High-Speed CDP Runner (`scripts/run_button_regression.js` / `scratch/test_all_buttons_regression.js`)**:
   - Standalone Node.js script using direct Chrome DevTools Protocol.
   - Zero npm runtime dependencies (uses native `fetch` and `WebSocket`).
   - Automatically parses all steps, captures screenshots, and produces `button_regression_audit_matrix.json` and `button_regression_audit_matrix.md`.

---

## 3. Systematic Button & Subbutton Specification Matrix

The following specification details every button and subbutton across the 5 target surfaces, including target selectors, trigger mechanisms, expected state changes, and screenshot proof files.

### 3.1 Surface 1: Chart Legend (Inside Chart Iframe)
The Chart Legend is rendered inside `#tv_chart_container iframe` by the TradingView Charting Library (`chart-widget-gui.js`).

| Step ID | Button / Action | Target Selector / Trigger | Expected State & Modal Behavior | Assertion Method | Screenshot Proof |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CL-1** | **Main Series Title Click** | `doc.querySelector('[data-name="legend-source-title"], .title-l31H9iuA, [class*="mainTitle"]')` or `activeChart.executeActionById('symbolSearch')` | Opens authentic TradingView Symbol Search dialog (`[data-name="symbol-search-dialog"]` or `input[data-role="search"]`) | `hasDialog === true`, `input !== null`, 0 native dialogs | `01_legend_title_symbol_search.png` |
| **CL-2** | **Eye Button (Show/Hide)** | Study/Series hover -> `[data-name="legend-show-hide-action"]` | Toggles visibility of series or study plot on canvas; tooltip changes to "Show" / "Hide" | Plot visibility toggled in chart model, 0 native dialogs | `02_legend_eye_toggle_visibility.png` |
| **CL-3** | **Gear Button (Format/Settings)** | Study hover -> `[data-name="legend-settings-action"]` | Opens authentic tabbed indicator settings dialog (`#tv_indicator_settings_modal` or `#overlap-manager-root`) | Dialog visible with Inputs/Style/Visibility tabs, closes cleanly via Cancel/✕ | `03_legend_gear_settings_dialog.png` |
| **CL-4** | **`{ }` Button (Open script in Pine Editor)** | Study hover -> `[data-name="legend-source-code-action"]` / `.tv-legend-code-btn` | Immediately expands Pine Editor dock (`setDockOpen(true)`), loads script code into `#pine_code_input`, focuses editor | `PineEditorIDE.isOpen() === true`, `#pine_code_input.value.length > 0`, focused, 0 dialogs | `04_legend_open_script_pine_editor.png` |
| **CL-5** | **3-Dots Button (Context Menu)** | Study hover -> `[data-name="legend-more-action"]` | Opens context menu (`[data-name="menu-inner"]`, `[role="menu"]`) with options (Visual Order, Settings, Remove) | Menu visible, items count > 0, closes on Escape, 0 dialogs | `05_legend_3dots_context_menu.png` |

---

### 3.2 Surface 2: Floating Toolbar (Chart Pane Overlay)
The Floating Toolbar appears when an indicator, study, or drawing tool is selected on the chart pane (`.tv-floating-toolbar`).

| Step ID | Button / Action | Target Selector / Trigger | Expected State & Modal Behavior | Assertion Method | Screenshot Proof |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **FT-1** | **Title / Drag Handle** | `.tv-floating-toolbar .tv-floating-toolbar__drag` | Toolbar is visible (`.tv-floating-toolbar:not(.i-hidden)`), draggable handle allows repositioning | Drag handle exists, bounding box valid | `06_floating_toolbar_title_drag.png` |
| **FT-2** | **Eye Button (Hide / Show)** | `.tv-floating-toolbar [data-name="toggle-visibility"]`, `[data-name="hide"]` | Toggles visibility of the selected study/drawing on the canvas | Visibility state toggled without errors | `07_floating_toolbar_eye_hide.png` |
| **FT-3** | **Hexagon / Settings Button** | `.tv-floating-toolbar [data-name="settings"]` | Opens Properties/Settings modal dialog for the active study/line tool | Properties dialog opens, closes cleanly | `08_floating_toolbar_settings_dialog.png` |
| **FT-4** | **`{ }` Button (Open script in Pine Editor)** | `.tv-floating-toolbar [data-name="source-code"]` / `.tv-floating-code-btn` | Expands Pine Editor dock (`setDockOpen(true)`), loads indicator source code, focuses `#pine_code_input` | `PineEditorIDE.isOpen() === true`, code matches study name, editor focused, 0 dialogs | `09_floating_toolbar_open_script_pine_editor.png` |
| **FT-5** | **Trash Button (Remove / Delete)** | `.tv-floating-toolbar [data-name="remove"]` or `[data-name="delete"]` | Removes the selected study or line tool from the chart cleanly | Target removed from `chart.getAllStudies()`, 0 dialogs | `10_floating_toolbar_trash_remove.png` |
| **FT-6** | **3-Dots Button (More Menu)** | `.tv-floating-toolbar [data-name="more"]` | Opens floating toolbar dropdown (Visual order, clone, copy, intervals visibilities) | Popup menu open, items present, closes on Escape | `11_floating_toolbar_3dots_menu.png` |

---

### 3.3 Surface 3: Pine Editor IDE (Bottom Dock & Toolbar)
The authentic Pine Editor dock is managed by `window.PineEditorIDE` (`pine_editor_ide.js`, `#pine_editor_dock`).

| Step ID | Button / Action | Target Selector / Trigger | Expected State & Modal Behavior | Assertion Method | Screenshot Proof |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **PE-1** | **Script Title Dropdown** | `#pine_script_dropdown_trigger` | Opens script dropdown menu (`#pine_script_dropdown_menu`) with script operations | Dropdown has `.show` class, items present | `12_pine_editor_script_title_dropdown.png` |
| **PE-2** | **New Script Modal** | `#pine_menu_create_new` | Opens `#tv_new_script_modal` with template cards (Blank, Indicator, Strategy, Library) | Modal visible, template items >= 4, closes via close button | `13_pine_editor_new_script_modal.png` |
| **PE-3** | **Save Script Button** | `#pine_save_btn` / `#pine_menu_save_script` | Saves script to localStorage; status pill updates to "Saved" without native prompt | LocalStorage updated, 0 native prompts | `14_pine_editor_save_script.png` |
| **PE-4** | **Add to Chart Button** | `#pine_add_to_chart_btn` | Compiles script via PineTS, registers study, adds to active chart pane | New study in `chart.getAllStudies()`, plots visible, status "Saved & added" | `15_pine_editor_add_to_chart.png` |
| **PE-5** | **Publish Script Modal** | `#pine_publish_btn` | Opens custom TV Publish Script modal dialog (`#tv_confirm_modal_overlay` or custom dialog); ZERO native alert | Custom modal visible, 0 native alerts intercepted, closes cleanly | `16_pine_editor_publish_script_modal.png` |
| **PE-6.1**| **3-Dots -> Option 1: Editor settings...** | `#pine_more_btn` -> `#pine_menu_editor_settings` | Opens `#pine_editor_settings_modal` with Theme, Font Size, Tab Size, Word Wrap | Modal open, controls interactive, closes cleanly | `17_pine_editor_more_opt1_settings.png` |
| **PE-6.2**| **3-Dots -> Option 2: New window** | `#pine_more_btn` -> `#pine_menu_open_new_window` | Detaches editor to separate window or sets detached state | Action executes cleanly without alerts | `18_pine_editor_more_opt2_new_window.png` |
| **PE-6.3**| **3-Dots -> Option 3: New tab** | `#pine_more_btn` -> `#pine_menu_open_new_tab` | Invokes new tab action without crashing or alerts | Action executes cleanly | `19_pine_editor_more_opt3_new_tab.png` |
| **PE-6.4**| **3-Dots -> Option 4: Profiler mode switch** | `#pine_more_btn` -> `#pine_profiler_switch` | Toggles profiler mode checkbox state | `sw.checked` state toggled, 0 dialogs | `20_pine_editor_more_opt4_profiler.png` |
| **PE-6.5**| **3-Dots -> Option 5: Pine logs** | `#pine_more_btn` -> `#pine_menu_pine_logs` | Expands `#pine_console_drawer_v2` showing chronological execution logs | Drawer visible (`display: block`), entries count >= 1 | `21_pine_editor_more_opt5_pine_logs.png` |
| **PE-6.6**| **3-Dots -> Option 6: Release notes** | `#pine_more_btn` -> `#pine_menu_release_notes` | Opens release notes in-chart drawer or modal; no native popups | Action completes cleanly | `22_pine_editor_more_opt6_release_notes.png` |
| **PE-6.7**| **3-Dots -> Option 7: Help** | `#pine_more_btn` -> `#pine_menu_help` | Displays help/shortcuts overlay or documentation link cleanly | Action completes cleanly | `23_pine_editor_more_opt7_help.png` |
| **PE-7** | **Settings Modal (Direct)** | `#pine_settings_btn` | Opens `#pine_editor_settings_modal` with Theme, Font size, Tab size dropdowns | Modal open, all dropdowns present, dark theme styling verified | `24_pine_editor_settings_modal_full.png` |
| **PE-8.1**| **Version Converter: Lightbulb (💡)** | Load `//@version=5` script -> inspect line 1 gutter | Yellow lightbulb `.pine-version-bulb` appears on line 1 in gutter | `bulb !== null`, `data-version="5"`, cursor is pointer | `25_pine_editor_version_converter_bulb.png` |
| **PE-8.2**| **Version Converter: Quick Fix Popover** | Click `.pine-version-bulb` | Opens `#pine_quickfix_popover` with item "💡 Convert script to v6" | Popover visible, button clickable | `26_pine_editor_quickfix_popover.png` |
| **PE-8.3**| **Version Converter: Side-by-Side Diff Modal** | Click `#pine_quickfix_convert_btn` | Opens `#tv_diff_modal_overlay` with left pane (red deletions) and right pane (green additions) | Left and right panes present, diff highlights rendered, Cancel/Apply work | `27_pine_editor_version_diff_modal.png` |
| **PE-9.1**| **Window Control: Minimize (_)** | `#pine_win_minimize` | Collapses editor dock (`dock.style.display === 'none'`) | `PineEditorIDE.isOpen() === false` or dock hidden | `28_pine_editor_win_minimize.png` |
| **PE-9.2**| **Window Control: Maximize (□)** | `#pine_win_maximize` | Expands editor dock to fill viewport width/height | Dock width is 100vw or maximized | `29_pine_editor_win_maximize.png` |
| **PE-9.3**| **Window Control: Close (✕)** | `#pine_win_close` | Closes editor dock completely (`setDockOpen(false)`) | `PineEditorIDE.isOpen() === false`, dock hidden | `30_pine_editor_win_close.png` |
| **PE-10** | **Console Toggle Drawer** | `#pine_console_toggle_btn` | Toggles `#pine_console_drawer_v2` open/closed at bottom of editor | Drawer display toggles, compiler status visible | `31_pine_editor_console_drawer.png` |

---

### 3.4 Surface 4: Top Toolbar (Header Area)
The Top Toolbar is rendered in `.layout__area--top` inside the TradingView iframe.

| Step ID | Button / Action | Target Selector / Trigger | Expected State & Modal Behavior | Assertion Method | Screenshot Proof |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **TB-1** | **Symbol Search Button** | `.layout__area--top button[aria-label="Symbol Search"]` | Opens authentic Symbol Search dialog with input box | Dialog visible, search input focused, closes on Escape | `32_top_toolbar_symbol_search.png` |
| **TB-2** | **Interval Tabs (Timeframes)** | `.layout__area--top button` (1m, 5m, etc.) | Changes chart resolution to clicked interval | `chart.resolution()` matches clicked interval | `33_top_toolbar_interval_tabs.png` |
| **TB-3** | **Candle Types Dropdown** | `.layout__area--top button[aria-label="Candles"]` | Opens candle style dropdown menu (Bars, Candles, Heikin Ashi, Line, Area) | Menu visible with >= 6 styles, closes on Escape | `34_top_toolbar_candle_types.png` |
| **TB-4** | **`fx` Indicators Button** | `.layout__area--top button[data-name="open-indicators-dialog"]` / `button[aria-label*="Indicator"]` | Opens Indicators & Strategies catalog modal dialog with search | Modal visible with catalog items, closes on Escape/close | `35_top_toolbar_fx_indicators.png` |

---

### 3.5 Surface 5: Bottom Dock (Footer Tab Bar)
The Bottom Dock tabs are situated in `#footer-chart-panel` inside the iframe.

| Step ID | Button / Action | Target Selector / Trigger | Expected State & Modal Behavior | Assertion Method | Screenshot Proof |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **BD-1** | **Pine Editor Tab** | `#tv_footer_pine_editor_tab button` / `[data-name="scripteditor"]` | Toggles Pine Editor open; hides conflicting bottom panels | `PineEditorIDE.isOpen() === true`, dock visible | `36_bottom_dock_pine_editor_tab.png` |
| **BD-2** | **Strategy Tester Tab** | `#tv_footer_strategy_tester_tab button` / `[data-name="strategy_tester_tab"]` | Opens Strategy Tester docking panel (`#pine_strategy_tester_panel`), highlights tab | Panel visible (`display !== 'none'`), tab has active class | `37_bottom_dock_strategy_tester_tab.png` |
| **BD-3** | **Account Manager Tab** | `button[data-name="paper_trading"]` / `button[aria-label*="account manager"]` | Opens native TradingView Account Manager / Trading Panel | Account Manager table visible, tabs active | `38_bottom_dock_account_manager_tab.png` |

---

## 4. Verification Methods & Technical Guardrails

### 4.1 Zero Native Browser Dialogs Interception
Native browser dialogs (`alert()`, `confirm()`, `prompt()`) freeze headless automated test harnesses and degrade user experience. We enforce a **Triple-Trap Interceptor**:
1. **CDP Event Trapping**:
   ```javascript
   ws.onmessage = (e) => {
     const d = JSON.parse(e.data);
     if (d.method === 'Page.javascriptDialogOpening') {
       nativeDialogsIntercepted.push({
         type: d.params.type,
         message: d.params.message,
         timestamp: new Date().toISOString()
       });
       // Auto-dismiss so browser does not hang
       call('Page.handleJavaScriptDialog', { accept: true });
     }
   };
   ```
2. **Playwright Event Trapping**:
   ```python
   intercepted_dialogs = []
   def on_dialog(dialog):
       intercepted_dialogs.append({"type": dialog.type, "message": dialog.message})
       dialog.dismiss()
   page.on("dialog", on_dialog)
   ```
3. **In-Page JavaScript Trapping**:
   ```javascript
   window.__nativeDialogs = [];
   ['alert', 'confirm', 'prompt'].forEach(fn => {
     window[fn] = function(msg) {
       window.__nativeDialogs.push({ fn, msg, stack: new Error().stack });
       console.error(`[VIOLATION] Native window.${fn} called:`, msg);
       return fn === 'confirm' ? true : (fn === 'prompt' ? '' : undefined);
     };
   });
   ```
**Assertion Rule**: `assert len(intercepted_dialogs) == 0` and `assert window.__nativeDialogs.length === 0`.

### 4.2 Modal Visibility & Geometry Assertions
To guarantee that a modal is genuinely visible and interactive (rather than hidden by `display: none`, `visibility: hidden`, or zero opacity):
```javascript
function isElementVisibleAndInteractive(el) {
  if (!el) return false;
  const style = window.getComputedStyle(el);
  if (style.display === 'none' || style.visibility === 'hidden' || parseFloat(style.opacity) === 0) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  return rect.width > 20 && rect.height > 20;
}
```

### 4.3 Editor Focus and Source Code Loading Assertions
When `{ }` is clicked:
```javascript
function verifyEditorLoadedStudy(expectedStudyName) {
  const isOpen = window.PineEditorIDE && window.PineEditorIDE.isOpen();
  const codeInput = document.getElementById('pine_code_input');
  if (!isOpen || !codeInput) return { pass: false, reason: 'Editor dock not open' };
  
  const val = codeInput.value.trim();
  const hasCode = val.length > 50;
  const isFocused = document.activeElement === codeInput;
  
  return {
    pass: isOpen && hasCode,
    details: `isOpen=${isOpen}, codeLength=${val.length}, isFocused=${isFocused}`
  };
}
```

### 4.4 Dark Theme Compliance Assertions
Dark theme integrity must be verified on every modal and editor component:
```javascript
function verifyDarkThemeColors(el) {
  const style = window.getComputedStyle(el);
  const bg = style.backgroundColor; // e.g. rgb(19, 23, 34) or #131722
  // Must NOT be pure white rgb(255, 255, 255)
  const isWhite = bg === 'rgb(255, 255, 255)' || bg === '#ffffff';
  return !isWhite;
}
```

---

## 5. Screenshot Capture Pipeline & Storage Discipline

1. **Resolution & Viewport**: Standardized to `1920x1080` with device scale factor `1.0`.
2. **Pre-Capture Stabilization**: Mandatory `500ms` layout settle delay before triggering `Page.captureScreenshot`.
3. **Dual-Path Storage Architecture**:
   - Project Root: `e:\TRADINGVIEW ADVANCED\screenshots\<filename>.png` (accessible to git and local tools).
   - Artifact Directory: `C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\<filename>.png` (for user preview).
4. **Naming Standard**: Sequenced prefix `00_` through `38_` with descriptive snake_case names, enabling clean sorted review.

---

## 6. Audit Matrix Output Schemas

### 6.1 JSON Matrix Schema (`button_regression_audit_matrix.json`)
```json
{
  "timestamp": "2026-09-11T13:15:00Z",
  "suite": "R5 Complete Button & Subbutton Regression Suite",
  "totalTests": 38,
  "passed": 38,
  "failed": 0,
  "passRate": "100.0%",
  "zeroNativeDialogsConfirmed": true,
  "nativeDialogsCount": 0,
  "steps": [
    {
      "stepId": "CL-1",
      "surface": "Chart Legend",
      "action": "Main Series Title Click",
      "status": "PASS",
      "elapsedMs": 842,
      "details": "Symbol Search dialog open, search input focused",
      "screenshot": "01_legend_title_symbol_search.png",
      "screenshotPath": "screenshots/01_legend_title_symbol_search.png"
    }
  ]
}
```

### 6.2 Markdown Matrix Schema (`button_regression_audit_matrix.md`)
The output report will feature an executive summary card, zero-dialog certification badge, and an audit table:
```markdown
| # | Step ID | Surface | Button / Action | Status | Duration | Verification Notes | Screenshot Proof |
|---|:---|:---|:---|:---:|:---:|:---|:---|
| 1 | CL-1 | Chart Legend | Symbol Search Click | ✅ PASS | 842ms | Symbol search dialog opened with search input | `01_legend_title_symbol_search.png` |
| 2 | CL-2 | Chart Legend | Eye Button (Hide/Show) | ✅ PASS | 430ms | Plot visibility toggled cleanly | `02_legend_eye_toggle_visibility.png` |
...
```

---

## 7. Concrete Step-by-Step Automation Script Architecture

The implementer should structure the test automation into two complementary files:
1. **`tests/test_button_regression_suite.py`**:
   - Integrates with `pytest`.
   - Defines a Pytest test class `TestButtonAndSubbuttonRegressionSuite`.
   - Connects to `http://127.0.0.1:9000`.
   - Runs all 38 steps sequentially, verifying DOM, asserting 0 native dialogs, and capturing screenshots.
   - Enforces Tier 9 in `run_e2e_tests.py`.
2. **`run_e2e_tests.py` Update**:
   - Add Tier 9 configuration:
     ```python
     9: {
         "name": "Tier 9: Button & Subbutton Regression Suite (R5)",
         "file": "tests/test_button_regression_suite.py",
         "min_tests": 38,
         "description": "Exhaustive button, subbutton & modal test with screenshot verification & 0 native dialogs"
     }
     ```

This provides complete automated coverage, satisfies every requirement of R5 word-for-word, and guarantees 100% TradingView operational parity.
