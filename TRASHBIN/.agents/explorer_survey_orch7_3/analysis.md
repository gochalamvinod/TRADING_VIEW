# Comprehensive Architecture Analysis: Automated Testing Setup for Pine Script IDE & Indicator Runtime Engine

**Agent**: teamwork_preview_explorer (`explorer_survey_orch7_3`)  
**Date**: 2026-09-09  
**Status**: Read-Only Survey Complete  
**Working Directory**: `e:\TRADINGVIEW ADVANCED\.agents\explorer_survey_orch7_3`  

---

## 1. Executive Summary & Mission Scope

This investigation analyzes the automated testing architecture and verification framework for the **Pine Script IDE and indicator runtime engine** within TradingView Advanced Charts (TT v29.6.0 Standalone) integrated with MetaTrader 5.

### Core Testing Mandates & Directives
1. **Focus Strictly on Custom and Library PineScript Indicators**:
   Automated testing must focus exclusively on:
   - Custom PineScript indicator templates (e.g. *SMA Crossover*, *Smoothed RSI*).
   - Library pre-converted indicators (e.g. *Crossing Moving Averages with ADX Filter*).
   - 0-explicit-plot scripts (e.g. *Golden Pocket Zones*, *Smart Trader Episode 03*) to confirm the adaptive trend baseline fallback prevents blank canvases.
2. **Exclude Built-in Indicators**:
   Per explicit user directive, built-in TradingView indicators (standard built-in SMA, EMA, RSI, MACD from the core library) **must be excluded** from automated tests to accelerate CI runs and prioritize custom/library PineScript workflows.
3. **Validate Visual Plots & Non-NaN Computation**:
   Indicators must generate genuine numeric series data across price candles or separate sub-panes with zero persistent `NaN` values.
4. **Validate Native Interactive Legend Controls**:
   Each indicator added to the chart must remain user-editable (`lock: false`) and expose functional hover action buttons:
   - **Hide/Show** (`data-name="legend-show-hide-action"`): toggles plot visibility on canvas.
   - **Format/Settings** (`data-name="legend-settings-action"`): opens native TradingView properties dialog for inputs & styles.
   - **Remove/Delete** (`data-name="legend-delete-action"`): removes the study cleanly from the chart and legend.
5. **Verify Server Health on Port 9000**:
   All server endpoints (`/health`, `/pine/catalog`, `/pine/transpile`, `/pine/source/*`, `/pine/js/*`, static assets) must be operational with 100% health.
6. **Enforce Authentic TradingView Bottom UI Styling (User Directive 2026-09-09T06:14:05Z)**:
   Verify the complete absence of unauthentic or slapped-on custom bottom bars, raw emoji buttons (`⚡`, `📄`, `📈`, `🌲`), or clunky bottom docks. Ensure authentic TradingView dark-theme layout with smooth switching between the Account Manager (Trading Panel) and Pine Editor.

---

## 2. Existing Test Infrastructure & Harness Survey

A deep forensic survey of `tests/`, `run_e2e_tests.py`, and test configurations reveals the following landscape:

### 2.1 Pytest Multi-Tier Runner (`run_e2e_tests.py`)
`run_e2e_tests.py` orchestrates the project's backend and financial verification tiers:
- **Tier 1**: Feature Coverage F1–F13 (`tests/test_tier1_feature_coverage.py` - 65 tests)
- **Tier 2**: Boundary Value & Negative Cases (`tests/test_tier2_boundary_corner.py` - 65 tests)
- **Tier 3**: Cross-Feature Combinations (`tests/test_tier3_cross_feature.py` - 15 tests)
- **Tier 4**: End-to-End Real-World Workloads (`tests/test_tier4_workloads.py` - 7 tests)
- **Tier 6**: R1–R4 Comprehensive Latency & Broker Integration (`tests/test_tier6_r1_to_r4.py` - 20 tests)
- **Tier 7**: HFT Clock Sync & Monotonic Countdown (`tests/test_hft_clock_countdown_suite.py` - 20 tests)
- **Tier 8**: Live P&L Parity & Adversarial Suite (`tests/test_pl_sync_adversarial.py` - 38 tests)

