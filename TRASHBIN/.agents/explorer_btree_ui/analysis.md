# Exhaustive Binary Tree UI Forensic Analysis Report

**Agent**: Binary Tree UI Explorer (`teamwork_preview_explorer` — Left Branch)  
**Working Directory**: `E:/TRADINGVIEW ADVANCED/.agents/explorer_btree_ui`  
**Timestamp**: 2026-09-12T05:35:00Z  
**Parent Caller ID**: `61e06442-1a8d-4c14-8e72-69a0c6a225a6`  
**Scope**: 100% UI Buttons, Interactive Controls, Navigation Paths, Dialogs, Modals, and Edge States across:
1. Chart Legend
2. Floating Toolbar
3. Top Toolbar
4. Bottom Dock
5. Modals & Edge States

---

## 1. Executive Summary

This investigation performs an exhaustive, segment-by-segment forensic audit across all client-side UI interactive surfaces in `index.html`, `pine_editor_ide.js`, `pine_indicators.js`, `pine_editor.css`, and the TradingView Charting Library standalone bundles (`chart-widget-gui.*.js`, `floating-toolbars.*.js`, `trading-account-manager.*.js`).

### Core Findings Summary
1. **Chart Legend**:
   - The symbol title click hook in `pine_editor_ide.js` (lines 6041–6068) correctly restricts `symbolSearch` triggering strictly to the main series item (`isMainSeries`), eliminating false triggers on indicator titles. However, clicks on outer wrapper whitespace (`.titlesWrapper`) can fail to match `titleTarget` due to omitted wrapper selector scoping.
   - The study eye icon (visibility toggle) and delete action in `pine_editor_ide.js` (lines 2008–2065) hook into `_pineActiveStudies` and `clearStudyShapes`.
   - The settings gear icon in `pine_indicators.js` (lines 3556–3570) successfully invokes the authentic 3-tab modal `openSettingsDialog` (Inputs, Style, Visibility).
   - The `{ }` code button is injected via `pine_editor_ide.js` (lines 5963–5992) with dataset attributes `legend-source-code-action` and `legend-pine-action`, functioning cleanly without browser popups.
   - The 3-dots more action button (`legend-more-action`) is preserved and made visible on hover via CSS injection (`max-width: 220px !important`).
2. **Floating Toolbar**:
   - Injected `{ }` code button in `pine_editor_ide.js` (lines 5994–6039) resolves study scripts and expands the dock.
   - **Critical Vulnerability Identified**: When `titleEl` is missing from the floating toolbar (common for custom line tools/drawings without text labels), fallback logic at line 6030 defaults to `studies[0].name`. On charts with multiple studies, clicking `{ }` on a non-first study opens the script for the first study instead of the currently selected study.
3. **Top Toolbar**:
   - Symbol search, interval tabs (`1S` to `1M`, `1T` to `100T`), candle styles (Bars, Candles, Hollow Candles, Heikin Ashi, Line, Area, Baseline), and fx Indicators button operate cleanly.
   - The fx Indicators button in `index.html` (lines 2013–2023) delegates to `PineEditorIDE.openIndicatorsModal()`, presenting a complete dark-themed indicator catalog.
4. **Bottom Dock**:
   - `Pine Editor`, `Strategy Tester`, and `Trading Panel` (Account Manager) tabs are integrated side-by-side in `#footer-chart-panel`.
   - **Critical Vulnerability Identified**: Mutual exclusion between Pine Editor and Account Manager is implemented on tab click (`pineTabDiv.addEventListener('click')`), but calling `PineEditorIDE.setDockOpen(true)` programmatically (e.g., from Legend `{ }`, Floating Toolbar `{ }`, or Right Toolbar `< / >`) does not invoke `bottomWidgetBar.close()`. This allows a dual dock clash if opened via non-tab triggers.
