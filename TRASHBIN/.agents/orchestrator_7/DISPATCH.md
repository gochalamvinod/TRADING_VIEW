# Dispatch Assignment — Orchestrator 7

## 2026-09-09T06:10:01Z

**From**: Parent (id: dc2788d9-7f6f-46d9-bc42-70feaeeee6b9)
**To**: orchestrator_7
**Working Directory**: e:\TRADINGVIEW ADVANCED\.agents\orchestrator_7
**Project Root**: e:\TRADINGVIEW ADVANCED

### Mission:
Complete the native TradingView-style Pine Script IDE and indicator runtime engine on the trading platform, ensuring all custom and library Pine scripts render calculated visual plots and expose functional native legend controls (hide/show, settings format modal, delete) matching TradingView's built-in indicators.

### Key Directives & Scope:
1. Native Indicator Execution & Visual Plots (R1):
   - Every Pine script added to the chart must produce genuine, non-NaN numerical series plots, bands, histograms, or shapes displayed on price candles or sub-panes.
   - For scripts using drawing primitives or custom calculation blocks without explicit plot() calls, provide an adaptive trend baseline plot so no study is invisible or produces blank charts, and log an informative notice in Pine Logs.
2. Native Legend Controls & Study Editability (R2):
   - Every study added to the chart legend must remain fully user-editable (lock: false), exposing interactive hover action buttons: Hide/Show (👁️), Format/Settings (⚙️), and Remove/Delete (🗑️).
   - Clicking Settings must open the native TradingView study properties modal; clicking Hide must toggle series visibility; clicking Delete must remove the study cleanly.
3. Reference Built-in Indicators Architecture (R3):
   - Conform to TradingView's Metainfo v52/v53 schema and the Std execution engine (this.main(ctx, inputCallback)).
   - Include clean, working PineScript v5 reference templates (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume) selectable directly from the Pine Editor IDE and custom indicators getter.
4. Parallel Execution & Focused Test Scope (R4):
   - Maximize parallel processing across worker pools to complete the task as soon as possible.
   - Focus automated testing strictly on custom and library PineScript indicators (such as SMA Crossover, Smoothed RSI, Crossing Moving Averages, and scripts with 0 explicit plots like Smart Trader / Golden Pocket Zones) to verify that they produce valid visual plot lines on the chart and expose working native legend controls (Hide/Show, Format/Settings dialog, Delete).
   - DO NOT test built-in indicators — exclude them from the automated test suite to prioritize custom/library PineScript workflows per explicit user directive.
   - Ensure backend FastAPI server remains running on port 9000 with 100% passing health and Pine endpoints.

## 2026-09-09T06:14:05Z

**CRITICAL USER DIRECTIVE**:
1. Maximize parallel processing across all tracks and stress the agents with rigorous verification.
2. User Directive: "i said u i need same ui as traingview u gave me bottom fix them"
Fix all bottom UI elements:
- Remove any unauthentic or slapped-on custom bottom bars, emoji buttons, or clunky docks.
- Ensure the bottom area, tab styling, and Pine Editor match TradingView's authentic native bottom dock UI and styling exactly.
- Cleanly integrate the Pine Editor / bottom panel with TradingView's native bottom widget area without clashing with the Account Manager or creating redundant awkward bottom docks.
