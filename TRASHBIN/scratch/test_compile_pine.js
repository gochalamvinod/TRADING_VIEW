require('E:/TRADINGVIEW ADVANCED/pine_indicators.js');
const PI = globalThis.PineIndicators;

console.log('Testing broken code:');
const res1 = PI.compilePineScript(['//@version=5', 'indicator("Bad")', 'x = 10 +', ''].join('\n'));
console.log('Broken result:', JSON.stringify(res1, null, 2));

console.log('\nTesting valid code:');
const res2 = PI.compilePineScript(['//@version=5', 'indicator("Good")', 'plot(close)', ''].join('\n'));
console.log('Valid success:', res2.success, 'plots:', res2.meta.plots.length);

console.log('\nTesting LuxAlgo script:');
const fs = require('fs');
const lux = fs.readFileSync('scratch_luxalgo.pine', 'utf-8');
const res3 = PI.compilePineScript(lux);
console.log('LuxAlgo success:', res3.success, 'plots count:', res3.meta.plots.length, 'shapes count:', res3.meta.shapes.length);
