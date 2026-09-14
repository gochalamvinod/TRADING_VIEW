# Survey Task Assignment: TradingView Frontend & Indicators Architecture

**Agent Identity**: Survey Explorer Frontend (`survey_frontend`)
**Working Directory**: `E:\TRADINGVIEW ADVANCED\.agents\survey_frontend`
**Authoritative Request**: `E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md`

## Mission
Investigate the TradingView frontend and indicator implementation:
1. Examine `index.html`: how scripts/bundles are loaded, how widget is initialized, how custom indicators getter is wired.
2. Examine `pine_indicators.js`: examine `compileAndRegisterPine(source)`, `createStudyFromTranspiled(...)`, `this.main(ctx, inputCallback)`, study metainfo v52/v53 schema, inputs mapping, and plot definitions.
3. Examine how `plotcandle` can be rendered authentic in TradingView:
   - OHLC plots configuration: `candle_0_open`, `candle_0_high`, `candle_0_low`, `candle_0_close`, `candle_0_colorer`, `candle_0_wick_colorer`, `candle_0_border_colorer`.
   - `ohlcPlots` schema, `defaults.ohlcPlots`, `isRGB: true`, returning `[o, h, l, c, colorInt, wickInt, borderInt]`.
4. Examine `pine_editor_ide.js` and bottom panel GUI:
   - How Pine Editor is currently built, how it docks/undocks, bottom tabs ("Pine Editor", "Strategy Tester", "Trading Panel").
   - Find what looks unauthentic (custom emoji buttons, awkward dual docks) and how to make it 100% authentic TradingView dark theme.
5. Examine legend controls and CSS:
   - Where `.valuesWrapper`, `.valuesAdditionalWrapper`, `[data-name="legend-interval-show-hide-action"]` / `.intervalEye` live.
   - How hover buttons Hide/Show, Settings (gear), Delete (trash) work and can be ensured reliable.
6. Write a comprehensive report to `E:\TRADINGVIEW ADVANCED\.agents\survey_frontend\report.md` and send completion message to parent.

## 2026-09-09T07:13:06Z
You are the Survey Explorer for TradingView Frontend & Indicators.
Read your task assignment in E:\TRADINGVIEW ADVANCED\.agents\survey_frontend\DISPATCH.md and authoritative request in E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md.
Investigate index.html, pine_indicators.js, pine_editor_ide.js, legend controls, CSS classes, and TradingView metainfo v52/v53 schema.
Analyze how plotcandle OHLC plots, isRGB, inputs mapping, native legend action buttons, and authentic TradingView dark theme Pine Editor GUI can be seamlessly implemented.
Write your complete technical findings to E:\TRADINGVIEW ADVANCED\.agents\survey_frontend\report.md.
When done, send a completion message to your parent with a concise summary.
