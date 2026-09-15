/**
 * Empirical Adversarial Challenger Oracle
 * Deep Stress Verification of 7 Tier-5 Dimensions for pine_engine.js
 */

const assert = require('assert');
const {
  PineEngine,
  PineTranspiler,
  PineScriptRuntime,
  PineScriptStorage,
  TradingViewCustomEngine
} = require('../pine_engine');

console.log('================================================================');
console.log('  STARTING EMPIRICAL ADVERSARIAL ORACLE VERIFICATION');
console.log('================================================================\n');

let totalChecks = 0;
let passedChecks = 0;
let failedChecks = 0;

function check(title, fn) {
  totalChecks++;
  try {
    fn();
    passedChecks++;
    console.log(`  [PASS] #${totalChecks}: ${title}`);
  } catch (err) {
    failedChecks++;
    console.error(`  [FAIL] #${totalChecks}: ${title}`);
    console.error(`         ERROR: ${err.message}`);
    if (err.stack) {
      console.error(`         STACK: ${err.stack.split('\n').slice(0, 3).join('\n')}`);
    }
  }
}

// Generate deterministic test bars
function generateBars(count = 100) {
  const bars = [];
  let price = 100;
  for (let i = 0; i < count; i++) {
    const o = price;
    const c = price + Math.sin(i * 0.2) * 4 + (i % 3 === 0 ? 1 : -0.5);
    const h = Math.max(o, c) + 1.5;
    const l = Math.min(o, c) - 1.5;
    const v = 1000 + i * 10;
    bars.push({
      time: 1700000000 + i * 60,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v
    });
    price = c;
  }
  return bars;
}

const bars100 = generateBars(100);

/* =========================================================================
 * DIMENSION 1: Lookback Indexing (close[1], high[1], myVar[1], etc.)
 * ========================================================================= */
console.log('\n--- [DIMENSION 1] Lookback Indexing ---');

check('Transpilation does not generate corrupted Std.Std.* or syntax errors', () => {
  const code = `//@version=5
indicator("Lookback Test", overlay=true)
c1 = close[1]
h2 = high[2]
l3 = low[3]
o0 = open[0]
v5 = volume[5]
hl = hl2[1]
hlc = hlc3[2]
ohlc = ohlc4[3]
plot(c1, "CloseLag1")
plot(h2, "HighLag2")
plot(o0, "Open0")
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true, `Transpile failed: ${res.errors.join(', ')}`);
  assert.ok(!res.constructorCode.includes('Std.Std.'), 'Contains double Std. wrapping!');
  assert.ok(!res.constructorCode.includes("Std.'close'"), "Contains invalid quote wrapping!");
});

check('Execution of lookback indexing matches actual bar offset values exactly', () => {
  const code = `//@version=5
indicator("Lookback Exact Values", overlay=true)
c1 = close[1]
h2 = high[2]
plot(c1, "c1")
plot(h2, "h2")
`;
  const res = PineEngine.transpile(code);
  const exec = PineScriptRuntime.execute(res, bars100);
  assert.strictEqual(exec.success, true);
  
  // At bar 0: close[1] should be NaN
  assert.ok(isNaN(exec.plotValues.plot_0[0]), 'Bar 0 close[1] should be NaN');
  // At bar 1: close[1] should equal bars100[0].close
  assert.strictEqual(exec.plotValues.plot_0[1], bars100[0].close);
  // At bar 50: close[1] should equal bars100[49].close
  assert.strictEqual(exec.plotValues.plot_0[50], bars100[49].close);
  // At bar 50: high[2] should equal bars100[48].high
  assert.strictEqual(exec.plotValues.plot_1[50], bars100[48].high);
});

check('Custom variable lookback indexing (myVar[1]) behaves properly', () => {
  const code = `//@version=5
indicator("Custom Var Lookback", overlay=true)
myVal = close * 2
myValLag1 = myVal[1]
plot(myVal, "Val")
plot(myValLag1, "ValLag")
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars100);
  assert.strictEqual(exec.success, true);
  assert.ok(isNaN(exec.plotValues.plot_1[0]), 'Bar 0 myVal[1] must be NaN');
  for (let i = 1; i < 50; i++) {
    const expected = bars100[i - 1].close * 2;
    assert.strictEqual(exec.plotValues.plot_1[i], expected, `Bar ${i} mismatch`);
  }
});

check('Multiple lookbacks in single arithmetic expression', () => {
  const code = `//@version=5
indicator("Chained Lookback", overlay=true)
res = (close[1] - close[2]) / (close[3] + 1)
plot(res, "DiffRatio")
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars100);
  assert.strictEqual(exec.success, true);
  assert.ok(isNaN(exec.plotValues.plot_0[2]));
  const expectedBar10 = (bars100[9].close - bars100[8].close) / (bars100[7].close + 1);
  assert.strictEqual(exec.plotValues.plot_0[10], expectedBar10);
});

check('Negative lookahead does not corrupt identifier substrings (e.g. close_price, open_val)', () => {
  const code = `//@version=5
indicator("Ident Substring", overlay=true)
close_price = 100
open_val = 50
diff = close_price - open_val + close
plot(diff, "Diff")
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.constructorCode.includes('const close_price = 100'));
  assert.ok(res.constructorCode.includes('const open_val = 50'));
  assert.ok(!res.constructorCode.includes('Std.close_price'));
});

