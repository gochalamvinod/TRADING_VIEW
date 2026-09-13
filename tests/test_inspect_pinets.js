const p = require('../pinets.min.cjs');

const src = `//@version=5
indicator("Custom Symbol Candles", overlay=false)
sym = input.symbol("BINANCE:BTCUSDT", title="Symbol")
tf = input.timeframe("", title="Timeframe")
showCandles = input.bool(true, title="Show Candles")
upColor = input.color(color.green, title="Up Candle Color")
downColor = input.color(color.red, title="Down Candle Color")
borderUp = input.color(color.green, title="Border Up")
borderDown = input.color(color.red, title="Border Down")
wickUp = input.color(color.green, title="Wick Up")
wickDown = input.color(color.red, title="Wick Down")

[o, h, l, c] = request.security(sym, tf, [open, high, low, close])

plotcandle(showCandles ? o : na, h, l, c, title="Candles",
           color = c >= o ? upColor : downColor,
           wickcolor = c >= o ? wickUp : wickDown,
           bordercolor = c >= o ? borderUp : borderDown)`;

const ind = p.Indicator.from(src);
console.log('InputsMeta:', JSON.stringify(ind.getInputsMeta(), null, 2));
console.log('Props keys:', Object.keys(ind.prop));
console.log('Props getPropsMeta:', ind.getPropsMeta ? ind.getPropsMeta() : 'none');
console.log('title in prop:', ind.prop.title, ind.prop['title'], ind.prop.name);
console.log('overlay in prop:', ind.prop.overlay);

try {
  const prep = ind.prepare();
  console.log('ind.prepare() keys:', Object.keys(prep || {}));
  console.log('prep.fn type:', typeof prep?.fn);
} catch (e) {
  console.log('ind.prepare() error:', e.message);
}


