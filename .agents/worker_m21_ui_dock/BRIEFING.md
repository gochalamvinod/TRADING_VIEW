# BRIEFING — 2026-09-09T11:51:00Z

## Mission
Authentic TradingView bottom UI overhaul and Pine Editor integration: eliminate slapped-on bottom bars and emoji buttons, seamlessly dock Pine Editor and Pine Logs into TradingView's bottom layout area with native dark styling (#131722 bg, #1e222d gutter, #2a2e39 border, monochrome SVGs), coordinate cleanly with native Account Manager (.layout__area--bottom / setAccountManagerVisibilityMode), ensure lock: false in study creation for full editability (userEditEnabled() === true), and expose all 8 reference Pine v5 templates in the IDE dropdown.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: e:\TRADINGVIEW ADVANCED\.agents\worker_m21_ui_dock
- Original parent: 629ecdbb-bdd9-4267-83c2-050d30aba17d (orchestrator_7)
- Milestone: M21 (UI & Authentic Bottom Dock)

## 🔒 Key Constraints
- EXCLUSIVE FILE OWNERSHIP:
  - `e:\TRADINGVIEW ADVANCED\pine_editor_ide.js`
  - `e:\TRADINGVIEW ADVANCED\pine_editor.css`
  - `e:\TRADINGVIEW ADVANCED\index.html`
- DO NOT modify any other file.
- Integrity Mandate: No cheating, no fake outputs, genuine implementations only. Independent forensic verification.
- CRITICAL USER DIRECTIVE ("bottom fix them"):
  - Remove slapped-on `#bottom_dock_tabs`, remove tree emoji 🌲 and emoji buttons.
  - Authentic TradingView dark theme tokens (#131722 bg, #1e222d gutter, #2a2e39 border, #787b86 text, monochrome SVGs).
  - Clean mutual coordination with Account Manager (.layout__area--bottom, setAccountManagerVisibilityMode) to eliminate stacked double bottom bars.
  - Enforce `lock: false` in `chart.createStudy(studyName, isOverlay, false)`.
  - Expose all 8 reference Pine v5 templates in the Pine Editor dropdown (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume).
  - Verify syntax with `node -c pine_editor_ide.js`.

## Current Parent
- Conversation ID: 629ecdbb-bdd9-4267-83c2-050d30aba17d
- Updated: not yet

## Task Summary
- **What to build**:
  1. Enforce study editability (`lock: false`) so `userEditEnabled() === true` and legend controls (eye, gear, trash) operate cleanly.
  2. Overhaul bottom UI: eliminate tree emoji 🌲 and arbitrary emojis, style dock tabs to authentically match TradingView native UI, integrate cleanly with TradingView's bottom widget area / Account Manager.
  3. Wire all 8 Pine v5 templates into the Pine Editor dropdown and pre-built loader.
  4. Coordinate dock visibility with native Account Manager (`setAccountManagerVisibilityMode`).
  5. Validate with `node -c pine_editor_ide.js` and browser verification.
- **Success criteria**:
  - No emojis in bottom bar.
  - Authentic TV dark styling (#131722, #1e222d, #2a2e39, monochrome SVGs).
  - No clashing or stacked double bottom bars.
  - All 8 templates accessible.
  - `lock: false` passed in study creation.
  - `node -c pine_editor_ide.js` passes.

## Change Tracker
- **Files modified**: none yet
- **Build status**: pending
- **Pending issues**: none

## Quality Status
- **Build/test result**: pending
- **Lint status**: pending
- **Tests added/modified**: pending

## Loaded Skills
- **Source**: C:\Users\gocha\.gemini\config\plugins\agent-skills\skills\frontend-ui-engineering\SKILL.md
- **Local copy**: e:\TRADINGVIEW ADVANCED\.agents\worker_m21_ui_dock\frontend-ui-engineering.md
- **Core methodology**: Production-quality, accessible, responsive UI adhering strictly to project design tokens and avoiding generic AI aesthetic.
