/**
 * Automated Verification Suite for pine_indicators.js (R2 & R3)
 */
const assert = require('assert');

// Load PineTS CommonJS bundle into globalThis so pine_indicators.js discovers it
const pinets = require('../../PineTS-main/dist/pinets.min.cjs');
globalThis.PineTSLib = pinets;
globalThis.PineTS = pinets.PineTS;
globalThis.PineTS.Indicator = pinets.Indicator;

// Load pine_indicators.js
require('../../pine_indicators.js');
const { PineIndicators } = globalThis;

console.log('--- Starting R2 & R3 Verification Suite ---');

// Test 1: Compile Custom Symbol Candles
console.log('\n[Test 1] Compiling Custom Symbol Candles...');
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
plotcandle(o, h, l, c, title="Candles", color=c >= o ? upColor : downColor, wickcolor=showWicks ? wickColor : na, bordercolor=showBorders ? (c >= o ? borderUpColor : borderDownColor) : na)
`;

const res = PineIndicators.compileAndRegisterPine(customCandlesSource);
assert(res && res.study, 'Study compilation returned valid study');
const metainfo = res.study.metainfo;

// Check Metainfo version & flags
assert.strictEqual(metainfo._metainfoVersion, 52, '_metainfoVersion must be 52');
assert.strictEqual(metainfo.isRGB, true, 'isRGB must be true');
assert.strictEqual(metainfo.is_price_study, false, 'is_price_study must be false');
console.log('  ✓ Metainfo version, isRGB, and is_price_study confirmed.');

// Check 7 OHLC plots
assert.strictEqual(metainfo.plots.length, 7, 'Must have 7 plots for candle_0');
const expectedPlotIds = [
  'candle_0_open', 'candle_0_high', 'candle_0_low', 'candle_0_close',
  'candle_0_colorer', 'candle_0_wick_colorer', 'candle_0_border_colorer'
];
expectedPlotIds.forEach((id, idx) => {
  assert.strictEqual(metainfo.plots[idx].id, id, `Plot ${idx} id matches ${id}`);
  assert.strictEqual(metainfo.plots[idx].target, 'candle_0', `Plot ${idx} target is candle_0`);
});
console.log('  ✓ All 7 OHLC & color plots declared correctly.');

// Check ohlcPlots & defaults
assert(metainfo.ohlcPlots && metainfo.ohlcPlots.candle_0, 'ohlcPlots.candle_0 defined');
assert.strictEqual(metainfo.ohlcPlots.candle_0.title, 'Candles');
assert(metainfo.defaults.ohlcPlots && metainfo.defaults.ohlcPlots.candle_0, 'defaults.ohlcPlots.candle_0 defined');
assert.strictEqual(metainfo.defaults.ohlcPlots.candle_0.plottype, 'ohlc_candles');
assert.strictEqual(metainfo.defaults.ohlcPlots.candle_0.display, 15);
assert.strictEqual(metainfo.defaults.ohlcPlots.candle_0.drawBorder, true);
assert.strictEqual(metainfo.defaults.ohlcPlots.candle_0.drawWick, true);
console.log('  ✓ ohlcPlots and defaults.ohlcPlots configuration confirmed.');

// Check palettes
assert(metainfo.palettes && metainfo.palettes.palette_candle_0, 'palette_candle_0 defined');
assert.strictEqual(metainfo.palettes.palette_candle_0.colors[0].name, 'Body Color');
assert.strictEqual(metainfo.palettes.palette_candle_0.colors[1].name, 'Wick Color');
assert.strictEqual(metainfo.palettes.palette_candle_0.colors[2].name, 'Border Color');
console.log('  ✓ palettes.palette_candle_0 configured with 3 color channels.');

// Check inputs (all 9 inputs)
assert.strictEqual(metainfo.inputs.length, 9, 'Must have exactly 9 inputs');
const inputTypes = metainfo.inputs.map(i => ({ id: i.id, type: i.type, isMTF: i.isMTFResolution }));
console.log('  Inputs:', JSON.stringify(inputTypes));
assert.strictEqual(metainfo.inputs[0].id, 'sym');
assert.strictEqual(metainfo.inputs[0].type, 'symbol');
assert.strictEqual(metainfo.inputs[1].id, 'res');
assert.strictEqual(metainfo.inputs[1].type, 'resolution');
assert.strictEqual(metainfo.inputs[1].isMTFResolution, true);
assert.strictEqual(metainfo.inputs[2].id, 'upColor');
assert.strictEqual(metainfo.inputs[2].type, 'color');
assert.strictEqual(metainfo.inputs[3].id, 'downColor');
assert.strictEqual(metainfo.inputs[3].type, 'color');
assert.strictEqual(metainfo.inputs[4].id, 'wickColor');
assert.strictEqual(metainfo.inputs[4].type, 'color');
assert.strictEqual(metainfo.inputs[5].id, 'borderUpColor');
assert.strictEqual(metainfo.inputs[5].type, 'color');
assert.strictEqual(metainfo.inputs[6].id, 'borderDownColor');
assert.strictEqual(metainfo.inputs[6].type, 'color');
assert.strictEqual(metainfo.inputs[7].id, 'showBorders');
assert.strictEqual(metainfo.inputs[7].type, 'bool');
assert.strictEqual(metainfo.inputs[8].id, 'showWicks');
assert.strictEqual(metainfo.inputs[8].type, 'bool');
console.log('  ✓ All 9 input types, names, and MTF properties confirmed.');

// Check dual indexing in defaults.inputs (key and index 0..8)
for (let i = 0; i < 9; i++) {
  assert(metainfo.defaults.inputs[i] !== undefined, `defaults.inputs[${i}] exists`);
  const inpId = metainfo.inputs[i].id;
  assert(metainfo.defaults.inputs[inpId] !== undefined, `defaults.inputs['${inpId}'] exists`);
}
console.log('  ✓ Dual indexing (varId + numeric index 0..8) in defaults.inputs confirmed.');

// Test 2: Study Execution (this.main)
console.log('\n[Test 2] Testing Study Execution & Candlestick Output...');
const studyInstance = new res.study.constructor();
const mockInputCallback = (keyOrIdx) => metainfo.defaults.inputs[keyOrIdx];

// Create mock TV context with stateful Series
function createMockCtx(bar) {
  return {
    symbol: {
      open: bar.open,
      high: bar.high,
      low: bar.low,
      close: bar.close,
      volume: bar.volume,
      time: bar.time,
      ticker: 'AAPL',
      interval: '1',
      index: bar.index
    },
    new_var(initVal) {
      let current = initVal;
      let prev = NaN;
      return {
        get(offset) {
          if (offset === 0) return current;
          if (offset === 1) return prev;
          return NaN;
        },
        set(val) {
          prev = current;
          current = val;
        }
      };
    }
  };
}

studyInstance.init(createMockCtx({ open: 100, high: 105, low: 95, close: 102, volume: 100, time: 1700000000000, index: 0 }), mockInputCallback);

// Bar 0: Bullish bar (100 -> 102)
const bar0Ctx = createMockCtx({ open: 100, high: 105, low: 95, close: 102, volume: 100, time: 1700000000000, index: 0 });
const resBar0 = studyInstance.main(bar0Ctx, mockInputCallback);
console.log('  Bar 0 result (7 elements):', resBar0);
assert(Array.isArray(resBar0), 'main must return an array');
assert.strictEqual(resBar0.length, 7, 'main must return exactly 7 elements for plotcandle');
assert.strictEqual(resBar0[0], 100, 'Open price is 100');
assert.strictEqual(resBar0[1], 105, 'High price is 105');
assert.strictEqual(resBar0[2], 95, 'Low price is 95');
assert.strictEqual(resBar0[3], 102, 'Close price is 102');
// Verify colors are valid integers
assert.strictEqual(typeof resBar0[4], 'number', 'bodyColor is integer');
assert.strictEqual(typeof resBar0[5], 'number', 'wickColor is integer');
assert.strictEqual(typeof resBar0[6], 'number', 'borderColor is integer');
assert(!resBar0.some(isNaN), 'No element is NaN');

// Bar 1: Bearish bar (105 -> 98)
const bar1Ctx = createMockCtx({ open: 105, high: 107, low: 97, close: 98, volume: 150, time: 1700000060000, index: 1 });
const resBar1 = studyInstance.main(bar1Ctx, mockInputCallback);
console.log('  Bar 1 result (7 elements):', resBar1);
assert.strictEqual(resBar1.length, 7);
assert(!resBar1.some(isNaN), 'No element is NaN');
assert(resBar0[4] !== resBar1[4], 'Bullish and bearish body colors differ');
console.log('  ✓ Dynamic body/wick/border coloring works.');

// Test 3: Prebuilt Studies & Templates
console.log('\n[Test 3] Testing Prebuilt Templates Pre-population...');
PineIndicators.initPrebuiltStudies();
const registered = PineIndicators.getRegisteredStudies();
console.log(`  Total registered studies: ${registered.length}`);
assert(registered.length >= 6, 'Must have at least 6 registered templates');
const titles = registered.map(s => s.name);
console.log('  Registered titles:', titles);
assert(titles.includes('Custom Symbol Candles'), 'Custom Symbol Candles must be pre-registered');
assert(titles.includes('SMA Crossover'), 'SMA Crossover must be pre-registered');
assert(titles.includes('SuperTrend Custom'), 'SuperTrend Custom must be pre-registered');
assert(titles.includes('Smoothed RSI'), 'Smoothed RSI must be pre-registered');
assert(titles.includes('MACD Momentum'), 'MACD Momentum must be pre-registered');
assert(titles.includes('Bollinger Bands Custom'), 'Bollinger Bands Custom must be pre-registered');
console.log('  ✓ All 6 prebuilt indicators compiled and registered.');

// Test 4: Scripts with 0 explicit plots (Adaptive Trend Baseline)
console.log('\n[Test 4] Testing scripts with 0 explicit plots (Adaptive Trend Baseline)...');
const zeroPlotSource = `//@version=5
indicator("Smart Trader Calculations", overlay=true)
len = input.int(14, "Length")
calcVal = ta.sma(close, len)
`;
const zeroPlotRes = PineIndicators.compileAndRegisterPine(zeroPlotSource);
assert(zeroPlotRes && zeroPlotRes.study, 'Compiled successfully');
assert.strictEqual(zeroPlotRes.study.metainfo.plots.length, 1, 'Adaptive trend baseline added');
const zeroStudyInst = new zeroPlotRes.study.constructor();
zeroStudyInst.init(bar0Ctx, () => 14);
const zeroPlotVal = zeroStudyInst.main(bar0Ctx, () => 14);
console.log('  Zero plot script return:', zeroPlotVal);
assert(Array.isArray(zeroPlotVal) && zeroPlotVal.length === 1);
assert(!isNaN(zeroPlotVal[0]), 'Adaptive baseline produces non-NaN price');
console.log('  ✓ Adaptive trend baseline verified (zero NaNs).');

// Test 5: addStudyToChart lock: false verification
console.log('\n[Test 5] Verifying addStudyToChart passes lock: false...');
let passedLock = null;
const mockChart = {
  createStudy(name, isOverlay, lock) {
    passedLock = lock;
    return Promise.resolve('study_id_123');
  }
};
PineIndicators.addStudyToChart(mockChart, 'Custom Symbol Candles', false).then(() => {
  assert.strictEqual(passedLock, false, 'lock parameter must be false');
  console.log('  ✓ addStudyToChart passes lock: false to activate legend hover action controls.');
  console.log('\n=== ALL VERIFICATION TESTS PASSED (100%) ===\n');
});
