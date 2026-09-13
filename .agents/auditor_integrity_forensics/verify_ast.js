const { Indicator } = require('./pinets.min.cjs');
const src = `//@version=5
indicator("Custom Symbol Candles", overlay=false)
sym = input.symbol("AAPL", "Symbol")
res = input.timeframe("D", "Resolution")
showCandles = input.bool(true, "Show Candles")
upColor = input.color(color.green, "Up Color")
downColor = input.color(color.red, "Down Color")
upWick = input.color(color.green, "Up Wick")
downWick = input.color(color.red, "Down Wick")
upBorder = input.color(color.green, "Up Border")
downBorder = input.color(color.red, "Down Border")

[o, h, l, c] = request.security(sym, res, [open, high, low, close])
plotcandle(showCandles ? o : na, h, l, c, color=c >= o ? upColor : downColor, wickcolor=upWick, bordercolor=upBorder)
` ;
try {
    const ind = Indicator.from(src);
    console.log("=== SUCCESS_AST_PARSED ===");
    const inputs = ind.getInputsMeta();
    console.log("INPUTS_COUNT:", inputs.length);
    console.log("INPUTS_META:", JSON.stringify(inputs, null, 2));
    console.log("PROPS_META:", JSON.stringify(ind.getPropsMeta(), null, 2);
    const decl = ind.getDeclarationType ? ind.getDeclarationType() : ind.declarationType;
    const prep = ind.prepare();
    console.log("INDICATOR_FUNCTION_PREPLED:", typeof prep.fn);
} catch(e) {
    console.error("AST_PARSE_ERROR:", e);
}
