const PineTS = require('e:/TRADINGVIEW ADVANCED/pinets.min.cjs');
global.PineTS = PineTS;
global.PineTSLib = PineTS;
global.window = global;

// Mock localStorage and window
global.window.localStorage = { getItem: () => null, setItem: () => {} };

require('e:/TRADINGVIEW ADVANCED/pine_indicators.js');

const code = `//@version=5
indicator("Custom Symbol Candles", overlay=false, max_bars_back=500)

// Inputs
sym = input.symbol("BINANCE:BTCUSDT", title="Symbol")
tf = input.timeframe("", title="Timeframe (blank = chart TF)")

// Fetch OHLCV from the requested symbol
[o, h, l, c, v] = request.security(sym, tf, [open, high, low, close, volume])

// Candle colours
bullCol = input.color(color.new(#26a69a, 0), title="Bull colour")
bearCol = input.color(color.new(#ef5350, 0), title="Bear colour")
wickCol = input.color(color.new(#787b86, 40), title="Wick colour")

col = c >= o ? bullCol : bearCol

// Plot as candles
plotcandle(o, h, l, c,
           title = "Candles",
           color = col,
           wickcolor = wickCol,
           bordercolor = col)

// Optional volume subplot
showVol = input.bool(true, title="Show volume")
hline(0, color=color.new(color.gray, 80))
plot(showVol ? v : na, style=plot.style_columns,
     color=color.new(col, 60), title="Volume")
`;

try {
  const res = global.PineIndicators.compileAndRegisterPine(code);
  console.log("=== META ===");
  console.log("title:", res.meta.title);
  console.log("isOverlay:", res.meta.isOverlay);
  console.log("candlePlots count:", res.meta.candlePlots.length, res.meta.candlePlots);
  console.log("plots count:", res.meta.plots.length, res.meta.plots);
  console.log("inputs count:", res.meta.inputs.length);
  console.log("inputs:", JSON.stringify(res.meta.inputs, null, 2));

  console.log("=== METAINFO ===");
  console.log("metainfo plots:", res.study.metainfo.plots);
  console.log("metainfo ohlcPlots:", res.study.metainfo.ohlcPlots);
  console.log("metainfo inputs:", res.study.metainfo.inputs);

  // Now let's execute the constructor and main!
  const studyInst = new res.study.constructor();
  studyInst.init({}, (idx) => {
    if (idx === 0 || idx === 'sym') return 'EURUSD.';
    if (idx === 1 || idx === 'tf') return '';
    return null;
  });

  const ctx = {
    symbol: {
      ticker: 'XAUUSD.',
      open: 4396.0,
      high: 4398.0,
      low: 4395.0,
      close: 4397.0,
      volume: 100,
      time: 1720000000000
    }
  };

  const inputCallback = (key) => {
    console.log("inputCallback called with key:", key);
    if (key === 0 || key === 'sym') return 'EURUSD.';
    if (key === 1 || key === 'tf') return '';
    return null;
  };

  const mainRet = studyInst.main(ctx, inputCallback);
  console.log("=== MAIN RETURN ===");
  console.log("main return:", mainRet);
} catch (e) {
  console.error("Error:", e);
}
