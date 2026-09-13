const p = require('../../PineTS-main/dist/pinets.min.cjs');

const code = `//@version=5
indicator("Pytest SMA Indicator", overlay=true)
length = input.int(14, "Length")
val = ta.sma(close, length)
plot(val, "SMA Plot", color=color.blue)
`;

try {
  console.log('Testing p.pineToJS:');
  const p2js = p.pineToJS(code);
  console.log('pineToJS success:', p2js.success);
  console.log('pineToJS code:\n', p2js.code);

  console.log('\nTesting p.Indicator.from:');
  const ind = p.Indicator.from(code);
  console.log('inputsMeta:', ind.getInputsMeta());
  console.log('propsMeta:', ind.getPropsMeta());
  console.log('declarationType:', ind.getDeclarationType());

  console.log('\nTesting p.transpile:');
  const fn = p.transpile(code);
  console.log('transpile returned type:', typeof fn);
  console.log('transpile function string:\n', fn.toString().slice(0, 300));
} catch (err) {
  console.error('Error:', err);
}
