const path = require('path');
const pinets = require('e:/TRADINGVIEW ADVANCED/PineTS-main/dist/pinets.min.cjs');
global.window = global;
global.PineTSLib = pinets;
global.PineTS = pinets;
require('e:/TRADINGVIEW ADVANCED/pine_indicators.js');

const code = `//@version=5
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

const res = PineIndicators.compileAndRegisterPine(code);
console.log('--- meta ---');
console.log('meta.plots:', JSON.stringify(res.meta.plots));
console.log('meta.candlePlots:', JSON.stringify(res.meta.candlePlots));
console.log('meta.rawPlotCount:', res.meta.rawPlotCount);
console.log('meta.rawCandleCount:', res.meta.rawCandleCount);
console.log('--- metainfo.plots ---');
console.log(JSON.stringify(res.study.metainfo.plots, null, 2));
console.log('--- metainfo.ohlcPlots ---');
console.log(JSON.stringify(res.study.metainfo.ohlcPlots, null, 2));
console.log('--- metainfo.defaults.ohlcPlots ---');
console.log(JSON.stringify(res.study.metainfo.defaults.ohlcPlots, null, 2));
console.log('--- metainfo.inputs ---');
console.log(JSON.stringify(res.study.metainfo.inputs, null, 2));
console.log('--- metainfo.defaults.inputs ---');
console.log(JSON.stringify(res.study.metainfo.defaults.inputs, null, 2));

// Now let's test what this.main returns!
const inst = new res.study.constructor();
inst.init({}, () => null);
const mockCtx = {
    symbol: { open: 4400, high: 4410, low: 4390, close: 4405, volume: 100, time: 1725800000000, ticker: "XAUUSD." },
    new_var: () => ({ get: () => 0, set: () => 0 })
};
const vals = inst.main(mockCtx, (k) => null);
console.log('--- main returned values ---');
console.log('vals length:', vals.length);
console.log('vals:', vals);