*Finding*: `run_e2e_tests.py` currently has **no dedicated Tier for Pine Script IDE or indicator runtime verification**. A new **Tier 9 (`tests/test_pine_custom_library_playwright.py` + `tests/test_pine_server_health.py`)** must be registered.

### 2.2 Status of Browser / Playwright Harnesses
- **No Existing Playwright Test Files**: There are currently 0 Playwright `.spec.ts` or `test_playwright_*.py` files in `tests/`.
- **Ad-Hoc Node CDP Scripts**: Previous browser verifications (`tests/verify_legend_and_handles.js`, `tests/test_cdp_browser.js`, `tests/test_full_verification.js`, `tests/test_cdp_check.js`) spawn `chrome.exe --headless=new --remote-debugging-port=9222` and communicate over raw WebSockets. While functional, these scripts lack structured Pytest assertions, automatic retries, fixture management, and CI reporter integration.
- **Python Playwright Availability**:
  - `playwright` 1.62.0 and `pytest-playwright` 0.9.0 are already installed in Python 3.11 (`C:\Users\gocha\AppData\Local\Programs\Python\Python311\Lib\site-packages\playwright`).
  - Chromium browser binary is present and verified at `C:\Users\gocha\AppData\Local\ms-playwright\chromium-1234\chrome-win\chrome.exe` (Version 151.0.7922.34).
  - Both headless Python Playwright and CDP direct attachments work reliably.

### 2.3 Status of Existing Pine Tests
- **`tests/test_pine_integration.py`** (94 lines):
  Tests `/pine/catalog`, `/pine/transpile`, `/pine/source/Folded_RSI.pine`, `/pine/js/Folded_RSI.js`, and static assets via `httpx.Client("http://127.0.0.1:9000")`. Fails when port 9000 server is not listening as an external daemon.
- **`tests/test_advanced_pine_plotting.js` & `tests/test_tier5_pine_stress.js`**:
  Both scripts fail immediately with `Error: Cannot find module '../pine_engine.js'` because `pine_engine.js` was replaced by the modern production architecture (`pine_transpiler.bundle.js` + `pine_indicators.js`). These legacy files must either be updated to require `pine_indicators.js` or superseded by the new Tier 9 test suite.

---

## 3. Server Health & Pine Endpoints Verification (Port 9000)

Using an in-process FastAPI `TestClient` verification script (`.agents/explorer_survey_orch7_3/check_server_pine.py`), we evaluated the server endpoints defined in `server.py`:

| Endpoint | HTTP Method | Expected Content | Verified Status | Observed Payload / Behavior |
| :--- | :---: | :--- | :---: | :--- |
| `/health` | `GET` | Server & MT5 health status | **200 OK** | `{"status": "healthy", "server": "online", "port_9000": "online", "mt5": "connected"}` |
| `/pine/catalog` | `GET` | Catalog of pre-converted indicators | **200 OK** | Returns 27 indicator objects (`3D MACD Bar Plot`, `Folded RSI`, etc.) |
| `/pine/transpile` | `POST` | Node bundle Pine-A-Script transpiler | **200 OK** | `{"success": true, "code": "...", "ast": {...}}` for Pine v5 source |
| `/pine/source/{file}` | `GET` | Raw PineScript code | **200 OK** | Returns 9,662 bytes UTF-8 text for `Folded_RSI.pine` |
| `/pine/js/{file}` | `GET` | Converted JavaScript code | **200 OK** | Returns 76,637 bytes JS for `Folded_RSI.js` |
| `/pine_transpiler.bundle.js` | `GET` | Transpiler bundle asset | **200 OK** | 196,803 bytes JS bundle |
| `/pine_indicators.js` | `GET` | TV Study Bridge & Runtime | **200 OK** | 39,077 bytes JS bridge |
| `/pine_editor_ide.js` | `GET` | Pine Editor IDE module | **200 OK** | 38,235 bytes JS IDE |
| `/pine_editor.css` | `GET` | Pine IDE styling stylesheet | **200 OK** | 7,265 bytes CSS |

*Conclusion*: The backend FastAPI routing and Node subprocess transpilation bridge are **100% operational**.

---

## 4. Custom & Library Indicator Execution Engine

