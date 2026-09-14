const fs = require('fs');
const content = fs.readFileSync('PineTS-main/dist/pinets.min.browser.js', 'utf8');
const vm = require('vm');
const sandbox = { console: console };
sandbox.globalThis = sandbox;
sandbox.window = sandbox;
sandbox.self = sandbox;
vm.createContext(sandbox);
vm.runInContext(content, sandbox);
const PineTS = sandbox.PineTSLib;

const code = `//@version=6
indicator("State Test", overlay=true)
var count = 0
count := count + 1
plot(count)
`;
const res = PineTS.pineToJS(code);
console.log('TRANSPILED STATE:\n' + res.code);
