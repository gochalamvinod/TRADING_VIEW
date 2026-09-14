# Handoff Report — Pine Script IDE & Indicator Runtime Engine Automated Testing Survey

**Agent**: teamwork_preview_explorer (`explorer_survey_orch7_3`)  
**Type**: Hard Handoff (Survey Phase Complete)  
**Parent Conversation ID**: `629ecdbb-bdd9-4267-83c2-050d30aba17d`  
**Working Directory**: `e:\TRADINGVIEW ADVANCED\.agents\explorer_survey_orch7_3`  
**Date**: 2026-09-09  

---

## 1. Observation

### Observation 1: Test Infrastructure & Existing Runners
- `run_e2e_tests.py` defines `TIER_CONFIG` with Tiers 1, 2, 3, 4, 6, 7, 8 (lines 40–83). Tier 1 covers Feature Coverage F1–F13; Tier 8 covers P&L parity and adversarial grading. No tier currently exists for Pine Script IDE or custom indicator verification.
- `tests/` contains legacy Node scripts (`test_advanced_pine_plotting.js`, `test_tier5_pine_stress.js`, `test_pine_adversarial_oracle.js`) that fail with verbatim error:
  ```
  Error: Cannot find module 'E:\TRADINGVIEW ADVANCED\pine_engine.js'
  ```
  because `pine_engine.js` was refactored and moved to `DELETED/pine_engine.js`.
- In Python 3.11 environment, Playwright is installed:
  - `python -m playwright --version` -> `Version 1.62.0`
  - Chromium binary: `C:\Users\gocha\AppData\Local\ms-playwright\chromium-1234\chrome-win\chrome.exe` (v151.0.7922.34).
  - Python import: `from playwright.sync_api import sync_playwright` launches Chromium successfully.
  - However, there are currently 0 Playwright `.spec.ts` or `test_*.py` browser test files in `tests/`. Previous browser tests in `tests/` (`verify_legend_and_handles.js`, `test_cdp_browser.js`) used manual Chrome spawning with raw WebSockets over CDP port 9222.

### Observation 2: Backend Server Health & Endpoints (Port 9000)
- Execution of `.agents/explorer_survey_orch7_3/check_server_pine.py` against `server.app` via `fastapi.testclient.TestClient` produced verbatim results:
  - `GET /health`: Status `200 OK`, JSON `{'status': 'healthy', 'uptime': 2.7, 'server': 'online', 'proxy': 'healthy', 'architecture': 'unified_zero_hop', 'port_9000': 'online', 'backend_8080': 'online', 'static_8081': 'online', 'mt5': 'connected', 'mt5_status': 'connected', 'hft_engine': 'stopped', 'mm_timer_1ms': False, 'timer_resolution_ms': None, 'timestamp': 1788934513.2960653}`
  - `GET /pine/catalog`: Status `200 OK`, length 27 indicators (`3D MACD Bar Plot [LuxAlgo]`, `Folded RSI`, `Crossing Moving Averages with ADX Filter`, etc.).
  - `POST /pine/transpile`: Status `200 OK`, JSON `{'success': True, 'keys': ['success', 'code', 'ast', 'tokens']}`.
  - `GET /pine/source/Folded_RSI.pine`: Status `200 OK`, length `9662` bytes.
  - `GET /pine/js/Folded_RSI.js`: Status `200 OK`, length `76637` bytes.
  - Static assets: `/pine_transpiler.bundle.js` (200, 196,803 bytes), `/pine_indicators.js` (200, 39,077 bytes), `/pine_editor_ide.js` (200, 38,235 bytes), `/pine_editor.css` (200, 7,265 bytes).
- `tests/test_pine_integration.py` exists but uses `httpx.Client(base_url="http://127.0.0.1:9000")`. When the external server process is stopped, pytest fails with `[WinError 10061] No connection could be made because the target machine actively refused it`.

### Observation 3: Custom & Library Indicators vs Built-in Indicators
- Custom templates in `pine_indicators.js` (lines 581–650): `sma_cross` (SMA Crossover Fast 9/Slow 21), `supertrend`, `rsi_smooth` (Smoothed RSI), `macd_custom`, `bollinger_bands`.
- Library indicators in `Pine-A-Script-master/examples/` and `pine_indicators_catalog.json`: `Crossing_Moving_Averages_with_ADX_Filter.pine`, `Folded_RSI.pine`, etc.
- Indicators with 0 explicit `plot()` calls: `Pine-A-Script-master/examples/Golden_Pocket_Zones.pine` (322 lines, 0 `plot(` calls; uses `box.new` and `label.new`) and `Smart_Trader_Episode_03_by_Ata_Sabanci_Candles_and_Tradelines.pine` (0 `plot(` calls).
- In `pine_indicators.js` (lines 273–280 & 514–527):
  - 0-plot scripts receive a fallback plot `plot_0`.
  - At runtime, `if (!hasValidNumericPlot)` triggers an adaptive trend baseline fallback:
    ```javascript
    if (isPriceStudy) {
      const fallback = Std.ema('close', 14, ctx);
      if (plotValues.length > 0) {
        plotValues[0] = (typeof fallback === 'number' && !isNaN(fallback)) ? fallback : c;
      }
    } else {
      const fallback = Std.rsi('close', 14, ctx);
      if (plotValues.length > 0) {
        plotValues[0] = (typeof fallback === 'number' && !isNaN(fallback)) ? fallback : 50;
      }
    }
    ```
  - However, there is no diagnostic notice currently logged to Pine Logs when the fallback triggers.

