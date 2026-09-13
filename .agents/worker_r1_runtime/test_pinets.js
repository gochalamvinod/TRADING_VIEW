const { Indicator } = require('../../PineTS-main/dist/pinets.min.cjs');

const validSource = `//@version=5
indicator("Pytest SMA Indicator", overlay=true)
length = input.int(14, "Length")
val = ta.sma(close, length)
plot(val, "SMA Plot", color=color.blue)
`;

const invalidSource = `//@version=5
indicator("Broken"
this is invalid syntax !!!
`;

function testScript(s) {
  try {
    const ind = Indicator.from(s);
    const inputs = ind.getInputsMeta();
    const props = ind.getPropsMeta();
    const declType = ind.getDeclarationType();
    const usesVis = ind.usesVisibleRange();
    const prep = ind.prepare();
    const codeStr = (prep && prep.fn) ? prep.fn.toString() : '';
    return {
      success: true,
      code: codeStr,
      inputs: inputs,
      meta: inputs,
      props: props,
      declarationType: declType,
      usesVisibleRange: usesVis
    };
  } catch (e) {
    return {
      success: false,
      error: e.message || String(e)
    };
  }
}

console.log("Valid test result:", testScript(validSource));
console.log("Invalid test result:", testScript(invalidSource));