5. **Modals & Edge States**:
   - **Memory Leak & Stacking Vulnerability Identified**: In `showTVConfirmDialog`, `showTVPromptDialog`, `showTVNewScriptDialog`, and `openSettingsDialog`, existing overlays are cleared via `if (existing) existing.remove()`. However, the corresponding `window.addEventListener('keydown', handleKeyDown)` listeners are not unregistered before DOM node detachment. Rapid clicking accumulates orphaned keydown listeners on `window`, triggering multiple callback invocations on `Escape`.
   - **Z-Index Collision**: `tv_indicators_modal_backdrop` and `tv_confirm_modal_overlay` both share `z-index: 100000`, causing potential stacking ambiguities when confirm dialogs are spawned from inside the indicator catalog.
   - **Dark Theme Consistency**: All Pine Editor surfaces, status bar items, and console toggle buttons are verified to adhere to dark theme tokens (`#131722`, `#1e222d`, `#2a2e39`, `#363a45`, `#d1d4dc`, `#787b86`), with zero bright white flashes.

---

## 2. Binary Tree UI Exploration Matrix

| Component | Target Action | Selector / Trigger | Handler Location | Observed State | Risk / Status |
|-----------|---------------|-------------------|------------------|----------------|---------------|
| **Legend** | Symbol Title Click | `[data-name="legend-source-title"]` inside `[data-name="legend-series-item"]` | `pine_editor_ide.js:6041` | Opens Symbol Search modal via `executeActionById('symbolSearch')` | PASS (wrapper scope gap noted) |
| **Legend** | Eye Icon | `[data-name="legend-show-hide-action"]` | `chart-widget-gui.js:32`, `pine_editor_ide.js:2042` | Toggles series / study visibility & updates shapes | PASS |
| **Legend** | Settings Gear | `[data-name="legend-settings-action"]` | `pine_indicators.js:3556` -> `openSettingsDialog` | Opens authentic 3-tab modal (Inputs, Style, Visibility) | PASS |
| **Legend** | Code `{ }` Button | `[data-name="legend-source-code-action"]`, `[data-action="legend-pine-action"]` | `pine_editor_ide.js:5984` -> `openScriptForStudy` | Opens Pine Editor dock, loads code, focuses editor | PASS |
| **Legend** | 3-Dots Context Menu | `[data-name="legend-more-action"]` | `chart-widget-gui.js:32` | Displays native more actions context menu | PASS |
| **Floating Toolbar** | Drag Handle & Title | `.tv-floating-toolbar__drag`, `[class*="title-"]` | `floating-toolbars.js:20` | Draggable toolbar across canvas panes | PASS |
| **Floating Toolbar** | Eye Icon | `[data-name="toggle-visibility"]`, `toggle-anchor` | `floating-toolbars.js:25` | Toggles source visibility / lock | PASS |
| **Floating Toolbar** | Settings Hexagon | `[data-name="settings"]` | `floating-toolbars.js:30` | Opens properties dialog | PASS |
| **Floating Toolbar** | Code `{ }` Button | `[data-name="source-code"]`, `.tv-floating-code-btn` | `pine_editor_ide.js:6017` -> `openScriptForStudy` | Injected before remove button; opens script | GAP: `studies[0]` fallback on multi-studies |
| **Floating Toolbar** | Trash / Delete | `[data-name="remove"]`, `[data-name="delete"]` | `floating-toolbars.js:30`, `pine_editor_ide.js:2015` | Removes selected object & cleans up shapes | PASS |
| **Floating Toolbar** | 3-Dots Menu | `[data-name="more"]` | `floating-toolbars.js:25` | Opens line tool / source context menu | PASS |
| **Top Toolbar** | Symbol Search Button | `button[aria-label="Symbol Search"]` | Native TV Header | Opens Symbol Search dialog | PASS |
| **Top Toolbar** | Interval Selectors | Timeframe buttons (`1m`..`1D`, `1S`..`30S`, `1T`..`100T`) | `index.html:1359-1453` | Switches resolution without crash or cliff drop | PASS |
| **Top Toolbar** | Candle Types Dropdown | `button[aria-label="Candles"]` | Native TV Header (`setChartType`) | Switches between Bars, Candles, Hollow, Heikin Ashi, Line, Area, Baseline | PASS |
| **Top Toolbar** | fx Indicators Button | `[data-name="open-indicators-dialog"]`, `#header-toolbar-indicators` | `index.html:2013` -> `openIndicatorsModal` | Opens authentic Indicators & Strategies dialog | GAP: Re-hooking on layout change needed |
| **Bottom Dock** | Pine Editor Tab | `#tv_footer_pine_editor_tab button`, `[data-name="scripteditor"]` | `pine_editor_ide.js:6170` | Toggles Pine Editor dock & minimizes Account Manager | PASS |
| **Bottom Dock** | Strategy Tester Tab | `#tv_footer_strategy_tester_tab button`, `[data-name="strategy_tester_tab"]` | `pine_editor_ide.js:6191` | Opens Strategy Tester panel & closes Pine Editor | PASS |
| **Bottom Dock** | Account Manager Tabs | `[data-name="paper_trading"]` -> Positions, Orders, History, Summary | `mt5_broker.js:271`, `trading-account-manager.js:55` | Renders tables, live P&L, balance, equity | PASS |
| **Dock Collision** | Non-Tab Open Triggers | `openScriptForStudy` / Right Toolbar `< / >` | `pine_editor_ide.js:5629` (`setDockOpen`) | Expands dock | GAP: Does not close AM or Strategy Tester |
| **Modals** | Rapid Click Stacking | Buttons spawning modals (Publish, Rename, New, Settings) | `pine_editor_ide.js:2875, 2944, 3010` | Replaces DOM node | BUG: Orphaned `keydown` event listeners |
| **Modals** | Backdrop & Stacking | Backdrops of all modal overlays | `pine_editor.css:1487`, `pine_editor_ide.js:2880` | Modals centered with dark backdrops | GAP: Identical z-index (100000) conflict |
| **Modals** | Native Alert Elimination | `window.alert`, `window.confirm`, `window.prompt` | `index.html:268-304`, `pine_editor_ide.js:2874` | Fully intercepted and replaced with custom in-chart TV dialogs | PASS (0 native alerts) |
| **Styling** | Dark Theme Consistency | All dialogs, Pine Editor, dock, statusbar | `pine_editor.css:2660-2746` | Tokens `#131722`, `#1e222d`, `#2a2e39`, `#363a45` | PASS (Zero white flashes) |