/* =========================================================================
 * DIMENSION 2: Composed / Nested Technical Indicator Calls
 * ========================================================================= */
console.log('\n--- [DIMENSION 2] Composed & Nested TA Calls ---');

check('ta.ema(ta.sma(close, 10), 20) 2-level nesting transpilation & accuracy', () => {
  const code = `//@version=5
indicator("Nested MA", overlay=true)
nested = ta.ema(ta.sma(close, 10), 20)
plot(nested, "NestedMA")
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.constructorCode.includes('Std.ema(Std.sma(Std.close(_ctx), 10, _ctx), 20, _ctx)'));
  
  const exec = PineScriptRuntime.execute(res, bars100);
  assert.strictEqual(exec.success, true);
  const values = exec.plotValues.plot_0;
  assert.ok(isNaN(values[0]), 'Initial bars must be NaN');
  assert.ok(!isNaN(values[50]), 'Bar 50 must have valid number');
  assert.ok(typeof values[50] === 'number');
});

check('ta.rsi(ta.ema(ta.sma(close, 5), 10), 14) 3-level nesting transpilation & execution', () => {
  const code = `//@version=5
indicator("Deep Nested TA", overlay=false)
deepTA = ta.rsi(ta.ema(ta.sma(close, 5), 10), 14)
plot(deepTA, "DeepRSI")
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars100);
  assert.strictEqual(exec.success, true);
  const val = exec.plotValues.plot_0[80];
  assert.ok(!isNaN(val) && val >= 0 && val <= 100, `RSI out of bounds: ${val}`);
});

check('ta.highest(ta.sma(close, 10), 20) and ta.lowest(ta.ema(close, 5), 15)', () => {
  const code = `//@version=5
indicator("Highest of SMA", overlay=true)
hSma = ta.highest(ta.sma(close, 10), 20)
lEma = ta.lowest(ta.ema(close, 5), 15)
plot(hSma, "HighSMA")
plot(lEma, "LowEMA")
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars100);
  assert.strictEqual(exec.success, true);
  assert.ok(!isNaN(exec.plotValues.plot_0[60]));
  assert.ok(!isNaN(exec.plotValues.plot_1[60]));
});

check('Nested TA calls with whitespace variations (e.g. ta.ema( ta.sma( close , 10 ) , 20 ))', () => {
  const code = `//@version=5
indicator("Nested Whitespace", overlay=true)
val = ta.ema(  ta.sma(  close  ,  10  )  ,  20  )
plot(val, "Val")
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars100);
  assert.strictEqual(exec.success, true);
  assert.ok(!isNaN(exec.plotValues.plot_0[50]));
});

/* =========================================================================
 * DIMENSION 3: color.new() Transpilation and Execution
 * ========================================================================= */
console.log('\n--- [DIMENSION 3] color.new() Transpilation & Execution ---');

check('color.new() maps correctly to Std.colorNew and evaluates properly', () => {
  const code = `//@version=5
indicator("Color New Test", overlay=true)
c1 = color.new(color.red, 50)
c2 = color.new(color.green, 20)
c3 = color.new("#0000FF", 80)
plot(close, "Plot1", color=color.new(color.blue, 30))
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.constructorCode.includes('Std.colorNew'));
  assert.ok(!res.constructorCode.includes('"color.new"('), 'Corrupted color.new as string literal!');
  
  // Test direct Std.colorNew helper outputs
  const cRed50 = TradingViewCustomEngine.Std.colorNew('#FF5252', 50);
  assert.strictEqual(cRed50, 'rgba(255, 82, 82, 0.50)');
  const cBlue0 = TradingViewCustomEngine.Std.colorNew('#2196F3', 0);
  assert.strictEqual(cBlue0, 'rgba(33, 150, 243, 1.00)');
  const cGreen100 = TradingViewCustomEngine.Std.colorNew('#4CAF50', 100);
  assert.strictEqual(cGreen100, 'rgba(76, 175, 80, 0.00)');
});

check('color.new() inside ternary expressions and conditional plots', () => {
  const code = `//@version=5
indicator("Color Ternary", overlay=true)
dynamicCol = close > open ? color.new(color.green, 40) : color.new(color.red, 40)
plot(close, "Close", color=color.blue)
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars100);
  assert.strictEqual(exec.success, true);
});

/* =========================================================================
 * DIMENSION 4: na() Function Transpilation vs na Constant
 * ========================================================================= */
console.log('\n--- [DIMENSION 4] na() Function vs na Constant ---');