### 4.1 Transpilation & Metainfo Generation
In `pine_indicators.js`:
- `parsePineMetadata(source)`: Parses `indicator("Title", overlay=true/false)`, inputs (`input.int`, `input.float`, `input.bool`), plots (`plot(...)`), and plotshapes (`plotshape(...)`).
- `createStudyFromTranspiled(meta, transpiledJs)`:
  - Generates TradingView Metainfo v52 schema (`_metainfoVersion: 52`).
  - Sets `is_price_study: isPriceStudy` (controls whether indicator plots on candles or in a new sub-pane).
  - Populates `defaults.styles` and `defaults.inputs`.
  - Defines the `Std` math library (SMA, EMA, RMA, STDEV, ATR, RSI, MACD, BB, NZ, NA).
  - Builds `studyConstructor` with `this.init(ctx, inputCallback)` and `this.main(ctx, inputCallback)`.

### 4.2 Study Editability & `lock: false`
In `pine_indicators.js` line 1003:
```javascript
// forceOverlay = isOverlay, lock = false
await chart.createStudy(studyName, isOverlay, false);
```
**Critical Discovery**: In TradingView Charting Library, the 3rd parameter of `chart.createStudy(name, forceOverlay, lock)` is `lock`. If `lock: true`, TradingView disables all legend controls (no hover actions, cannot edit settings, cannot delete from legend). Passing `lock: false` is strictly required to enable `isUserDeletable() === true` and `userEditEnabled() === true`.

### 4.3 0-Plot Adaptive Trend Baseline Fallback
For indicators that use drawing primitives (`box.new`, `label.new`, `line.new`) or pure calculation blocks without explicit `plot()` calls (such as `Golden_Pocket_Zones.pine` and `Smart_Trader_Episode_03_by_Ata_Sabanci_Candles_and_Tradelines.pine`):
1. `parsePineMetadata`:
   ```javascript
   if (plots.length === 0 && shapes.length === 0) {
     plots.push({
       id: 'plot_0',
       title: shortTitle || (isOverlay ? 'Baseline' : 'Oscillator'),
       color: isOverlay ? '#2196F3' : '#FF9800'
     });
   }
   ```
2. `studyConstructor.main`:
   ```javascript
   const hasValidNumericPlot = plotValues.some(v => typeof v === 'number' && !isNaN(v));
   if (!hasValidNumericPlot) {
     if (isPriceStudy) {
       const fallback = Std.ema('close', 14, ctx);
       plotValues[0] = (typeof fallback === 'number' && !isNaN(fallback)) ? fallback : c;
     } else {
       const fallback = Std.rsi('close', 14, ctx);
       plotValues[0] = (typeof fallback === 'number' && !isNaN(fallback)) ? fallback : 50;
     }
   }
   ```
*Defect Identified for Developers*: While the numerical fallback exists, it currently lacks an informative diagnostic print in Pine Logs (`[Pine] 0 explicit plots detected; adaptive trend baseline activated`). Developer agents must implement this diagnostic notice.

---

## 5. TradingView Chart Legend DOM Architecture & Exact Selectors

Inspection of `charting_library/bundles/chart-widget-gui.373398f680e71823f0f1.js` (lines 31–35) reveals the exact dataset attributes and DOM hierarchy used by TradingView:

### 5.1 Legend Action Selectors (Inside Chart Iframe)
- **Container**: `[data-name="legend"]` or `.legend`
- **Study Row**: `[data-name="legend-source-item"]` or `[class*="sourcesWrapper-"] > div`
- **Title**: `[data-name="legend-source-title"]`, `[class*="title-"]`
- **Values**: `[class*="valuesWrapper-"]`
- **Action Buttons** (revealed on study hover):
  - **Hide/Show (Eye)**:
    `button[data-name="legend-show-hide-action"]` (class: `E.eye`)
    *Action*: Calls `onToggleDisabled()`, toggles `source.properties().childs().visible` between `true` and `false`.
  - **Format/Settings (Gear)**:
    `button[data-name="legend-settings-action"]`
    *Action*: Calls `onShowSettings()`, opens the native TradingView Format dialog (`data-dialog-name="Format"` or `[data-name="study-properties-dialog"]`).
  - **Delete/Remove (Trash)**:
    `button[data-name="legend-delete-action"]`
    *Action*: Calls `onRemoveSource()`, removes study from `model` without orphaned state.
  - **More Actions (Ellipsis)**:
    `button[data-name="legend-more-action"]`