---

## 3. Forensic Inspection & Evidence Chains

### Section 1: Chart Legend

#### 1.1 Symbol Title Click -> Symbol Search
- **Observation**: `pine_editor_ide.js` lines 6041–6068.
  ```javascript
  const titleTarget = t.closest('[data-name="legend-source-title"], [data-name="legend-source-description"], .title-l31H9iuA, [class*="mainTitle"]');
  if (titleTarget && !t.closest('[data-name="legend-show-hide-action"], ...')) {
    const isMainSeries = titleTarget.closest('[data-name="legend-series-item"], [class*="series-"]');
    if (isMainSeries) {
      const ch = (_widget && typeof _widget.activeChart === 'function') ? _widget.activeChart() : ...;
      if (ch && typeof ch.executeActionById === 'function') {
        e.preventDefault();
        e.stopPropagation();
        ch.executeActionById('symbolSearch');
        return;
      }
    }
  }
  ```
- **Logic Chain**:
  1. In previous builds, clicking an indicator title triggered `symbolSearch` because `.title-l31H9iuA` was present on both series and studies.
  2. The added check `titleTarget.closest('[data-name="legend-series-item"], [class*="series-"]')` guarantees that only main series symbol clicks execute `symbolSearch`.
  3. Clicks on indicator titles bypass this branch and fall through to normal study selection.
- **Identified Gap**: If the user clicks on the padding or gap of `.titlesWrapper-l31H9iuA`, `titleTarget` can be null because `[class*="titlesWrapper"]` is not in `titleTarget`'s selector list.
- **Fix Spec**: Expand selector to:
  `const titleTarget = t.closest('[data-name="legend-source-title"], [data-name="legend-source-description"], .title-l31H9iuA, [class*="mainTitle"], [class*="titlesWrapper"], [class*="titleWrapper"]');`

#### 1.2 Eye Icon (Show/Hide Visibility)
- **Observation**:
  - Main series eye icon: `chart-widget-gui.*.js` line 32 (`Qe` class pushes `legend-show-hide-action` toggling series visibility).
  - Study eye icon: `chart-widget-gui.*.js` line 34 (`vt` class pushes `legend-show-hide-action` toggling study visibility).
  - Custom shapes sync: `pine_editor_ide.js` line 2042:
    ```javascript
    const showHideBtn = e.target.closest('[data-name="legend-show-hide-action"], [data-name="toggle-visibility-button"]');
    if (showHideBtn) {
      setTimeout(() => {
        if (typeof chart.getAllStudies === 'function') {
          const currentStudies = chart.getAllStudies();
          currentStudies.forEach(s => {
            const studyApi = chart.getStudyById(s.id);
            if (studyApi && typeof studyApi.isVisible === 'function') {
              const isVis = studyApi.isVisible();
              _studyVisibilityState.set(s.id, isVis);
              if (root.PineIndicators?.setStudyShapesVisibility) {
                root.PineIndicators.setStudyShapesVisibility(s.id, isVis, chart);
              }
            }
          });
        }
      }, 50);
    }
    ```