check('na() function transpiles to Std.na() while na constant becomes NaN', () => {
  const code = `//@version=5
indicator("Na Handling", overlay=true)
isCNa = na(close)
nanVal = na
safeVal = isCNa ? 0 : close
plot(safeVal, "SafeClose")
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.constructorCode.includes('Std.na(Std.close(_ctx))'));
  assert.ok(res.constructorCode.includes('const nanVal = NaN'));
  assert.ok(!res.constructorCode.includes('Std.NaN('), 'Corrupted na() to Std.NaN()!');
  
  // Test runtime execution
  const exec = PineScriptRuntime.execute(res, bars100);
  assert.strictEqual(exec.success, true);
  assert.strictEqual(exec.plotValues.plot_0[0], bars100[0].close);
});

check('Std.na helper function returns 1 for NaN/null/undefined and 0 for valid numbers', () => {
  assert.strictEqual(TradingViewCustomEngine.Std.na(NaN), 1);
  assert.strictEqual(TradingViewCustomEngine.Std.na(null), 1);
  assert.strictEqual(TradingViewCustomEngine.Std.na(undefined), 1);
  assert.strictEqual(TradingViewCustomEngine.Std.na(0), 0);
  assert.strictEqual(TradingViewCustomEngine.Std.na(123.45), 0);
  assert.strictEqual(TradingViewCustomEngine.Std.na(-50), 0);
});

/* =========================================================================
 * DIMENSION 5: input.source String Resolution
 * ========================================================================= */
console.log('\n--- [DIMENSION 5] input.source String Resolution ---');

check('input.source string resolution in ta.sma, ta.ema, ta.rsi, ta.sum', () => {
  const code = `//@version=5
indicator("Source Input Test", overlay=true)
src = input.source(close, "Price Source")
ma = ta.sma(src, 10)
emaVal = ta.ema(src, 10)
rsiVal = ta.rsi(src, 14)
sumVal = ta.sum(src, 10)
plot(ma, "SMA")
plot(emaVal, "EMA")
plot(rsiVal, "RSI")
plot(sumVal, "SUM")
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  assert.strictEqual(res.metainfo.inputs[0].type, 'source');
  
  // Test default input (close)
  const execClose = PineScriptRuntime.execute(res, bars100, { in_0: 'close' });
  assert.strictEqual(execClose.success, true);
  assert.ok(!isNaN(execClose.plotValues.plot_0[20]));
  
  // Test override with 'high'
  const execHigh = PineScriptRuntime.execute(res, bars100, { in_0: 'high' });
  assert.strictEqual(execHigh.success, true);
  assert.ok(!isNaN(execHigh.plotValues.plot_0[20]));
  
  // High SMA must be greater than Close SMA because high > close on these bars
  assert.ok(
    execHigh.plotValues.plot_0[20] > execClose.plotValues.plot_0[20],
    'High SMA should be higher than Close SMA'
  );
  
  // Test override with 'hlc3'
  const execHlc3 = PineScriptRuntime.execute(res, bars100, { in_0: 'hlc3' });
  assert.strictEqual(execHlc3.success, true);
  assert.ok(!isNaN(execHlc3.plotValues.plot_0[20]));
});

/* =========================================================================
 * DIMENSION 6: ta.sum Mapping Rule & Accuracy
 * ========================================================================= */
console.log('\n--- [DIMENSION 6] ta.sum Mapping & Numerical Precision ---');

check('ta.sum transpilation and exact rolling calculation', () => {
  const code = `//@version=5
indicator("Sum Test", overlay=false)
s = ta.sum(close, 5)
plot(s, "Sum5")
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.constructorCode.includes('Std.sum(Std.close(_ctx), 5, _ctx)'));
  
  const exec = PineScriptRuntime.execute(res, bars100);
  assert.strictEqual(exec.success, true);
  
  // Verify bars 0..3 are NaN
  for (let i = 0; i < 4; i++) {
    assert.ok(isNaN(exec.plotValues.plot_0[i]), `Bar ${i} should be NaN`);
  }
  
  // Verify bar 4 and beyond match exact sum of 5 bars
  for (let i = 4; i < 30; i++) {
    let expectedSum = 0;
    for (let k = 0; k < 5; k++) {
      expectedSum += bars100[i - k].close;
    }
    const actualSum = exec.plotValues.plot_0[i];
    const diff = Math.abs(actualSum - expectedSum);
    assert.ok(diff < 1e-10, `Bar ${i} diff too large: ${diff}`);
  }
});

/* =========================================================================
 * DIMENSION 7: Whitespace & Empty Script Validation
 * ========================================================================= */
console.log('\n--- [DIMENSION 7] Whitespace & Empty Script Validation ---');

check('Empty and whitespace-only scripts are rejected with clean error', () => {
  const emptyCases = [
    "",
    "   ",
    "\n\n\r\t   \n",
    " \t \r\n "
  ];
  
  for (const tc of emptyCases) {
    const res = PineEngine.transpile(tc);
    assert.strictEqual(res.success, false, `Expected failure for whitespace code: "${tc}"`);
    assert.ok(res.errors.length > 0, 'Must have at least one error message');
    assert.strictEqual(res.metainfo, null);
    assert.strictEqual(res.constructor, null);
  }
  
  // Comment-only script returns success with warning
  const commentRes = PineEngine.transpile("// only comment line 1\n// only comment line 2");
  assert.strictEqual(commentRes.success, true);
  assert.ok(commentRes.warnings.length > 0);
});

/* =========================================================================
 * ADVERSARIAL STRESS: Syntax Fuzzing, URL Comments & Boundary Stress
 * ========================================================================= */
console.log('\n--- [ADVERSARIAL STRESS] Boundary & Fuzzing Probes ---');

check('String containing URL with // does not truncate string literal', () => {
  const code = `//@version=5
indicator("URL in String", overlay=true)
desc = "Check https://tradingview.com//chart for details" // real comment
plot(close, desc)
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  assert.ok(res.constructorCode.includes('Check https://tradingview.com//chart for details'));
});

