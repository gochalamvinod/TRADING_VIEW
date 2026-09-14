# DISPATCH: Survey Pine Script Runtime & Execution Engine

## Identity & Role
- Archetype: teamwork_preview_spec_miner
- Role: Pine Runtime Spec Miner
- Working Directory: e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_spec_miner_survey_1
- Parent Orchestrator: orchestrator_6 (e:\TRADINGVIEW ADVANCED\.agents\orchestrator_6)

## Mandatory Context
Read `e:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md` (specifically the request under `## 2026-09-09T05:52:12Z`).

## Objective
Thoroughly inspect the authoritative source of truth in the codebase regarding the Pine Script IDE, parser, compiler, AST transformer, runtime execution engine, and TradingView indicator integration.

## Key Investigation Questions
1. Where are the Pine Editor IDE, Pine compiler, and runtime files located? (Search for pine, parser, AST, custom_indicators_getter, backend endpoints in `server.py` or `/pine/*`).
2. How does the current system handle "Add to chart"? How are custom scripts compiled and registered with TradingView?
3. How does the TradingView `custom_indicators_getter` interface with `this.main(ctx, inputCallback)` and Metainfo?
4. How are plot series (lines, histograms, bands, shapes) generated, buffered, and passed to TradingView's datafeed/study renderer?
5. Why would studies output continuous `NaN` values or blank canvas renders?
6. How is the adaptive trend baseline fallback implemented when 0 explicit `plot()` calls exist in a Pine script? Where are Pine Logs handled?

## Boundaries & Constraints
- READ-ONLY exploration. Do NOT edit source code files.
- Document exact file paths, line numbers, and architectural data flows.
- Write your comprehensive findings to `analysis.md` and summary in `handoff.md` in your working directory.
- When complete, send a message back to orchestrator_6 with the path to your handoff.md.