- **Verification**: Toggling visibility hides/shows both native indicator plot candles/lines and custom shapes (session boxes, labels, dividers) synchronously.

#### 1.3 Settings Gear Icon -> Format / Settings Modal
- **Observation**: `pine_indicators.js` lines 3556–3570 and lines 4046–5030.
  - Clicking `[data-name="legend-settings-action"]` matches the study title against `chart.getAllStudies()` and invokes `openSettingsDialog(match.id, chart)`.
  - `openSettingsDialog` constructs a 100% authentic TradingView modal with 3 tabs: `Inputs`, `Style`, `Visibility`.
  - Inputs are categorized into uppercase groups (`SESSION A`, `SESSION B`, `RANGES SETTINGS`, `TIMEZONE`, etc.) with flex inline rows, session time pickers (`[13:00 🕒] — [22:00 🕒]`), color pickers, and tooltips.
  - OK button applies input values directly to `activeSrc.properties().childs().inputs.child(k).setValue(val)` and triggers `renderSessionVisuals(chart)` if applicable.

#### 1.4 Code `{ }` Button
- **Observation**: `pine_editor_ide.js` lines 5963–5992.
  - Injects a `{ }` button after the settings gear with attributes `data-name="legend-source-code-action"` and `data-action="legend-pine-action"`.
  - Click listener extracts `titleEl.textContent.trim()` and calls `openScriptForStudy(studyName)`.
  - `openScriptForStudy`:
    1. Checks built-in `TEMPLATES` (e.g. `sessions_luxalgo`, `sma`, `ema`, `rsi`, `macd`).
    2. Checks user saved scripts in `localStorage`.
    3. Checks `PineIndicators.getRegisteredStudies()`.
    4. Calls `setDockOpen(true)`, `loadScript(name, code, id)`, and focuses `#pine_code_input`.
- **Finding**: Operates smoothly with 0 errors.

#### 1.5 3-Dots Context Menu
- **Observation**: `chart-widget-gui.*.js` line 32 and `pine_editor_ide.js` lines 5852–5880.
  - `[data-name="legend-more-action"]` calls `this._moreActionHandler.bind(this)`.
  - CSS injection in `pine_legend_polish_styles` ensures `.buttonsWrapper-l31H9iuA` and `.buttons-l31H9iuA` expand to `max-width: 220px !important` on hover, rendering the 3-dots button accessible.
  - Context menu items (Settings, Visual Order, Pin to Scale, Hide, Remove) open and operate natively.

---

### Section 2: Floating Toolbar

#### 2.1 Drag Handle & Title
- **Observation**: `floating-toolbars.*.js` lines 20–28.
  - `.tv-floating-toolbar` features `.tv-floating-toolbar__drag` allowing full viewport dragging.
  - Title and state labels render cleanly.

#### 2.2 Eye Icon / Visibility Toggle
- **Observation**: Drawing/study tools in floating toolbar support `toggle-visibility`, `lock`, `unlock`, and `toggle-anchor`.

#### 2.3 Settings Hexagon
- **Observation**: `floating-toolbars.*.js` line 30: `_createSettingsButton()` creates `[data-name="settings"]`. Clicking it opens the Format properties dialog for the selected chart source.

#### 2.4 Code `{ }` Button Injection & Study Name Resolution
- **Observation**: `pine_editor_ide.js` lines 5994–6039.
  - The script injects `{ }` button before `[data-name="remove"]`.
  - Click handler:
    ```javascript
    codeWidget.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      let sName = '';
      try {
        const titleEl = tb.querySelector('[class*="title-"], [class*="label-"]');
        if (titleEl) sName = titleEl.textContent.trim();
      } catch(err) {}
      if (!sName) {
        try {
          const ch = (_widget && typeof _widget.activeChart === 'function') ? _widget.activeChart() : ...;
          if (ch) {
            const studies = ch.getAllStudies ? ch.getAllStudies() : [];
            if (studies.length > 0) sName = studies[0].name;
          }
        } catch(err) {}
      }
      openScriptForStudy(sName);
    });
    ```