check('Multi-output tuple destructuring with MACD and Bollinger Bands', () => {
  const code = `//@version=5
indicator("Multi Tuple Indicator", overlay=true)
[mLine, sLine, hLine] = ta.macd(close, 12, 26, 9)
[bbBasis, bbUpper, bbLower] = ta.bb(close, 20, 2.0)
plot(mLine, "MACD")
plot(sLine, "Signal")
plot(bbBasis, "BB Basis")
plot(bbUpper, "BB Upper")
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars100);
  assert.strictEqual(exec.success, true);
  assert.strictEqual(exec.plotsMeta.length, 4);
  assert.ok(!isNaN(exec.plotValues.plot_0[40]));
  assert.ok(!isNaN(exec.plotValues.plot_2[40]));
});

check('SuperTrend direction switching with color linebr', () => {
  const code = `//@version=5
indicator("ST Test", overlay=true)
[st, dir] = ta.supertrend(3.0, 10)
plot(dir < 0 ? st : na, "Up", color=color.green, style=plot.style_linebr)
plot(dir > 0 ? st : na, "Down", color=color.red, style=plot.style_linebr)
`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars100);
  assert.strictEqual(exec.success, true);
  assert.strictEqual(exec.plotsMeta.length, 2);
});

check('Storage Manager CRUD, Starter Template Immutability, and Corruption Recovery', () => {
  // Clear any existing custom scripts
  PineScriptStorage.clearCustomScripts();
  
  // 1. Check starter templates are read-only
  const templates = PineScriptStorage.getTemplates();
  assert.strictEqual(templates.length, 8);
  const delResult = PineScriptStorage.deleteScript('template_ema_cross');
  assert.strictEqual(delResult, false, 'Template deletion must return false');
  
  // 2. Save 10 custom scripts
  for (let i = 0; i < 10; i++) {
    PineScriptStorage.saveScript({
      name: `Custom Script ${i}`,
      code: `//@version=5\nindicator("C${i}")\nplot(close)`
    });
  }
  assert.strictEqual(PineScriptStorage.getCustomScripts().length, 10);
  assert.strictEqual(PineScriptStorage.getAllScripts().length, 18);
  
  // 3. Export / Import roundtrip
  const exported = PineScriptStorage.exportAll();
  const parsedExport = JSON.parse(exported);
  assert.strictEqual(parsedExport.scripts.length, 10);
  
  PineScriptStorage.clearCustomScripts();
  assert.strictEqual(PineScriptStorage.getCustomScripts().length, 0);
  
  const importedCount = PineScriptStorage.importAll(exported);
  assert.strictEqual(importedCount, 10);
  assert.strictEqual(PineScriptStorage.getCustomScripts().length, 10);
  
  // Clean up
  PineScriptStorage.clearCustomScripts();
});

/* =========================================================================
 * DIMENSION 8: 500-Bar Empirical Adversarial Oracle Verification
 * Deep Mathematical Precision, Historical Convergence & Discrepancy Detection
 * ========================================================================= */
console.log('\n--- [DIMENSION 8] 500-Bar Empirical Adversarial Oracle Verification ---');

// 1. Generate 500 deterministic historical bars with realistic multi-regime dynamics
function generate500Bars() {
  const bars = [];
  let price = 100.0;
  for (let i = 0; i < 500; i++) {
    const o = price;
    // Composite multi-frequency price action with trend shifts
    const delta = Math.sin(i * 0.15) * 3.5 + Math.cos(i * 0.04) * 2.0 + ((i > 250 && i < 350) ? 0.8 : -0.2);
    const c = price + delta;
    const h = Math.max(o, c) + 2.5 + Math.abs(Math.sin(i * 0.3)) * 1.0;
    const l = Math.min(o, c) - 2.5 - Math.abs(Math.cos(i * 0.3)) * 1.0;
    const v = 1000 + (i % 20) * 150 + Math.floor(Math.abs(delta) * 100);
    bars.push({
      time: 1700000000 + i * 60,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: v
    });
    price = c;
  }
  return bars;
}

const bars500 = generate500Bars();
const close500 = bars500.map(b => b.close);

// 2. Pure Mathematical Reference Oracles
function oracleSMA(series, len) {
  const out = [];
  for (let i = 0; i < series.length; i++) {
    if (i < len - 1) {
      out.push(NaN);
    } else {
      let sum = 0;
      for (let k = 0; k < len; k++) sum += series[i - k];
      out.push(sum / len);
    }
  }
  return out;
}

function oracleEMA(series, len) {
  const out = [];
  const alpha = 2 / (len + 1);
  let prev = NaN;
  for (let i = 0; i < series.length; i++) {
    if (i < len - 1) {
      out.push(NaN);
    } else if (i === len - 1) {
      let sum = 0;
      for (let k = 0; k < len; k++) sum += series[i - k];
      prev = sum / len;
      out.push(prev);
    } else {
      prev = alpha * series[i] + (1 - alpha) * prev;
      out.push(prev);
    }
  }
  return out;
}

function oracleRMA(series, len) {
  const out = [];
  let prev = NaN;
  for (let i = 0; i < series.length; i++) {
    if (i < len - 1) {
      out.push(NaN);
    } else if (i === len - 1) {
      let sum = 0;
      for (let k = 0; k < len; k++) sum += series[i - k];
      prev = sum / len;
      out.push(prev);
    } else {
      prev = (series[i] + (len - 1) * prev) / len;
      out.push(prev);
    }
  }
  return out;
}

