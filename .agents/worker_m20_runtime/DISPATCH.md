# Dispatch Assignment — Worker M20 (Pine Runtime & Non-NaN Plots)

**Identity**: teamwork_preview_worker (worker_m20_runtime)
**Working Directory**: e:\TRADINGVIEW ADVANCED\.agents\worker_m20_runtime
**Parent**: orchestrator_7 (Conversation ID: 629ecdbb-bdd9-4267-83c2-050d30aba17d)
**Authoritative Request**: e:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md and e:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md
**Scope Document**: e:\TRADINGVIEW ADVANCED\.agents\orchestrator_7\PROJECT.md
**Investigation Findings**: e:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_orch7_1\handoff.md and e:\TRADINGVIEW ADVANCED\.agents\spec_miner_survey_orch7_1\analysis.md

## Exclusive File Ownership:
You own EXCLUSIVELY: `e:\TRADINGVIEW ADVANCED\pine_indicators.js`
You must NOT modify any other files.

## Mandatory Integrity Warning:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Tasks & Implementation Requirements:
1. **Eliminate Global State Pollution**:
   - Encapsulate execution runtime inside study constructor instance closures instead of mutating `globalThis.__pineRuntime`.
2. **Non-NaN Series Guarantee**:
   - Fix named argument plot regex matching (`title="..."`).
   - Implement zero-warmup cold-start seeding: seed EMA with `ctx.symbol.close` on Bar 0; seed RSI with `50.0` on Bar 0 so no series produces continuous NaNs.
3. **0-Plot Adaptive Trend Baseline Fallback**:
   - For indicators with 0 explicit `plot()` calls (such as Golden Pocket Zones and Smart Trader), inject an adaptive trend baseline fallback plot: 21-period EMA for overlays, 14-period RSI for subpanes.
   - Emit clear notice in Pine Logs: `"[Pine Logs] Notice: Script '<title>' contains 0 explicit plot() statements. Engaged adaptive trend baseline fallback plot..."`.
4. **All 8 Reference Pine v5 Templates**:
   - Populate all 8 reference Pine v5 templates in `PREBUILT_TEMPLATES`: SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume.
5. **Validation**:
   - Verify syntax with `node -c pine_indicators.js`.

Write your report to `handoff.md` in your working directory and notify parent via `send_message`.
