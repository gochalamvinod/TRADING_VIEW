const { Indicator, Context } = require('E:/TRADINGVIEW ADVANCED/pinets.min.cjs');

const code = `//@version=5
indicator("Inverse OHLC", overlay=false)

safe_open  = open  != 0 ? open  : na
safe_high  = high  != 0 ? high  : na
safe_low   = low   != 0 ? low   : na
safe_close = close != 0 ? close : na

inv_open  = 1 / safe_open
inv_high  = 1 / safe_low
inv_low   = 1 / safe_high
inv_close = 1 / safe_close

plotcandle(inv_open, inv_high, inv_low, inv_close, title="Inverse OHLC")
`;

const ind = Indicator.from(code);
console.log('Indicator methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(ind)));
console.log('ind properties:', Object.keys(ind));
