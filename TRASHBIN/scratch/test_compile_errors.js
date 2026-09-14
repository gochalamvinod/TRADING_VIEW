const { Indicator, pineToJS } = require('E:/TRADINGVIEW ADVANCED/PineTS-main/dist/pinets.min.cjs');

const tests = [
  {
    name: "Syntax error (unfinished expression)",
    code: `//@version=5
indicator("Test")
a = 1 +
plot(a)
`
  },
  {
    name: "Missing indicator declaration",
    code: `//@version=5
a = 10
plot(a)
`
  },
  {
    name: "Undeclared variable",
    code: `//@version=5
indicator("Test")
plot(nonExistentVar)
`
  },
  {
    name: "Invalid version",
    code: `//@version=99
indicator("Test")
plot(close)
`
  },
  {
    name: "Indentation error",
    code: `//@version=5
indicator("Test")
if close > open
plot(close)
`
  }
];

tests.forEach(t => {
  console.log(`\n=== Testing: ${t.name} ===`);
  try {
    const res = pineToJS(t.code);
    console.log("pineToJS success!");
  } catch (e) {
    console.log("pineToJS threw error:");
    console.log("Message:", e.message);
    console.log("Line:", e.line, "Column:", e.column, "Location:", e.location);
  }

  try {
    const ind = Indicator.from(t.code);
    console.log("Indicator.from success!");
    ind.prepare();
    console.log("ind.prepare success!");
  } catch (e) {
    console.log("Indicator.from / prepare threw error:");
    console.log("Message:", e.message);
    console.log("Line:", e.line, "Column:", e.column);
  }
});
