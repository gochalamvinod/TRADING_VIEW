# BRIEFING — 2026-09-09T06:20:00Z

## Mission
Investigate frontend Pine Editor IDE, Charting Library hooks, study legend DOM, editability (lock: false), hover action buttons (eye, gear, trash), reference templates, and authentic TradingView bottom UI styling.

## 🔒 My Identity
- Archetype: explorer
- Roles: frontend investigator, UI & legend controls analyst
- Working directory: e:\TRADINGVIEW ADVANCED\.agents\explorer_survey_orch7_2
- Original parent: 629ecdbb-bdd9-4267-83c2-050d30aba17d
- Milestone: M0 / M21 / M22 survey

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Investigation only; output analysis.md and 5-component handoff.md in own directory
- Strict evidence chain with file paths and line numbers
- Follow prompt protection rules

## Current Parent
- Conversation ID: 629ecdbb-bdd9-4267-83c2-050d30aba17d
- Updated: not yet

## Investigation State
- **Explored paths**:
  - `pine_editor_ide.js` (DOM mounting, IDE tabs, open menu, compile & add to chart, bottom dock tab bar, emojis)
  - `pine_indicators.js` (Std math library, metainfo v52 builder, studyConstructor, prebuilt templates, custom_indicators_getter)
  - `pine_editor.css` (Dark theme design tokens, bottom dock tabs, gutter, drawer)
  - `index.html` (widget options, custom_indicators_getter, enabled_features, iframe styling, IDE initialization)
  - `charting_library/bundles/library.e8d44337c84d65489d2c.js` (createStudy, studyMetaInfoRepository, lock parameter, removeEntity, showPropertiesDialog, custom_indicators_getter, bottom widget bar init)
  - `charting_library/bundles/chart-widget-gui.373398f680e71823f0f1.js` (legend DOM rendering, vt class, _createActions, onToggleDisabled, onShowSettings, onRemoveSource, _getIsEditable)
  - `charting_library/bundles/terminal-configset.abbe3b2ddf1adcad2530.js` (native widgets: paper_trading, scripteditor, backtesting, screener)
  - `charting_library/bundles/trading.5355aa53ba59846168ee.js` (setAccountManagerVisibilityMode, bottomWidgetMode)
  - `charting_library/bundles/2666.d7dd4a59f33a2f52cf86.css` (legend item hover, buttonsWrapper, buttonIcon, action buttons display)
  - `server.py` (/pine/catalog, /pine/transpile, /pine/source, /pine/js)
- **Key findings**:
  - `createStudy(name, forceOverlay, lock, ...)`: parameter `lock` directly drives `e.setUserEditEnabled(!1)`. When `lock: false`, `userEditEnabled()` is true.
  - `userEditEnabled()` controls `canBeHidden()`, `isUserDeletable()`, and `_getIsEditable()`.
  - Hover action buttons in legend (`legend-show-hide-action`, `legend-settings-action`, `legend-delete-action`) are gated by `show_hide_button_in_legend`, `format_button_in_legend`, `delete_button_in_legend`, and `property_pages` featuresets, and `_getIsEditable()`.
  - All required featuresets are already active in `index.html` `enabled_features`.
  - 8 working PineScript v5 reference templates cataloged: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume.
  - Root cause of user's bottom UI dissatisfaction diagnosed: unauthentic tree emoji `🌲`, custom `#bottom_dock_tabs` creating double bottom bars against TradingView's native bottom area.
  - Solution: Remove emojis, apply authentic TradingView design tokens (`#131722` / `#1e222d` / `#2a2e39` / `#787b86`), and synchronize with native Account Manager via `setAccountManagerVisibilityMode`.
- **Unexplored areas**: none within survey scope.

## Key Decisions Made
- Fully traced the call and event chain for Settings, Hide, and Delete buttons.
- Cataloged the exact 8 PineScript v5 reference templates and how they must be exposed.
- Formulated bottom UI fix ensuring 100% visual authenticity with TradingView.
- Completed comprehensive `analysis.md` and 5-component `handoff.md`.

## Artifact Index
- analysis.md — comprehensive technical investigation of UI, legend controls, and bottom dock architecture
- handoff.md — 5-component handoff report (Observation, Logic Chain, Caveats, Conclusion, Verification Method)
- progress.md — liveness heartbeat
