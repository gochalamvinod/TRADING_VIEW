const fs = require('fs');
const contentPinets = fs.readFileSync('PineTS-main/dist/pinets.min.browser.js', 'utf8');

const vm = require('vm');
const sandbox = { console: console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(contentPinets, sandbox);
const PineTS = sandbox.PineTSLib;

const userScript = `//@version=6
indicator("Title", overlay=true)
plotshape(open>close, title="Signal", style=shape.triangleup, location=location.belowbar, color=color.green)
`;

const res = PineTS.pineToJS(userScript);
console.log('Transpiled code:', res.code);

const evalColor = { green: '#089981' };
const evalShapes = [];

// Try to create the function exactly as pine_indicators.js currently does (line 1488)
const fn = new Function(
  'open', 'high', 'low', 'close', 'volume', 'time', 'bar_index',
  'plotcandle', 'plot', 'plotbar', 'plotshape', 'plotchar', 'plotarrow', 'hline', 'fill',
  'indicator', 'color', 'na', 'nz', 'ta', 'math', 'syminfo', 'barstate', 'Math',
  res.code
);

try {
  fn(
    10, 12, 9, 11, 100, Date.now(), 0,
    () => {}, () => {}, () => {},
    (sval, sopts) => { evalShapes.push({ val: sval, opts: sopts }); },
    () => {}, () => {}, () => {}, () => {},
    () => {}, evalColor, NaN, (v) => v, {}, Math, {}, {}, Math
  );
  console.log('Evaluated successfully! evalShapes:', evalShapes);
} catch (e) {
  console.log('CAUGHT ERROR IN CURRENT BAREVALUATOR:', e.message);
}
