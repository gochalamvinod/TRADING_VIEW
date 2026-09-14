const p = require('../../PineTS-main/dist/pinets.min.cjs');
const code = `//@version=5
indicator("T")
sym = input.symbol("AAPL")
res = input.timeframe("D")
[o, h, l, c] = request.security(sym, res, [open, high, low, close])
`;

const fn = p.transpile(code);
console.log('Transpiled code:\n', fn.toString());
