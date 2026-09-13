/**
 * verify_pine_indicators.js
 * Comprehensive automated verification suite for Pine Indicators metainfo:
 * 1. Palette removal on isRGB: true for candle colorers (ohlc_colorer, wick_colorer, border_colorer).
 * 2. Complete absence of metainfo.palettes for RGB studies.
 * 3. Color hex normalization from 8-digit (#RRGGBBAA) to 6-digit (#RRGGBB) across inputs and defaults.inputs.
 * 4. Prebuilt templates compilation and execution regression check.
 */

const assert = require('assert');
require('./pine_indicators.js');
const PineIndicators = globalThis.PineIndicators;

let totalTests = 0;
let passedTests = 0;

function runTest(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] ${name}`);
  } catch (err) {
    console.error(`  [FAIL] ${name}: ${err.message}`);
    console.error(err.stack);
    process.exitCode = 1;
  }
}

console.log("==================================================================");
console.log("Starting verify_pine_indicators.js Verification Suite");
console.log("==================================================================");

// ── Test Group 1: Custom Symbol Candles Compilation & Metainfo ─────────
console.log("\n--- Group 1: Custom Symbol Candles Metainfo & Plots ---");

const customCandlesSource = `//@version=5
indicator("Custom Symbol Candles", overlay=false)
sym = input.symbol("AAPL", "Symbol")
res = input.timeframe("D", "Resolution")
upColor = input.color(color.green, "Bullish Body Color")
downColor = input.color(color.red, "Bearish Body Color")
wickColor = input.color(color.gray, "Wick Color")
borderUpColor = input.color(color.green, "Bullish Border Color")
borderDownColor = input.color(color.red, "Bearish Border Color")
showBorders = input.bool(true, "Show Borders")
showWicks = input.bool(true, "Show Wicks")
[o, h, l, c] = request.security(sym, res, [open, high, low, close])
plotcandle(o, h, l, c, title="Candles", color=c >= o ? upColor : downColor, wickcolor=showWicks ? wickColor : na, bordercolor=showBorders ? (c >= o ? borderUpColor : borderDownColor) : na)`;

const compilation = PineIndicators.compileAndRegisterPine(customCandlesSource);
const metainfo = compilation.study.metainfo;

runTest("Compilation succeeds and returns valid study and metainfo", () => {
  assert(compilation && compilation.study, "compilation.study must exist");
  assert(metainfo, "metainfo must exist");
  assert.strictEqual(metainfo.isRGB, true, "metainfo.isRGB must be true");
  assert.strictEqual(metainfo.is_price_study, false, "metainfo.is_price_study must be false");
});

runTest("Plots contain exactly 7 candle plots with matching targets and types", () => {
  const plots = metainfo.plots;
  assert.strictEqual(plots.length, 7, `Expected 7 plots, found ${plots.length}`);

  const expectedPlots = [
    { id: 'candle_0_open', type: 'ohlc_open', target: 'candle_0' },
    { id: 'candle_0_high', type: 'ohlc_high', target: 'candle_0' },
    { id: 'candle_0_low', type: 'ohlc_low', target: 'candle_0' },
    { id: 'candle_0_close', type: 'ohlc_close', target: 'candle_0' },
    { id: 'candle_0_colorer', type: 'ohlc_colorer', target: 'candle_0' },
    { id: 'candle_0_wick_colorer', type: 'wick_colorer', target: 'candle_0' },
    { id: 'candle_0_border_colorer', type: 'border_colorer', target: 'candle_0' }
  ];

  expectedPlots.forEach((expected, i) => {
    assert.strictEqual(plots[i].id, expected.id, `Plot ${i} id mismatch`);
    assert.strictEqual(plots[i].type, expected.type, `Plot ${i} type mismatch`);
    assert.strictEqual(plots[i].target, expected.target, `Plot ${i} target mismatch`);
  });
});

runTest("Palette property is completely removed from all candle colorer plots", () => {
  const colorerPlots = metainfo.plots.filter(p => p.type.includes('colorer'));
  assert.strictEqual(colorerPlots.length, 3, "Expected 3 colorer plots");

  colorerPlots.forEach(p => {
    assert.strictEqual(p.palette, undefined, `Plot ${p.id} must NOT have palette property`);
    assert(!('palette' in p), `Plot ${p.id} must not have 'palette' key`);
  });
});

runTest("metainfo.palettes is removed for isRGB candle indicator", () => {
  assert.strictEqual(metainfo.palettes, undefined, "metainfo.palettes must be undefined");
  assert(!('palettes' in metainfo) || metainfo.palettes === undefined, "metainfo.palettes must not exist");
});

// ── Test Group 2: Color Hex Normalization ──────────────────────────────
console.log("\n--- Group 2: Color Hex Normalization (8-digit to 6-digit hex) ---");

runTest("Metainfo inputs contain exactly 9 inputs", () => {
  assert.strictEqual(metainfo.inputs.length, 9, `Expected 9 inputs, got ${metainfo.inputs.length}`);
});

runTest("All color inputs are normalized to 6-digit hex (#RRGGBB)", () => {
  const colorInputs = metainfo.inputs.filter(i => i.type === 'color');
  assert.strictEqual(colorInputs.length, 5, `Expected 5 color inputs, found ${colorInputs.length}`);

  const hex6Regex = /^#[0-9a-fA-F]{6}$/;

  colorInputs.forEach(ci => {
    assert(hex6Regex.test(ci.defval), `Input ${ci.id} defval "${ci.defval}" is not a valid 6-digit hex`);
    assert.strictEqual(ci.defval.length, 7, `Input ${ci.id} defval "${ci.defval}" length must be 7 (#RRGGBB)`);
  });

  // Check specific normalized values
  const upColorInput = metainfo.inputs.find(i => i.id === 'upColor');
  const downColorInput = metainfo.inputs.find(i => i.id === 'downColor');
  const wickColorInput = metainfo.inputs.find(i => i.id === 'wickColor');
  const borderUpColorInput = metainfo.inputs.find(i => i.id === 'borderUpColor');
  const borderDownColorInput = metainfo.inputs.find(i => i.id === 'borderDownColor');

  assert.strictEqual(upColorInput.defval.toUpperCase(), '#4CAF50', 'upColor defval must be #4CAF50');
  assert.strictEqual(downColorInput.defval.toUpperCase(), '#F23645', 'downColor defval must be #F23645');
  assert.strictEqual(wickColorInput.defval.toUpperCase(), '#787B86', 'wickColor defval must be #787B86');
  assert.strictEqual(borderUpColorInput.defval.toUpperCase(), '#4CAF50', 'borderUpColor defval must be #4CAF50');
  assert.strictEqual(borderDownColorInput.defval.toUpperCase(), '#F23645', 'borderDownColor defval must be #F23645');
});

