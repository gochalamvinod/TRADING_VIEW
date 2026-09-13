## 2026-09-11T02:19:18Z
You are spec_miner_r2_converter. Your working directory is e:\TRADINGVIEW ADVANCED\.agents\spec_miner_r2_converter\.

MISSION:
Investigate R2: Pine Script Version Converter Engine Rules (v1 through v6).
Authoritative sources:
- e:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md (specifically lines 609-625)
- e:\TRADINGVIEW ADVANCED\pinescriptv6\pinescriptv6_complete_reference.md
- Existing migration guides or AST utilities in the repo

TASK:
1. Formulate complete, precise transformation rules (regex and AST/token replacements) for each version transition:
   - v1 -> v2: Type enforcement, nz() wrapping on self-referencing variables
   - v2 -> v3: Variable reassignment `=` to `:=` for re-declarations
   - v3 -> v4: Bare colors (`red`, `green`, etc.) to `color.red`, `color.green`; input type migrations; `var` declarations
   - v4 -> v5: `study()` -> `indicator()`, bare TA functions to `ta.*` namespace (sma->ta.sma, rsi->ta.rsi, ema->ta.ema, macd->ta.macd, atr->ta.atr, crossover->ta.crossover, crossunder->ta.crossunder, stdev->ta.stdev, etc.), math functions to `math.*`, `security()` -> `request.security()`, `tostring()` -> `str.tostring()`, input type migrations
   - v5 -> v6: Version header `//@version=6`, strict type annotations where required, method syntax updates
2. Design the chained migration engine `PineVersionConverter.convert(code, fromVersion, toVersion)` capable of sequential upgrades (e.g. v1 -> v6 running v1->v2->v3->v4->v5->v6).
3. Document line-by-line mapping and diff generation logic.
4. Write your detailed report to e:\TRADINGVIEW ADVANCED\.agents\spec_miner_r2_converter\analysis.md and e:\TRADINGVIEW ADVANCED\.agents\spec_miner_r2_converter\handoff.md.
5. Send a completion message via send_message to caller. DO NOT write source code.
