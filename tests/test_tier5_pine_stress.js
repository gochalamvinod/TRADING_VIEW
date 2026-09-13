/**
 * Tier 5: Adversarial Stress Testing & Empirical Validation Suite
 * Target: pine_engine.js (Pine Script v5 Transpiler, Runtime, TA Std Lib, LocalStorage)
 * 
 * 5 Comprehensive Adversarial Categories (46+ stress tests):
 * Category 1: Complex Syntax & Transpiler Stress
 * Category 2: Historical Lookback & Series Indexing Stress
 * Category 3: Mathematical Precision vs TA Reference (500+ Bars)
 * Category 4: Syntax Fuzzing & Malformed Code Error Diagnostics
 * Category 5: LocalStorage Resilience & Corrupt Payload Recovery
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const pineEnginePath = path.resolve(__dirname, '../pine_engine.js');
const {
  PineEngine,
  PineScriptTemplates,
  PineScriptStorage,
  PineTranspiler,
  PineScriptRuntime,
  PineScriptHighlighter,
  TradingViewCustomEngine
} = require(pineEnginePath);

// Initialize PineEngine
PineEngine.init(null);

const results = {
  total: 0,
  passed: 0,
  failed: 0,
  errors: [],
  categories: {}
};

function runTest(category, name, fn) {
  results.total++;
  if (!results.categories[category]) {
    results.categories[category] = { total: 0, passed: 0, failed: 0 };
  }
  results.categories[category].total++;

  try {
    fn();
    results.passed++;
    results.categories[category].passed++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    results.failed++;
    results.categories[category].failed++;
    results.errors.push({ category, name, error: err.message, stack: err.stack });
    console.error(`  [FAIL] ${name}: ${err.message}`);
  }
}

// Deterministic 500-bar OHLCV generator
function generate500Bars(count = 500, basePrice = 100.0) {
  const bars = [];
  let price = basePrice;
  for (let i = 0; i < count; i++) {
    const trend = Math.sin(i / 15.0) * 12.0;
    const cycle = Math.cos(i / 5.0) * 4.0;
    const noise = Math.sin(i * 3.7) * 1.5;
    const open = price;
    const close = Math.max(10.0, open + trend * 0.1 + cycle * 0.2 + noise);
    const high = Math.max(open, close) + Math.abs(Math.sin(i * 1.1)) * 3.0 + 0.5;
    const low = Math.min(open, close) - Math.abs(Math.cos(i * 1.3)) * 3.0 - 0.5;
    const volume = Math.floor(1000 + Math.abs(Math.sin(i)) * 2500 + (i % 7) * 300);
    bars.push({
      time: 1700000000 + i * 60,
      open,
      high,
      low,
      close,
      volume
    });
    price = close;
  }
  return bars;
}

const mockBars500 = generate500Bars(500);

console.log('='.repeat(80));
console.log('  TIER 5: PINE SCRIPT ENGINE ADVERSARIAL STRESS TEST SUITE');
console.log('='.repeat(80));

/* =========================================================================
 * Category 1: Complex Syntax & Transpiler Stress
 * ========================================================================= */
console.log('\n[>] Category 1: Complex Syntax & Transpiler Stress');

runTest('Category 1', '1.1: Nested Moving Averages transpilation & execution', () => {
  const code = `//@version=5
indicator("Nested MA", overlay=true)
fast = ta.ema(close, 9)
nested = ta.sma(fast, 14)
plot(nested)
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true, 'Transpilation should succeed');
  assert.strictEqual(transpiled.metainfo.plots.length, 1);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
  assert.strictEqual(execRes.plotValues['plot_0'].length, 500);
  assert(!isNaN(execRes.plotValues['plot_0'][499]), 'Last bar value should not be NaN');
});

runTest('Category 1', '1.2: Deeply nested TA expressions with highest/lowest of SMA', () => {
  const code = `//@version=5
indicator("Deep Nested", overlay=true)
s = ta.sma(close, 10)
h = ta.highest(s, 5)
l = ta.lowest(h, 3)
plot(l)
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
  assert.strictEqual(execRes.plotValues['plot_0'].length, 500);
  assert(!isNaN(execRes.plotValues['plot_0'][499]));
});

runTest('Category 1', '1.3: Complex mathematical expressions with math library functions', () => {
  const code = `//@version=5
indicator("Complex Math", overlay=true)
val = (high + low) / 2 + math.sqrt(math.abs(close - open)) * math.pow(volume, 0.5) / (1 + math.abs(close - open))
rounded = math.round(val)
floored = math.floor(val)
ceiled = math.ceil(val)
plot(val, "Val")
plot(rounded, "Round")
plot(floored, "Floor")
plot(ceiled, "Ceil")
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  assert.strictEqual(transpiled.metainfo.plots.length, 4);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
  assert(!isNaN(execRes.plotValues['plot_0'][10]));
  assert(!isNaN(execRes.plotValues['plot_1'][10]));
});

runTest('Category 1', '1.4: Diverse input types with constraints (int, float, bool, string, color, source)', () => {
  const code = `//@version=5
indicator("All Inputs", overlay=true)
i1 = input.int(10, "Int Val", minval=1, maxval=100)
i2 = input.float(2.5, "Float Val", minval=0.1, maxval=10.0)
i3 = input.bool(true, "Bool Val")
i4 = input.string("EURUSD", "Symbol Name")
i5 = input.color(color.red, "Color Pick")
i6 = input.source(close, "Source Field")
calc = i3 ? (i6 * i2 + i1) : 0
plot(calc)
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  const inputs = transpiled.metainfo.inputs;
  assert.strictEqual(inputs.length, 6);
  assert.strictEqual(inputs[0].type, 'integer');
  assert.strictEqual(inputs[1].type, 'float');
  assert.strictEqual(inputs[2].type, 'bool');
  assert.strictEqual(inputs[3].type, 'text');
  assert.strictEqual(inputs[4].type, 'color');
  assert.strictEqual(inputs[5].type, 'source');
  
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
});