runTest("defaults.inputs contains 6-digit hex values for both named and indexed keys", () => {
  const defInputs = metainfo.defaults.inputs;
  const hex6Regex = /^#[0-9a-fA-F]{6}$/;

  // Named keys
  ['upColor', 'downColor', 'wickColor', 'borderUpColor', 'borderDownColor'].forEach(key => {
    const val = defInputs[key];
    assert(hex6Regex.test(val), `defaults.inputs['${key}'] "${val}" must be 6-digit hex`);
    assert.strictEqual(val.length, 7, `defaults.inputs['${key}'] must have length 7`);
  });

  // Indexed keys (inputs 2, 3, 4, 5, 6 are the color inputs)
  [2, 3, 4, 5, 6].forEach(idx => {
    const val = defInputs[idx];
    assert(hex6Regex.test(val), `defaults.inputs[${idx}] "${val}" must be 6-digit hex`);
    assert.strictEqual(val.length, 7, `defaults.inputs[${idx}] must have length 7`);
  });

  assert.strictEqual(defInputs.upColor.toUpperCase(), '#4CAF50');
  assert.strictEqual(defInputs.downColor.toUpperCase(), '#F23645');
  assert.strictEqual(defInputs.wickColor.toUpperCase(), '#787B86');
  assert.strictEqual(defInputs['2'].toUpperCase(), '#4CAF50');
  assert.strictEqual(defInputs['3'].toUpperCase(), '#F23645');
  assert.strictEqual(defInputs['4'].toUpperCase(), '#787B86');
});

// ── Test Group 3: Execution Runtime Invariant ───────────────────────────
console.log("\n--- Group 3: Execution & Color Calculation ---");

