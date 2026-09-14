# Survey Task Assignment: PineTS Specification & Engine Mining

**Agent Identity**: Survey Spec Miner (`survey_pinets`)
**Working Directory**: `E:\TRADINGVIEW ADVANCED\.agents\survey_pinets`
**Authoritative Request**: `E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md`

## Mission
Investigate `E:\TRADINGVIEW ADVANCED\PineTS-main` and all relevant dist files:
1. Examine `dist/pinets.min.browser.js` and `dist/pinets.min.cjs` (and any source files in `PineTS-main/src` or `PineTS-main/dist`).
2. Identify how `Indicator.from(source)` works, what methods it exposes (`ind.getInputsMeta()`, `ind.run()`, etc.), how AST is built, what `ctx.plots` look like.
3. Identify how `plotcandle(...)` is handled: plot outputs structure, style (`candle`), colors (`color`, `wickcolor`, `bordercolor`), values passed to `ctx.plots`.
4. Identify how `request.security(...)` is supported or mocked in PineTS, including tuple destructuring like `[o, h, l, c] = request.security(sym, tf, [open, high, low, close])`.
5. Check how `pinets.min.browser.js` attaches to global scope (`window.PineTSLib` or `window.PineTS`).
6.## 2026-09-09T07:13:00Z
You are the Survey Spec Miner for the PineTS Indicator Engine.
Read your task assignment in E:\TRADINGVIEW ADVANCED\.agents\survey_pinets\DISPATCH.md and authoritative request in E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md.
Investigate E:\TRADINGVIEW ADVANCED\PineTS-main and its dist files (pinets.min.browser.js, pinets.min.cjs, source files, tests).
Analyze Indicator.from, ind.getInputsMeta(), plotcandle output structure, styles, colors, request.security tuple support, and global window exports.
Write your complete technical findings to E:\TRADINGVIEW ADVANCED\.agents\survey_pinets\report.md.
When done, send a completion message to your parent with a concise summary.
