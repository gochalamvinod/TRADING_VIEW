const { pineToJS } = require('E:/TRADINGVIEW ADVANCED/PineTS-main/dist/pinets.min.cjs');
const broken2 = [
  '//@version=5',
  'indicator("Test")',
  'x = close > open ? 1 :',
  'plot(x)'
].join('\n');

const res = pineToJS(broken2);
console.log('Success:', res.success);
console.log('Error:', res.error);