runTest("Study constructor instantiates and executes main() returning 7 bar values", () => {
  const StudyCtor = compilation.study.constructor;
  const instance = new StudyCtor();

  const mockCtx = {
    symbol: {
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000,
      time: 1720000000000,
      index: 0,
      ticker: 'AAPL'
    },
    new_var: function(init) {
      let v = init;
      return {
        get: (offset) => (offset === 0 ? v : NaN),
        set: (newV) => { v = newV; }
      };
    }
  };

  instance.init(mockCtx, () => undefined);
  const barResult = instance.main(mockCtx, () => undefined);

  assert(Array.isArray(barResult), "main() must return an array of plot values");
  assert.strictEqual(barResult.length, 7, `Expected 7 plot values, got ${barResult.length}`);

  const [o, h, l, c, bodyColor, wickColor, borderColor] = barResult;
  assert.strictEqual(o, 100, "open value match");
  assert.strictEqual(h, 105, "high value match");
  assert.strictEqual(l, 95, "low value match");
  assert.strictEqual(c, 102, "close value match");
  assert(typeof bodyColor === 'number' && !isNaN(bodyColor), "bodyColor must be a valid color integer");
  assert(typeof wickColor === 'number' && !isNaN(wickColor), "wickColor must be a valid color integer");
  assert(typeof borderColor === 'number' && !isNaN(borderColor), "borderColor must be a valid color integer");
});

// ── Test Group 4: Prebuilt Indicators Regression ────────────────────────
console.log("\n--- Group 4: Prebuilt Indicators Regression ---");

runTest("initPrebuiltStudies initializes all prebuilt templates without error", () => {
  PineIndicators.initPrebuiltStudies();
  const studies = PineIndicators.getRegisteredStudies();
  assert(studies.length >= 6, `Expected at least 6 prebuilt studies, got ${studies.length}`);

  const candleStudy = studies.find(s => s.name === "Custom Symbol Candles");
  assert(candleStudy, "Custom Symbol Candles must be in registered studies");
  assert.strictEqual(candleStudy.metainfo.plots.length, 7, "Custom Symbol Candles must have 7 plots");
  assert.strictEqual(candleStudy.metainfo.palettes, undefined, "Custom Symbol Candles must have no palettes");
});

// ── Test Group 5: Pine Script v6 New Primitives & Metainfo Verification ──
console.log("\n--- Group 5: Pine Script v6 Primitives (plotbar, hline, fill, shapes, chars, arrows, 9 inputs) ---");

const pineV6ComprehensiveSource = `//@version=6
indicator("Pine v6 Complete Primitives", overlay=true)
i_int = input.int(10, "Int Val")
i_float = input.float(1.5, "Float Val")
i_bool = input.bool(true, "Bool Val")
i_str = input.string("hello", "String Val")
i_color = input.color(color.blue, "Color Val")
i_tf = input.timeframe("15", "Timeframe Val")
i_sym = input.symbol("AAPL", "Symbol Val")
i_session = input.session("0930-1600", "Session Val")
i_source = input.source(close, "Source Val")
i_price = input.price(100.5, "Price Val")
i_time = input.time(1700000000, "Time Val")
i_textarea = input.text_area("Multi line", "Text Area")

p1 = plot(close, "Plot 1")
p2 = plot(open, "Plot 2")
h1 = hline(100, "Level 100", color=color.red)
h2 = hline(0, "Level 0", color=color.green)
fill(h1, h2, color=color.new(color.blue, 90), title="Hline Fill")
fill(p1, p2, color=color.new(color.purple, 85), title="Plot Fill")
plotbar(open, high, low, close, title="Custom Bars")
plotshape(close > open, title="Shape", style=shape.triangleup)
plotchar(close > open, title="Char", char='X')
plotarrow(close - open, title="Arrow")`;

const compV6 = PineIndicators.compileAndRegisterPine(pineV6ComprehensiveSource);
const metaV6 = compV6.study.metainfo;

runTest("Pine v6 script compiles successfully and produces metainfo", () => {
  assert(compV6 && compV6.study, "compV6.study must exist");
  assert(metaV6, "metaV6 must exist");
  assert.strictEqual(metaV6.is_price_study, true, "Overlay true -> is_price_study must be true");
});

