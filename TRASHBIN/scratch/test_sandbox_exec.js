const { pineToJS } = require('E:/TRADINGVIEW ADVANCED/pinets.min.cjs');

const code = `//@version=5
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
     bordercolor = inv_close >= inv_open ? color.green : color.red)
`;

const res = pineToJS(code);
console.log('Transpiled JS:');
console.log(res.code);

// Now construct a bar execution function
const capturedCandles = [];
const capturedPlots = [];

const color = {
    green: '#089981',
    red: '#f23645',
    gray: '#787b86',
    blue: '#2962ff',
    white: '#ffffff',
    black: '#000000',
    yellow: '#ffeb3b',
    orange: '#ff9800',
    purple: '#9c27b0',
    new: (c, t) => c
};

const na = NaN;
const nz = (v, d = 0) => (v === null || v === undefined || isNaN(v) ? d : v);

function plotcandle(o, h, l, c, opts) {
    capturedCandles.push({ o, h, l, c, opts });
}
function plot(val, title, opts) {
    capturedPlots.push({ val, title, opts });
}
function indicator() {}

const fn = new Function(
    'open', 'high', 'low', 'close', 'volume', 'time', 'bar_index',
    'plotcandle', 'plot', 'indicator', 'color', 'na', 'nz', 'Math',
    res.code
);

// Test with bar prices
const o = 1.10, h = 1.15, l = 1.05, c = 1.12;
fn(o, h, l, c, 1000, 1600000, 0, plotcandle, plot, indicator, color, na, nz, Math);

console.log('Captured candles:', capturedCandles);
console.log('Expected:');
console.log('inv_open:', 1 / 1.10, '=', capturedCandles[0].o);
console.log('inv_high:', 1 / 1.05, '=', capturedCandles[0].h);
console.log('inv_low:', 1 / 1.15, '=', capturedCandles[0].l);
console.log('inv_close:', 1 / 1.12, '=', capturedCandles[0].c);
