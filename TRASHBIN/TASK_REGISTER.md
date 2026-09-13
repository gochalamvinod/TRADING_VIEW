# Master Task Register: Complete End-to-End Requirements Analysis

> **Analysis Scope**: All 66 user interactions from conversation initialization to the present turn, including all 24 user-uploaded screenshots, code snippets, defect reports, and feature requests.

---

## 1. Executive Summary of User Requirements & Core Directives

The user requires a **100% authentic TradingView reproduction** with **0% diversion**:
1. **Pine Script Editor IDE (1:1 GUI)**: Identical to TradingView reference images across all 5 views (main editor view, title dropdown, three dots `•••` action dropdown, status bar, and collapsible console drawer).
2. **Indicator Settings Dialog (1:1 TradingView UI)**: Fix the crude vertical inputs stack to match authentic TradingView dialog with group headers (`SESSION A`, etc.), inline horizontal alignment (`inline = "..."`), session time pickers `[13:00 🕒] - [22:00 🕒]`, tooltips `ℹ`, and tabs (`Inputs`, `Style`, `Visibility`).
3. **Pine Script Version Converter & Multi-Version Runtime (v1 through v6)**:
   - Floating yellow lightbulb 💡 next to version directive when version < 6.
   - Quick Fix popup: `💡 Convert script to v6`.
   - Side-by-side diff modal (`Converting script`) with red deletions `-` and green additions `+`, minimap diff bars, `[Cancel]` and `[Apply]`.
   - Complete migration engine converting v1 → v2 → v3 → v4 → v5 → v6.
   - Runtime support for any version without errors.
4. **Unified Theme Architecture in Settings**:
   - Add Theme control (Dark / Light) in Settings (Chart Settings & Editor Settings).
   - Dynamically sync theme across the entire application: Chart, Pine Editor, Trading Panel, Watchlist, and modals.
5. **Header Toolbar Cleanup**:
   - Remove redundant `| Alert | <> Pine Editor |` buttons injected into top header toolbar, as clean access is already provided on the right vertical toolbar and bottom dock tabs.
6. **Robust Pine Script Execution & Chart Plotting**:
   - Exact `plotshape`, `plotcandle`, `open[1]` series indexing, `request.security`, and drawing primitives without orphan shapes or ghost plots.
   - Zero lag, MT5 broker integration, and clean indicator removal/lifecycle.

---

## 2. Granular Task Breakdown

### Category A: Top Header Cleanup & Theme Synchronization
- [x] **TASK-A1: Remove Injected Top Header Buttons** (User Input 63, `media_1789059700010.png`):
  - Remove `attachHeaderButton` calls from `index.html` and `pine_editor_ide.js`.
  - Ensure the top header toolbar is clean and uncluttered, matching native TradingView.
- [ ] **TASK-A2: Dual-Theme Architecture in `pine_editor.css`** (User Input 63):
  - Refactor hardcoded `#ffffff !important` in `#pine_editor_dock`, `.pine-workspace`, `.pine-gutter`, `.pine-editor-container`, etc.
  - Implement `.theme-dark` (TradingView `#131722` / `#1e222d` / `#2a2e39` / `#d1d4dc`) and `.theme-light` (`#ffffff` / `#fafbfc` / `#e0e3eb` / `#131722`).
  - Seamlessly switch themes without page reload.
- [ ] **TASK-A3: Theme Control in Settings** (User Input 63):
  - In Chart Settings dialog (Canvas tab / Settings modal): Inject Theme switcher (Dark / Light).
  - In Pine Editor `•••` action menu -> "Editor settings...": Open authentic settings dialog with Theme switcher (Dark / Light) + font size, tab size, wrap, minimap.
  - Wire to `setAppTheme(theme)` to synchronize Chart (`widget.changeTheme`), Pine Editor, and localStorage.

---

### Category B: 1:1 Authentic Indicator Settings Dialog
*(User Input 65, comparing `media_1789060285102.png` [our current crude UI] vs `media_1789060474799.png` [TradingView authentic UI])*
- [ ] **TASK-B1: Group Headers Rendering**:
  - Parse Pine Script `group = ...` attribute on inputs.
  - Render clean uppercase muted group headers (`SESSION A`, `SESSION B`, `RANGES SETTINGS`, `TIMEZONE`, `DASHBOARD`, `DIVIDERS`, etc.) with proper top margins and divider lines.