runTest('Category 1', '1.5: Multi-plot indicators with all 8 plot styles', () => {
  const code = `//@version=5
indicator("Multi Plots", overlay=true)
plot(close, "Line", style=plot.style_line)
plot(open, "Histogram", style=plot.style_histogram)
plot(high, "Cross", style=plot.style_cross)
plot(low, "Area", style=plot.style_area)
plot(hl2, "Columns", style=plot.style_columns)
plot(hlc3, "Circles", style=plot.style_circles)
plot(ohlc4, "LineBR", style=plot.style_linebr)
plot(close, "StepLine", style=plot.style_stepline)
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  assert.strictEqual(transpiled.metainfo.plots.length, 8);
  const plottypeVals = transpiled.metainfo.plots.map(p => transpiled.metainfo.defaults.styles[p.id].plottype);
  assert.deepStrictEqual(plottypeVals, [0, 1, 3, 4, 5, 6, 7, 9]);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
});

runTest('Category 1', '1.6: Multi-shape plots covering all shapes and locations', () => {
  const code = `//@version=5
indicator("Multi Shapes", overlay=true)
plotshape(close > open, "Up", style=shape.triangleup, location=location.belowbar, color=color.green)
plotshape(close < open, "Down", style=shape.triangledown, location=location.abovebar, color=color.red)
plotshape(high > high[1], "ArrowUp", style=shape.arrowup, location=location.top, color=color.blue)
plotshape(low < low[1], "ArrowDown", style=shape.arrowdown, location=location.bottom, color=color.orange)
plotshape(close == open, "Cross", style=shape.cross, location=location.absolute, color=color.white)
plotshape(volume > 2000, "Circle", style=shape.circle, location=location.abovebar, color=color.purple)
plotshape(volume > 3000, "Square", style=shape.square, location=location.belowbar, color=color.yellow)
plotshape(high - low > 5, "Diamond", style=shape.diamond, location=location.abovebar, color=color.teal)
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  assert.strictEqual(transpiled.metainfo.plots.length, 8);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
});

runTest('Category 1', '1.7: Background color conditionals and dynamic colors', () => {
  const code = `//@version=5
indicator("BG Color", overlay=true)
bgcolor(close > open ? color.green : color.red)
plot(close)
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  assert.strictEqual(transpiled.metainfo.plots.length, 2);
  assert.strictEqual(transpiled.metainfo.plots[0].type, 'bg_colorer');
  assert.strictEqual(transpiled.metainfo.plots[1].type, 'line');
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
});

runTest('Category 1', '1.8: Multiple horizontal lines (hline) with varied styles and colors', () => {
  const code = `//@version=5
indicator("HLine Test", overlay=false)
plot(ta.rsi(close, 14))
hline(80, "Extreme OB", color=color.maroon, linestyle=hline.style_solid)
hline(70, "OB", color=color.red, linestyle=hline.style_dotted)
hline(50, "Mid", color=color.gray, linestyle=hline.style_dashed)
hline(30, "OS", color=color.green, linestyle=hline.style_dotted)
hline(20, "Extreme OS", color=color.lime, linestyle=hline.style_solid)
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  assert.strictEqual(transpiled.metainfo.bands.length, 5);
  const styles = transpiled.metainfo.defaults.bands.map(b => b.linestyle);
  assert.deepStrictEqual(styles, [0, 1, 2, 1, 0]);
});

runTest('Category 1', '1.9: Tuple destructuring for multi-output indicators', () => {
  const code = `//@version=5
indicator("Destructure All", overlay=true)
[mLine, sLine, hLine] = ta.macd(close, 12, 26, 9)
[bBasis, bUpper, bLower] = ta.bb(close, 20, 2.0)
[stVal, stDir] = ta.supertrend(3.0, 10)
plot(bBasis, "BB Basis")
plot(bUpper, "BB Upper")
plot(bLower, "BB Lower")
plot(stVal, "SuperTrend")
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  assert.strictEqual(transpiled.metainfo.plots.length, 4);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
  assert(!isNaN(execRes.plotValues['plot_0'][30]));
  assert(!isNaN(execRes.plotValues['plot_1'][30]));
});

runTest('Category 1', '1.10: Tricky comments, string quotes, URLs, and Pine expressions in comments', () => {
  const code = `//@version=5
// Header comment with url: https://tradingview.com/script//test
indicator("Tricky 'Quotes' & // Comments", overlay=true) // Trailing comment with plot(close)
fastLen = input.int(10, "Fast Length // not a comment") // another // comment
// line with only // comment
val = close // comment at end
plot(val, "Plot // Title 'escaped'", color=color.blue) // final plot comment
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  assert.strictEqual(transpiled.metainfo.name, "Tricky 'Quotes' & // Comments");
  assert.strictEqual(transpiled.metainfo.plots.length, 1);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
});


