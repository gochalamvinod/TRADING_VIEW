const p = require('../../PineTS-main/dist/pinets.min.cjs');

console.log('PineTS version / exports:', Object.keys(p));

const customSymbolCandlesPine = `//@version=5
indicator("Custom Symbol Candles", overlay=false)
sym = input.symbol("AAPL", "Symbol")
res = input.timeframe("D", "Timeframe")
showCandles = input.bool(true, "Show Candles")
upCol = input.color(color.green, "Up Color")
dnCol = input.color(color.red, "Down Color")
upWick = input.color(color.green, "Up Wick")
dnWick = input.color(color.red, "Down Wick")
upBorder = input.color(color.green, "Up Border")
dnBorder = input.color(color.red, "Down Border")

[o, h, l, c] = request.security(sym, res, [open, high, low, close])
plotcandle(showCandles ? o : na, h, l, c, color=c >= o ? upCol : dnCol, wickcolor=c >= o ? upWick : dnWick, bordercolor=c >= o ? upBorder : dnBorder)
`;

try {
  const ind = p.Indicator.from(customSymbolCandlesPine);
  const inputs = ind.getInputsMeta();
  console.log('Inputs count:', inputs.length);
  console.log('Inputs:', JSON.stringify(inputs, null, 2));
  console.log('Props:', JSON.stringify(ind.getPropsMeta(), null, 2));

  // Test transpile / pineToJS
  const parsed = p.pineToJS(customSymbolCandlesPine);
  console.log('pineToJS success:', parsed.success, 'version:', parsed.version);
  if (!parsed.success) {
    console.error('pineToJS error:', parsed.error);
  } else {
    console.log('Generated code length:', parsed.code ? parsed.code.length : 0);
  }
} catch (err) {
  console.error('Error during test:', err);
}
