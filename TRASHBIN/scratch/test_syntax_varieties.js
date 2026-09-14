require('E:/TRADINGVIEW ADVANCED/pine_indicators.js');
const PI = globalThis.PineIndicators;

const t1 = PI.compilePineScript(['//@version=5', 'indicator("Test")', 'x = (10 + 20', ''].join('\n'));
console.log('Unbalanced paren:', t1.errors);

const t2 = PI.compilePineScript(['indicator("No Version")', 'plot(close)'].join('\n'));
console.log('No version:', t2.errors);

const t3 = PI.compilePineScript(['//@version=5', 'indicator("Test")', 'x = 10 +', ''].join('\n'));
console.log('EOF plus:', t3.errors);
