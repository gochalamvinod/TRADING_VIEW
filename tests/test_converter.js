// tests/test_converter.js
const pinets = require('../pinets.min.cjs');

const PineVersionConverter = {
  convert: function(code, fromVersion = 5, toVersion = 6) {
    if (!code || typeof code !== 'string') return '';
    let res = code;

    // 1. Version directive update
    if (/\/\/@version\s*=\s*\d+/i.test(res)) {
      res = res.replace(/\/\/@version\s*=\s*\d+/gi, '//@version=6');
    } else {
      res = '//@version=6\n' + res;
    }

    // 2. study() -> indicator()
    res = res.replace(/\bstudy\s*\(/g, 'indicator(');

    // 3. Builtin variable migrations
    res = res.replace(/(?<![a-zA-Z0-9_.])tickerid\b/g, 'syminfo.tickerid');
    res = res.replace(/(?<![a-zA-Z0-9_.])period\b(?!\s*=[^=])/g, 'timeframe.period');
    res = res.replace(/(?<![a-zA-Z0-9_.])interval\b(?!\s*=[^=])/g, 'timeframe.multiplier');
    res = res.replace(/(?<![a-zA-Z0-9_.])n\b(?!\s*=[^=])(?!\s*\()/g, 'bar_index');

    // 4. Technical analysis namespace: ta.*
    const taFuncs = [
      'sma', 'ema', 'rsi', 'macd', 'atr', 'stdev', 'crossover', 'crossunder', 'cross',
      'highest', 'lowest', 'highestbars', 'lowestbars', 'wma', 'vwma', 'hma',
      'alma', 'swma', 'rma', 'tr', 'bb', 'bbw', 'cci', 'mom', 'mfi', 'roc',
      'tsi', 'sar', 'supertrend', 'stoch', 'dmi', 'vwap', 'linreg', 'falling',
      'rising', 'cum', 'barssince', 'barsince', 'valuewhen', 'pivothigh', 'pivotlow', 'change',
      'median', 'mode', 'range', 'dev', 'variance', 'correlation', 'percentrank',
      'cog', 'wpr'
    ];
    taFuncs.forEach(fn => {
      const re = new RegExp(`(?<!ta\\.)(?<![a-zA-Z0-9_.])${fn}\\s*\\(`, 'g');
      res = res.replace(re, `ta.${fn === 'barsince' ? 'barssince' : fn}(`);
    });

    // 5. Math namespace: math.*
    const mathFuncs = [
      'abs', 'max', 'min', 'round', 'pow', 'sqrt', 'sign', 'log', 'log10',
      'floor', 'ceil', 'sin', 'cos', 'tan', 'asin', 'acos', 'atan', 'exp',
      'avg', 'sum', 'todegrees', 'toradians'
    ];
    mathFuncs.forEach(fn => {
      const re = new RegExp(`(?<!math\\.)(?<!Math\\.)(?<![a-zA-Z0-9_.])${fn}\\s*\\(`, 'g');
      res = res.replace(re, `math.${fn}(`);
    });

    // 6. Request namespace
    const reqFuncs = ['security', 'financial', 'quandl', 'splits', 'dividends', 'earnings'];
    reqFuncs.forEach(fn => {
      const re = new RegExp(`(?<!request\\.)(?<![a-zA-Z0-9_.])${fn}\\s*\\(`, 'g');
      res = res.replace(re, `request.${fn}(`);
    });

    // 7. String namespace
    res = res.replace(/(?<!str\.)(?<![a-zA-Z0-9_.])tostring\s*\(/g, 'str.tostring(');

    // 8. Bare color names to color.*
    const colors = [
      'red', 'green', 'blue', 'orange', 'purple', 'yellow', 'white', 'black',
      'lime', 'aqua', 'fuchsia', 'silver', 'gray', 'grey', 'maroon', 'olive',
      'navy', 'teal'
    ];
    colors.forEach(col => {
      const re = new RegExp(`([=,:(\\[\\?\\s]|^)\\b${col}\\b(?!\\s*\\()(?![._a-zA-Z0-9])`, 'g');
      res = res.replace(re, `$1color.${col}`);
    });

    // 9. Input migrations (input(...) -> input.*)
    res = res.replace(/\binput\s*\(\s*(true|false)\b/g, 'input.bool($1');
    res = res.replace(/\binput\s*\(\s*(color\.[a-z]+|#[0-9a-fA-F]{6,8})\b/g, 'input.color($1');
    res = res.replace(/\binput\s*\(\s*(?:type\s*=\s*)?input\.integer\b/g, 'input.int(');
    res = res.replace(/\binput\s*\(\s*(?:type\s*=\s*)?input\.float\b/g, 'input.float(');
    res = res.replace(/\binput\s*\(\s*(?:type\s*=\s*)?input\.bool\b/g, 'input.bool(');
    res = res.replace(/\binput\s*\(\s*(?:type\s*=\s*)?input\.string\b/g, 'input.string(');
    res = res.replace(/\binput\s*\(\s*(?:type\s*=\s*)?input\.color\b/g, 'input.color(');
    res = res.replace(/\binput\s*\(\s*(?:type\s*=\s*)?input\.time\b/g, 'input.time(');
    res = res.replace(/\binput\s*\(\s*(?:type\s*=\s*)?input\.resolution\b/g, 'input.timeframe(');
    res = res.replace(/\binput\s*\(\s*(?:type\s*=\s*)?input\.source\b/g, 'input.source(');
    res = res.replace(/\binput\s*\(\s*(?:type\s*=\s*)?input\.symbol\b/g, 'input.symbol(');
    res = res.replace(/\binput\.resolution\b/g, 'input.timeframe');
    res = res.replace(/\bresolution\s*=/g, 'timeframe=');

    // 10. iff(cond, a, b) -> (cond ? a : b)
    res = res.replace(/\biff\s*\(([^,]+),\s*([^,]+),\s*([^)]+)\)/g, '($1 ? $2 : $3)');

    return res;
  }
};

const testCases = [
  {
    name: "v1 script without version tag",
    code: `study("Old Indicator", overlay=false)
val = sma(close, 20)
plot(val, color=blue)`
  },
  {
    name: "v2 script with reassignment and math",
    code: `//@version=2
study("v2 Test", overlay=true)
p = round(close)
sq = sqrt(p)
plot(sq, color=orange)`
  },
  {
    name: "v4 script with security, iff, inputs",
    code: `//@version=4
study("v4 Multi-Feature", overlay=true)
len = input(20, title="Length", type=input.integer)
tf = input("D", title="Timeframe", type=input.resolution)
upper = highest(high, len)
lower = lowest(low, len)
sig = crossover(close, upper)
col = iff(sig, green, red)
sec = security(syminfo.tickerid, tf, close)
plot(sec, color=col)`
  }
];

let allPassed = true;
testCases.forEach((tc, idx) => {
  console.log(`\n--- Test Case ${idx + 1}: ${tc.name} ---`);
  const converted = PineVersionConverter.convert(tc.code);
  console.log("Converted:\n" + converted);
  const result = pinets.pineToJS(converted);
  if (result.success) {
    console.log("PASS: Transpiled successfully by pinets!");
  } else {
    console.error("FAIL: Transpilation error:", result.error);
    allPassed = false;
  }
});

if (allPassed) {
  console.log("\nALL TEST CASES PASSED!");
} else {
  process.exit(1);
}