- [ ] **TASK-B2: Inline Horizontal Row Layout**:
  - Parse `inline = "..."` attribute on inputs.
  - Group all inputs sharing the same inline key (e.g. `inline = "sessionA"` for Enable + Name, or `inline = "sessionAOverlays"` for Range, Trendline, Mean, VWAP, Max/Min).
  - Render them side-by-side on a single clean horizontal flex row with proper gap and alignment.
- [ ] **TASK-B3: Authentic `input.session` Time Pickers**:
  - Detect `input.session` or format `HHMM-HHMM` / `"1300-2200"`.
  - Split into start time and end time.
  - Render as two time inputs with clock icon 🕒 dropdowns: `[ 13:00 🕒 ] — [ 22:00 🕒 ]`.
  - Provide interactive 15-minute interval selection dropdowns (00:00, 00:15, ..., 23:45).
- [ ] **TASK-B4: Tooltip Info Icons (`ℹ`)**:
  - Parse `tooltip = "..."` attribute on inputs.
  - Render the small circular info icon `ℹ` on the right edge of the row, displaying the tooltip text on hover.
- [ ] **TASK-B5: Dialog Footer & Tabs**:
  - Tabs: `Inputs`, `Style`, `Visibility`.
  - Footer: `Defaults ▾` dropdown button on the left, `Cancel` and `Ok` buttons on the right.

---

### Category C: Pine Script Version Converter & Quick Fix Diff Engine
*(User Input 64, `media_1789060090732.png`, `media_1789060097005.png`, `media_1789060158390.png`)*
- [ ] **TASK-C1: Gutter Lightbulb (💡) Detection & Hover**:
  - Monitor cursor line and check if active script version is `< 6` (e.g. `//@version=5`, `4`, `3`, `2`, `1`, or omitted).
  - Display a floating yellow lightbulb icon 💡 in the line margin / gutter next to the `//@version=...` line (or line 1).
- [ ] **TASK-C2: Quick Fix Popover**:
  - Clicking the lightbulb opens the authentic dark floating menu:
    - Header: `Quick Fix` (muted gray)
    - Item: `💡 Convert script to v6` (or next version).
- [ ] **TASK-C3: Complete Version Migration Engine (`PineVersionConverter`)**:
  - **v1 → v2**: Type enforcement, `nz()` on self-references, `//@version=2`.
  - **v2 → v3**: Variable reassignments converted from `=` to `:=`, `//@version=3`.
  - **v3 → v4**: Bare colors to `color.*` (`red` -> `color.red`), `input(...)` type migrations (`type=integer` -> `input.int`), `line.new`, `label.new`, `var` declarations, `//@version=4`.
  - **v4 → v5**:
    - `study(...)` -> `indicator(...)`.
    - Technical analysis functions to `ta.*` namespace (`sma` -> `ta.sma`, `rsi` -> `ta.rsi`, `macd` -> `ta.macd`, `atr` -> `ta.atr`, `crossover` -> `ta.crossover`, `crossunder` -> `ta.crossunder`, `highest` -> `ta.highest`, `lowest` -> `ta.lowest`, etc.).
    - Math functions to `math.*` namespace (`abs` -> `math.abs`, `max` -> `math.max`, `min` -> `math.min`, `pow` -> `math.pow`, `round` -> `math.round`, `sqrt` -> `math.sqrt`, etc.).
    - `security(...)` -> `request.security(...)`.
    - `tostring(...)` -> `str.tostring(...)`.
    - `input(...)` -> `input.int`, `input.float`, `input.bool`, `input.string`, `input.color`, `input.timeframe`.
  - **v5 → v6**:
    - `//@version=6`.
    - String literals, strict type declarations (`color BULL_COLOR = #089981`, `string TOP_RIGHT = "Top Right"`, etc.).
    - Strict boolean parameter values.
