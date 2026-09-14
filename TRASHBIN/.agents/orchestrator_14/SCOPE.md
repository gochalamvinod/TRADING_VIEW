# Scope: Operational Parity, HFT Backend & UI Regression Suite (orchestrator_14)

## Architecture
```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             TradingView Frontend                                 │
│                                                                                  │
│  ┌─────────────────────────┐  ┌────────────────────────┐  ┌────────────────────┐ │
│  │   Chart Canvas & Legend │  │  Floating Toolbar      │  │ Pine Editor IDE    │ │
│  │   - Title -> Sym Search │  │  - Eye, Hexagon        │  │ - Bottom Dock      │ │
│  │   - 3-dots Context Menu │  │  - { } Open in Editor  │  │ - Dark Theme       │ │
│  │   - { } Open in Editor  │  │  - Trash, 3-dots       │  │ - 0 Native Popups  │ │
│  │   - Clean Ticker Title  │  │                        │  │ - 7 Sub-items menu │ │
│  └────────────┬────────────┘  └───────────┬────────────┘  └──────────┬─────────┘ │
│               │                           │                          │           │
│               └───────────────────────────┴──────────────────────────┘           │
│                                           │                                      │
│                                           ▼                                      │
│                       window.PineEditorIDE.setDockOpen(true)                     │
│                       openScriptForStudy() -> #pine_code_input                   │
└───────────────────────────────────────────┬──────────────────────────────────────┘
                                            │ HTTP / WebSocket (:9000 -> :8080)
┌───────────────────────────────────────────▼──────────────────────────────────────┐
│                    FastAPI Backend & HFT Engine (server.py)                      │
│                                                                                  │
│  - Integer timestamp to mt5.copy_rates_from (fixes incremental update loop)      │
│  - Raw UTC ticks in seconds.py & ticks.py (no double-subtraction of offset)      │
│  - Non-blocking _FAST_READ_METHODS concurrency in hft_engine.py                  │
│  - 250,000 tick ContiguousTickRingBuffer in RAM (<0.15ms aggregations)           │
└──────────────────────────────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|:------:|
| F44 | Floating Toolbar `{ }` Button | Authentic `{ }` button on `.tv-floating-toolbar` alongside eye & settings | M30 | ORIGINAL_REQUEST §R1 | **PLANNED** |
| F45 | Legend Hover `{ }` Button | Authentic `{ }` button on hover for indicator/study legend items | M30 | ORIGINAL_REQUEST §R1 | **PLANNED** |
| F46 | `PineEditorIDE.setDockOpen` & Script Load | Public export `setDockOpen(true)`, loads source into editor, focuses textarea | M30 | ORIGINAL_REQUEST §R1 | **PLANNED** |
| F47 | Legend Main Series Title Click | Clicking `XAUUSD.` immediately triggers `symbolSearch` dialog | M31 | ORIGINAL_REQUEST §R2 | **PLANNED** |
| F48 | Legend 3-Dots Context Menu | 3-dots visible on hover for series item and opens context menu | M31 | ORIGINAL_REQUEST §R2 | **PLANNED** |
| F49 | Legend Polish & Duplicate Cleanup | Remove circular logo badge `[X]`, remove duplicate description (`XAUUSD. • 1 • MetaTrader5`) | M31 | ORIGINAL_REQUEST §R2 | **PLANNED** |
| F50 | Dark Theme Consistency | Authentic dark theme across workspace, gutter, textarea, minimap, status bar, drawer | M32 | ORIGINAL_REQUEST §R3 | **PLANNED** |
| F51 | Zero Native Browser Popups | Eliminate `alert()`, `confirm()`, `prompt()`; 100% in-chart custom modals/toasts | M32 | ORIGINAL_REQUEST §R3 | **PLANNED** |
| F52 | Incremental Update Loop Permanent Fix | Integer epoch seconds to `copy_rates_from`, UTC ticks, filter incremental bars | M33 | ORIGINAL_REQUEST §R4 | **PLANNED** |
| F53 | 100,000x Speed Backend & No Spinner Locks | Expand `_FAST_READ_METHODS`, 250k tick RingBuffer, 3s frontend watchdog | M33 | ORIGINAL_REQUEST §R4 | **PLANNED** |
| F54 | Complete 38-Step Button Regression Suite | Full button & subbutton regression suite with screenshot verification across 5 surfaces | M34 | ORIGINAL_REQUEST §R5 | **PLANNED** |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|:------:|
| M30 | Floating Toolbar & Legend `{ }` Integration | `pine_editor_ide.js`, `pine_indicators.js`, `pine_editor.css` (F44, F45, F46) | Survey | **PLANNED** |
| M31 | Legend Interaction Polish & Defect Fixes | `pine_editor_ide.js`, `index.html`, `pine_editor.css` (F47, F48, F49) | Survey | **PLANNED** |
| M32 | Dark Theme & Zero Browser Popups | `pine_editor.css`, `pine_editor_ide.js` (F50, F51) | Survey | **PLANNED** |
| M33 | 100,000x Speed Backend & Realtime Stability | `server.py`, `seconds.py`, `ticks.py`, `hft_engine.py`, `index.html` (F52, F53) | Survey | **PLANNED** |
| M34 | Complete Button Regression Suite & Screenshot Verification | `tests/test_button_regression_suite.py`, `run_e2e_tests.py`, `scratch/test_all_buttons_regression.js` (F54) | M30, M31, M32, M33 | **PLANNED** |

## Code Layout & Write Ownership
- **Worker Frontend UI (M30, M31, M32)**: Owns `pine_editor_ide.js`, `pine_indicators.js`, `pine_editor.css`.
- **Worker Backend HFT (M33)**: Owns `server.py`, `seconds.py`, `ticks.py`, `hft_engine.py`, and UDF datafeed hooks in `index.html`.
- **Worker Test Suite (M34)**: Owns `tests/test_button_regression_suite.py`, `run_e2e_tests.py`, and `scratch/test_all_buttons_regression.js`.
