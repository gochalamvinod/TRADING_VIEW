const { pineToJS } = require('E:/TRADINGVIEW ADVANCED/pinets.min.cjs');
const code = `//@version=6
indicator("Smart Trader, Episode 03, by Ata Sabanci | Candles and Tradelines")
import TradingView/ta/10 as tvta
x = 1
`;

const res = pineToJS(code);
console.log('RESULT:', JSON.stringify(res, null, 2));