- **Identified Gap**: If `titleEl` is not found, it blindly defaults to `studies[0].name`. If the user selected the second or third study on the chart, clicking `{ }` incorrectly opens the first study!
- **Fix Spec**: Check chart selection first:
  ```javascript
  if (!sName && ch) {
    try {
      const selSources = ch.selection ? ch.selection().allSources() : (ch._chartWidget?.model()?.selection()?.allSources() || []);
      const selStudy = selSources.find(s => s && (typeof s.isStudy === 'function' ? s.isStudy() : s._metaInfo));
      if (selStudy) {
        sName = typeof selStudy.name === 'function' ? selStudy.name() : (selStudy._name || selStudy.name);
      }
    } catch(err) {}
    if (!sName) {
      const studies = ch.getAllStudies ? ch.getAllStudies() : [];
      if (studies.length > 0) sName = studies[0].name;
    }
  }
  ```

#### 2.5 Trash / Remove Icon
- **Observation**: `[data-name="remove"]` or `[data-name="delete"]` executes `activeChartWidget.removeSelectedSources()`. Triggers shape cleanup in `pine_editor_ide.js:2015`.

#### 2.6 3-Dots Menu
- **Observation**: `[data-name="more"]` opens `ActionsTable` with Clone, Copy, Visual Order, and Sync actions.

---

### Section 3: Top Toolbar

#### 3.1 Symbol Search Button
- **Observation**: `button[aria-label="Symbol Search"]` inside `.layout__area--top`.
  - Launches `[data-name="symbol-search-dialog"]` with input auto-focus.
  - Search queries execute against `/symbols` and datafeed `searchSymbols`.

#### 3.2 Interval / Resolution Selectors
- **Observation**: `index.html` lines 1359–1453.
  - Dynamic resolution validator overrides `supported_resolutions.includes` and `indexOf` to accept ANY integer seconds (`1S`..`30S`) and ticks (`1T`..`100T`).
  - Sets `has_seconds: true`, `has_ticks: true`, `is-tickbars-available: true`.
  - Verified across: `1S`, `5S`, `10S`, `15S`, `30S`, `1`, `3`, `5`, `15`, `30`, `45`, `1H`, `2H`, `3H`, `4H`, `1D`, `1W`, `1M`, `1T`, `10T`, `40T`, `100T`. Transitions occur cleanly without blank canvas or exceptions.

#### 3.3 Candle Types Selector
- **Observation**: `button[aria-label="Candles"]`.
  - Enables full palette: Bars (`0`), Candles (`1`), Hollow Candles (`9`), Heikin Ashi (`8`), Line (`2`), Area (`3`), Baseline (`10`).
  - `enabled_features`: `"japanese_chart_styles"`, `"chart_style_hilo"`, `"chart_style_hilo_last_price"`.

#### 3.4 fx Indicators Button Delegation
- **Observation**: `index.html` lines 2013–2023:
  ```javascript
  const btn = e.target.closest('#header-toolbar-indicators, [data-name="indicators"], [data-name="open-indicators-dialog"], button[aria-label*="Indicators"]...');
  if (btn) {
    e.preventDefault();
    e.stopPropagation();
    if (window.PineEditorIDE?.openIndicatorsModal) window.PineEditorIDE.openIndicatorsModal();
  }
  ```
  - Displays catalog modal (`#tv_indicators_modal_backdrop`) containing categories: Technicals, My Scripts, Favorites, Editors' Picks, Top, Trending.
  - Each item exposes: Favorite star (★), Name, `Add to chart`, `{ }` Open in Pine Editor, and Delete.
- **Identified Gap**: Hook is only attached during initialization (0ms, 500ms, 1500ms, 3000ms). If a multi-chart layout is toggled, re-attachment is needed.
- **Fix Spec**: Include `hookIframeIndicators()` call inside the 2500ms heartbeat interval in `pine_editor_ide.js:3960`.

---

### Section 4: Bottom Dock