### 5.2 Enabling Featuresets in `index.html`
All prerequisite features are verified active in `index.html` (lines 1075–1080):
- `study_buttons_in_legend`: `true`
- `show_hide_button_in_legend`: `true`
- `format_button_in_legend`: `true`
- `delete_button_in_legend`: `true`
- `edit_buttons_in_legend`: `true`
- `property_pages`: `true`

---

## 6. Authentic TradingView Bottom UI Styling Verification

### 6.1 The Defect Identified
The user explicitly issued an urgent corrective directive:
> *"i said u i need same ui as traingview u gave me bottom fix them"*
> *Remove any unauthentic or slapped-on custom bottom bars, emoji buttons, or clunky bottom docks.*
> *Ensure the bottom panel and Pine Editor UI match authentic TradingView styling exactly.*

In `pine_editor_ide.js` and `pine_editor.css`:
- An unauthentic bar (`#bottom_dock_tabs`) was slapped below `#tv_chart_container` containing raw emoji text:
  `📄 New blank indicator`, `📈 New blank strategy`, `⚡ SMA 9/21 Crossover`, `🌲 Pine Script Editor`.
- This clashes with TradingView's native bottom docking bar (`trading_account_manager`, `bottomWidgetVisibility()`).

### 6.2 Test Architecture Assertions for Bottom UI
The automated test harness must explicitly verify:
1. **Absence of Clunky Custom Elements**:
   `#bottom_dock_tabs` with emoji icons does NOT exist or has been refactored into authentic TradingView tab styling.
2. **Zero Raw Emojis**:
   The bottom UI must use clean SVG vector icons or native TradingView text labels without emoji prefixes (`⚡`, `📄`, `📈`, `🌲`).
3. **Seamless Switching**:
   Switching between the Account Manager ("Trading Panel") and the Pine Editor toggles cleanly without breaking canvas sizing or creating overlapping divs.
4. **Dark Theme Compliance**:
   Colors must adhere strictly to `#131722` (primary background), `#1e222d` (secondary background), `#2a2e39` (borders), and `#2962ff` (TradingView brand blue accent).

---

## 7. Automated Test Architecture & Exact Assertions Design

We design a comprehensive automated testing suite consisting of two focused test modules:
1. `tests/test_pine_server_health.py` (Backend Health & Pine Endpoints)
2. `tests/test_pine_custom_library_playwright.py` (End-to-End Headless Browser Verification)

### 7.1 Test Targets: Whitelist vs Exclusions

```
+-------------------------------------------------------------------------------+
| AUTOMATED TEST INDICATOR SCOPE MATRIX                                          |
+-------------------------------------------------------------------------------+
| STATUS     | CATEGORY        | INDICATOR NAME                 | PURPOSE       |
|------------|-----------------|--------------------------------|---------------|
| INCLUDED   | Custom Template | SMA Crossover (Fast/Slow)      | Overlay MAs   |
| INCLUDED   | Custom Template | Smoothed RSI with Bands        | Sub-pane RSI  |
| INCLUDED   | Converted Lib   | Crossing Moving Averages ADX   | Library MA    |
| INCLUDED   | 0-Plot Fallback | Golden Pocket Zones            | 0-Plot Boxes  |
| INCLUDED   | 0-Plot Fallback | Smart Trader Ep. 03 Candles    | 0-Plot Trend  |
|------------|-----------------|--------------------------------|---------------|
| EXCLUDED   | Built-in (TV)   | Built-in SMA / EMA             | User Exclusion|
| EXCLUDED   | Built-in (TV)   | Built-in RSI / MACD            | User Exclusion|
| EXCLUDED   | Built-in (TV)   | Built-in Bollinger Bands       | User Exclusion|
+-------------------------------------------------------------------------------+
```

### 7.2 Detailed Test Suite Specifications