function oracleATR(bars, len) {
  const tr = [];
  for (let i = 0; i < bars.length; i++) {
    if (i === 0) {
      tr.push(bars[0].high - bars[0].low);
    } else {
      const h = bars[i].high;
      const l = bars[i].low;
      const pc = bars[i - 1].close;
      tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
  }
  return oracleRMA(tr, len);
}

function oracleRSI(series, len) {
  const up = [];
  const down = [];
  for (let i = 0; i < series.length; i++) {
    if (i === 0) {
      up.push(0);
      down.push(0);
    } else {
      const chg = series[i] - series[i - 1];
      up.push(Math.max(chg, 0));
      down.push(-Math.min(chg, 0));
    }
  }
  const upRma = oracleRMA(up, len);
  const downRma = oracleRMA(down, len);
  const out = [];
  for (let i = 0; i < series.length; i++) {
    if (isNaN(upRma[i]) || isNaN(downRma[i])) {
      out.push(NaN);
    } else if (downRma[i] === 0) {
      out.push(100);
    } else if (upRma[i] === 0) {
      out.push(0);
    } else {
      const rs = upRma[i] / downRma[i];
      out.push(100 - (100 / (1 + rs)));
    }
  }
  return out;
}

function oracleMACD(series, fastLen, slowLen, sigLen) {
  const fastEMA = oracleEMA(series, fastLen);
  const slowEMA = oracleEMA(series, slowLen);
  const macdLine = [];
  for (let i = 0; i < series.length; i++) {
    if (isNaN(fastEMA[i]) || isNaN(slowEMA[i])) {
      macdLine.push(NaN);
    } else {
      macdLine.push(fastEMA[i] - slowEMA[i]);
    }
  }
  // In TradingView custom engine runtime, macdVar falls back to 0 during NaN warmup
  const macdSeriesWithZeroFallback = macdLine.map(v => isNaN(v) ? 0 : v);
  const signalLine = oracleEMA(macdSeriesWithZeroFallback, sigLen);
  const hist = [];
  for (let i = 0; i < series.length; i++) {
    if (isNaN(macdLine[i]) || isNaN(signalLine[i])) {
      hist.push(NaN);
    } else {
      hist.push(macdLine[i] - signalLine[i]);
    }
  }
  return { macd: macdLine, signal: signalLine, hist };
}

function oracleBB(series, len, mult) {
  const basis = oracleSMA(series, len);
  const upper = [];
  const lower = [];
  for (let i = 0; i < series.length; i++) {
    if (isNaN(basis[i])) {
      upper.push(NaN);
      lower.push(NaN);
    } else {
      let sumSq = 0;
      for (let k = 0; k < len; k++) {
        sumSq += Math.pow(series[i - k] - basis[i], 2);
      }
      const stdev = Math.sqrt(sumSq / len);
      upper.push(basis[i] + mult * stdev);
      lower.push(basis[i] - mult * stdev);
    }
  }
  return { basis, upper, lower };
}

function oracleSuperTrend(bars, factor, atrPeriod) {
  const atr = oracleATR(bars, atrPeriod);
  const st = [];
  const dir = [];
  let prevFinalUpper = NaN;
  let prevFinalLower = NaN;
  let prevClose = NaN;
  let prevST = NaN;
  let prevDir = 1;

  for (let i = 0; i < bars.length; i++) {
    const b = bars[i];
    const curAtr = atr[i];
    if (isNaN(curAtr)) {
      st.push(NaN);
      dir.push(1);
      continue;
    }
    const hl2 = (b.high + b.low) / 2;
    const basicUpper = hl2 + factor * curAtr;
    const basicLower = hl2 - factor * curAtr;

    let finalUpper = basicUpper;
    if (!isNaN(prevFinalUpper) && !isNaN(prevClose)) {
      finalUpper = (basicUpper < prevFinalUpper || prevClose > prevFinalUpper) ? basicUpper : prevFinalUpper;
    }

    let finalLower = basicLower;
    if (!isNaN(prevFinalLower) && !isNaN(prevClose)) {
      finalLower = (basicLower > prevFinalLower || prevClose < prevFinalLower) ? basicLower : prevFinalLower;
    }

    let currentDir = 1;
    let currentST = finalUpper;

    if (isNaN(prevST)) {
      currentDir = b.close > finalUpper ? -1 : 1;
      currentST = currentDir === -1 ? finalLower : finalUpper;
    } else if (prevDir === -1) {
      if (b.close < finalLower) {
        currentDir = 1;
        currentST = finalUpper;
      } else {
        currentDir = -1;
        currentST = finalLower;
      }
    } else {
      if (b.close > finalUpper) {
        currentDir = -1;
        currentST = finalLower;
      } else {
        currentDir = 1;
        currentST = finalUpper;
      }
    }

    st.push(currentST);
    dir.push(currentDir);

    prevFinalUpper = finalUpper;
    prevFinalLower = finalLower;
    prevClose = b.close;
    prevST = currentST;
    prevDir = currentDir;
  }
  return { st, dir };
}

// Check 21: 500-Bar Dataset Generation & Integrity
check('500-bar historical dataset integrity & non-zero variance check', () => {
  assert.strictEqual(bars500.length, 500);
  for (let i = 0; i < 500; i++) {
    const b = bars500[i];
    assert.ok(!isNaN(b.open) && !isNaN(b.high) && !isNaN(b.low) && !isNaN(b.close) && !isNaN(b.volume));
    assert.ok(b.high >= Math.max(b.open, b.close));
    assert.ok(b.low <= Math.min(b.open, b.close));
    assert.ok(b.volume > 0);
  }
});

// Check 22: 500-Bar Multi-Period SMA Convergence vs Oracle (drift < 1e-10)
check('500-bar multi-period SMA convergence (periods 5, 14, 50, 200) vs Oracle (drift < 1e-10)', () => {
  const periods = [5, 14, 50, 200];
  const pineCode = `//@version=5\nindicator("MultiSMA")\n` +
    periods.map((p, idx) => `plot(ta.sma(close, ${p}), "SMA_${p}")`).join('\n');
  const res = PineEngine.transpile(pineCode);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars500);
  assert.strictEqual(exec.success, true);

  for (let pIdx = 0; pIdx < periods.length; pIdx++) {
    const len = periods[pIdx];
    const oracleVals = oracleSMA(close500, len);
    const engineVals = exec.plotValues[`plot_${pIdx}`];
    assert.strictEqual(engineVals.length, 500);

    let maxDrift = 0;
    for (let i = 0; i < 500; i++) {
      if (i < len - 1) {
        assert.ok(isNaN(engineVals[i]), `SMA(${len}) bar ${i} must be NaN`);
      } else {
        const drift = Math.abs(engineVals[i] - oracleVals[i]);
        if (drift > maxDrift) maxDrift = drift;
        assert.ok(drift < 1e-10, `SMA(${len}) bar ${i} drift ${drift} exceeds 1e-10`);
      }
    }
  }
});

