# Project: Native TradingView-Style Pine Script IDE & Indicator Runtime Engine

## Architecture
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             TradingView Frontend                                 │
│                                                                                  │
│  ┌─────────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐ │
│  │   TradingView Widget    │  │  Pine Script v5 IDE    │  │ Authentic Bottom   │ │
│  │  (TT v29.6.0 Standalone)│  │  (Editor, Logs, Docs)  │  │ Dock & Tab System  │ │
│  └────────────┬────────────┘  └───────────┬────────────┘  └──────────┬─────────┘ │
│               │                           │                          │           │
│               │ custom_indicators_getter  │ Apply to Chart           │ Native TV │
│               ▼                           ▼ (lock: false)            ▼ Styling   │
│  ┌───────────────────────────────────────────────────────────────────▼─────────┐ │
│  │                     pine_indicators.js & Transpiler Engine                    │ │
│  │  - Metainfo v52/v53 Schema (<name>@tv-basicstudies-1)                         │ │
│  │  - Std Execution Engine (this.main(ctx, inputCallback))                       │ │
│  │  - Non-NaN Series Guarantee (Zero-Warmup Cold-Start Seeding)                  │ │
│  │  - 0-Plot Adaptive Trend Baseline Fallback (EMA-21 / RSI-14)                  │ │
│  │  - 8 Reference Pine v5 Templates (SMA, EMA, RSI, MACD, BB, ATR, Trend, Vol)  │ │
│  └────────────────────────────────────────┬───────────────────────────────────┘ │
└───────────────────────────────────────────┼──────────────────────────────────────┘
                                            │ HTTP :9000
┌───────────────────────────────────────────▼──────────────────────────────────────┐
│                    FastAPI Backend Server & Proxy (:9000 / :8080)               │
│  - /health, /pine/catalog, /pine/transpile, /pine/source/*, /pine/js/*           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|:------:|
| F39 | Native Pine Indicator Execution & Non-NaN Numerical Series | Eliminate globalThis pollution; fix named argument plot regex; implement zero-warmup cold-start seeding; ensure all custom/library scripts render visible series | M20 | ORIGINAL_REQUEST §R1 | **IN_PROGRESS** |
| F40 | 0-Plot Adaptive Trend Baseline Fallback & Pine Logs Diagnostic | Inject 21-period EMA (overlays) or 14-period RSI (subpanes) for scripts with 0 explicit plot() calls (Golden Pocket Zones, Smart Trader, etc.); emit informative notice in Pine Logs | M20 | ORIGINAL_REQUEST §R1 | **IN_PROGRESS** |
| F41 | Native Legend Controls & Study Editability | Enforce `chart.createStudy(name, isOverlay, false)` with `lock: false`; expose interactive hover buttons: Hide/Show (👁️), Format/Settings (⚙️), Delete (🗑️); verify event handlers | M21 | ORIGINAL_REQUEST §R2 | **IN_PROGRESS** |
| F42 | Reference Built-in Indicators Architecture & Pine v5 Templates | Conform to Metainfo v52/v53 schema (`id: <name>@tv-basicstudies-1`) and Std execution engine; provide 8 clean Pine v5 templates (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume) | M22 | ORIGINAL_REQUEST §R3 | **IN_PROGRESS** |
| F43 | Authentic TradingView Bottom Dock UI Overhaul | Eliminate unauthentic #bottom_dock_tabs, tree emoji 🌲, and clunky floating bottom bars; integrate Pine Editor and Pine Logs seamlessly into TradingView's native bottom dock tab area with authentic dark theme styling | M22 | Critical Directive 2026-09-09 | **IN_PROGRESS** |
| F44 | Focused Custom/Library Automated Test Suite & Server Stability Verification | Playwright automated headless tests verifying custom/library scripts (SMA Crossover, Smoothed RSI, Crossing MAs, Golden Pocket Zones, Smart Trader); verify non-NaN canvas plot rendering, legend controls, authentic bottom dock UI; exclude built-ins; verify 100% server health | M23 | ORIGINAL_REQUEST §R4 | **IN_PROGRESS** |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|:------:|
| M20 | Native Indicator Execution & Visual Plots (R1) | `pine_indicators.js`: Non-NaN series calculation, zero-warmup seeding, 0-plot adaptive trend baseline fallback (EMA-21/RSI-14), Pine Logs notice | none | **IN_PROGRESS** |
| M21 | Native Legend Controls & Study Editability (R2) | `pine_editor_ide.js`, `index.html`: `lock: false` in createStudy, hover action buttons (Hide/Show, Format Settings, Delete) | none | **IN_PROGRESS** |
| M22 | Reference Built-in Architecture & Authentic Bottom Dock UI (R3) | `pine_indicators.js`, `pine_editor_ide.js`, `pine_editor.css`: 8 Pine v5 templates, eliminate clunky emoji bottom bars, integrate authentic TradingView bottom dock | none | **IN_PROGRESS** |
| M23 | Parallel Automated Verification & Hardening (R4) | `tests/test_pine_server_health.py`, `tests/test_pine_custom_library_playwright.py`, `run_e2e_tests.py`: Tier 9 test suite strictly on custom/library scripts, 100% server health | M20, M21, M22 | **IN_PROGRESS** |

## Interface Contracts
### Study Registration Contract (`custom_indicators_getter`)
- Schema: Metainfo v52/v53: `{ id: "<name>@tv-basicstudies-1", name: string, description: string, shortDescription: string, is_price_study: boolean, plots: [{ id: "plot_0", type: "line" }], defaults: { styles: { plot_0: { color: "#2962FF", linewidth: 2, plottype: 0, title: "..." } } } }`
- Constructor Contract: `this.main = function(ctx, inputCallback) { return [plotValues...]; }`
- Return value: Must return ordered numeric Array matching `metainfo.plots`. No NaNs after bar 0.

### Study Creation & Legend Contract
- Invocation: `await chart.createStudy(studyName, isOverlay, false)`
- Requirement: 3rd argument `lock` MUST be `false` to preserve `userEditEnabled() === true`.
- Buttons:
  - `legend-show-hide-action`: toggles `source.properties().childs().visible`
  - `legend-settings-action`: calls `showChartPropertiesForSource(source)`
  - `legend-delete-action`: calls `model.removeSource(source, false)`

### Bottom Dock Contract
- Container: Native TradingView bottom area coordination (`.layout__area--bottom`, `setAccountManagerVisibilityMode`).
- Tabs: `Pine Editor`, `Strategy Tester`, `Trading Panel`, `Pine Logs`.
- Tokens: Background `#131722`, tab gutter `#1e222d`, border `#2a2e39`, text `#d1d4dc`. Zero emojis.

## Code Layout & Write Ownership
- `pine_indicators.js`: Owned exclusively by `worker_m20_runtime`
- `pine_editor_ide.js`, `pine_editor.css`, `index.html`: Owned exclusively by `worker_m21_ui_dock`
- `tests/test_pine_server_health.py`, `tests/test_pine_custom_library_playwright.py`, `run_e2e_tests.py`: Owned exclusively by `worker_m23_test`
