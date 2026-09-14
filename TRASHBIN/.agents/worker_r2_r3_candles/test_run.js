const pinets = require('../../PineTS-main/dist/pinets.min.cjs');
const { PineTS } = pinets;

async function test() {
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

  const periods = [
    { openTime: 1000, open: 100, high: 105, low: 95, close: 102, volume: 1000 },
    { openTime: 2000, open: 102, high: 108, low: 101, close: 107, volume: 1200 },
    { openTime: 3000, open: 107, high: 109, low: 103, close: 101, volume: 1100 }
  ];

  const pine = new PineTS(periods, "AAPL", "D");
  await pine.ready();
  const ctx = await pine.run(code);
  console.log('Candle data:');
  console.log(JSON.stringify(ctx.plots.Candles.data, null, 2));
}

test();