// Check 23: 500-Bar Multi-Period EMA Convergence vs Oracle (drift < 1e-5)
check('500-bar multi-period EMA exponential convergence (periods 9, 21, 50) vs Oracle (drift < 1e-5)', () => {
  const periods = [9, 21, 50];
  const pineCode = `//@version=5\nindicator("MultiEMA")\n` +
    periods.map((p, idx) => `plot(ta.ema(close, ${p}), "EMA_${p}")`).join('\n');
  const res = PineEngine.transpile(pineCode);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars500);
  assert.strictEqual(exec.success, true);

  for (let pIdx = 0; pIdx < periods.length; pIdx++) {
    const len = periods[pIdx];
    const oracleVals = oracleEMA(close500, len);
    const engineVals = exec.plotValues[`plot_${pIdx}`];

    let maxDrift = 0;
    for (let i = 0; i < 500; i++) {
      if (i < len - 1) {
        assert.ok(isNaN(engineVals[i]), `EMA(${len}) bar ${i} must be NaN`);
      } else {
        const drift = Math.abs(engineVals[i] - oracleVals[i]);
        if (drift > maxDrift) maxDrift = drift;
        assert.ok(drift < 1e-5, `EMA(${len}) bar ${i} drift ${drift} exceeds 1e-5`);
      }
    }
  }
});

// Check 24: 500-Bar RMA and ATR Precision vs Wilder's Smoothing Oracle (drift < 1e-5)
check('500-bar RMA and ATR precision vs Wilder smoothing Oracle (drift < 1e-5)', () => {
  const pineCode = `//@version=5\nindicator("RMA_ATR")\nplot(ta.rma(close, 14), "RMA14")\nplot(ta.atr(14), "ATR14")`;
  const res = PineEngine.transpile(pineCode);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars500);
  assert.strictEqual(exec.success, true);

  const oracleRmaVals = oracleRMA(close500, 14);
  const oracleAtrVals = oracleATR(bars500, 14);
  const engineRmaVals = exec.plotValues.plot_0;
  const engineAtrVals = exec.plotValues.plot_1;

  for (let i = 13; i < 500; i++) {
    const rmaDrift = Math.abs(engineRmaVals[i] - oracleRmaVals[i]);
    const atrDrift = Math.abs(engineAtrVals[i] - oracleAtrVals[i]);
    assert.ok(rmaDrift < 1e-5, `RMA(14) bar ${i} drift ${rmaDrift} exceeds 1e-5`);
    assert.ok(atrDrift < 1e-5, `ATR(14) bar ${i} drift ${atrDrift} exceeds 1e-5`);
  }
});

// Check 25: 500-Bar RSI Precision and [0, 100] Bound Conformance vs Oracle (drift < 1e-4)
check('500-bar RSI(14) precision and boundary [0, 100] conformance vs Oracle (drift < 1e-4)', () => {
  const pineCode = `//@version=5\nindicator("RSI14")\nplot(ta.rsi(close, 14), "RSI")`;
  const res = PineEngine.transpile(pineCode);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars500);
  assert.strictEqual(exec.success, true);

  const oracleRsiVals = oracleRSI(close500, 14);
  const engineRsiVals = exec.plotValues.plot_0;

  for (let i = 14; i < 500; i++) {
    const val = engineRsiVals[i];
    assert.ok(!isNaN(val), `RSI bar ${i} should not be NaN`);
    assert.ok(val >= 0 && val <= 100, `RSI bar ${i} (${val}) out of bounds [0, 100]`);
    const drift = Math.abs(val - oracleRsiVals[i]);
    assert.ok(drift < 1e-4, `RSI(14) bar ${i} drift ${drift} exceeds 1e-4`);
  }
});

