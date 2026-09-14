const pts = require('../../PineTS-main/dist/pinets.min.cjs');
console.log('PineTS keys:', Object.keys(pts));

const code = `//@version=5
indicator("Custom Symbol Candles", overlay=false)
sym = input.symbol("AAPL", "Symbol")
res = input.timeframe("D", "Timeframe")
showCandles = input.bool(true, "Show Candles")
upColor = input.color(#089981, "Up Color")
downColor = input.color(#f23645, "Down Color")
wickColor = input.color(#787b86, "Wick Color")
borderColor = input.color(#089981, "Border Color")
borderDownColor = input.color(#f23645, "Border Down Color")
plotcandle(open, high, low, close, "Candles", color=close >= open ? upColor : downColor, wickcolor=wickColor, bordercolor=close >= open ? borderColor : borderDownColor)
`;

const ind = pts.Indicator.from(code);
console.log('Inputs count:', ind.getInputsMeta().length);
console.log('Inputs meta:', JSON.stringify(ind.getInputsMeta(), null, 2));
console.log('Declaration type:', ind.getDeclarationType());

// Let's test running it with PineTS
const mockData = [
  { openTime: 1000, open: 100, high: 105, low: 99, close: 104, volume: 1000 },
  { openTime: 2000, open: 104, high: 108, low: 103, close: 107, volume: 1200 },
  { openTime: 3000, open: 107, high: 107, low: 101, close: 102, volume: 1100 }
];
const pine = new pts.PineTS(mockData);

pine.run(ind).then(ctx => {
  console.log('Execution success!');
  console.log('Context plot keys:', Object.keys(ctx.plots));
  console.log('Candles bar 0 data:', JSON.stringify(ctx.plots['Candles'].data[0]));
  console.log('Candles bar 1 data:', JSON.stringify(ctx.plots['Candles'].data[1]));
  console.log('Candles bar 2 data:', JSON.stringify(ctx.plots['Candles'].data[2]));
}).catch(err => {
  console.error('Run error:', err);
});