#### 4.1 Pine Editor Tab
- **Observation**: Injected as first tab in `.tabs-n3UmcVi3`: `#tv_footer_pine_editor_tab button`.
  - Clicking toggles Pine Editor dock (`setDockOpen(!_isDockOpen)`), removes active class from Strategy Tester, and closes Account Manager via `bottomWidgetBar.close()`.

#### 4.2 Strategy Tester Tab
- **Observation**: Injected as second tab: `#tv_footer_strategy_tester_tab button`.
  - Clicking closes Pine Editor dock (`setDockOpen(false)`), closes Account Manager, and opens `#pine_strategy_tester_panel`.

#### 4.3 Account Center / Account Manager Tabs
- **Observation**: Native tab `[data-name="paper_trading"]`.
  - Configured via `mt5_broker.js:271` (`accountManagerInfo`):
    - **Positions Table**: Symbol, Side, Qty, Avg Price, Last, Profit (live syncing), Stop Loss, Take Profit.
    - **Orders Table**: Symbol, Side, Type, Qty, Limit Price, Stop Price, Last, Status (Working, Filled, Canceled), Ticket.
    - **History Table**: Symbol, Side, Type, Qty, Price, Status, Ticket.
    - **Account Summary**: Balance, Open P&L, Equity, Margin, Free Margin.
  - Clicking closes Pine Editor dock and closes Strategy Tester.

#### 4.4 Mutual Dock Exclusion Vulnerability
- **Observation**: `setDockOpen(open)` in `pine_editor_ide.js` lines 5629–5646:
  ```javascript
  function setDockOpen(open) {
    _isDockOpen = open;
    ...
    const dock = document.getElementById('pine_editor_dock');
    if (dock) dock.style.display = open ? 'flex' : 'none';
    syncRightToolbarButton(open);
    syncBottomDockTabs(open);
    window.dispatchEvent(new Event('resize'));
  }
  ```
  - When Pine Editor is opened through Legend `{ }`, Floating Toolbar `{ }`, Right Toolbar `< / >`, or `window.PineEditorIDE.open()`, `setDockOpen(true)` does NOT close Strategy Tester or Account Manager!
- **Fix Spec**: Add inside `setDockOpen(open)`:
  ```javascript
  if (open) {
    closeStrategyTesterPanel();
    try {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const innerDoc = iframe?.contentDocument || (_widget && typeof _widget._innerWindow === 'function' && _widget._innerWindow()?.document);
      const bw = innerDoc?.defaultView?.TradingView?.bottomWidgetBar || root.TradingView?.bottomWidgetBar;
      if (bw && typeof bw.close === 'function') bw.close();
    } catch(err) {}
  }
  ```

---

### Section 5: Modals, Dialogs & Edge States

#### 5.1 & 5.2 Rapid Clicking & Dangling Keydown Listeners
- **Observation**:
  - `showTVPromptDialog` (`pine_editor_ide.js:2944`):
    `const existing = document.getElementById('tv_prompt_modal_overlay'); if (existing) existing.remove();`
    `window.addEventListener('keydown', handleKeyDown);`
  - `showTVConfirmDialog` (`pine_editor_ide.js:2875`):
    `const existing = document.getElementById('tv_confirm_modal_overlay'); if (existing) existing.remove();`
    `window.addEventListener('keydown', handleKeyDown);`
  - `showTVNewScriptDialog` (`pine_editor_ide.js:3010`):
    `const existing = document.getElementById('tv_new_script_modal'); if (existing) existing.remove();`
    `window.addEventListener('keydown', handleKeyDown);`
  - `openSettingsDialog` (`pine_indicators.js:4155`):
    `const existing = document.getElementById('tv_settings_modal_overlay'); if (existing) existing.remove();`
    `document.addEventListener('keydown', onKeyDown);`
- **Root Cause Analysis**:
  1. Simply invoking `existing.remove()` unmounts the DOM element from the parent body.
  2. The registered listener (`handleKeyDown` / `onKeyDown`) remains attached to `window` / `document`.
  3. Under rapid clicking (e.g. user spamming "Publish" or "Rename"), 5–10 keydown listeners pile up in the V8 event loop.
  4. When the user subsequently presses `Escape`, every single orphaned handler fires sequentially, causing multiple unhandled calls or unexpected state mutations.