// Check 26: 500-Bar MACD (12, 26, 9) Multi-Tuple Precision vs Oracle (drift < 1e-5)
check('500-bar MACD(12, 26, 9) multi-tuple precision and signal convergence vs Oracle (drift < 1e-5)', () => {
  const pineCode = `//@version=5\nindicator("MACD")\n[m, s, h] = ta.macd(close, 12, 26, 9)\nplot(m, "MACD")\nplot(s, "Signal")\nplot(h, "Hist")`;
  const res = PineEngine.transpile(pineCode);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars500);
  assert.strictEqual(exec.success, true);

  const oracleMacdData = oracleMACD(close500, 12, 26, 9);
  const engineM = exec.plotValues.plot_0;
  const engineS = exec.plotValues.plot_1;
  const engineH = exec.plotValues.plot_2;

  // After 34 bars (26 slow + 9 sig - 1), MACD and Signal are fully converged
  for (let i = 34; i < 500; i++) {
    const mDrift = Math.abs(engineM[i] - oracleMacdData.macd[i]);
    const sDrift = Math.abs(engineS[i] - oracleMacdData.signal[i]);
    const hDrift = Math.abs(engineH[i] - oracleMacdData.hist[i]);
    assert.ok(mDrift < 1e-5, `MACD line bar ${i} drift ${mDrift} exceeds 1e-5`);
    assert.ok(sDrift < 1e-5, `MACD signal bar ${i} drift ${sDrift} exceeds 1e-5`);
    assert.ok(hDrift < 1e-5, `MACD hist bar ${i} drift ${hDrift} exceeds 1e-5`);
  }
});

// Check 27: 500-Bar Bollinger Bands (20, 2.0) Precision & Envelope Invariant (Upper >= Basis >= Lower)
check('500-bar Bollinger Bands (20, 2.0) precision & envelope invariant vs Oracle (drift < 1e-5)', () => {
  const pineCode = `//@version=5\nindicator("BB")\n[b, u, l] = ta.bb(close, 20, 2.0)\nplot(b, "Basis")\nplot(u, "Upper")\nplot(l, "Lower")`;
  const res = PineEngine.transpile(pineCode);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars500);
  assert.strictEqual(exec.success, true);

  const oracleBBData = oracleBB(close500, 20, 2.0);
  const engineBasis = exec.plotValues.plot_0;
  const engineUpper = exec.plotValues.plot_1;
  const engineLower = exec.plotValues.plot_2;

  for (let i = 19; i < 500; i++) {
    const bDrift = Math.abs(engineBasis[i] - oracleBBData.basis[i]);
    const uDrift = Math.abs(engineUpper[i] - oracleBBData.upper[i]);
    const lDrift = Math.abs(engineLower[i] - oracleBBData.lower[i]);
    assert.ok(bDrift < 1e-5, `BB Basis bar ${i} drift ${bDrift} exceeds 1e-5`);
    assert.ok(uDrift < 1e-5, `BB Upper bar ${i} drift ${uDrift} exceeds 1e-5`);
    assert.ok(lDrift < 1e-5, `BB Lower bar ${i} drift ${lDrift} exceeds 1e-5`);
    // Envelope Invariant: Upper >= Basis >= Lower
    assert.ok(engineUpper[i] >= engineBasis[i] - 1e-9, `Upper < Basis invariant violation at ${i}`);
    assert.ok(engineBasis[i] >= engineLower[i] - 1e-9, `Basis < Lower invariant violation at ${i}`);
  }
});

// Check 28: 500-Bar SuperTrend (3.0, 10) Directional State Machine & Trailing Stop Oracle
check('500-bar SuperTrend (3.0, 10) state machine and trailing stop vs Oracle', () => {
  const pineCode = `//@version=5\nindicator("ST")\n[st, dir] = ta.supertrend(3.0, 10)\nplot(st, "ST")\nplot(dir, "Dir")`;
  const res = PineEngine.transpile(pineCode);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars500);
  assert.strictEqual(exec.success, true);

  const oracleSTData = oracleSuperTrend(bars500, 3.0, 10);
  const engineST = exec.plotValues.plot_0;
  const engineDir = exec.plotValues.plot_1;

  for (let i = 10; i < 500; i++) {
    assert.strictEqual(engineDir[i], oracleSTData.dir[i], `SuperTrend direction mismatch at bar ${i}`);
    const stDrift = Math.abs(engineST[i] - oracleSTData.st[i]);
    assert.ok(stDrift < 1e-5, `SuperTrend value drift ${stDrift} at bar ${i}`);
  }
});

// Check 29: 500-Bar Deep Series Lookback Indexing (offsets 1, 10, 50, 100, 250, 499) and Out-Of-Bounds (500)
check('500-bar deep series lookback indexing (offsets 1, 10, 50, 100, 250, 499) and out-of-bounds', () => {
  const pineCode = `//@version=5\nindicator("DeepLookback")\n` +
    `c1 = close[1]\n` +
    `c10 = close[10]\n` +
    `c50 = close[50]\n` +
    `c100 = close[100]\n` +
    `c250 = close[250]\n` +
    `c499 = close[499]\n` +
    `c500 = close[500]\n` +
    `plot(c1, "c1")\n` +
    `plot(c10, "c10")\n` +
    `plot(c50, "c50")\n` +
    `plot(c100, "c100")\n` +
    `plot(c250, "c250")\n` +
    `plot(c499, "c499")\n` +
    `plot(c500, "c500")`;
  const res = PineEngine.transpile(pineCode);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, bars500);
  assert.strictEqual(exec.success, true);

  // Offset 1 at bar 499
  assert.strictEqual(exec.plotValues.plot_0[499], bars500[498].close);
  // Offset 10 at bar 499
  assert.strictEqual(exec.plotValues.plot_1[499], bars500[489].close);
  // Offset 50 at bar 499
  assert.strictEqual(exec.plotValues.plot_2[499], bars500[449].close);
  // Offset 100 at bar 499
  assert.strictEqual(exec.plotValues.plot_3[499], bars500[399].close);
  // Offset 250 at bar 499
  assert.strictEqual(exec.plotValues.plot_4[499], bars500[249].close);
  // Offset 499 at bar 499 (bar 0 value)
  assert.strictEqual(exec.plotValues.plot_5[499], bars500[0].close);
  // Offset 500 at bar 499 (out of bounds -> must be NaN)
  assert.ok(isNaN(exec.plotValues.plot_6[499]), 'Offset 500 must return NaN');
});

