# DISPATCH: Survey Built-in Indicators Architecture & E2E Testing Harness

## Identity & Role
- Archetype: teamwork_preview_explorer
- Role: Indicators & Testing Explorer
- Working Directory: e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_3
- Parent Orchestrator: orchestrator_6 (e:\TRADINGVIEW ADVANCED\.agents\orchestrator_6)

## Mandatory Context
Read `e:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md` (specifically the request under `## 2026-09-09T05:52:12Z`).

## Objective
Thoroughly inspect the Metainfo v52/v53 schema, reference PineScript v5 indicator templates (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume), backend FastAPI endpoints on port 9000, and existing automated Playwright test suites.

## Key Investigation Questions
1. What does the Metainfo v52/v53 schema require in TradingView Charting Library? How are built-in indicators defined in `custom_indicators_getter` or `charting_library/bundles/*.js`?
2. Where are the PineScript v5 reference templates (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume) located or exposed in the Pine Editor IDE? If any are missing or broken, what needs to be added?
3. What is the current status of the backend FastAPI server on port 9000? What endpoints exist in `server.py` or other backend files (e.g. `/pine/compile`, `/pine/logs`, `/health`, `/symbols`, `/time`)?
4. What automated Playwright test scripts already exist in `tests/` or elsewhere in the repo? How are they structured, how do they run, and how can we write comprehensive tests for:
   - Adding Pine scripts to the chart
   - Verifying genuine non-NaN visual plot lines on price candles or sub-panes
   - Verifying adaptive trend baseline for 0-plot scripts
   - Testing hover action buttons on chart legend (Hide, Settings modal, Delete)
5. What tools and packages are installed in the environment (e.g. `playwright`, `pytest`, `fastapi`, `uvicorn`)?

## Boundaries & Constraints
- READ-ONLY exploration. Do NOT edit source code files.
- Document exact file paths, line numbers, and architectural data flows.
- Write your comprehensive findings to `analysis.md` and summary in `handoff.md` in your working directory.
- When complete, send a message back to orchestrator_6 with the path to your handoff.md.

## 2026-09-09T05:53:57Z
You are teamwork_preview_explorer_survey_3.
Your working directory is: e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_3
Read your instructions in: e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_3\DISPATCH.md
Also read e:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md (specifically the latest request under ## 2026-09-09T05:52:12Z).

Investigate built-in indicators architecture, templates, and the testing framework:
- Metainfo v52/v53 schema compliance in the codebase.
- PineScript v5 reference templates: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume. Check where they are defined, exposed in the Pine Editor, and registered in custom indicators getter.
- Backend FastAPI server (port 9000): existing endpoints (`server.py`, `/pine/*`, `/health`).
- Automated headless browser test setup (Playwright): existing tests in `tests/`, test fixtures, how to verify indicator addition, canvas rendering of plots, and legend action button clicks.

Write your detailed findings to analysis.md and a summary handoff in handoff.md in your working directory. Then send a completion message back to orchestrator_6.

## 2026-09-09T05:58:07Z
CRITICAL USER DIRECTIVE UPDATE (2026-09-09T05:57:14Z):
1. Focus automated testing strictly on custom and library PineScript indicators (such as SMA Crossover, Smoothed RSI, Crossing Moving Averages, and scripts with 0 explicit plots like Smart Trader / Golden Pocket Zones) to verify that they produce valid visual plot lines on the chart and expose working native legend controls (Hide/Show, Format/Settings dialog, Delete).
2. DO NOT test the built-in indicators — exclude them from the test suite to save time and prioritize custom/library PineScript workflows.
Action: Please integrate this constraint directly into your analysis and test harness survey.

## 2026-09-11T07:26:44Z
You are teamwork_preview_explorer_survey_3.
Your working directory is: e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_3
Your parent is orchestrator_14.

MANDATORY INSTRUCTION:
Read the authoritative user request at: e:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md (specifically see header ## 2026-09-11T07:10:27Z).
Do not implement changes or edit source code directly; you are an exploration agent.

YOUR MISSION:
Survey the test infrastructure and headless browser automation harnesses (tests/, run_e2e_tests.py, Playwright/Puppeteer/Selenium scripts) for requirement R5:
1. Complete Button & Subbutton Regression Suite with Screenshot Verification:
   - Systematically inspect how tests currently interact with the TradingView UI and Pine Editor.
   - Design the exact automation plan to test EVERY button and subbutton across:
     1. Chart Legend: Title click (Symbol Search modal), Eye button (show/hide), Gear button (Indicator Settings dialog), { } button (Open script in Pine Editor), 3-dots button (Context menu).
     2. Floating Toolbar: Title, Eye, Hexagon/Settings, { } (Open script in Pine Editor), Trash, 3-dots.
     3. Pine Editor: Script title dropdown, New Script modal, Save Script, Add to Chart, Publish Script modal, 3-dots more menu (all 7 sub-items), Settings modal, Version Converter lightbulb & Diff modal, Window controls (_ □ ✕), Console toggle drawer.
     4. Top Toolbar: Symbol search, interval tabs, candle types, fx Indicators button.
     5. Bottom Dock: Pine Editor tab, Strategy Tester tab, Account Manager tab.
   - Specify screenshot capture mechanisms, assertion methods (verifying 0 native browser dialogs, verifying modal visibility, verifying editor focus and code loading), and audit matrix output format.

Write your detailed analysis report to e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_3\analysis.md and write your handoff report to e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_3\handoff.md.
When finished, send a message to parent with a concise summary and reference to your handoff file.
