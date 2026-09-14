const PineTS = require('e:/TRADINGVIEW ADVANCED/pinets.min.cjs');
const ind = PineTS.Indicator.from('//@version=5\nindicator("Test", overlay=true)\na = ta.sma(close, 14)\nplot(a)');
console.log('Indicator instance keys:', Object.keys(ind));
console.log('Indicator prototype methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(ind)));

if (typeof ind.getInputsMeta === 'function') {
  console.log('Inputs meta:', ind.getInputsMeta());
}
if (typeof ind.getPlotsMeta === 'function') {
  console.log('Plots meta:', ind.getPlotsMeta());
}

const res = PineTS.pineToJS('//@version=5\nindicator("Test", overlay=true)\nfast = ta.sma(close, 14)\nplot(fast)');
console.log('AST structure:\n', JSON.stringify(res.ast, null, 2).slice(0, 800));
