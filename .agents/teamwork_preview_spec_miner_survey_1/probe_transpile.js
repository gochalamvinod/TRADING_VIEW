const pt = require('../../pine_transpiler.bundle.js');

const scriptNoPlot = `//@version=5
strategy("No Plot Strategy", overlay=true)
fast = ta.sma(close, 9)
slow = ta.sma(close, 21)
if ta.crossover(fast, slow)
    strategy.entry("Buy", strategy.long)
`;

const res = pt.transpile(scriptNoPlot);
console.log('=== NO PLOT SCRIPT ===');
console.log('Transpiled success:', res.success);
const cleaned = res.code.replace(/export\s*\{[^}]*\};?/g, '');
const mod = new Function(`${cleaned}\nreturn { run, main, pinescript };`)();
const result = mod.run({ close: [100, 101, 102] });
console.log('Plots keys:', Object.keys(result.plots));
