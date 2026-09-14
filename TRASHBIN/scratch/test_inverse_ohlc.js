const p = require('E:/TRADINGVIEW ADVANCED/PineTS-main/dist/pinets.min.cjs');
const src = `//@version=5
indicator("Inverse OHLC", overlay=false)

// Guard against division by zero
safe_open  = open  != 0 ? open  : na
safe_high  = high  != 0 ? high  : na
safe_low   = low   != 0 ? low   : na
safe_close = close != 0 ? close : na

inv_open  = 1 / safe_open
inv_high  = 1 / safe_low    // low → inv_high
inv_low   = 1 / safe_high   // high → inv_low
inv_close = 1 / safe_close

plotcandle(inv_open, inv_high, inv_low, inv_close,
     title       = "Inverse OHLC",
     color       = inv_close >= inv_open ? color.green : color.red,
     wickcolor   = color.gray,
     bordercolor = inv_close >= inv_open ? color.green : color.red)`;

const candleRegex = /plotcandle\s*\(\s*([^,\)]+)\s*,\s*([^,\)]+)\s*,\s*([^,\)]+)\s*,\s*([^,\)]+)(?:,\s*(?:title\s*=\s*)?(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_]+)))?/gi;
let cMatch;
const candlePlots = [];
let cIdx = 0;
while ((cMatch = candleRegex.exec(src)) !== null) {
  const cTitle = cMatch[5] || cMatch[6] || cMatch[7] || (cIdx === 0 ? 'Candles' : `Candles ${cIdx + 1}`);
  candlePlots.push({ id: `candle_${cIdx}`, title: cTitle });
  cIdx++;
}
console.log('candlePlots matched:', candlePlots);


const evalCandles = [];
const colorObj = { green: '#089981', red: '#f23645', gray: '#787b86' };

const barEvaluator = new Function(
  'open', 'high', 'low', 'close', 'volume', 'time', 'bar_index',
  'plotcandle', 'plot', 'plotbar', 'plotshape', 'plotchar', 'plotarrow', 'hline', 'fill',
  'indicator', 'color', 'na', 'nz', 'ta', 'math', 'syminfo', 'barstate', 'Math',
  res.code
);

barEvaluator(
  4416.5, 4420.0, 4410.0, 4418.0, 100, Date.now(), 0,
  (co, ch, cl, cc, copts) => {
    evalCandles.push({ o: Number(co), h: Number(ch), l: Number(cl), c: Number(cc), opts: copts || {} });
  },
  () => {}, () => {}, () => {}, () => {}, () => {}, () => {}, () => {},
  () => {}, colorObj, NaN, (v, d = 0) => (v == null || isNaN(v) ? d : v), {}, Math,
  { mintick: 0.00001, ticker: 'XAUUSD.' }, { islast: true, isfirst: true }, Math
);

console.log('Evaluated candles for Gold (4416):', evalCandles);