### Observation 4: TradingView Chart Legend DOM & Action Selectors
- In `charting_library/bundles/chart-widget-gui.373398f680e71823f0f1.js` (lines 31–34), study action buttons are defined with explicit dataset attributes:
  - Hide/Show (Eye): `dataset: { name: "legend-show-hide-action" }`
  - Settings (Gear): `dataset: { name: "legend-settings-action" }`
  - Delete (Trash): `dataset: { name: "legend-delete-action" }`
  - More (Ellipsis): `dataset: { name: "legend-more-action" }`
- Editability condition: In `chart-widget-gui.*.js`, settings and delete buttons are gated on `_getIsEditable()`, which checks `this._source.userEditEnabled()`.
- In `pine_indicators.js` line 1003:
  ```javascript
  await chart.createStudy(studyName, isOverlay, false);
  ```
  The 3rd argument `lock = false` is critical. If `lock: true`, `userEditEnabled()` returns `false`, preventing legend action buttons from rendering.
- In `index.html` (lines 1075–1080), features `show_hide_button_in_legend`, `format_button_in_legend`, `delete_button_in_legend`, `study_buttons_in_legend`, `edit_buttons_in_legend`, and `property_pages` are all active.

### Observation 5: Bottom Panel UI & User Directive Update
- CRITICAL USER DIRECTIVE UPDATE (2026-09-09T06:14:05Z):
  `User Directive: "i said u i need same ui as traingview u gave me bottom fix them"`
  `Fix all bottom UI elements across the application immediately:`
  `1. Remove any unauthentic or slapped-on custom bottom bars, emoji buttons, or clunky bottom docks.`
  `2. Ensure the bottom panel and Pine Editor UI match authentic TradingView styling exactly.`
  `3. Properly integrate the Pine Editor / bottom panel with TradingView's native bottom widget area without clashing with the Account Manager or creating redundant awkward bottom docks.`
- In `pine_editor_ide.js` (lines 531–545) and `pine_editor.css`:
  - Slapped-on bottom bar `#bottom_dock_tabs` renders below chart container with raw emoji text: `📄 New blank indicator`, `📈 New blank strategy`, `⚡ SMA 9/21 Crossover`, `🌲 Pine Script Editor`.
  - This violates the authentic TradingView look-and-feel requirement.

---

## 2. Logic Chain

1. **Test Runner Gap**:
   - *Observation 1* shows `run_e2e_tests.py` covers Tiers 1–8 but lacks a Pine Script verification tier. Furthermore, legacy Node scripts fail because `pine_engine.js` was deleted.
   - *Therefore*: A new Tier 9 test suite (`tests/test_pine_custom_library_playwright.py` + `tests/test_pine_server_health.py`) must be introduced and integrated into `run_e2e_tests.py`.

2. **Backend Server Stability**:
   - *Observation 2* shows all `/health` and `/pine/*` endpoints respond with 200 OK and valid JSON/scripts via `TestClient`.
   - *Therefore*: Backend server logic is sound; tests can run against live port 9000 or use TestClient for isolated execution.

3. **Scope Enforcement (Custom/Library ONLY; Built-ins Excluded)**:
   - *Observation 3* and the user directive mandate testing custom and library scripts (SMA Crossover, Smoothed RSI, Crossing MAs with ADX Filter, Golden Pocket Zones, Smart Trader) and strictly excluding built-in indicators.
   - *Therefore*: The test suite must establish a whitelist containing only custom and library indicators. Any test attempting to execute built-in indicator routines must be skipped/filtered out.

4. **Visual Plotting & 0-Plot Fallback Logic**:
   - *Observation 3* reveals `Golden Pocket Zones` and `Smart Trader` have 0 `plot()` calls. `pine_indicators.js` supplies an adaptive baseline (EMA-14 or RSI-14).
   - *Therefore*: Test assertions must verify that 0-plot indicators produce `plots.length >= 1`, non-NaN numeric series arrays, and non-blank chart canvas renderings, plus verify diagnostic logging in Pine Logs.

