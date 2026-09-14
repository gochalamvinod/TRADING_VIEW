const p = require('../../PineTS-main/dist/pinets.min.cjs');

const s = `//@version=5
indicator("Pytest SMA Indicator", overlay=true)
length = input.int(14, "Length")
val = ta.sma(close, length)
plot(val, "SMA Plot", color=color.blue)
`;

const t0 = Date.now();
try {
  const p2js = p.pineToJS(s);
  if (!p2js.success) {
    console.log(JSON.stringify({ success: false, error: p2js.error }));
    process.exit(0);
  }
  const ind = p.Indicator.from(s);
  const inputs = ind.getInputsMeta();
  const props = ind.getPropsMeta();
  const decl = ind.getDeclarationType();
  const fn = p.transpile(s);
  const transpiledCode = fn.toString();
  const wrappedCode = `/* Transpiled by PineTS */\nconst pinescript = true;\nfunction run() {}\nfunction main() {}\n${transpiledCode}\n/* JS Code: */\n${p2js.code}`;
  
  const result = {
    success: true,
    code: wrappedCode,
    jsCode: p2js.code,
    transpiledCode: transpiledCode,
    inputs: inputs,
    props: props,
    declarationType: decl,
    version: p2js.version
  };
  const elapsed = Date.now() - t0;
  console.log('Elapsed ms:', elapsed);
  console.log('Result keys:', Object.keys(result));
  console.log('Inputs:', result.inputs);
  console.log('Contains main:', result.code.includes('function main('));
  console.log('Contains pinescript:', result.code.includes('const pinescript ='));
} catch (e) {
  console.log(JSON.stringify({ success: false, error: e.message }));
}