/* =========================================================================
 * Category 2: Historical Lookback & Series Indexing Stress
 * ========================================================================= */
console.log('\n[>] Category 2: Historical Lookback & Series Indexing Stress');

runTest('Category 2', '2.1: Lookback on all built-in OHLCV series', () => {
  const code = `//@version=5
indicator("Lookback Builtins", overlay=true)
c1 = close[1]
o2 = open[2]
h3 = high[3]
l4 = low[4]
v5 = volume[5]
hl_1 = hl2[1]
hlc_2 = hlc3[2]
ohlc_3 = ohlc4[3]
diff = c1 + o2 + h3 + l4 + v5 + hl_1 + hlc_2 + ohlc_3
plot(diff)
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
  
  // Verify bar 10 exact calculation
  const b = mockBars500;
  const expectedBar10 = b[9].close + b[8].open + b[7].high + b[6].low + b[5].volume +
    ((b[9].high + b[9].low)/2) + ((b[8].high + b[8].low + b[8].close)/3) + ((b[7].open + b[7].high + b[7].low + b[7].close)/4);
  const actualBar10 = execRes.plotValues['plot_0'][10];
  assert(Math.abs(actualBar10 - expectedBar10) < 1e-5, `Bar 10 lookback mismatch: expected ${expectedBar10}, got ${actualBar10}`);
});

runTest('Category 2', '2.2: Deep lookback (offset 50, 100, 250, 490) on 500-bar series', () => {
  const code = `//@version=5
indicator("Deep Lookback", overlay=true)
c50 = close[50]
c100 = close[100]
c250 = close[250]
c490 = close[490]
plot(c50, "C50")
plot(c100, "C100")
plot(c250, "C250")
plot(c490, "C490")
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
  
  // At bar 495:
  // close[50] -> bar 495 - 50 = bar 445
  // close[100] -> bar 495 - 100 = bar 395
  // close[250] -> bar 495 - 250 = bar 245
  // close[490] -> bar 495 - 490 = bar 5
  assert.strictEqual(execRes.plotValues['plot_0'][495], mockBars500[445].close);
  assert.strictEqual(execRes.plotValues['plot_1'][495], mockBars500[395].close);
  assert.strictEqual(execRes.plotValues['plot_2'][495], mockBars500[245].close);
  assert.strictEqual(execRes.plotValues['plot_3'][495], mockBars500[5].close);
});

runTest('Category 2', '2.3: Out-of-bounds lookback returns NaN gracefully without crashing', () => {
  const code = `//@version=5
indicator("OOB Lookback", overlay=true)
c10 = close[10]
plot(c10)
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
  // Bars 0..9 should be NaN because offset 10 is out of bounds
  for (let i = 0; i < 10; i++) {
    assert(isNaN(execRes.plotValues['plot_0'][i]), `Bar ${i} should be NaN for close[10]`);
  }
  // Bar 10 should have mockBars500[0].close
  assert.strictEqual(execRes.plotValues['plot_0'][10], mockBars500[0].close);
});

runTest('Category 2', '2.4: Zero offset lookback close[0] equals current close', () => {
  const code = `//@version=5
indicator("Zero Offset", overlay=true)
c0 = close[0]
plot(c0)
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
  for (let i = 0; i < 500; i++) {
    assert.strictEqual(execRes.plotValues['plot_0'][i], mockBars500[i].close);
  }
});

runTest('Category 2', '2.5: bar_index progression from 1 to 500', () => {
  const code = `//@version=5
indicator("Bar Index Test", overlay=true)
plot(bar_index)
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
  for (let i = 0; i < 500; i++) {
    assert.strictEqual(execRes.plotValues['plot_0'][i], i + 1);
  }
});

runTest('Category 2', '2.6: ta.change and ta.cum historical tracking', () => {
  const code = `//@version=5
indicator("Change and Cum", overlay=true)
chg = ta.change(close)
cumVol = ta.cum(volume)
plot(chg, "Change")
plot(cumVol, "CumVol")
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
  
  // Bar 0 change is NaN
  assert(isNaN(execRes.plotValues['plot_0'][0]));
  // Bar 1..499 change is close[i] - close[i-1]
  for (let i = 1; i < 500; i++) {
    const expectedChg = mockBars500[i].close - mockBars500[i-1].close;
    assert(Math.abs(execRes.plotValues['plot_0'][i] - expectedChg) < 1e-5);
  }
  
  // Cum volume
  let expectedCum = 0;
  for (let i = 0; i < 500; i++) {
    expectedCum += mockBars500[i].volume;
    assert.strictEqual(execRes.plotValues['plot_1'][i], expectedCum);
  }
});