#### Suite 1: `tests/test_pine_server_health.py`
- **Execution**: Pure Python with FastAPI `TestClient` (isolated execution) and conditional live HTTP fallback.
- **Assertions**:
  1. `test_server_health_200()`: Verifies `GET /health` returns 200, `"status": "healthy"`, `"port_9000": "online"`, `"mt5": "connected"`.
  2. `test_pine_catalog_completeness()`: Verifies `GET /pine/catalog` returns `list` with $\ge 25$ indicators; confirms `3D MACD Bar Plot`, `Folded RSI`, `Crossing Moving Averages with ADX Filter` are present.
  3. `test_pine_transpile_v5_v6()`: POSTs Pine v5 custom scripts to `/pine/transpile`, verifies `success == True`, `code` contains transpiled JavaScript with `function main()` and `const pinescript`.
  4. `test_pine_source_and_js_endpoints()`: Verifies `GET /pine/source/{file}` and `GET /pine/js/{file}` return valid scripts.
  5. `test_pine_static_assets()`: Verifies `/pine_transpiler.bundle.js`, `/pine_indicators.js`, `/pine_editor_ide.js`, and `/pine_editor.css` return 200 with non-empty content.

#### Suite 2: `tests/test_pine_custom_library_playwright.py`
- **Execution**: Python Playwright (`pytest --headed=false` or direct sync Playwright harness).
- **Setup Fixture**:
  - Launches headless Chromium (`--window-size=1920,1080`).
  - Navigates to `http://127.0.0.1:9000`.
  - Waits for `#tv_chart_container iframe` to render and `window.widget.onChartReady` callback to fire.
  - Verifies chart is active and symbol is resolved (`XAUUSD.`).
- **Test Cases & Assertions**:

##### Test 1: Adding Custom SMA Crossover
1. Execute `await chart.createStudy("SMA Crossover", true, false)`.
2. Verify study appears in `chart.getAllStudies()` with `lock: false`.
3. Locate legend row inside iframe:
   `const legendRow = iframe.locator('[data-name="legend"] [data-name="legend-source-item"]').filter(hasText="SMA Crossover")`.
   `expect(legendRow).to_be_visible()`.
4. Inspect runtime calculation:
   Evaluate `window.__pineRuntime.plots["Fast MA"].data`: verify array length $\ge 100$, no all-NaN data.
5. Canvas rendering assertion:
   Verify the chart canvas contains rendered plot pixels (canvas bounding rect height $> 300$, non-blank).

##### Test 2: Adding Library Smoothed RSI (Separate Pane)
1. Execute `await chart.createStudy("Smoothed RSI", false, false)`.
2. Verify study is created in a **new sub-pane** (`is_price_study: false`).
3. Verify legend row exists for "Smoothed RSI".
4. Verify non-NaN values in `window.__pineRuntime.plots["RSI"].data` and `window.__pineRuntime.plots["RSI Smooth"].data`.

##### Test 3: Adding Converted Library "Crossing Moving Averages with ADX Filter"
1. Transpile `Crossing_Moving_Averages_with_ADX_Filter.pine` and inject via `window.PineIndicators.registerStudy(...)`.
2. Add to chart: `await chart.createStudy("Crossing Moving Averages with ADX Filter", true, false)`.
3. Assert both `Fast MA` and `Slow MA` plot lines calculate valid numeric series.

##### Test 4: 0-Plot Adaptive Baseline Fallback (Golden Pocket Zones & Smart Trader)
1. Transpile and add `Golden Pocket Zones` (which has 0 `plot()` statements).
2. Assert study generates $\ge 1$ plot (`plots.length >= 1`).
3. Assert the fallback adaptive trend baseline (EMA-14 on overlay) produces valid numeric values rather than `NaN`.
4. Transpile and add `Smart Trader Episode 03`.
5. Assert study does NOT render a blank canvas; adaptive baseline is plotted.
6. Verify diagnostic notice is emitted in console/Pine Logs.

##### Test 5: Native Legend Controls Interaction (Hover, Hide, Settings, Delete)
For an active custom study (e.g. "SMA Crossover"):
1. **Hover Action**:
   - `await legendRow.hover()`
   - Assert action buttons become visible:
     - `hideBtn = legendRow.locator('button[data-name="legend-show-hide-action"]')`
     - `settingsBtn = legendRow.locator('button[data-name="legend-settings-action"]')`
     - `deleteBtn = legendRow.locator('button[data-name="legend-delete-action"]')`
     - `expect(hideBtn).to_be_visible()`
     - `expect(settingsBtn).to_be_visible()`
     - `expect(deleteBtn).to_be_visible()`
