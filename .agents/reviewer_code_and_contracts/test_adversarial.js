const assert = require('assert');
require('../../pine_indicators.js');
const PineIndicators = globalThis.PineIndicators;

console.log("=== Starting Node Adversarial Verification ===");

// -------------------------------------------------------------
// 1. colorToInt Stress Testing & Invertibility
// -------------------------------------------------------------
console.log("\n1. Testing colorToInt edge cases & TV decoding invertibility...");

function decodeTvColorInt(intVal) {
  const r = Math.round(intVal) % 256;
  const g = Math.floor(intVal / 256) % 256;
  const b = Math.floor(intVal / 65536) % 256;
  const a = Math.floor(intVal / 16777216) / 255;
  return { r, g, b, a };
}

// Test transparent / na
assert.strictEqual(PineIndicators.colorToInt('transparent'), 0);
assert.strictEqual(PineIndicators.colorToInt('na'), 0);
assert.strictEqual(PineIndicators.colorToInt('NA '), 0);

// Test null / undefined fallback
const fallbackInt = PineIndicators.colorToInt(null);
assert(fallbackInt > 0, "Null should produce non-zero fallback color");

// Test numeric input pass-through
assert.strictEqual(PineIndicators.colorToInt(12345678), 12345678);

// Test 6-digit hex
const redInt = PineIndicators.colorToInt('#ff0000');
const decRed = decodeTvColorInt(redInt);
assert.strictEqual(decRed.r, 255);
assert.strictEqual(decRed.g, 0);
assert.strictEqual(decRed.b, 0);
assert.strictEqual(Math.round(decRed.a), 1);

// Test 3-digit hex
const blueInt = PineIndicators.colorToInt('#00f');
const decBlue = decodeTvColorInt(blueInt);
assert.strictEqual(decBlue.r, 0);
assert.strictEqual(decBlue.g, 0);
assert.strictEqual(decBlue.b, 255);

// Test rgba string
const rgbaInt = PineIndicators.colorToInt('rgba(50, 100, 150, 0.5)');
const decRgba = decodeTvColorInt(rgbaInt);
assert.strictEqual(decRgba.r, 50);
assert.strictEqual(decRgba.g, 100);
assert.strictEqual(decRgba.b, 150);
assert(Math.abs(decRgba.a - 0.5) < 0.01);

// Test 8-digit hex (#RRGGBBAA)
const hex8Int = PineIndicators.colorToInt('#11223380');
const decHex8 = decodeTvColorInt(hex8Int);
assert.strictEqual(decHex8.r, 0x11);
assert.strictEqual(decHex8.g, 0x22);
assert.strictEqual(decHex8.b, 0x33);
assert(Math.abs(decHex8.a - (0x80 / 255)) < 0.01);

console.log(" [PASS] colorToInt satisfies all edge cases and decodes perfectly.");

// -------------------------------------------------------------
// 2. Metainfo v52 Schema & No Palettes
// -------------------------------------------------------------
console.log("\n2. Testing Metainfo v52 Schema & Palettes Exclusion...");

const advScript = `//@version=5
indicator("Adversarial Custom Candles", overlay=false)
s = input.symbol("EURUSD", "Symbol Inp")
res = input.timeframe("60", "Timeframe Inp")
c_up = input.color(#00FF00FF, "Bullish Color")
c_dn = input.color(#FF0000FF, "Bearish Color")
[o, h, l, c] = request.security(s, res, [open, high, low, close])
plotcandle(o, h, l, c, color=c >= o ? c_up : c_dn)
`;

const res = PineIndicators.compileAndRegisterPine(advScript);
const meta = res.study.metainfo;

assert.strictEqual(meta._metainfoVersion, 52, "Must be metainfo v52");
assert.strictEqual(meta.isRGB, true, "Must have isRGB: true");
assert.strictEqual(meta.is_price_study, false, "Must be subpane");
assert.strictEqual(meta.palettes, undefined, "metainfo.palettes must be undefined for RGB studies");

// Verify 7 plots
assert.strictEqual(meta.plots.length, 7, "Must have exactly 7 plots");
const expectedPlotTypes = ['ohlc_open', 'ohlc_high', 'ohlc_low', 'ohlc_close', 'ohlc_colorer', 'wick_colorer', 'border_colorer'];
expectedPlotTypes.forEach(t => {
  const p = meta.plots.find(plot => plot.type === t);
  assert(p, `Missing plot type: ${t}`);
  assert.strictEqual(p.target, 'candle_0');
  assert.strictEqual(p.palette, undefined, `Plot ${t} must NOT have palette property`);
  assert(!('palette' in p), `Plot ${t} must not contain 'palette' key`);
});