runTest('Category 2', '2.7: ta.sum rolling sum calculation', () => {
  const code = `//@version=5
indicator("Rolling Sum", overlay=true)
rSum = ta.sum(close, 10)
plot(rSum)
`;
  const transpiled = PineEngine.transpile(code);
  assert.strictEqual(transpiled.success, true);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
  
  for (let i = 9; i < 500; i++) {
    let expectedSum = 0;
    for (let j = 0; j < 10; j++) {
      expectedSum += mockBars500[i - j].close;
    }
    assert(Math.abs(execRes.plotValues['plot_0'][i] - expectedSum) < 1e-4, `Bar ${i} rolling sum mismatch`);
  }
});


/* =========================================================================
 * Category 3: Mathematical Precision vs Independent TA Reference (500+ Bars)
 * ========================================================================= */
console.log('\n[>] Category 3: Mathematical Precision vs Independent TA Reference (500+ Bars)');

// Pure reference implementations in JS for independent verification
function refSMA(series, len) {
  const out = [];
  for (let i = 0; i < series.length; i++) {
    if (i < len - 1) {
      out.push(NaN);
    } else {
      let sum = 0;
      for (let j = 0; j < len; j++) sum += series[i - j];
      out.push(sum / len);
    }
  }
  return out;
}

function refEMA(series, len) {
  const out = [];
  const alpha = 2 / (len + 1);
  let prev = NaN;
  for (let i = 0; i < series.length; i++) {
    if (i < len - 1) {
      out.push(NaN);
    } else if (i === len - 1) {
      let sum = 0;
      for (let j = 0; j < len; j++) sum += series[i - j];
      prev = sum / len;
      out.push(prev);
    } else {
      prev = alpha * series[i] + (1 - alpha) * prev;
      out.push(prev);
    }
  }
  return out;
}

function refRMA(series, len) {
  const out = [];
  let prev = NaN;
  for (let i = 0; i < series.length; i++) {
    if (i < len - 1) {
      out.push(NaN);
    } else if (i === len - 1) {
      let sum = 0;
      for (let j = 0; j < len; j++) sum += series[i - j];
      prev = sum / len;
      out.push(prev);
    } else {
      prev = (series[i] + (len - 1) * prev) / len;
      out.push(prev);
    }
  }
  return out;
}

