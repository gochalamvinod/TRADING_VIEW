# Project: TradingView Advanced Pine Script IDE (1:1 TradingView Parity)

## Architecture
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TradingView Advanced Chart IDE                     │
│                                                                             │
│  ┌───────────────────────┐  ┌───────────────────────┐  ┌──────────────────┐ │
│  │   Chart Widget & UI   │  │  CodeMirror Editor    │  │  Pine Runtime    │ │
│  │  - Theme Synchronization│  │  - Gutter 💡 Marker   │  │  - Multi-version │ │
│  │  - Settings Dialog (R1)│  │  - Quick Fix Popover  │  │    v1-v6 compat   │ │
│  │  - Dark/Light Theme    │  │  - Diff Modal (R2)   │  │  - Aliases & map  │ │
│  │  - Editor Settings Modal│ │  - Theme CSS Vars(R3) │  │  - Series index   │ │
│  └───────────┬───────────┘  └───────────┬───────────┘  └─────────┬────────┘ │
│              │                          │                        │          │
│              ▼                          ▼                        ▼          │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │              pine_indicators.js & pine_editor.js / .css               │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Feature Inventory
| # | Feature | Description | Milestone | Source | Status |
|---|---------|-------------|-----------|--------|:------:|
| 1 | R1: Authentic Indicator Settings Dialog | Tabbed modal (Inputs, Style, Visibility), dark theme (#131722), group headers, inline row flex layout, session time pickers, tooltips, color/bool/string/source pickers, Defaults/Cancel/Ok | M30 | ORIGINAL_REQUEST §R1 | IN_PROGRESS |
| 2 | R2: Pine Script Version Converter & Diff Modal | Gutter 💡 bulb on //@version=N < 6, Quick Fix popover, chained v1->v6 migration engine, full side-by-side diff modal with synced scrolling, Apply/Cancel actions | M31 | ORIGINAL_REQUEST §R2 | IN_PROGRESS |
| 3 | R3: Unified Dark/Light Theme Architecture & Settings | CSS custom properties token system in pine_editor.css, zero hardcoded hex/!important, Editor Settings modal from ••• menu, PineEditorIDE.setTheme API, chart sync, localStorage | M32 | ORIGINAL_REQUEST §R3 | IN_PROGRESS |
| 4 | R4: Universal Multi-Version Pine Script Runtime | v1-v6 compatibility layer in pine_indicators.js, bare functions (sma, ema, rsi, etc.), bare colors, study->indicator, security->request.security, tostring, series indexing | M33 | ORIGINAL_REQUEST §R4 | IN_PROGRESS |
| 5 | E2E Testing Suite (Tiers 1-4) & Adversarial Verification | Comprehensive automated test suite (Category-Partition, BVA, Pairwise, Real-world workload, LuxAlgo session, chained diff, theme sync) | M34 | ORIGINAL_REQUEST §Verification | IN_PROGRESS |

## Milestones
| # | Name | Scope | Dependencies | Status |
|---|------|-------|-------------|:------:|
| M30 | R1: Indicator Settings Dialog | `pine_indicators.js`, `pine_editor.js`, `pine_editor.css`: Tabbed dialog, group/inline parsing, session pickers, swatch pickers, inputs serialization | none | IN_PROGRESS |
| M31 | R2: Version Converter & Diff Modal | `pine_editor.js`, `pine_version_converter.js`: CodeMirror gutter marker, Quick Fix popover, conversion rules v1-v6, side-by-side diff modal | none | IN_PROGRESS |
| M32 | R3: Theme System & Settings Modal | `pine_editor.css`, `pine_editor.js`, `index.html`: CSS custom properties, Editor Settings modal, `setTheme` API, `setAppTheme` integration | none | IN_PROGRESS |
| M33 | R4: Multi-Version Runtime | `pine_indicators.js`: Multi-version AST/evaluation aliases, bare functions, bare colors, study/security/tostring aliases, series indexing | none | IN_PROGRESS |
| M34 | E2E Testing Track | `tests/`: Automated unit, integration, and browser test suite across R1-R4, publishing `TEST_READY.md` | M30, M31, M32, M33 | IN_PROGRESS |

## Interface Contracts
- `PineEditorIDE.setTheme(themeName)`: sets `data-theme="dark"` or `"light"` on the editor dock container element.
- `PineVersionConverter.convert(code, fromVersion, toVersion)`: returns `{ convertedCode, changesCount, diff: [...] }`.
- `parsePineMetadata(source)`: returns `{ title, inputs: [...], groups: [...], inlines: [...] }`.
- `window.openIndicatorSettings(indicatorInstance)`: renders the 1:1 authentic TradingView settings modal.
