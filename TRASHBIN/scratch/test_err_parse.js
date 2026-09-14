const { pineToJS } = require('E:/TRADINGVIEW ADVANCED/PineTS-main/dist/pinets.min.cjs');
const broken = [
  '//@version=5',
  'indicator("Test")',
  'x = 10 +',
  ''
].join('\n');

const res = pineToJS(broken);
console.log('Success:', res.success);
console.log('Error:', res.error);
console.log('Full:', res);