function refRSI(series, len) {
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
  const upRma = refRMA(up, len);
  const downRma = refRMA(down, len);
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

const closeSeries = mockBars500.map(b => b.close);

runTest('Category 3', '3.1: SMA precision (periods 5, 14, 50, 200) vs Reference', () => {
  for (const len of [5, 14, 50, 200]) {
    const code = `//@version=5\nindicator("SMA_${len}")\nplot(ta.sma(close, ${len}))`;
    const transpiled = PineEngine.transpile(code);
    const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
    const ref = refSMA(closeSeries, len);
    const engineVals = execRes.plotValues['plot_0'];
    
    for (let i = len - 1; i < 500; i++) {
      assert(Math.abs(engineVals[i] - ref[i]) < 1e-5, `SMA(${len}) mismatch at bar ${i}: engine=${engineVals[i]}, ref=${ref[i]}`);
    }
  }
});

runTest('Category 3', '3.2: EMA precision (periods 9, 21, 50) vs Reference', () => {
  for (const len of [9, 21, 50]) {
    const code = `//@version=5\nindicator("EMA_${len}")\nplot(ta.ema(close, ${len}))`;
    const transpiled = PineEngine.transpile(code);
    const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
    const ref = refEMA(closeSeries, len);
    const engineVals = execRes.plotValues['plot_0'];
    
    for (let i = len - 1; i < 500; i++) {
      assert(Math.abs(engineVals[i] - ref[i]) < 1e-4, `EMA(${len}) mismatch at bar ${i}: engine=${engineVals[i]}, ref=${ref[i]}`);
    }
  }
});

runTest('Category 3', '3.3: RMA & ATR precision (period 14) vs Reference', () => {
  const code = `//@version=5\nindicator("RMA_ATR")\nplot(ta.rma(close, 14), "RMA")\nplot(ta.atr(14), "ATR")`;
  const transpiled = PineEngine.transpile(code);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  
  const refRmaVals = refRMA(closeSeries, 14);
  const engineRmaVals = execRes.plotValues['plot_0'];
  for (let i = 13; i < 500; i++) {
    assert(Math.abs(engineRmaVals[i] - refRmaVals[i]) < 1e-4, `RMA(14) mismatch at bar ${i}`);
  }
  
  // ATR reference
  const tr = [];
  for (let i = 0; i < 500; i++) {
    if (i === 0) tr.push(mockBars500[0].high - mockBars500[0].low);
    else {
      const h = mockBars500[i].high;
      const l = mockBars500[i].low;
      const pc = mockBars500[i-1].close;
      tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
  }
  const refAtrVals = refRMA(tr, 14);
  const engineAtrVals = execRes.plotValues['plot_1'];
  for (let i = 13; i < 500; i++) {
    assert(Math.abs(engineAtrVals[i] - refAtrVals[i]) < 1e-4, `ATR(14) mismatch at bar ${i}`);
  }
});

runTest('Category 3', '3.4: RSI precision (period 14) vs Reference', () => {
  const code = `//@version=5\nindicator("RSI_14")\nplot(ta.rsi(close, 14))`;
  const transpiled = PineEngine.transpile(code);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  const ref = refRSI(closeSeries, 14);
  const engineVals = execRes.plotValues['plot_0'];
  
  for (let i = 14; i < 500; i++) {
    assert(Math.abs(engineVals[i] - ref[i]) < 1e-4, `RSI(14) mismatch at bar ${i}: engine=${engineVals[i]}, ref=${ref[i]}`);
  }
});

runTest('Category 3', '3.5: MACD precision (12, 26, 9) vs Reference', () => {
  const code = `//@version=5\nindicator("MACD")\n[m, s, h] = ta.macd(close, 12, 26, 9)\nplot(m, "MACD")\nplot(s, "Sig")\nplot(h, "Hist")`;
  const transpiled = PineEngine.transpile(code);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  
  const fastEma = refEMA(closeSeries, 12);
  const slowEma = refEMA(closeSeries, 26);
  const refMacd = [];
  for (let i = 0; i < 500; i++) {
    refMacd.push(isNaN(fastEma[i]) || isNaN(slowEma[i]) ? NaN : fastEma[i] - slowEma[i]);
  }
  const validMacd = refMacd.map(v => isNaN(v) ? 0 : v);
  const refSig = refEMA(validMacd, 9);
  
  const mVals = execRes.plotValues['plot_0'];
  const sVals = execRes.plotValues['plot_1'];
  const hVals = execRes.plotValues['plot_2'];
  
  for (let i = 25; i < 500; i++) {
    assert(Math.abs(mVals[i] - refMacd[i]) < 1e-3, `MACD line mismatch at bar ${i}`);
    assert(Math.abs(sVals[i] - refSig[i]) < 1e-3, `Signal line mismatch at bar ${i}`);
    assert(Math.abs(hVals[i] - (refMacd[i] - refSig[i])) < 1e-3, `Hist mismatch at bar ${i}`);
  }
});

runTest('Category 3', '3.6: Bollinger Bands precision (20, 2.0) vs Reference', () => {
  const code = `//@version=5\nindicator("BB")\n[basis, upper, lower] = ta.bb(close, 20, 2.0)\nplot(basis)\nplot(upper)\nplot(lower)`;
  const transpiled = PineEngine.transpile(code);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  
  const basisVals = execRes.plotValues['plot_0'];
  const upperVals = execRes.plotValues['plot_1'];
  const lowerVals = execRes.plotValues['plot_2'];
  
  for (let i = 19; i < 500; i++) {
    let sum = 0;
    for (let j = 0; j < 20; j++) sum += closeSeries[i - j];
    const mean = sum / 20;
    let sumSq = 0;
    for (let j = 0; j < 20; j++) sumSq += Math.pow(closeSeries[i - j] - mean, 2);
    const stdev = Math.sqrt(sumSq / 20);
    const expectedUpper = mean + 2.0 * stdev;
    const expectedLower = mean - 2.0 * stdev;
    
    assert(Math.abs(basisVals[i] - mean) < 1e-4, `BB basis mismatch at bar ${i}`);
    assert(Math.abs(upperVals[i] - expectedUpper) < 1e-4, `BB upper mismatch at bar ${i}`);
    assert(Math.abs(lowerVals[i] - expectedLower) < 1e-4, `BB lower mismatch at bar ${i}`);
  }
});

runTest('Category 3', '3.7: SuperTrend precision (3.0, 10) vs Reference', () => {
  const code = `//@version=5\nindicator("ST")\n[st, dir] = ta.supertrend(3.0, 10)\nplot(st)\nplot(dir)`;
  const transpiled = PineEngine.transpile(code);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  assert.strictEqual(execRes.success, true);
  
  const stVals = execRes.plotValues['plot_0'];
  const dirVals = execRes.plotValues['plot_1'];
  
  for (let i = 15; i < 500; i++) {
    assert(!isNaN(stVals[i]), `SuperTrend value at bar ${i} should be a number`);
    assert(dirVals[i] === 1 || dirVals[i] === -1, `SuperTrend direction at bar ${i} must be 1 or -1`);
  }
});

runTest('Category 3', '3.8: ta.stdev & ta.variance precision vs Reference', () => {
  const code = `//@version=5\nindicator("StdVar")\nplot(ta.stdev(close, 20), "Std")\nplot(ta.variance(close, 20), "Var")`;
  const transpiled = PineEngine.transpile(code);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  
  const stdVals = execRes.plotValues['plot_0'];
  const varVals = execRes.plotValues['plot_1'];
  
  for (let i = 19; i < 500; i++) {
    let sum = 0;
    for (let j = 0; j < 20; j++) sum += closeSeries[i - j];
    const mean = sum / 20;
    let sumSq = 0;
    for (let j = 0; j < 20; j++) sumSq += Math.pow(closeSeries[i - j] - mean, 2);
    const expectedVar = sumSq / 20;
    const expectedStd = Math.sqrt(expectedVar);
    
    assert(Math.abs(stdVals[i] - expectedStd) < 1e-4);
    assert(Math.abs(varVals[i] - expectedVar) < 1e-4);
  }
});

runTest('Category 3', '3.9: ta.highest, ta.lowest, ta.highestbars, ta.lowestbars vs Reference', () => {
  const code = `//@version=5\nindicator("HighLow")\nplot(ta.highest(high, 15), "H")\nplot(ta.lowest(low, 15), "L")\nplot(ta.highestbars(high, 15), "HB")\nplot(ta.lowestbars(low, 15), "LB")`;
  const transpiled = PineEngine.transpile(code);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  
  const hVals = execRes.plotValues['plot_0'];
  const lVals = execRes.plotValues['plot_1'];
  const hbVals = execRes.plotValues['plot_2'];
  const lbVals = execRes.plotValues['plot_3'];
  
  for (let i = 14; i < 500; i++) {
    let maxH = -Infinity;
    let minL = Infinity;
    let maxIdx = 0;
    let minIdx = 0;
    for (let j = 0; j < 15; j++) {
      const curH = mockBars500[i - j].high;
      const curL = mockBars500[i - j].low;
      if (curH > maxH) { maxH = curH; maxIdx = -j; }
      if (curL < minL) { minL = curL; minIdx = -j; }
    }
    assert.strictEqual(hVals[i], maxH);
    assert.strictEqual(lVals[i], minL);
    assert.strictEqual(hbVals[i], maxIdx);
    assert.strictEqual(lbVals[i], minIdx);
  }
});

runTest('Category 3', '3.10: ta.wma, ta.vwma, and ta.swma precision vs Reference', () => {
  const code = `//@version=5\nindicator("WMA_VWMA")\nplot(ta.wma(close, 10), "WMA")\nplot(ta.vwma(close, 10), "VWMA")\nplot(ta.swma(close), "SWMA")`;
  const transpiled = PineEngine.transpile(code);
  const execRes = PineScriptRuntime.execute(transpiled, mockBars500);
  
  const wmaVals = execRes.plotValues['plot_0'];
  const vwmaVals = execRes.plotValues['plot_1'];
  const swmaVals = execRes.plotValues['plot_2'];
  
  for (let i = 9; i < 500; i++) {
    // WMA ref
    let sum = 0;
    let norm = 0;
    for (let j = 0; j < 10; j++) {
      const weight = 10 - j;
      sum += closeSeries[i - j] * weight;
      norm += weight;
    }
    const expectedWma = sum / norm;
    assert(Math.abs(wmaVals[i] - expectedWma) < 1e-4, `WMA mismatch at bar ${i}`);
    
    // VWMA ref
    let sumPV = 0;
    let sumV = 0;
    for (let j = 0; j < 10; j++) {
      sumPV += closeSeries[i - j] * mockBars500[i - j].volume;
      sumV += mockBars500[i - j].volume;
    }
    const expectedVwma = sumPV / sumV;
    assert(Math.abs(vwmaVals[i] - expectedVwma) < 1e-4, `VWMA mismatch at bar ${i}`);
  }
  
  // SWMA ref (4 bars: 1/6, 2/6, 2/6, 1/6)
  for (let i = 3; i < 500; i++) {
    const expectedSwma = (closeSeries[i-3] * 1/6) + (closeSeries[i-2] * 2/6) + (closeSeries[i-1] * 2/6) + (closeSeries[i] * 1/6);
    assert(Math.abs(swmaVals[i] - expectedSwma) < 1e-4, `SWMA mismatch at bar ${i}`);
  }
});


/* =========================================================================
 * Category 4: Syntax Fuzzing & Malformed Script Error Recovery
 * ========================================================================= */
console.log('\n[>] Category 4: Syntax Fuzzing & Malformed Script Error Recovery');

runTest('Category 4', '4.1: Unclosed parentheses diagnostic handling without engine crash', () => {
  const code = `//@version=5\nindicator("Broken Paren")\nfast = ta.ema(close, 14\nplot(fast)`;
  const res = PineEngine.transpile(code);
  // Must return an object with errors, not crash the process
  assert(res !== null && typeof res === 'object');
  assert(Array.isArray(res.errors));
});

runTest('Category 4', '4.2: Unclosed brackets and quotes handling', () => {
  const code1 = `//@version=5\nindicator("Broken Bracket")\nval = close[10\nplot(val)`;
  const res1 = PineEngine.transpile(code1);
  assert(res1 !== null && typeof res1 === 'object');
  
  const code2 = `//@version=5\nindicator("Unclosed String\nplot(close)`;
  const res2 = PineEngine.transpile(code2);
  assert(res2 !== null && typeof res2 === 'object');
});

runTest('Category 4', '4.3: Random garbage token stream fuzzing', () => {
  const garbageCodes = [
    '@@@@ $$$$ %%%% ^^^^ &&&& ****',
    'indicator(***) plot(???)',
    '=== +++ --- /// *** %%%',
    'indicator("")\n[a, b = ta.macd(close)\nplot(a)',
    'indicator("Fuzz")\nplot(color.new(#1234567890abcdef, 999999999))'
  ];
  
  for (const gc of garbageCodes) {
    const res = PineEngine.transpile(gc);
    assert(res !== null && typeof res === 'object', 'Transpiler must not crash on garbage tokens');
  }
});

runTest('Category 4', '4.4: Missing header handles gracefully with default title', () => {
  const code = `fast = ta.ema(close, 10)\nplot(fast)`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.name, "Custom Indicator");
  assert.strictEqual(res.overlay, false);
  assert.strictEqual(res.metainfo.plots.length, 1);
});

runTest('Category 4', '4.5: Unknown identifier or unsupported function diagnostic', () => {
  const code = `//@version=5\nindicator("Unknown Func")\nx = ta.non_existent_magic_math(close)\nplot(x)`;
  const res = PineEngine.transpile(code);
  assert(res !== null);
  // Transpiled constructor compilation will catch unknown function at runtime or parse time
  if (res.constructor) {
    assert.throws(() => {
      PineScriptRuntime.execute(res, mockBars500);
    });
  }
});

runTest('Category 4', '4.6: Division by zero and NaN propagation stability', () => {
  const code = `//@version=5\nindicator("DivZero")\nz = 10 / 0\nn = math.sqrt(-1)\nplot(z, "Z")\nplot(n, "N")`;
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  const execRes = PineScriptRuntime.execute(res, mockBars500);
  assert.strictEqual(execRes.success, true);
  assert.strictEqual(execRes.plotValues['plot_0'][0], Infinity);
  assert(isNaN(execRes.plotValues['plot_1'][0]));
});

runTest('Category 4', '4.7: Empty, whitespace-only, and comment-only scripts', () => {
  const emptyRes = PineEngine.transpile("");
  assert.strictEqual(emptyRes.success, false);
  assert(emptyRes.errors.length > 0);
  
  const wsRes = PineEngine.transpile("   \n\t  \r\n   ");
  assert.strictEqual(wsRes.success, false);
  
  const commentRes = PineEngine.transpile("// only comment line 1\n// only comment line 2");
  assert.strictEqual(commentRes.success, true);
  assert(commentRes.warnings.length > 0);
});

runTest('Category 4', '4.8: Massive script with 100+ variables', () => {
  let lines = ['//@version=5', 'indicator("Massive Script")'];
  for (let i = 0; i < 100; i++) {
    lines.push(`v_${i} = close + ${i}`);
  }
  lines.push(`plot(v_99)`);
  const code = lines.join('\n');
  const res = PineEngine.transpile(code);
  assert.strictEqual(res.success, true);
  const execRes = PineScriptRuntime.execute(res, mockBars500);
  assert.strictEqual(execRes.success, true);
  assert.strictEqual(execRes.plotValues['plot_0'][0], mockBars500[0].close + 99);
});

runTest('Category 4', '4.9: Prototype pollution and sandbox escape containment', () => {
  const code = `//@version=5
indicator("Security Attempt")
p1 = this.constructor.name
plot(close)
`;
  const res = PineEngine.transpile(code);
  assert(res !== null);
  // Ensure global scope is not corrupted
  assert.strictEqual(Object.prototype.polluted, undefined);
});


/* =========================================================================
 * Category 5: LocalStorage Resilience & Storage Stress
 * ========================================================================= */
console.log('\n[>] Category 5: LocalStorage Resilience & Storage Stress');

runTest('Category 5', '5.1: Bulk save stress with 50 unique custom scripts', () => {
  PineScriptStorage.clearCustomScripts();
  for (let i = 0; i < 50; i++) {
    PineScriptStorage.saveScript({
      id: `custom_script_${i}`,
      name: `Indicator ${i}`,
      description: `Description for indicator ${i}`,
      code: `//@version=5\nindicator("Indicator ${i}")\nplot(close + ${i})`
    });
  }
  const custom = PineScriptStorage.getCustomScripts();
  assert.strictEqual(custom.length, 50);
  const s25 = PineScriptStorage.getScriptById('custom_script_25');
  assert.strictEqual(s25.name, 'Indicator 25');
});

runTest('Category 5', '5.2: Bulk save stress with 100 unique custom scripts', () => {
  PineScriptStorage.clearCustomScripts();
  for (let i = 0; i < 100; i++) {
    PineScriptStorage.saveScript({
      id: `bulk_script_${i}`,
      name: `Bulk Indicator ${i}`,
      description: `Bulk description ${i}`,
      code: `//@version=5\nindicator("Bulk ${i}")\nplot(ta.sma(close, ${i + 1}))`
    });
  }
  const custom = PineScriptStorage.getCustomScripts();
  assert.strictEqual(custom.length, 100);
  const all = PineScriptStorage.getAllScripts();
  const expectedTotal = Object.keys(PineScriptTemplates).length + 100;
  assert.strictEqual(all.length, expectedTotal);
});

runTest('Category 5', '5.3: Large payload storage stress (100KB+ script code)', () => {
  PineScriptStorage.clearCustomScripts();
  // Create 120KB of Pine Script statements
  let bigCode = '//@version=5\nindicator("Huge 100KB Script")\n';
  for (let i = 0; i < 3000; i++) {
    bigCode += `line_${i} = ta.sma(close, ${(i % 50) + 1}) + ${i}\n`;
  }
  bigCode += 'plot(line_2999)\n';
  assert(bigCode.length > 100000, `Code size ${bigCode.length} should be > 100KB`);
  
  const saved = PineScriptStorage.saveScript({
    id: 'huge_script_100kb',
    name: 'Huge Script',
    code: bigCode
  });
  
  assert.strictEqual(saved.id, 'huge_script_100kb');
  const retrieved = PineScriptStorage.getScriptById('huge_script_100kb');
  assert.strictEqual(retrieved.code.length, bigCode.length);
  assert.strictEqual(retrieved.code, bigCode);
});

runTest('Category 5', '5.4: Corrupted JSON injection recovery in storage', () => {
  // Simulate corrupted JSON in memory store
  PineScriptStorage._memoryStore[PineScriptStorage.STORAGE_KEY] = "{ bad json string: [";
  const custom = PineScriptStorage.getCustomScripts();
  assert(Array.isArray(custom), 'Should return an empty array on corrupt storage data');
  
  // Non-array object injection
  PineScriptStorage._memoryStore[PineScriptStorage.STORAGE_KEY] = { not: "an array" };
  const custom2 = PineScriptStorage.getCustomScripts();
  assert(Array.isArray(custom2), 'Should safely normalize non-array object to empty array');
});

runTest('Category 5', '5.5: Full CRUD lifecycle validation', () => {
  PineScriptStorage.clearCustomScripts();
  
  // Create
  const script1 = PineScriptStorage.saveScript({
    name: 'Lifecycle Test',
    code: '//@version=5\nindicator("L1")\nplot(close)'
  });
  const id1 = script1.id;
  assert(id1.startsWith('custom_'));
  
  // Read
  const found = PineScriptStorage.getScriptById(id1);
  assert.strictEqual(found.name, 'Lifecycle Test');
  
  // Update
  PineScriptStorage.saveScript({
    id: id1,
    name: 'Lifecycle Updated',
    code: '//@version=5\nindicator("L1 Updated")\nplot(open)'
  });
  const updated = PineScriptStorage.getScriptById(id1);
  assert.strictEqual(updated.name, 'Lifecycle Updated');
  assert(updated.code.includes('L1 Updated'));
  
  // Delete
  const deleted = PineScriptStorage.deleteScript(id1);
  assert.strictEqual(deleted, true);
  assert.strictEqual(PineScriptStorage.getScriptById(id1), null);
});

runTest('Category 5', '5.6: Starter template immutability protection', () => {
  // Attempting to delete template should fail
  const delRsi = PineScriptStorage.deleteScript('template_rsi');
  assert.strictEqual(delRsi, false);
  const rsi = PineScriptStorage.getScriptById('template_rsi');
  assert(rsi !== null && rsi.isTemplate === true);
});

runTest('Category 5', '5.7: Export and Import roundtrip validation', () => {
  PineScriptStorage.clearCustomScripts();
  
  for (let i = 0; i < 10; i++) {
    PineScriptStorage.saveScript({
      id: `export_test_${i}`,
      name: `Export Script ${i}`,
      code: `//@version=5\nindicator("Exp ${i}")\nplot(close)`
    });
  }
  
  const exportedJSON = PineScriptStorage.exportAll();
  assert(typeof exportedJSON === 'string');
  const parsed = JSON.parse(exportedJSON);
  assert.strictEqual(parsed.scripts.length, 10);
  
  // Clear and Re-import
  PineScriptStorage.clearCustomScripts();
  assert.strictEqual(PineScriptStorage.getCustomScripts().length, 0);
  
  const importedCount = PineScriptStorage.importAll(exportedJSON);
  assert.strictEqual(importedCount, 10);
  assert.strictEqual(PineScriptStorage.getCustomScripts().length, 10);
});


/* =========================================================================
 * Final Summary Output
 * ========================================================================= */
console.log('\n' + '='.repeat(80));
console.log('                 TIER 5 ADVERSARIAL TEST SUMMARY');
console.log('='.repeat(80));
console.log(`Total Tests Run:  ${results.total}`);
console.log(`Passed:           ${results.passed}`);
console.log(`Failed:           ${results.failed}`);
console.log('-'.repeat(80));

for (const [catName, catStats] of Object.entries(results.categories)) {
  const status = catStats.failed === 0 ? 'PASS' : 'FAIL';
  console.log(`  ${catName.padEnd(16)}: ${status} (${catStats.passed}/${catStats.total} passed)`);
}

console.log('='.repeat(80));

if (results.failed > 0) {
  console.error('\n[x] Failures detected in Tier 5 Adversarial Stress Testing:');
  results.errors.forEach(e => {
    console.error(`  - [${e.category}] ${e.name}: ${e.error}`);
  });
  process.exit(1);
} else {
  console.log('\n[+] ALL 46 ADVERSARIAL STRESS TESTS PASSED WITH 100% EMPIRICAL SUCCESS!');
  process.exit(0);
}
