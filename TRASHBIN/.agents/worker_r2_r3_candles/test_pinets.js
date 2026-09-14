const pinets = require('../../PineTS-main/dist/pinets.min.cjs');
console.log('Keys:', Object.keys(pinets));
console.log('Indicator:', typeof pinets.Indicator);

if (pinets.Indicator) {
  const code = `//@version=5
indicator("Custom Symbol Candles", overlay=false)
sym = input.symbol("AAPL", "Symbol")
res = input.timeframe("D", "Resolution")
upColor = input.color(color.green, "Bullish Body Color")
downColor = input.color(color.red, "Bearish Body Color")
wickColor = input.color(color.gray, "Wick Color")
borderUpColor = input.color(color.green, "Bullish Border Color")
borderDownColor = input.color(color.red, "Bearish Border Color")
showBorders = input.bool(true, "Show Borders")
showWicks = input.bool(true, "Show Wicks")
[o, h, l, c] = request.security(sym, res, [open, high, low, close])
plotcandle(o, h, l, c, title="Candles", color=c >= o ? upColor : downColor, wickcolor=showWicks ? wickColor : na, bordercolor=showBorders ? (c >= o ? borderUpColor : borderDownColor) : na)
`;
  const ind = pinets.Indicator.from(code);
  console.log('Inputs meta:', JSON.stringify(ind.getInputsMeta(), null, 2));
  console.log('Props meta:', JSON.stringify(ind.getPropsMeta(), null, 2));
  const prep = ind.prepare();
  console.log('Prepared keys:', Object.keys(prep));
  console.log('Function type:', typeof prep.fn);
  console.log('Code snippet:\n', prep.fn.toString().slice(0, 500));
}
