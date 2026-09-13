/**
 * Dedicated Adversarial Stress Verification Suite for PineTS Runtime,
 * Indicator Compilation, and Custom Symbol Candles Execution.
 *
 * File: .agents/challenger_pinets_stress/stress_pinets.js
 * Author: challenger_pinets_stress (teamwork_preview_challenger)
 * 
 * Challenge Pillars:
 *  1. Malformed Pine script syntax -> graceful error diagnostics without server or browser crash.
 *  2. Script with 0 explicit plots -> adaptive trend baseline generates non-NaN series.
 *  3. Multi-timeframe tuple destructuring [o, h, l, c] = request.security(...) with boundary values.
 *  4. Dynamic bar updates and forming candle color transitions (bullish green vs bearish red).
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

// Ensure root PineIndicators and PineTS are loaded
const ROOT_DIR = path.resolve(__dirname, '../../');
const pineIndicatorsPath = path.join(ROOT_DIR, 'pine_indicators.js');
const pinetsCjsPath = path.join(ROOT_DIR, 'PineTS-main/dist/pinets.min.cjs');

require(pineIndicatorsPath);
const PineIndicators = globalThis.PineIndicators;
const PineTSLib = require(pinetsCjsPath);

const BASE_URL = 'http://127.0.0.1:9000';

let totalTests = 0;
let passedTests = 0;
let failedTests = 0;
const failures = [];

function test(name, fn) {
  totalTests++;
  try {
    fn();
    passedTests++;
    console.log(`  [PASS] #${totalTests}: ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message, stack: err.stack });
    console.error(`  [FAIL] #${totalTests}: ${name}`);
    console.error(`         Reason: ${err.message}`);
  }
}

async function asyncTest(name, fn) {
  totalTests++;
  try {
    await fn();
    passedTests++;
    console.log(`  [PASS] #${totalTests}: ${name}`);
  } catch (err) {
    failedTests++;
    failures.push({ name, error: err.message, stack: err.stack });
    console.error(`  [FAIL] #${totalTests}: ${name}`);
    console.error(`         Reason: ${err.message}`);
  }
}

console.log('='.repeat(80));
console.log('  PINETS ADVERSARIAL STRESS & EMPIRICAL CHALLENGER HARNESS');
console.log('='.repeat(80));

async function main() {
  /* =========================================================================
   * PILLAR 1: Malformed Pine Script Syntax & Crash-Resilience Fuzzing
   * ========================================================================= */
  console.log('\n[PILLAR 1] Malformed Pine Script Syntax & Crash-Resilience Fuzzing');

  const adversarialScripts = [
    { name: 'Empty string', code: '' },
    { name: 'Whitespace only', code: '   \n\t  \n  ' },
    { name: 'Unclosed string literal', code: '//@version=5\nindicator("Unclosed string' },
    { name: 'Invalid operator sequence', code: '//@version=5\nindicator("Bad Ops")\nx = = = + + + / / /' },
    { name: 'Mismatched parentheses & brackets', code: '//@version=5\nindicator("Mismatch")\nplot(((close, open])' },
    { name: 'Undeclared unknown identifier call', code: '//@version=5\nindicator("Unknown Call")\ny = completely_unregistered_ta_function(close)' },
    { name: 'Malformed plotcandle call (too few args)', code: '//@version=5\nindicator("Bad Candle")\nplotcandle(open, high)' },
    { name: 'Deep expression nesting (100 nested parentheses)', code: '//@version=5\nindicator("Deep")\nx = ' + '('.repeat(100) + 'close' + ')'.repeat(100) },
    { name: 'Invalid Pine version header', code: '//@version=9999\nindicator("Future")\nplot(close)' },
    { name: 'Command injection attempt', code: '//@version=5\nindicator("Inject"); require("child_process").execSync("whoami")' },
    { name: 'Process exit attempt', code: '//@version=5\nindicator("Kill"); process.exit(1)' },
    { name: 'Reserved keyword shadowing', code: '//@version=5\nindicator("Shadow")\nplot = 10\nplot(plot)' }
  ];

  // 1.1 Backend /pine/transpile fuzzing
  for (const item of adversarialScripts) {
    await asyncTest(`Backend transpile handles malformed script: ${item.name}`, async () => {
      let resp;
      try {
        resp = await fetch(`${BASE_URL}/pine/transpile`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ source: item.code })
        });
      } catch (netErr) {
        throw new Error(`Server connection failed during fuzzing: ${netErr.message}`);
      }

      // Server must NOT crash or return HTTP 500
      assert.notStrictEqual(resp.status, 500, `Server returned HTTP 500 Internal Server Error for ${item.name}`);
      
      const data = await resp.json();
      if (item.code.trim() === '') {
        assert.strictEqual(resp.status, 400, 'Empty code should return HTTP 400');
        assert.ok(data.detail, 'Empty code response should contain detail');
      } else {
        // For syntax errors, backend should return 200 with success: false and diagnostic error
        if (data.success === false) {
          assert.ok(data.error && data.error.length > 0, `Expected diagnostic error for ${item.name}`);
        } else {
          // If AST parser was lenient, code must be generated safely
          assert.ok(typeof data.code === 'string', `Lenient parse must still return code string for ${item.name}`);
        }
      }
    });
  }

  // 1.2 Verify backend health survived all fuzzing payloads
  await asyncTest('FastAPI backend /health remains 100% healthy after fuzzing battery', async () => {
    const res = await fetch(`${BASE_URL}/health`);
    assert.strictEqual(res.status, 200, `/health must return 200, got ${res.status}`);
    const health = await res.json();
    assert.strictEqual(health.status, 'healthy', 'Server status must be healthy');
  });

  // 1.3 Local PineTS runtime fuzzing resilience
  for (const item of adversarialScripts) {
    test(`Local runtime compileAndRegisterPine handles: ${item.name}`, () => {
      let threw = false;
      let res = null;
      try {
        res = PineIndicators.compileAndRegisterPine(item.code);
      } catch (e) {
        threw = true;
        // Verify caught error has descriptive message
        assert.ok(e.message && e.message.length > 0, 'Error message must be non-empty');
      }
      // Either handled gracefully with study fallback or threw catchable error (no process crash)
      if (!threw) {
        assert.ok(res && res.study, 'If not thrown, must return valid study wrapper');
      }
    });
  }

  /* =========================================================================
   * PILLAR 2: Zero Explicit Plots & Adaptive Trend Baseline Verification
   * ========================================================================= */
  console.log('\n[PILLAR 2] Scripts with 0 Explicit Plots & Adaptive Trend Baseline Verification');

  const zeroPlotScripts = [
    {
      name: 'Pure calculation overlay script without plot()',
      source: `//@version=5
indicator("Calculations Only Overlay", overlay=true)
fastLen = input.int(9, "Fast Length")
slowLen = input.int(21, "Slow Length")
fastMA = ta.sma(close, fastLen)
slowMA = ta.sma(close, slowLen)
diff = fastMA - slowMA`,
      isOverlay: true
    },
    {
      name: 'Pure calculation separate pane oscillator script without plot()',
      source: `//@version=5
indicator("Calculations Only Pane", overlay=false)
rsiLen = input.int(14, "RSI Length")
r = ta.rsi(close, rsiLen)
smoothR = ta.ema(r, 5)`,
      isOverlay: false
    },
    {
      name: 'Minimal empty indicator declaration',
      source: `//@version=5
indicator("Minimal Empty", overlay=true)`,
      isOverlay: true
    }
  ];

  for (const item of zeroPlotScripts) {
    test(`0-plot metadata generation for: ${item.name}`, () => {
      const meta = PineIndicators.parsePineMetadata(item.source);
      assert.strictEqual(meta.rawPlotCount, 0, 'Raw plot count must be 0');
      assert.strictEqual(meta.rawCandleCount, 0, 'Raw candle count must be 0');
      assert.strictEqual(meta.rawShapeCount, 0, 'Raw shape count must be 0');
      assert.strictEqual(meta.plots.length, 1, 'Must synthesize exactly 1 adaptive plot');
      assert.strictEqual(meta.plots[0].id, 'plot_0', 'Adaptive plot id must be plot_0');
      assert.ok(meta.plots[0].title.length > 0, 'Adaptive plot must have non-empty title');
    });

    test(`0-plot Metainfo v52 conformity for: ${item.name}`, () => {
      const compilation = PineIndicators.compileAndRegisterPine(item.source);
      const study = compilation.study;
      assert.ok(study, 'Study must be created');
      assert.strictEqual(study.metainfo._metainfoVersion, 52);
      assert.strictEqual(study.metainfo.plots.length, 1);
      assert.strictEqual(study.metainfo.plots[0].id, 'plot_0');
      assert.strictEqual(study.metainfo.plots[0].type, 'line');
      assert.ok(study.metainfo.styles['plot_0'], 'Style for plot_0 must be defined');
      assert.ok(study.metainfo.defaults.styles['plot_0'], 'Default style for plot_0 must be defined');
    });

    test(`0-plot execution generates non-NaN series across bar states: ${item.name}`, () => {
      const compilation = PineIndicators.compileAndRegisterPine(item.source);
      const study = compilation.study;
      const instance = new study.constructor();
      instance.init({}, () => undefined);

      // 1. First Bar (Cold-start, index 0, no lookback available)
      const mockCtxBar0 = {
        symbol: { open: 100, high: 105, low: 98, close: 102, volume: 1000, time: 1700000000000, index: 0 },
        new_var: (initVal) => {
          let v = initVal;
          return { get: (lag) => lag === 0 ? v : NaN, set: (val) => { v = val; } };
        }
      };
      const plotBar0 = instance.main(mockCtxBar0, () => undefined);
      assert.ok(Array.isArray(plotBar0), 'main() must return array of plot values');
      assert.strictEqual(plotBar0.length, 1, 'Must return exactly 1 plot value');
      assert.strictEqual(typeof plotBar0[0], 'number', 'Plot value must be a number');
      assert.ok(!isNaN(plotBar0[0]), `First bar must NEVER produce NaN, got: ${plotBar0[0]}`);

      // 2. 200 consecutive bars stress test with trend and noise
      let currentPrice = 100;
      for (let barIdx = 1; barIdx <= 200; barIdx++) {
        const change = (Math.sin(barIdx * 0.15) * 3.0) + ((barIdx % 5 === 0) ? 2.5 : -1.8);
        const open = currentPrice;
        const close = currentPrice + change;
        const high = Math.max(open, close) + 1.2;
        const low = Math.min(open, close) - 1.2;
        currentPrice = close;

        const ctx = {
          symbol: { open, high, low, close, volume: 1000 + barIdx * 10, time: 1700000000000 + barIdx * 60000, index: barIdx },
          new_var: (initVal) => {
            let v = initVal;
            return { get: (lag) => lag === 0 ? v : NaN, set: (val) => { v = val; } };
          }
        };

        const plotVals = instance.main(ctx, () => undefined);
        assert.strictEqual(plotVals.length, 1);
        assert.strictEqual(typeof plotVals[0], 'number');
        assert.ok(!isNaN(plotVals[0]), `Bar #${barIdx} produced NaN: ${plotVals[0]}`);
      }

      // 3. Boundary prices: Zero, Negative, Flat, and Massive (1e12)
      const boundaryPrices = [
        { open: 0, high: 0, low: 0, close: 0, desc: 'Zero price' },
        { open: -50, high: -45, low: -55, close: -48, desc: 'Negative price' },
        { open: 100, high: 100, low: 100, close: 100, desc: 'Flat unchanged price' },
        { open: 1e12, high: 1.01e12, low: 0.99e12, close: 1.005e12, desc: 'Massive price 1e12' }
      ];

      boundaryPrices.forEach((bp, bIdx) => {
        const ctx = {
          symbol: { open: bp.open, high: bp.high, low: bp.low, close: bp.close, volume: 500, time: 1700000000000 + (300 + bIdx) * 60000, index: 300 + bIdx },
          new_var: (initVal) => {
            let v = initVal;
            return { get: (lag) => lag === 0 ? v : NaN, set: (val) => { v = val; } };
          }
        };
        const plotVals = instance.main(ctx, () => undefined);
        assert.strictEqual(plotVals.length, 1);
        assert.strictEqual(typeof plotVals[0], 'number');
        assert.ok(!isNaN(plotVals[0]), `${bp.desc} produced NaN: ${plotVals[0]}`);
      });
    });
  }

  /* =========================================================================
   * PILLAR 3: Multi-Timeframe Tuple Destructuring [o, h, l, c] = request.security(...)
   * ========================================================================= */
  console.log('\n[PILLAR 3] Multi-Timeframe Tuple Destructuring & Boundary Values');

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

  const candlesCompilation = PineIndicators.compileAndRegisterPine(customCandlesSource);
  const candlesStudy = candlesCompilation.study;

  test('Custom Symbol Candles Metainfo defines 7 OHLC plot targets', () => {
    assert.ok(candlesStudy, 'Custom Symbol Candles must compile successfully');
    const mi = candlesStudy.metainfo;
    assert.strictEqual(mi.plots.length, 7, 'Must have exactly 7 OHLC plot elements');
    const expectedPlots = [
      { id: 'candle_0_open', type: 'ohlc_open' },
      { id: 'candle_0_high', type: 'ohlc_high' },
      { id: 'candle_0_low', type: 'ohlc_low' },
      { id: 'candle_0_close', type: 'ohlc_close' },
      { id: 'candle_0_colorer', type: 'ohlc_colorer' },
      { id: 'candle_0_wick_colorer', type: 'wick_colorer' },
      { id: 'candle_0_border_colorer', type: 'border_colorer' }
    ];
    expectedPlots.forEach((ep, idx) => {
      assert.strictEqual(mi.plots[idx].id, ep.id);
      assert.strictEqual(mi.plots[idx].type, ep.type);
      assert.strictEqual(mi.plots[idx].target, 'candle_0');
    });
    assert.ok(mi.ohlcPlots['candle_0'], 'ohlcPlots.candle_0 must exist');
    assert.ok(mi.defaults.ohlcPlots['candle_0'], 'defaults.ohlcPlots.candle_0 must exist');
    assert.strictEqual(mi.defaults.ohlcPlots['candle_0'].plottype, 'ohlc_candles');
  });

  test('Boundary symbol resolution in [o, h, l, c] destructuring', () => {
    const boundarySymbols = [
      '',
      '   ',
      'UNKNOWN_STOCK_XYZ',
      'BINANCE:BTCUSDT',
      'FX:EUR/USD:123',
      'XAUUSD.',
      'INVALID:SYMBOL:COLONS:MORE'
    ];

    const instance = new candlesStudy.constructor();
    instance.init({}, () => undefined);

    boundarySymbols.forEach((sym) => {
      const ctx = {
        symbol: { ticker: 'EURUSD', open: 1.0850, high: 1.0890, low: 1.0820, close: 1.0875, time: 1700000000000, index: 1 }
      };
      const inputCallback = (key) => {
        if (key === 'sym' || key === 'symbol' || key === 0) return sym;
        return undefined;
      };

      const out = instance.main(ctx, inputCallback);
      assert.strictEqual(out.length, 7, `Output must be 7 elements for symbol: "${sym}"`);
      const [o, h, l, c, bodyCol, wickCol, borderCol] = out;
      assert.ok(!isNaN(o), `Open must not be NaN for symbol: "${sym}"`);
      assert.ok(!isNaN(h), `High must not be NaN for symbol: "${sym}"`);
      assert.ok(!isNaN(l), `Low must not be NaN for symbol: "${sym}"`);
      assert.ok(!isNaN(c), `Close must not be NaN for symbol: "${sym}"`);
      assert.ok(h >= Math.min(o, c) - 1e-6, `High must be >= min(open, close) for symbol: "${sym}"`);
      assert.ok(l <= Math.max(o, c) + 1e-6, `Low must be <= max(open, close) for symbol: "${sym}"`);
    });
  });

  test('Boundary timeframe resolution in [o, h, l, c] destructuring', () => {
    const boundaryResolutions = [
      '1S', '1', '3', '5', '15', '30', '60', '120', '240',
      'D', '1D', 'W', '1W', 'M', '1M',
      '', 'INVALID_RES', '9999', '0', '-5'
    ];

    const instance = new candlesStudy.constructor();
    instance.init({}, () => undefined);

    boundaryResolutions.forEach((res) => {
      const ctx = {
        symbol: { ticker: 'AAPL', open: 150.0, high: 155.0, low: 149.0, close: 153.5, time: 1700000000000, index: 1 }
      };
      const inputCallback = (key) => {
        if (key === 'res' || key === 'timeframe' || key === 'resolution' || key === 1) return res;
        return undefined;
      };

      const out = instance.main(ctx, inputCallback);
      assert.strictEqual(out.length, 7, `Output must be 7 elements for tf: "${res}"`);
      const [o, h, l, c] = out;
      assert.ok(!isNaN(o) && !isNaN(h) && !isNaN(l) && !isNaN(c), `OHLC must not be NaN for tf: "${res}"`);
    });
  });

  test('Security Bar Cache binary search & cache boundary conditions', () => {
    // Populate _securityCache with mock HTF bars
    const testSym = 'TESTBTC';
    const testRes = 'D';
    const cacheKey = `${testSym}_${testRes}`;

    const mockCachedBars = [
      { time: 10000000, open: 100, high: 110, low: 95, close: 108 },
      { time: 20000000, open: 108, high: 120, low: 105, close: 115 },
      { time: 30000000, open: 115, high: 125, low: 112, close: 122 }
    ];

    PineIndicators._securityCache.set(cacheKey, { bars: mockCachedBars, fetching: false });

    const instance = new candlesStudy.constructor();
    instance.init({}, () => undefined);

    const inputCallback = (key) => {
      if (key === 'sym' || key === 'symbol' || key === 0) return testSym;
      if (key === 'res' || key === 'timeframe' || key === 'resolution' || key === 1) return testRes;
      return undefined;
    };

    // Case A: Exact timestamp match
    const ctxMatch = { symbol: { ticker: 'CHART', open: 50, high: 60, low: 40, close: 55, time: 20000000, index: 1 } };
    const outMatch = instance.main(ctxMatch, inputCallback);
    assert.strictEqual(outMatch[0], 108, 'Must match cached open');
    assert.strictEqual(outMatch[1], 120, 'Must match cached high');
    assert.strictEqual(outMatch[2], 105, 'Must match cached low');
    assert.strictEqual(outMatch[3], 115, 'Must match cached close');

    // Case B: Timestamp between bars (25000000 should match bar at 20000000)
    const ctxBetween = { symbol: { ticker: 'CHART', open: 50, high: 60, low: 40, close: 55, time: 25000000, index: 2 } };
    const outBetween = instance.main(ctxBetween, inputCallback);
    assert.strictEqual(outBetween[0], 108, 'Must match previous cached bar open');
    assert.strictEqual(outBetween[3], 115, 'Must match previous cached bar close');

    // Case C: Timestamp before all cached bars (5000000 < 10000000)
    const ctxBefore = { symbol: { ticker: 'CHART', open: 50, high: 60, low: 40, close: 55, time: 5000000, index: 3 } };
    const outBefore = instance.main(ctxBefore, inputCallback);
    // Should safely fallback to chart symbol bar
    assert.strictEqual(outBefore[0], 50, 'Fallback to chart open');
    assert.strictEqual(outBefore[3], 55, 'Fallback to chart close');

    // Case D: Timestamp after all cached bars (40000000 > 30000000)
    const ctxAfter = { symbol: { ticker: 'CHART', open: 50, high: 60, low: 40, close: 55, time: 40000000, index: 4 } };
    const outAfter = instance.main(ctxAfter, inputCallback);
    assert.strictEqual(outAfter[0], 115, 'Must match latest cached bar open');
    assert.strictEqual(outAfter[3], 122, 'Must match latest cached bar close');
  });

  /* =========================================================================
   * PILLAR 4: Dynamic Bar Updates & Forming Candle Color Transitions
   * ========================================================================= */
  console.log('\n[PILLAR 4] Dynamic Bar Updates & Forming Candle Color Transitions');

  test('Forming candle dynamic color transitions (Bullish Green vs Bearish Red)', () => {
    const instance = new candlesStudy.constructor();
    instance.init({}, () => undefined);

    const baseTime = 1700000000000;
    const barIndex = 42;

    const GREEN_BODY = PineIndicators.colorToInt('#089981'); // Bullish
    const RED_BODY = PineIndicators.colorToInt('#F23645');   // Bearish
    assert.strictEqual(typeof GREEN_BODY, 'number', 'Color must be numeric integer');
    assert.strictEqual(typeof RED_BODY, 'number', 'Color must be numeric integer');
    assert.notStrictEqual(GREEN_BODY, RED_BODY, 'Bullish and bearish color integers must differ');

    const inputCb = (key) => {
      if (key === 'sym' || key === 0) return 'AAPL';
      if (key === 'res' || key === 1) return 'D';
      if (key === 'upColor' || key === 2) return '#089981';
      if (key === 'downColor' || key === 3) return '#F23645';
      if (key === 'wickColor' || key === 4) return '#787B86';
      if (key === 'borderUpColor' || key === 5) return '#089981';
      if (key === 'borderDownColor' || key === 6) return '#F23645';
      if (key === 'showBorders' || key === 7) return true;
      if (key === 'showWicks' || key === 8) return true;
      return undefined;
    };

    // --- Tick 1: Open bar at 2000.0 (Doji: c == o) ---
    const tick1 = instance.main({
      symbol: { ticker: 'AAPL', open: 2000.0, high: 2000.0, low: 2000.0, close: 2000.0, time: baseTime, index: barIndex }
    }, inputCb);
    assert.strictEqual(tick1[0], 2000.0, 'Bar open is 2000.0');
    assert.strictEqual(tick1[3], 2000.0, 'Bar close is 2000.0');
    assert.strictEqual(tick1[4], GREEN_BODY, 'Doji (c >= o) must display bullish upColor');

    // --- Tick 2: Price drops to 1995.0 (Bearish: c < o) ---
    const tick2 = instance.main({
      symbol: { ticker: 'AAPL', open: 2000.0, high: 2000.0, low: 1995.0, close: 1995.0, time: baseTime, index: barIndex }
    }, inputCb);
    assert.strictEqual(tick2[0], 2000.0, 'Open preserved');
    assert.strictEqual(tick2[2], 1995.0, 'Low expanded to 1995.0');
    assert.strictEqual(tick2[3], 1995.0, 'Close is 1995.0');
    assert.strictEqual(tick2[4], RED_BODY, 'Bearish tick must dynamically flip to downColor (red)');

    // --- Tick 3: Price surges to 2012.0 (Bullish: c > o) ---
    const tick3 = instance.main({
      symbol: { ticker: 'AAPL', open: 2000.0, high: 2012.0, low: 1995.0, close: 2012.0, time: baseTime, index: barIndex }
    }, inputCb);
    assert.strictEqual(tick3[0], 2000.0, 'Open preserved');
    assert.strictEqual(tick3[1], 2012.0, 'High expanded to 2012.0');
    assert.strictEqual(tick3[2], 1995.0, 'Low preserved at 1995.0');
    assert.strictEqual(tick3[3], 2012.0, 'Close is 2012.0');
    assert.strictEqual(tick3[4], GREEN_BODY, 'Bullish surge must dynamically flip to upColor (green)');

    // --- Tick 4: Price plunges to 1990.0 (Bearish: c < o) ---
    const tick4 = instance.main({
      symbol: { ticker: 'AAPL', open: 2000.0, high: 2012.0, low: 1990.0, close: 1990.0, time: baseTime, index: barIndex }
    }, inputCb);
    assert.strictEqual(tick4[0], 2000.0, 'Open preserved');
    assert.strictEqual(tick4[1], 2012.0, 'High preserved at 2012.0');
    assert.strictEqual(tick4[2], 1990.0, 'Low expanded to 1990.0');
    assert.strictEqual(tick4[3], 1990.0, 'Close is 1990.0');
    assert.strictEqual(tick4[4], RED_BODY, 'Bearish plunge must dynamically flip to downColor (red)');
  });

  test('Style toggles: showBorders and showWicks enforce transparent alpha=0', () => {
    const instance = new candlesStudy.constructor();
    instance.init({}, () => undefined);

    const baseTime = 1700000000000;
    const barIndex = 50;

    // Both borders and wicks disabled
    const noStyleCb = (key) => {
      if (key === 'showBorders' || key === 7) return false;
      if (key === 'showWicks' || key === 8) return false;
      return undefined;
    };

    const out = instance.main({
      symbol: { ticker: 'AAPL', open: 100.0, high: 105.0, low: 95.0, close: 102.0, time: baseTime, index: barIndex }
    }, noStyleCb);

    const [o, h, l, c, bodyCol, wickCol, borderCol] = out;
    assert.strictEqual(wickCol, 0, 'Disabled wicks must return 0 (transparent)');
    assert.strictEqual(borderCol, 0, 'Disabled borders must return 0 (transparent)');
    assert.notStrictEqual(bodyCol, 0, 'Body color must remain visible non-zero');
  });

  test('Massive dynamic bar stress: 10,000 randomized forming bar ticks', () => {
    const instance = new candlesStudy.constructor();
    instance.init({}, () => undefined);

    const GREEN_BODY = PineIndicators.colorToInt('#089981');
    const RED_BODY = PineIndicators.colorToInt('#F23645');

    let openPrice = 1800.0;
    let highPrice = openPrice;
    let lowPrice = openPrice;
    let closePrice = openPrice;
    let barTime = 1700000000000;
    let barIndex = 1;

    for (let tick = 0; tick < 10000; tick++) {
      // Every 100 ticks, advance to a new bar
      if (tick > 0 && tick % 100 === 0) {
        barIndex++;
        barTime += 60000;
        openPrice = closePrice;
        highPrice = openPrice;
        lowPrice = openPrice;
      }

      const delta = (Math.sin(tick * 0.3) * 2.0) + ((tick % 7 === 0) ? 3.5 : -2.8);
      closePrice = openPrice + delta;
      highPrice = Math.max(highPrice, closePrice);
      lowPrice = Math.min(lowPrice, closePrice);

      const ctx = {
        symbol: {
          ticker: 'AAPL',
          open: openPrice,
          high: highPrice,
          low: lowPrice,
          close: closePrice,
          time: barTime,
          index: barIndex
        }
      };

      const out = instance.main(ctx, () => undefined);
      assert.strictEqual(out.length, 7);
      const [barO, barH, barL, barC, bodyCol, wickCol, borderCol] = out;

      // Invariants
      assert.ok(!isNaN(barO) && !isNaN(barH) && !isNaN(barL) && !isNaN(barC), `NaN detected at tick ${tick}`);
      assert.ok(barH >= Math.max(barO, barC) - 1e-6, `High violation at tick ${tick}`);
      assert.ok(barL <= Math.min(barO, barC) + 1e-6, `Low violation at tick ${tick}`);

      if (barC >= barO) {
        assert.strictEqual(bodyCol, GREEN_BODY, `Expected green body at tick ${tick}`);
      } else {
        assert.strictEqual(bodyCol, RED_BODY, `Expected red body at tick ${tick}`);
      }
    }
  });

  /* =========================================================================
   * SUMMARY & VERDICT
   * ========================================================================= */
  console.log('\n' + '='.repeat(80));
  console.log(`STRESS SUITE EXECUTION SUMMARY: ${passedTests}/${totalTests} PASSED`);
  if (failedTests > 0) {
    console.error(`FAILURES DETECTED: ${failedTests}`);
    failures.forEach((f, idx) => {
      console.error(`  #${idx + 1}: ${f.name} -> ${f.error}`);
    });
    console.log('FINAL VERDICT: REJECT');
    process.exit(1);
  } else {
    console.log('ALL EMPIRICAL STRESS CHECKS PASSED WITH 100% SUCCESS RATE.');
    console.log('FINAL VERDICT: APPROVE');
  }
  console.log('='.repeat(80));
}

main().catch((err) => {
  console.error('Fatal execution error:', err);
  process.exit(1);
});