- [ ] **TASK-C4: Side-by-Side Diff Modal ("Converting script")**:
  - Dialog title: `Converting script` with `✕` close button.
  - Left pane: Original code with deleted lines highlighted in soft red (`-` prefix, background `rgba(242, 54, 69, 0.15)`).
  - Right pane: Converted code with added lines highlighted in soft green (`+` prefix, background `rgba(8, 153, 129, 0.15)`).
  - Synchronized scrolling and minimap diff bars with red/green tick marks.
  - Action buttons: `[Cancel]` and `[Apply]`.
- [ ] **TASK-C5: Apply Action Wiring**:
  - Clicking `[Apply]` replaces editor textarea content with converted v6 code.
  - Status bar updates to `Pine Script® v6`.
  - Console drawer logs: `[Time] Converting...` and `[Time] Compiled.`.
  - Triggers compilation and chart update.

---

### Category D: Multi-Version Pine Script Runtime Execution
- [ ] **TASK-D1: Universal Version Execution Scope in `pine_indicators.js`**:
  - Enable scripts written in v1, v2, v3, v4, v5, or v6 to run seamlessly on the chart even if the user decides not to convert them immediately.
  - Provide fallback aliases: `study = indicator`, `sma = pineTa.sma`, `rsi = pineTa.rsi`, `abs = Math.abs`, `security = pineRequest.security`, bare color names (`red`, `green`, etc.).
- [x] **TASK-D2: `plotshape` Execution**:
  - Shape styles (`shape.triangleup`, `shape.triangledown`, `shape.circle`, `shape.arrowup`, etc.).
  - Shape locations (`location.belowbar`, `location.abovebar`, `location.top`, `location.bottom`).
  - Shape colors, titles, and conditional triggers (`open > close`).
- [x] **TASK-D3: `open[1]` Series Indexing**:
  - Zero-indexed historical bar access (`arr.length - 1 - idx`).
  - Returns `NaN` on bar 0, accurate preceding bar open on bar 1+.
- [x] **TASK-D4: Study Removal & Orphan Plot Cleanup**:
  - Observer detecting study deletion and clearing all canvas shapes, lines, boxes, and tables.

---

### Category E: Pine Editor IDE GUI 1:1 Visual Parity (Images 1–5)
- [x] **TASK-E1: Image 1 Main View**: Title bar, toolbar, action buttons `▷ Add to chart`, `📤 Publish script`, `•••` action button with red notification dot, code view, minimap, status bar.
- [x] **TASK-E2: Image 2 Title Dropdown**: Save script (Ctrl+S), Make a copy..., Rename..., Version history..., Move script to bottom/side, Create new ›, RECENTLY USED, Open script... (Ctrl+O).
- [x] **TASK-E3: Image 3 `•••` Dropdown**: Editor settings..., New window, New tab, Profiler mode toggle, Pine logs ❔, Release notes 🔴, Help ›.
- [x] **TASK-E4: Image 4 Status Bar**: `[>_]` button on left, `Line X, Col Y   Pine Script® vN` on right.
- [x] **TASK-E5: Image 5 Console Drawer**: Collapsible timestamped diagnostic drawer.
- [x] **TASK-E6: Read-Only Warning Banner**: "This script is read-only. To edit its code you can make a copy."

---

### Category F: Broker & Chart Integration
- [x] **TASK-F1: MT5 Broker Integration**: Only MT5 broker active, live pricing, account manager.
- [x] **TASK-F2: Gesture Engine**: Secondary click / two-finger tap opens settings.
- [x] **TASK-F3: Watermark Suppression**: Intrusive logos removed from chart canvas.
- [x] **TASK-F4: Auto-Volume Suppression**: No unsolicited volume indicator auto-added.

---

## 3. Immediate Implementation Sequence
1. **Execute Task B**: Complete redesign of Indicator Settings dialog in `pine_indicators.js` to match Image 2 (`media_1789060474799.png`) with groups, inline rows, session time pickers, and tooltips.
2. **Execute Task C**: Build `PineVersionConverter`, floating 💡 bulb, Quick Fix popup, and side-by-side diff modal ("Converting script").
3. **Execute Task A & Category D**: Theme switcher in Settings + dual-theme CSS in `pine_editor.css`, and universal v1-v6 runtime execution.
4. **Comprehensive Verification**: Playwright tests verifying indicator settings dialog, version conversion diff modal, theme toggle, and live chart execution.