- **Fix Spec**: Attach the cleanup function directly to the element before mounting:
  `overlay._close = close;`
  And when removing:
  ```javascript
  const existing = document.getElementById('tv_confirm_modal_overlay');
  if (existing) {
    if (typeof existing._close === 'function') existing._close();
    else existing.remove();
  }
  ```

#### 5.3 Modal Stacking & Z-Index Hierarchy
- **Observation**:
  - `.tv-indicators-modal-backdrop`: `z-index: 100000;` (`pine_editor.css:1495`)
  - `#tv_confirm_modal_overlay`: `z-index: 100000;` (`pine_editor_ide.js:2884`)
  - `#tv_prompt_modal_overlay`: `z-index: 100000;` (`pine_editor_ide.js:2953`)
  - `#tv_new_script_modal`: `z-index: 100000;` (`pine_editor_ide.js:3019`)
  - `#tv_settings_modal_overlay`: `z-index: 250000;` (`pine_indicators.js:4202`)
  - `#tv_diff_modal_overlay`: `z-index: 250000;` (`pine_editor_ide.js:5241`)
- **Root Cause**: When `showTVConfirmDialog` is called from within the indicators modal (e.g. to confirm script deletion), both have `z-index: 100000`. Stacking order is vulnerable to re-rendering.
- **Fix Spec**: Standardize z-index tiers:
  - Base overlays / docks: `z-index: 10000`
  - Catalog / Settings / Diff modals: `z-index: 150000`
  - Confirm / Alert / Prompt modals: `z-index: 200000`
  - Global notification toast: `z-index: 999999`

#### 5.4 Zero Native Browser `alert()` Dialogs
- **Observation**: `index.html` lines 268–304.
  - `window.alert`, `window.confirm`, and `window.prompt` are globally intercepted.
  - Routed to `showTVAlertDialog`, `showTVConfirmDialog`, `showTVPromptDialog`, or graceful toast notifications.
  - Automated CDP test (`test_all_buttons_regression.js`) confirmed 0 native dialogs triggered.

#### 5.5 Dark Theme Consistency & Zero White Flash
- **Observation**: `pine_editor.css` lines 2660–2746.
  - Default styles use `#1e222d`, `#2a2e39`, `#363a45`, `#d1d4dc`, and `#787b86`.
  - Light theme properties are strictly scoped under `[data-theme="light"]`.
  - On page load, `index.html` lines 12–17 sets `data-theme="dark"` and `class="theme-dark"` synchronously before DOM rendering, preventing any white flashes.

---

## 4. Summary of Identified Gaps & Required Fix Specifications

| # | Component | File & Lines | Bug / Gap Description | Fix Specification |
|---|-----------|--------------|----------------------|-------------------|
| 1 | Chart Legend | `pine_editor_ide.js:6049` | Clicking outer `.titlesWrapper` on main series item can miss `titleTarget` | Include `[class*="titlesWrapper"], [class*="titleWrapper"]` in `t.closest(...)` selector |
| 2 | Floating Toolbar | `pine_editor_ide.js:6030` | Falls back to `studies[0]` when `titleEl` is absent, opening wrong script on multi-study charts | Resolve selected study via `ch.selection().allSources()` prior to `studies[0]` fallback |
| 3 | Modals / Dialogs | `pine_editor_ide.js:2875, 2944, 3010`, `pine_indicators.js:4155` | Orphaned `keydown` event listeners on rapid modal spawning | Store `overlay._close = close` and call it on `existing` before removal |
| 4 | Modal Stacking | `pine_editor_ide.js:2884, 2953, 3019`, `pine_editor.css:1495` | Z-index collision (`100000`) between parent catalog and child confirm dialog | Elevate Confirm/Alert/Prompt dialogs to `z-index: 200000` |
| 5 | Bottom Dock | `pine_editor_ide.js:5629` | `setDockOpen(true)` does not close Strategy Tester or Account Manager | Add `closeStrategyTesterPanel()` and `bottomWidgetBar.close()` inside `setDockOpen(true)` |
| 6 | Top Toolbar | `pine_editor_ide.js:3960`, `index.html:2008` | fx Indicators button click hook may drop after multi-chart layout changes | Include `hookIframeIndicators()` inside the 2500ms lifecycle heartbeat |