5. **Legend Controls Interaction Contract**:
   - *Observation 4* proves TradingView renders `button[data-name="legend-show-hide-action"]`, `button[data-name="legend-settings-action"]`, and `button[data-name="legend-delete-action"]` when `chart.createStudy(name, isOverlay, false)` is used with `lock: false`.
   - *Therefore*: Playwright tests can deterministically locate these buttons inside `#tv_chart_container iframe` upon hovering over `[data-name="legend-source-item"]`, assert visibility, and verify click behaviors (Hide toggles visibility, Settings opens Format modal, Delete removes study).

6. **Bottom Panel UI Compliance**:
   - *Observation 5* documents the user directive rejecting unauthentic emoji docks (`#bottom_dock_tabs`).
   - *Therefore*: The test suite must include specific UI assertions checking for the absence of raw emoji buttons/custom docks and verifying authentic TradingView bottom tab styling and smooth Account Manager / Pine Editor switching.

---

## 3. Caveats

1. **Live vs Mock Server Execution**:
   If port 9000 is not started as a persistent daemon before running Playwright tests, Playwright browser navigation will fail. The test harness must either include an auto-start server fixture or be run after launching `advanced bat runner.bat` / `uvicorn server:app`.
2. **Chart Ready Timing**:
   TradingView Advanced Charts requires 3–8 seconds to resolve the initial symbol (`XAUUSD.`), load historical UDF bars, and initialize the study engine. Playwright tests must use explicit waits on `widget.onChartReady` or iframe DOM elements rather than arbitrary timeouts.
3. **Canvas Pixel Verification Sensitivity**:
   Checking canvas pixels via `canvas.toDataURL()` or pixel buffer entropy detects non-blank rendering, but precise pixel-to-pixel comparison depends on GPU rasterization settings. Assertions should test pixel variance / non-uniformity rather than strict static PNG diffs.
4. **Pine Logs Diagnostic Logging**:
   The 0-plot adaptive fallback currently calculates the baseline line but does not yet write a message to the Pine Logs console in `pine_editor_ide.js`. Developers will need to add this line before the diagnostic log assertion can pass.

---

## 4. Conclusion

The automated testing setup for the Pine Script IDE and indicator runtime engine must be implemented as a **two-pronged verification architecture**:

1. **`tests/test_pine_server_health.py`**:
   Verifies server health on port 9000 (`/health`, `/pine/catalog`, `/pine/transpile`, `/pine/source/*`, `/pine/js/*`, and static assets) using FastAPI `TestClient` for instantaneous, rock-solid execution with 0 external process dependencies.
2. **`tests/test_pine_custom_library_playwright.py`**:
   Uses Python Playwright 1.62.0 to automate headless Chromium against the live application:
   - Verifies adding custom indicators (`SMA Crossover`, `Smoothed RSI`) and library indicators (`Crossing Moving Averages with ADX Filter`).
   - Verifies 0-plot adaptive trend baseline fallback on `Golden Pocket Zones` and `Smart Trader Episode 03` (non-NaN numeric series and non-blank canvas).
   - Verifies legend hover controls: Hide/Show (`legend-show-hide-action`), Settings Format dialog (`legend-settings-action`), and Delete (`legend-delete-action`).
   - Verifies authentic TradingView bottom UI styling (no custom emoji docks, authentic dark-mode layout, seamless Account Manager switching).
   - Strictly excludes built-in indicators per user directive.
3. **Integration into `run_e2e_tests.py`**:
   Registered as **Tier 9 (`Tier 9: Pine Script IDE & Custom Indicator Engine Verification`)** to enable unified test execution across the entire platform.

---

## 5. Verification Method

### 5.1 Independent Verification of Server Health Endpoints
Execute the standalone check script created during the survey:
```powershell
python .agents/explorer_survey_orch7_3/check_server_pine.py
```
*Expected Result*: Returns status 200 for `/health`, `/pine/catalog` (27 items), `/pine/transpile` (`success: True`), and all static assets.

### 5.2 Verification of Python Playwright Runtime
Verify that headless Chromium launches cleanly:
```powershell
python -c "from playwright.sync_api import sync_playwright; p = sync_playwright().start(); b = p.chromium.launch(headless=True); print('Playwright OK:', b.version); b.close(); p.stop()"
```
*Expected Result*: Prints `Playwright OK: 151.0.7922.34`.

### 5.3 Verification of New Test Suite (Once Implemented)
Run the unit/integration server health suite:
```powershell
pytest tests/test_pine_server_health.py -v
```
Run the Playwright custom/library indicator E2E suite:
```powershell
pytest tests/test_pine_custom_library_playwright.py -v --tb=short
```
Run the unified E2E test runner for Tier 9:
```powershell
python run_e2e_tests.py --tier 9 -v
```

### 5.4 Invalidation Conditions
This investigation and test architecture would be invalidated if:
1. The Charting Library version is changed to one where `_metainfoVersion` 52 is no longer supported.
2. The dataset naming convention in `chart-widget-gui.*.js` is modified (e.g. `legend-show-hide-action` renamed).
3. The user explicitly reverses the directive to exclude built-in indicators.
