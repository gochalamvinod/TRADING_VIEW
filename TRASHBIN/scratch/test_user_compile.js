const fs = require('fs');
const contentPinets = fs.readFileSync('PineTS-main/dist/pinets.min.browser.js', 'utf8');
const contentIndicators = fs.readFileSync('pine_indicators.js', 'utf8');

const vm = require('vm');
const sandbox = {
  console: console,
  document: { addEventListener: () => {}, querySelectorAll: () => [], querySelector: () => null },
  window: {},
  location: { search: '' },
  setInterval: () => {},
  clearInterval: () => {},
  setTimeout: (fn) => fn(),
  clearTimeout: () => {}
};
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.self = sandbox;

vm.createContext(sandbox);
vm.runInContext(contentPinets, sandbox);
vm.runInContext(contentIndicators, sandbox);

const PineIndicators = sandbox.window.PineIndicators || sandbox.PineIndicators;

console.log('=== TEST 1: User plotshape script ===');
const userScript = `//@version=6
indicator("Title", overlay=true)
plotshape(open>close, title="Signal", style=shape.triangleup, location=location.belowbar, color=color.green)
`;

const res1 = PineIndicators.compilePineScript(userScript);
console.log('Success:', res1.success);
console.log('Errors:', res1.errors);
console.log('Plots:', res1.study.metainfo.plots);
console.log('Defaults styles:', res1.study.metainfo.defaults.styles);

const inst1 = new res1.study.constructor();
inst1.init({ symbol: { open: 10, high: 12, low: 9, close: 11, volume: 100 } }, () => undefined);

// Bar 0: open 10, close 11 -> open > close is false
const b1 = inst1.main({ symbol: { open: 10, high: 12, low: 9, close: 11, volume: 100, index: 0 } }, () => undefined);
console.log('Bar 0 (open 10 < close 11):', b1);

// Bar 1: open 15, close 11 -> open > close is true
const b2 = inst1.main({ symbol: { open: 15, high: 16, low: 10, close: 11, volume: 100, index: 1 } }, () => undefined);
console.log('Bar 1 (open 15 > close 11):', b2);


console.log('\n=== TEST 2: open[1] script ===');
const script2 = `//@version=6
indicator("History", overlay=true)
prevOpen = open[1]
plot(prevOpen)
`;
const res2 = PineIndicators.compilePineScript(script2);
console.log('Success:', res2.success);
console.log('Plots:', res2.study.metainfo.plots);

const inst2 = new res2.study.constructor();
inst2.init({ symbol: { open: 100, high: 105, low: 95, close: 102, volume: 100 } }, () => undefined);

// Bar 0: open 100
const h1 = inst2.main({ symbol: { open: 100, high: 105, low: 95, close: 102, volume: 100, index: 0 } }, () => undefined);
console.log('Bar 0 (open 100):', h1);

// Bar 1: open 108
const h2 = inst2.main({ symbol: { open: 108, high: 110, low: 107, close: 109, volume: 100, index: 1 } }, () => undefined);
console.log('Bar 1 (open 108, prev open was 100):', h2);

// Bar 2: open 115
const h3 = inst2.main({ symbol: { open: 115, high: 118, low: 112, close: 114, volume: 100, index: 2 } }, () => undefined);
console.log('Bar 2 (open 115, prev open was 108):', h3);


console.log('\n=== TEST 3: open > open[1] combined script ===');
const script3 = `//@version=6
indicator("Combined", overlay=true)
plotshape(open > open[1], title="Up Open", style=shape.triangleup, location=location.belowbar, color=color.green)
`;
const res3 = PineIndicators.compilePineScript(script3);
console.log('Success:', res3.success);
console.log('Plots:', res3.study.metainfo.plots);

const inst3 = new res3.study.constructor();
inst3.init({ symbol: { open: 100, high: 105, low: 95, close: 102, volume: 100 } }, () => undefined);

// Bar 0: open 100 -> no previous bar -> NaN
const c1 = inst3.main({ symbol: { open: 100, high: 105, low: 95, close: 102, volume: 100, index: 0 } }, () => undefined);
console.log('Bar 0 (open 100, no prev):', c1);

// Bar 1: open 108 -> open 108 > open[1] 100 is true -> 1
const c2 = inst3.main({ symbol: { open: 108, high: 110, low: 107, close: 109, volume: 100, index: 1 } }, () => undefined);
console.log('Bar 1 (open 108 > 100):', c2);

// Bar 2: open 104 -> open 104 > open[1] 108 is false -> NaN
const c3 = inst3.main({ symbol: { open: 104, high: 106, low: 102, close: 105, volume: 100, index: 2 } }, () => undefined);
console.log('Bar 2 (open 104 < 108):', c3);
