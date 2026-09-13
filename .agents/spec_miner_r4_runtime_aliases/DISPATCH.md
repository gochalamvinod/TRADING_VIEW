# DISPATCH: spec_miner_r4_runtime_aliases

## 2026-09-11T02:19:19Z
Investigate R4: Universal Multi-Version Runtime Compatibility & Aliases.
Authoritative sources:
- e:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md (lines 637-650)
- e:\TRADINGVIEW ADVANCED\pine_indicators.js line 1862+ (barEvaluator injection)

TASK:
1. Inspect pine_indicators.js around line 1862 where runtime compatibility aliases are injected into barEvaluator.
2. Catalog all bare function calls that must work across v1-v6 without ta.* prefix:
   - sma(), ema(), rsi(), atr(), macd(), stdev(), crossover(), crossunder(), highest(), lowest(), stoch(), cci(), wma(), vwma()
3. Catalog all bare color names that must resolve without color.* prefix:
   - red (#f23645), green (#089981), blue (#2962ff), orange (#ff9800), purple (#9c27b0), yellow (#ffeb3b), white (#ffffff), black (#000000), lime (#00e676), aqua (#00bcd4), fuchsia (#e040fb), silver (#b2b5be), gray/grey (#787b86), maroon (#880e4f), olive (#808000), navy (#311b92), teal (#00897b)
4. Specify runtime semantics for:
   - study() silently mapping to indicator()
   - security() mapping to request.security()
   - tostring() mapping to str.tostring() / String()
   - input() bare function call across all versions
   - plotshape, plotcandle, plot, hline, fill across all versions
   - Historical series indexing open[1], close[2], etc. across all versions
5. Write your findings to e:\TRADINGVIEW ADVANCED\.agents\spec_miner_r4_runtime_aliases\analysis.md and e:\TRADINGVIEW ADVANCED\.agents\spec_miner_r4_runtime_aliases\handoff.md.
6. Send a completion message via send_message to caller. DO NOT write source code.