2. **Hide/Show Interaction**:
   - Click `hideBtn`.
   - Assert `study.properties().childs().visible.value() === false`.
   - Assert eye icon updates (`aria-label` or title switches to "Show").
   - Click `hideBtn` again.
   - Assert `study.properties().childs().visible.value() === true`.
3. **Format/Settings Dialog Interaction**:
   - Click `settingsBtn`.
   - Assert native TradingView study properties modal opens (`iframe.locator('[data-name="study-properties-dialog"], [data-dialog-name="Format"]')`).
   - Assert inputs tab / style tab elements are present.
   - Press `Escape` or click modal Close button to dismiss.
   - Assert dialog closes cleanly.
4. **Delete Interaction**:
   - Note study count: `const countBefore = (await chart.getAllStudies()).length`.
   - Click `deleteBtn`.
   - Wait for study removal: `const countAfter = (await chart.getAllStudies()).length`.
   - Assert `countAfter === countBefore - 1`.
   - Assert `legendRow` is completely removed from DOM.

##### Test 6: Authentic Bottom UI Layout & Styling Verification
1. **Absence of Slapped-on Emoji Docks**:
   `expect(page.locator('#bottom_dock_tabs')).not.to_contain_text(['⚡', '📄', '📈', '🌲'])`.
2. **Authentic Styling**:
   Verify bottom widget area uses native TradingView CSS variables (`--tv-bg-primary`, `--tv-border`).
3. **Switching Verification**:
   - Click "Pine Editor" tab -> Pine Editor opens cleanly.
   - Click "Trading Panel" / "Account Manager" tab -> Account Manager docks without overlapping or displacing Pine Editor.

##### Test 7: Strict Built-in Indicator Exclusion Enforcement
1. Iterate over all studies tested.
2. Assert every tested study ID or name is within the Custom / Library Whitelist.
3. Assert that NO built-in indicator IDs (e.g. `Moving Average@tv-basicstudies`, `Relative Strength Index@tv-basicstudies`) are executed in the automated test run.

---

## 8. Integration into E2E Test Suite (`run_e2e_tests.py`)

To formalize this verification within the unified runner, `run_e2e_tests.py` should be updated with **Tier 9**:

```python
TIER_CONFIG[9] = {
    "name": "Tier 9: Pine Script IDE & Custom Indicator Engine Verification",
    "file": "tests/test_pine_custom_library_playwright.py",
    "min_tests": 12,
    "description": "Custom/library PineScript plotting, adaptive fallback, legend controls & authentic bottom UI"
}
```

### Test Runner Commands
```powershell
# Run backend health & Pine endpoint tests
pytest tests/test_pine_server_health.py -v

# Run full Playwright headless browser suite for custom & library indicators
pytest tests/test_pine_custom_library_playwright.py -v --tb=short

# Run unified E2E runner including Tier 9
python run_e2e_tests.py --tier 9 -v
```

---

## 9. Summary of Exact Files to Create or Modify

| File Path | Action | Description |
| :--- | :---: | :--- |
| `tests/test_pine_server_health.py` | **Create** | Pytest unit/integration suite for `/health`, `/pine/*`, and static assets. |
| `tests/test_pine_custom_library_playwright.py` | **Create** | Full Playwright E2E browser test verifying custom/library indicators, 0-plot adaptive fallback, legend controls, and authentic bottom UI. |
| `run_e2e_tests.py` | **Modify** | Register Tier 9 in `TIER_CONFIG` and update argument parser choices to include `9`. |
| `pine_indicators.js` | **Modify (Dev)** | Add Pine Logs diagnostic output when adaptive baseline is activated for 0-plot scripts. |
| `pine_editor_ide.js` & `pine_editor.css` | **Modify (Dev)** | Eliminate slapped-on `#bottom_dock_tabs` with emoji icons; align bottom panel styling with authentic TradingView look-and-feel. |

This concludes the architectural analysis and test framework design.