console.log(" [PASS] Metainfo v52 schema, candle plots, and palette suppression confirmed.");

// -------------------------------------------------------------
// 3. Hex Normalization for Color Inputs & Defaults
// -------------------------------------------------------------
console.log("\n3. Testing 6-digit hex normalization...");

const bullInp = meta.inputs.find(i => i.id === 'c_up');
const bearInp = meta.inputs.find(i => i.id === 'c_dn');
assert.strictEqual(bullInp.defval, '#00FF00', "8-digit hex #00FF00FF must normalize to #00FF00");
assert.strictEqual(bearInp.defval, '#FF0000', "8-digit hex #FF0000FF must normalize to #FF0000");

// Check defaults.inputs (named and indexed)
assert.strictEqual(meta.defaults.inputs.c_up, '#00FF00');
assert.strictEqual(meta.defaults.inputs.c_dn, '#FF0000');
assert.strictEqual(meta.defaults.inputs[2], '#00FF00');
assert.strictEqual(meta.defaults.inputs[3], '#FF0000');

console.log(" [PASS] 6-digit hex normalization verified across inputs and defaults.");

// -------------------------------------------------------------
// 4. Study Execution & Dynamic Input Overrides
// -------------------------------------------------------------
console.log("\n4. Testing Study Execution with edge case bars & input overrides...");

const StudyClass = res.study.constructor;
const studyInst = new StudyClass();

const ctx = {
  symbol: {
    open: NaN, // Adversarial NaN open
    high: 150,
    low: 100,
    close: 120,
    volume: 50,
    time: 1725000000000,
    ticker: 'EURUSD'
  },
  new_var: () => ({ get: () => 0, set: () => {} })
};

studyInst.init(ctx, () => undefined);

// Pass inputCallback returning 8-digit hex override
const barOutput = studyInst.main(ctx, (key) => {
  if (key === 'c_up' || key === 2) return '#12345688';
  return undefined;
});

assert.strictEqual(barOutput.length, 7, "Must return 7-element array");
const [bo, bh, bl, bc, bColor, bWick, bBorder] = barOutput;

// Check non-NaN guarantee
assert(!isNaN(bo), "Open must not be NaN");
assert(!isNaN(bh), "High must not be NaN");
assert(!isNaN(bl), "Low must not be NaN");
assert(!isNaN(bc), "Close must not be NaN");
assert(typeof bColor === 'number' && !isNaN(bColor), "Color must be valid number");
assert(typeof bWick === 'number' && !isNaN(bWick), "Wick color must be valid number");
assert(typeof bBorder === 'number' && !isNaN(bBorder), "Border color must be valid number");

// Verify overridden color decoded
const decOverridden = decodeTvColorInt(bColor);
assert.strictEqual(decOverridden.r, 0x12);
assert.strictEqual(decOverridden.g, 0x34);
assert.strictEqual(decOverridden.b, 0x56);

console.log(" [PASS] Study execution, non-NaN fallback, and dynamic color override verified.");

// -------------------------------------------------------------
// 5. Study Addition with lock: false Verification
// -------------------------------------------------------------
console.log("\n5. Testing addStudyToChart lock: false parameter contract...");

let createStudyCalledWith = null;
const mockChart = {
  createStudy: async function(name, isOverlay, lock) {
    createStudyCalledWith = { name, isOverlay, lock };
    return "study_entity_id_123";
  }
};

PineIndicators.addStudyToChart(mockChart, "Custom Symbol Candles", false).then(studyId => {
  assert.strictEqual(studyId, "study_entity_id_123");
  assert.strictEqual(createStudyCalledWith.name, "Custom Symbol Candles");
  assert.strictEqual(createStudyCalledWith.isOverlay, false);
  assert.strictEqual(createStudyCalledWith.lock, false, "Third parameter to createStudy MUST be false for lock!");
  console.log(" [PASS] addStudyToChart explicitly passes lock: false.");
  console.log("\n=== ALL ADVERSARIAL NODE TESTS PASSED (100%) ===");
});
