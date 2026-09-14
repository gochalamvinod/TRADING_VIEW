const PineTS = require('e:/TRADINGVIEW ADVANCED/pinets.min.cjs');
const code = `//@version=5
indicator("Custom Symbol Candles", overlay=false, max_bars_back=500)

// Inputs
sym = input.symbol("BINANCE:BTCUSDT", title="Symbol")
tf  = input.timeframe("", title="Timeframe (blank = chart TF)")

// Fetch OHLCV from the requested symbol
[o, h, l, c, v] = request.security(sym, tf, [open, high, low, close, volume])

// Candle colours
bullCol = input.color(color.new(#26a69a, 0), title="Bull colour")
bearCol = input.color(color.new(#ef5350, 0), title="Bear colour")
wickCol = input.color(color.new(#787b86, 40), title="Wick colour")

col = c >= o ? bullCol : bearCol

// Plot as candles
plotcandle(o, h, l, c, title="Candles", color=col, wickcolor=wickCol, bordercolor=col)
`;

try {
  const ind = PineTS.Indicator.from(code);
  console.log("getInputsMeta():");
  console.log(JSON.stringify(ind.getInputsMeta(), null, 2));
} catch(e) {
  console.error("Error:", e);
}