runTest("Metainfo correctly parses all v6 input types", () => {
  assert(metaV6.inputs.length >= 12, `Expected at least 12 inputs, found ${metaV6.inputs.length}`);
  const intInp = metaV6.inputs.find(i => i.id === 'i_int');
  const floatInp = metaV6.inputs.find(i => i.id === 'i_float');
  const boolInp = metaV6.inputs.find(i => i.id === 'i_bool');
  const strInp = metaV6.inputs.find(i => i.id === 'i_str');
  const colorInp = metaV6.inputs.find(i => i.id === 'i_color');
  const tfInp = metaV6.inputs.find(i => i.id === 'i_tf');
  const symInp = metaV6.inputs.find(i => i.id === 'i_sym');
  const sessInp = metaV6.inputs.find(i => i.id === 'i_session');
  const srcInp = metaV6.inputs.find(i => i.id === 'i_source');
  const priceInp = metaV6.inputs.find(i => i.id === 'i_price');
  const timeInp = metaV6.inputs.find(i => i.id === 'i_time');
  const textInp = metaV6.inputs.find(i => i.id === 'i_textarea');

  assert(intInp && intInp.type === 'integer', "i_int must be integer");
  assert(floatInp && floatInp.type === 'float', "i_float must be float");
  assert(boolInp && boolInp.type === 'bool', "i_bool must be bool");
  assert(strInp && strInp.type === 'text', "i_str must be text");
  assert(colorInp && colorInp.type === 'color', "i_color must be color");
  assert(tfInp && tfInp.type === 'resolution', "i_tf must be resolution");
  assert(symInp && symInp.type === 'symbol', "i_sym must be symbol");
  assert(sessInp && sessInp.type === 'text', "i_session must be text");
  assert(srcInp && srcInp.type === 'source', "i_source must be source");
  assert(priceInp && priceInp.type === 'float', "i_price must be float");
  assert(timeInp && timeInp.type === 'integer', "i_time must be integer");
  assert(textInp && textInp.type === 'text', "i_textarea must be text");
});

runTest("Metainfo correctly parses hlines into bands", () => {
  assert(Array.isArray(metaV6.bands), "metaV6.bands must exist");
  assert.strictEqual(metaV6.bands.length, 2, `Expected 2 bands, found ${metaV6.bands.length}`);
  assert(Array.isArray(metaV6.defaults.bands), "metaV6.defaults.bands must exist");
  assert.strictEqual(metaV6.defaults.bands.length, 2, `Expected 2 default bands, found ${metaV6.defaults.bands.length}`);
  assert.strictEqual(metaV6.defaults.bands[0].val, 100, "Band 0 val must be 100");
  assert.strictEqual(metaV6.defaults.bands[1].val, 0, "Band 1 val must be 0");
});

runTest("Metainfo correctly parses fills into filledAreas", () => {
  assert(Array.isArray(metaV6.filledAreas), "metaV6.filledAreas must exist");
  assert.strictEqual(metaV6.filledAreas.length, 2, `Expected 2 filledAreas, found ${metaV6.filledAreas.length}`);
  assert.strictEqual(metaV6.filledAreas[0].type, 'band_band', "Fill between hlines must have type band_band");
  assert.strictEqual(metaV6.filledAreas[1].type, 'plot_plot', "Fill between plots must have type plot_plot");
  assert(metaV6.defaults.filledAreas, "metaV6.defaults.filledAreas must exist");
});

runTest("Metainfo correctly parses plotbar into ohlcPlots with plottype ohlc_bars", () => {
  assert(metaV6.ohlcPlots && metaV6.ohlcPlots['bar_0'], "ohlcPlots['bar_0'] must exist");
  assert(metaV6.defaults.ohlcPlots && metaV6.defaults.ohlcPlots['bar_0'], "defaults.ohlcPlots['bar_0'] must exist");
  assert.strictEqual(metaV6.defaults.ohlcPlots['bar_0'].plottype, 'ohlc_bars', "plottype must be ohlc_bars");

  const barPlots = metaV6.plots.filter(p => p.target === 'bar_0');
  assert.strictEqual(barPlots.length, 5, `Expected 5 bar plots (open, high, low, close, colorer), found ${barPlots.length}`);
});

runTest("Metainfo correctly parses plotshape, plotchar, and plotarrow", () => {
  const shapePlot = metaV6.plots.find(p => p.type === 'shapes');
  const charPlot = metaV6.plots.find(p => p.type === 'chars');
  const arrowPlot = metaV6.plots.find(p => p.type === 'arrows');

  assert(shapePlot, "shapes plot must exist in plots");
  assert(charPlot, "chars plot must exist in plots");
  assert(arrowPlot, "arrows plot must exist in plots");

  assert.strictEqual(metaV6.styles[shapePlot.id].title, "Shape");
  assert.strictEqual(metaV6.styles[charPlot.id].title, "Char");
  assert.strictEqual(metaV6.styles[charPlot.id].char, "X");
  assert.strictEqual(metaV6.styles[arrowPlot.id].title, "Arrow");
});

console.log("\n==================================================================");
console.log(`Verification Summary: ${passedTests}/${totalTests} tests passed.`);
console.log("==================================================================");

if (passedTests === totalTests) {
  console.log("ALL TESTS PASSED SUCCESSFULLY! [100%]\n");
} else {
  console.error(`FAILED: ${totalTests - passedTests} tests failed.`);
  process.exit(1);
}
