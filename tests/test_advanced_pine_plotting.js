/**
 * Test Advanced Pine Script Engine Plotting and Instant Execution
 */
const assert = require('assert');
const { PineEngine, PineScriptTemplates, PineScriptRuntime } = require('../pine_engine.js');

console.log('=== TEST 1: Transpiling All 8 Starter Templates ===');
const templateKeys = Object.keys(PineScriptTemplates);
assert.strictEqual(templateKeys.length >= 8, true, 'Expected >= 8 templates, got ' + templateKeys.length);

for (const key of templateKeys) {
  const tmpl = PineScriptTemplates[key];
  console.log(`- Testing template: "${tmpl.name}" (${key})`);
  const res = PineEngine.transpile(tmpl.code);
  if (!res.success) {
    console.error(`Transpile failed for ${key}:`, res.errors);
  }
  assert.strictEqual(res.success, true, `Template ${key} should transpile cleanly`);
  assert.ok(res.metainfo, `Template ${key} should produce metainfo`);
  assert.strictEqual(res.metainfo._metainfoVersion, 52);
  assert.ok(typeof res.constructor === 'function', `Template ${key} constructor must be a function`);
}
console.log('✓ All 8 starter templates transpiled successfully!\n');

console.log('=== TEST 2: Testing Advanced Plot Directives ===');
const advancedPlotScript = `//@version=5
indicator("Advanced Plots Test", overlay=true)

fastEMA = ta.ema(close, 9)
slowEMA = ta.ema(close, 21)

p1 = plot(fastEMA, "Fast EMA", color=color.green)
p2 = plot(slowEMA, "Slow EMA", color=color.red)
fill(p1, p2, color=color.blue, title="EMA Cloud")

bullish = ta.crossover(fastEMA, slowEMA)
plotchar(bullish, "Star Signal", char="★", location=location.abovebar, color=color.yellow)
plotarrow(fastEMA - slowEMA, "Trend Arrow", colorup=color.green, colordown=color.red)
barcolor(close > open ? color.green : color.red)
bgcolor(bullish ? color.new(color.green, 90) : na)
hline(100, "Ref Level", color=color.gray, linestyle=hline.style_dotted)
`;

const advRes = PineEngine.transpile(advancedPlotScript);
assert.strictEqual(advRes.success, true, 'Advanced plot script failed: ' + advRes.errors.join(', '));
const plots = advRes.metainfo.plots;
console.log(`- Generated ${plots.length} plots in metainfo`);
const plotTypes = plots.map(p => p.type);
console.log(`- Plot types detected:`, plotTypes);

assert.ok(plotTypes.includes('line'), 'Should have line plots');
assert.ok(plotTypes.includes('chars'), 'Should have char plots');
assert.ok(plotTypes.includes('arrows'), 'Should have arrow plots');
assert.ok(plotTypes.includes('bar_color'), 'Should have bar_color plots');
assert.ok(plotTypes.includes('bg_colorer'), 'Should have bg_colorer plots');

assert.ok(advRes.metainfo.filledAreas && advRes.metainfo.filledAreas.length === 1, 'Should have 1 filledArea');
console.log(`- filledAreas config:`, advRes.metainfo.filledAreas);
assert.strictEqual(advRes.metainfo.bands.length, 1, 'Should have 1 hline band');
console.log('✓ Advanced plot directives (chars, arrows, bar_color, bg_colorer, fill, hline) verified!\n');

console.log('=== TEST 3: Testing Extended Technical Analysis Functions ===');
const taScript = `//@version=5
indicator("Extended TA Test", overlay=false)

stochVal = ta.stoch(close, high, low, 14)
cciVal = ta.cci(close, 20)
momVal = ta.mom(close, 10)
rocVal = ta.roc(close, 10)
[kcBasis, kcUpper, kcLower] = ta.kc(close, 20, 1.5, true)
bbwVal = ta.bbw(close, 20, 2.0)
wprVal = ta.wpr(14)
ph = ta.pivothigh(high, 3, 3)
pl = ta.pivotlow(low, 3, 3)
gradCol = color.from_gradient(stochVal, 0, 100, color.blue, color.red)
rgbCol = color.rgb(100, 150, 200, 0.8)

plot(stochVal, "Stoch")
plot(cciVal, "CCI")
plot(momVal, "MOM")
plot(rocVal, "ROC")
plot(kcUpper, "KC Upper")
plot(bbwVal, "BBW")
plot(wprVal, "WPR")
`;

const taRes = PineEngine.transpile(taScript);
assert.strictEqual(taRes.success, true, 'TA script failed: ' + taRes.errors.join(', '));
console.log('✓ Extended TA functions transpiled cleanly!\n');

console.log('=== TEST 4: Microsecond Bar-by-Bar Runtime Benchmark ===');
const mockBars = PineScriptRuntime.createMockBars(1000, 150);
const startBench = Date.now();
const runResult = PineScriptRuntime.execute(taRes, mockBars);
const durationMs = Date.now() - startBench;

assert.strictEqual(runResult.success, true, 'Execution failed');
assert.strictEqual(runResult.barsCount, 1000);
console.log(`✓ 1,000 bars calculated in ${durationMs} ms (${(durationMs / 1000 * 1000).toFixed(2)} µs per bar)`);
assert.ok(durationMs < 100, `Calculation took ${durationMs}ms, expected < 100ms for 1000 bars`);

console.log('\n=========================================');
console.log('🎯 ALL ADVANCED PINE ENGINE TESTS PASSED!');
console.log('=========================================');
