# Execution Plan — Pine Script IDE & Indicator Runtime Engine

## Objective
Complete the native TradingView-style Pine Script IDE and indicator runtime engine on the trading platform, ensuring all custom and library Pine scripts render calculated visual plots and expose functional native legend controls (hide/show, settings format modal, delete) matching TradingView's built-in indicators.

## Plan Breakdown

### Milestone 0: Parallel Survey & Discovery
- Dispatch 3 specialized survey agents in parallel:
  1. `spec_miner_m20_1`: Probe backend Pine endpoints, compiler/transpiler, AST transformations, and calculation engine.
  2. `explorer_m20_2`: Investigate frontend Pine Editor IDE, custom indicator getter, TradingView Charting Library hooks, legend elements, and study editability.
  3. `explorer_m20_3`: Inspect test infrastructure, Playwright browser test harnesses, server port 9000 health, and custom/library test targets.
- Goal: Synthesize exact architecture, root causes for NaN plots or missing legend controls, and precise file ownership.

### Milestone 20: Native Indicator Execution & Visual Plots (R1)
- Ensure all custom/library Pine scripts produce genuine numerical series plots, bands, histograms, or shapes.
- Implement an adaptive trend baseline fallback for scripts with 0 explicit `plot()` calls (e.g. scripts using drawing primitives or custom logic) so no study is invisible or produces blank charts.
- Output informative diagnostic notice in Pine Logs when adaptive baseline is activated.

### Milestone 21: Native Legend Controls & Study Editability (R2)
- Ensure every study added to chart legend is fully user-editable (`lock: false`).
- Expose functional interactive hover action buttons:
  - Hide/Show (👁️): toggles plot visibility on canvas.
  - Format/Settings (⚙️): opens native TradingView study properties modal for inputs & styles.
  - Remove/Delete (🗑️): removes the study cleanly from chart without leaving orphaned state.

### Milestone 22: Reference Built-in Indicators Architecture & Authentic Bottom Dock UI (R3)
- Conform to TradingView Metainfo v52/v53 schema and `Std` execution engine (`this.main(ctx, inputCallback)`).
- Provide clean, working PineScript v5 reference templates: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume.
- Wire templates directly to Pine Editor IDE dropdown and custom indicators getter.
- **Authentic TradingView Bottom UI Overhaul**:
  * Eliminate all non-authentic, slapped-on bottom bars, emoji buttons, or clunky bottom docks.
  * Integrate Pine Editor, Pine Logs, and Account Manager seamlessly into TradingView's authentic native bottom dock architecture.
  * Match TradingView's exact dark-theme styling, typography, and tab switching behavior.

### Milestone 23: Parallel Verification & Hardening (R4)
- Automated headless browser tests (Playwright) verifying:
  * Adding custom/library indicators (SMA Crossover, Smoothed RSI, Crossing MAs, 0-plot scripts).
  * Canvas plot presence & non-NaN verification.
  * Interactive legend controls: Hide/Show toggle, Settings modal opening, Delete removal.
  * Authentic TradingView bottom UI verification (absence of clunky emoji bottom docks, native tabs).
- Strictly exclude built-in indicators from automated tests per user directive.
- Ensure backend FastAPI server remains running on port 9000 with 100% health pass rate.
- Run multi-axis verification: Reviewers, Challengers, and Forensic Auditor.
