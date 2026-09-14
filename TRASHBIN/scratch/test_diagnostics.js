const pinets = require('E:/TRADINGVIEW ADVANCED/PineTS-main/dist/pinets.min.cjs');
require('E:/TRADINGVIEW ADVANCED/pine_indicators.js');
const PineIndicators = globalThis.PineIndicators;

const testCases = [
  {
    name: "Missing closing parenthesis",
    script: `//@version=6
indicator("Error Test 1")
plot(close
`
  },
  {
    name: "Invalid token / characters",
    script: `//@version=6
indicator("Error Test 2")
plot(close @#$)
`
  },
  {
    name: "Missing @version header",
    script: `indicator("Error Test 3")
plot(close)
`
  },
  {
    name: "Unclosed string literal",
    script: `//@version=6
indicator("Unclosed string)
plot(close)
`
  }
];

testCases.forEach((tc, idx) => {
  console.log(`\n=== Test Case ${idx + 1}: ${tc.name} ===`);
  const res = PineIndicators.compilePineScript(tc.script);
  console.log("Success:", res.success);
  console.log("Errors:", JSON.stringify(res.errors, null, 2));
});