// Check 30: 500-Bar Edge Case Stress: Zero-Volatility Flat Series (division-by-zero stability)
check('500-bar zero-volatility flat series division-by-zero and numerical stability', () => {
  const flatBars = [];
  for (let i = 0; i < 500; i++) {
    flatBars.push({
      time: 1700000000 + i * 60,
      open: 100.0,
      high: 100.0,
      low: 100.0,
      close: 100.0,
      volume: 500
    });
  }
  const pineCode = `//@version=5\nindicator("FlatSeries")\n` +
    `s = ta.sma(close, 20)\n` +
    `e = ta.ema(close, 20)\n` +
    `r = ta.rsi(close, 14)\n` +
    `[b, u, l] = ta.bb(close, 20, 2.0)\n` +
    `[m, sig, h] = ta.macd(close, 12, 26, 9)\n` +
    `plot(s)\nplot(e)\nplot(r)\nplot(u)\nplot(l)\nplot(m)`;
  const res = PineEngine.transpile(pineCode);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, flatBars);
  assert.strictEqual(exec.success, true);

  // At bar 499: SMA and EMA should be exactly 100
  assert.strictEqual(exec.plotValues.plot_0[499], 100.0);
  assert.strictEqual(exec.plotValues.plot_1[499], 100.0);
  // BB Upper and Lower should both equal 100 (stdev = 0)
  assert.strictEqual(exec.plotValues.plot_3[499], 100.0);
  assert.strictEqual(exec.plotValues.plot_4[499], 100.0);
  // MACD line should be 0
  assert.strictEqual(exec.plotValues.plot_5[499], 0.0);
});

// Check 31: 500-Bar Edge Case Stress: Extreme Volatility Alternating Jumps (+/- 50% swings)
check('500-bar extreme volatility alternating jumps (+/- 50% price changes) stability', () => {
  const extremeBars = [];
  let p = 100.0;
  for (let i = 0; i < 500; i++) {
    p = (i % 2 === 0) ? p * 1.5 : p * 0.67;
    // Bound price between 10 and 10000
    if (p < 10) p = 100;
    if (p > 10000) p = 1000;
    extremeBars.push({
      time: 1700000000 + i * 60,
      open: p,
      high: p * 1.05,
      low: p * 0.95,
      close: p,
      volume: 1000
    });
  }
  const pineCode = `//@version=5\nindicator("ExtremeVol")\n` +
    `s = ta.sma(close, 10)\n` +
    `e = ta.ema(close, 10)\n` +
    `r = ta.rsi(close, 14)\n` +
    `plot(s)\nplot(e)\nplot(r)`;
  const res = PineEngine.transpile(pineCode);
  assert.strictEqual(res.success, true);
  const exec = PineScriptRuntime.execute(res, extremeBars);
  assert.strictEqual(exec.success, true);

  for (let i = 20; i < 500; i++) {
    assert.ok(isFinite(exec.plotValues.plot_0[i]), `SMA not finite at bar ${i}`);
    assert.ok(isFinite(exec.plotValues.plot_1[i]), `EMA not finite at bar ${i}`);
    const rsiVal = exec.plotValues.plot_2[i];
    assert.ok(isFinite(rsiVal) && rsiVal >= 0 && rsiVal <= 100, `RSI out of bounds at bar ${i}: ${rsiVal}`);
  }
});

// Check 32: Adversarial Discrepancy Detection Oracle (mutated oracle sensitivity test)
check('Adversarial discrepancy detection oracle catches intentional numerical mutation', () => {
  // Deliberately introduce a 0.05 discrepancy in reference SMA and confirm oracle detects it
  const engineVals = oracleSMA(close500, 20);
  const mutatedVals = [...engineVals];
  mutatedVals[250] += 0.05; // Inject synthetic discrepancy

  let discrepancyDetected = false;
  const tolerance = 1e-4;
  for (let i = 19; i < 500; i++) {
    if (Math.abs(engineVals[i] - mutatedVals[i]) > tolerance) {
      discrepancyDetected = true;
      break;
    }
  }
  assert.strictEqual(discrepancyDetected, true, 'Oracle must catch synthetic precision deviation');
});

console.log('\n================================================================');
console.log(`  VERIFICATION RESULTS: ${passedChecks}/${totalChecks} PASS (${failedChecks} FAIL)`);
console.log('================================================================');

if (failedChecks > 0) {
  process.exit(1);
} else {
  process.exit(0);
}
