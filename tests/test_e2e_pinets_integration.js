/**
 * test_e2e_pinets_integration.js
 * End-to-end headless browser test verifying:
 *  1. PineTS runtime engine and PineIndicators compiler integration
 *  2. Pine Editor IDE GUI: Save button, Add to chart button, dark TV theme
 *  3. Seamless tab integration: bottom [data-name="scripteditor"] and right toolbar [data-name="pine-editor"]
 *  4. Custom Symbol Candles study:
 *      - All 9 inputs (symbol, resolution, bool, 6 colors)
 *      - 7 native OHLC plots (open, high, low, close, body color, wick color, border color)
 *      - isRGB: true and defaults.ohlcPlots
 *      - Subpane candlestick rendering
 *  5. Legend polish: interval eye icon hidden, valuesWrapper nowrap
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runE2ETest() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-e2e-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2500));

  const results = {
    testName: "PineTS & Pine Editor Full E2E Test Suite",
    passed: 0,
    failed: 0,
    assertions: []
  };

  function assert(condition, message, details = {}) {
    if (condition) {
      results.passed++;
      results.assertions.push({ status: "PASS", message, details });
      console.log(`  [PASS] ${message}`);
    } else {
      results.failed++;
      results.assertions.push({ status: "FAIL", message, details });
      console.error(`  [FAIL] ${message}`, details);
    }
  }

  try {
    const putResp = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id && pending.has(d.id)) pending.get(d.id)(d); };
    await new Promise(r => ws.onopen = r);

    const call = (method, params = {}) => new Promise(res => {
      const cid = id++;
      pending.set(cid, res);
      ws.send(JSON.stringify({ id: cid, method, params }));
    });

    await call('Page.enable');
    await call('Runtime.enable');

    console.log("\n========================================================");
    console.log("1. Waiting for chart widget and iframe to load (12s)...");
    console.log("========================================================");
    await new Promise(r => setTimeout(r, 12000));

    // ── Check 1: Engine and IDE availability ───────────────────────────
    console.log("\n--- Check 1: Core Engine & Modules Global Availability ---");
    const engineCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        return {
          hasPineTS: !!(window.PineTSLib || window.PineTS),
          hasPineIndicators: !!window.PineIndicators,
          hasPineEditorIDE: !!window.PineEditorIDE,
          hasWidget: !!window.widget,
          hasChart: !!(window.widget && window.widget.activeChart())
        };
      })()`,
      returnByValue: true
    });
    const eng = engineCheck.result?.result?.value || {};
    assert(eng.hasPineTS, "PineTS runtime engine loaded globally on window", eng);
    assert(eng.hasPineIndicators, "PineIndicators bridge loaded globally on window", eng);
    assert(eng.hasPineEditorIDE, "PineEditorIDE loaded globally on window", eng);
    assert(eng.hasWidget && eng.hasChart, "TradingView chart widget ready and active", eng);

    // ── Check 2: Bottom Bar Tab & Right Toolbar Buttons ────────────────
    console.log("\n--- Check 2: Authentic Bottom Bar Tab & Right Toolbar ---");
    const buttonsCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (!doc) return { error: "no iframe doc" };

        const bottomPineTab = doc.querySelector('[data-name="scripteditor"]');
        const bottomStratTab = doc.querySelector('[data-name="strategy_tester_tab"]');
        const bottomTradingTab = doc.querySelector('.js-bottom-trading-tab');
        const rtPineBtn = doc.querySelector('[data-name="pine-editor"]');
        const dock = document.getElementById('pine_editor_dock');

        return {
          hasBottomPineTab: !!bottomPineTab,
          bottomPineTabText: bottomPineTab?.textContent?.trim(),
          hasBottomStratTab: !!bottomStratTab,
          hasBottomTradingTab: !!bottomTradingTab,
          hasRtPineBtn: !!rtPineBtn,
          hasDock: !!dock,
          dockInitialDisplay: dock?.style.display
        };
      })()`,
      returnByValue: true
    });
    const btns = buttonsCheck.result?.result?.value || {};
    assert(btns.hasBottomPineTab, "Bottom bar contains [data-name='scripteditor'] Pine Editor tab", btns);
    assert(btns.bottomPineTabText === "Pine Editor", "Bottom tab label matches 'Pine Editor'", btns);
    assert(btns.hasBottomStratTab, "Bottom bar contains Strategy Tester tab", btns);
    assert(btns.hasBottomTradingTab, "Bottom bar contains native Trading Panel / Account Manager tab", btns);
    assert(btns.hasRtPineBtn, "Right toolbar contains [data-name='pine-editor'] button", btns);
    assert(btns.hasDock && btns.dockInitialDisplay === 'none', "Pine Editor dock mounted and initially hidden", btns);

    // ── Check 3: Bottom Tab Click & Seamless Dock Toggle ───────────────
    console.log("\n--- Check 3: Bottom Tab Click & Toggle Interaction ---");
    const toggleCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const bottomTab = doc?.querySelector('[data-name="scripteditor"]');
        if (!bottomTab) return { error: "no bottom tab" };

        // Click bottom tab to open dock
        bottomTab.click();
        const opened = {
          isDockOpen: window.PineEditorIDE.isOpen(),
          dockDisplay: document.getElementById('pine_editor_dock')?.style.display,
          tabAriaPressed: bottomTab.getAttribute('aria-pressed'),
          tabActive: bottomTab.classList.contains('active-RoCcHn9S'),
          rtActive: doc.querySelector('[data-name="pine-editor"]')?.classList.contains('isActive-I_wb5FjE')
        };

        // Click bottom tab again to close dock
        bottomTab.click();
        const closed = {
          isDockOpen: window.PineEditorIDE.isOpen(),
          dockDisplay: document.getElementById('pine_editor_dock')?.style.display,
          tabAriaPressed: bottomTab.getAttribute('aria-pressed'),
          tabActive: bottomTab.classList.contains('active-RoCcHn9S'),
          rtActive: doc.querySelector('[data-name="pine-editor"]')?.classList.contains('isActive-I_wb5FjE')
        };

        // Reopen for subsequent tests
        bottomTab.click();

        return { opened, closed, reOpened: window.PineEditorIDE.isOpen() };
      })()`,
      returnByValue: true
    });
    const tog = toggleCheck.result?.result?.value || {};
    assert(tog.opened?.isDockOpen === true && tog.opened?.dockDisplay === 'flex', "Clicking bottom tab opens Pine Editor dock", tog.opened);
    assert(tog.opened?.tabActive === true && tog.opened?.rtActive === true, "Active state synchronized across bottom tab and right toolbar", tog.opened);
    assert(tog.closed?.isDockOpen === false && tog.closed?.dockDisplay === 'none', "Clicking bottom tab again seamlessly closes Pine Editor dock", tog.closed);
    assert(tog.reOpened === true, "Pine Editor dock reopened successfully", tog);

    // ── Check 4: Pine Editor GUI Elements (Save, Dirty, Code) ──────────
    console.log("\n--- Check 4: Pine Editor GUI & Save Functionality ---");
    const saveCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const codeInput = document.getElementById('pine_code_input');
        const saveBtn = document.getElementById('pine_save_btn');
        const dirtyInd = document.getElementById('pine_dirty_indicator');
        const statusText = document.getElementById('pine_compiler_status_text')?.textContent;

        const originalCode = codeInput.value;
        const hasCustomCandles = originalCode.includes("Custom Symbol Candles") && originalCode.includes("plotcandle");

        // Simulate typing a space to make dirty
        codeInput.value += " ";
        codeInput.dispatchEvent(new Event('input'));
        const isDirtyAfterInput = dirtyInd.style.display !== 'none';

        // Click Save button
        saveBtn.click();
        const isDirtyAfterSave = dirtyInd.style.display === 'none';
        const savedStatus = document.getElementById('pine_compiler_status_text')?.textContent;

        return {
          hasCustomCandles,
          isDirtyAfterInput,
          isDirtyAfterSave,
          savedStatus
        };
      })()`,
      returnByValue: true
    });
    const sc = saveCheck.result?.result?.value || {};
    assert(sc.hasCustomCandles, "Editor contains default Custom Symbol Candles script with plotcandle", sc);
    assert(sc.isDirtyAfterInput, "Dirty indicator (*) triggers when code is edited", sc);
    assert(sc.isDirtyAfterSave, "Dirty indicator clears after clicking Save button", sc);
    assert(sc.savedStatus === "Saved", "Status pill displays 'Saved' after save", sc);

    // ── Check 5: Add to Chart Execution ────────────────────────────────
    console.log("\n--- Check 5: Add to Chart Execution & Study Registration ---");
    const addCheck = await call('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const addBtn = document.getElementById('pine_add_to_chart_btn');
        addBtn.click();

        // Wait 3 seconds for compilation, registration, and chart ingestion
        await new Promise(r => setTimeout(r, 3000));

        const chart = window.widget.activeChart();
        const allStudies = chart ? chart.getAllStudies() : [];
        const customStudy = allStudies.find(s => s.name.includes("Custom Symbol Candles"));

        return {
          studyCount: allStudies.length,
          allStudies: allStudies.map(s => ({ id: s.id, name: s.name })),
          foundCustomStudy: !!customStudy,
          customStudyId: customStudy?.id,
          customStudyName: customStudy?.name
        };
      })()`,
      returnByValue: true
    });
    const ac = addCheck.result?.result?.value || {};
    assert(ac.foundCustomStudy, "Custom Symbol Candles added to active chart successfully", ac);

    // ── Check 6: Metainfo Schema (All 9 Inputs, 7 Candle Plots, isRGB) ─
    console.log("\n--- Check 6: Metainfo Schema & Technical Constraints ---");
    const metaCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const registered = window.PineIndicators.getRegisteredStudies();
        const study = registered.find(s => s.name.includes("Custom Symbol Candles"));
        if (!study || !study.metainfo) return { error: "Study metainfo not found in registry" };

        const meta = study.metainfo;
        const inputs = meta.inputs || [];
        const plots = meta.plots || [];
        const ohlcPlots = meta.ohlcPlots || {};
        const defaults = meta.defaults || {};

        return {
          isRGB: meta.isRGB,
          is_price_study: meta.is_price_study,
          inputCount: inputs.length,
          inputs: inputs.map(i => ({ id: i.id, name: i.name, type: i.type, defval: i.defval })),
          plotCount: plots.length,
          plots: plots.map(p => ({ id: p.id, type: p.type, target: p.target })),
          ohlcPlotsKeys: Object.keys(ohlcPlots),
          defaultsOhlcPlots: defaults.ohlcPlots
        };
      })()`,
      returnByValue: true
    });
    const mc = metaCheck.result?.result?.value || {};
    assert(mc.isRGB === true, "Metainfo enforces isRGB: true for 32-bit integer color support", mc);
    assert(mc.is_price_study === false, "Custom Symbol Candles is configured as subpane (overlay: false)", mc);
    assert(mc.inputCount === 9, "Metainfo specifies exactly 9 inputs", { count: mc.inputCount });

    // Validate each of the 9 inputs:
    const inTypes = (mc.inputs || []).map(i => ({ id: i.id, type: i.type }));
    const hasSymbol = inTypes.some(i => i.type === 'symbol');
    const hasResolution = inTypes.some(i => i.type === 'resolution');
    const hasBool = inTypes.some(i => i.type === 'bool');
    const colorCount = inTypes.filter(i => i.type === 'color').length;

    assert(hasSymbol, "Inputs contain Symbol picker (type: 'symbol')", inTypes);
    assert(hasResolution, "Inputs contain Timeframe/Resolution picker (type: 'resolution')", inTypes);
    assert(hasBool, "Inputs contain Show Candles checkbox (type: 'bool')", inTypes);
    assert(colorCount === 6, "Inputs contain exactly 6 color pickers (type: 'color')", { colorCount });

    // Validate 7 OHLC candle plots:
    const candlePlotTypes = (mc.plots || []).map(p => p.type);
    const expectedPlots = ['ohlc_open', 'ohlc_high', 'ohlc_low', 'ohlc_close', 'ohlc_colorer', 'wick_colorer', 'border_colorer'];
    const allPlotsPresent = expectedPlots.every(ep => candlePlotTypes.includes(ep));
    assert(allPlotsPresent, "Metainfo includes all 7 native OHLC candle plots (open, high, low, close, body/wick/border colorers)", candlePlotTypes);
    assert(mc.ohlcPlotsKeys.length > 0 && mc.defaultsOhlcPlots?.candle_0?.plottype === 'ohlc_candles', "Metainfo ohlcPlots and defaults.ohlcPlots configured with plottype 'ohlc_candles'", mc.defaultsOhlcPlots);

    // ── Check 7: Chart Panes & Candlestick Subpane Verification ────────
    console.log("\n--- Check 7: Chart Panes & Candlestick Subpane ---");
    const paneCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const chart = window.widget.activeChart();
        const panes = chart ? chart.getPanes() : [];
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const domPanes = doc ? doc.querySelectorAll('[data-name="pane-widget"], [class*="pane-widget"]') : [];
        const studies = chart ? chart.getAllStudies() : [];
        return {
          paneCount: Array.isArray(panes) ? panes.length : 0,
          domPaneCount: domPanes.length,
          studyCount: studies.length,
          studies: studies.map(s => s.name)
        };
      })()`,
      returnByValue: true
    });
    const pc = paneCheck.result?.result?.value || {};
    assert(pc.paneCount >= 2 || pc.domPaneCount >= 2, "Chart has at least 2 panes (Main price series + Custom Symbol Candles subpane)", pc);

    // ── Check 8: Legend Polish Verification ────────────────────────────
    console.log("\n--- Check 8: Legend Polish Verification ---");
    const legendCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (!doc) return { error: "no iframe doc" };

        const intervalEye = doc.querySelector('[data-name="legend-interval-show-hide-action"], .intervalEye, [class*="intervalEye"]');
        const intervalEyeStyle = intervalEye ? window.getComputedStyle(intervalEye) : null;
        const intervalEyeHidden = !intervalEye || intervalEyeStyle?.display === 'none' || intervalEyeStyle?.visibility === 'hidden';

        const valuesWrappers = Array.from(doc.querySelectorAll('[class*="valuesWrapper"], [class*="valuesAdditionalWrapper"]'));
        const allNowrap = valuesWrappers.length > 0 && valuesWrappers.every(el => {
          const s = window.getComputedStyle(el);
          return s.whiteSpace === 'nowrap' || s.flexWrap === 'nowrap';
        });

        const legendStudies = Array.from(doc.querySelectorAll('[data-name="legend-source-item"], [class*="study-"]')).map(el => ({
          text: el.textContent?.trim()?.slice(0, 40)
        }));

        return {
          intervalEyeFound: !!intervalEye,
          intervalEyeHidden,
          valuesWrappersCount: valuesWrappers.length,
          allNowrap,
          legendStudies
        };
      })()`,
      returnByValue: true
    });
    const lc = legendCheck.result?.result?.value || {};
    assert(lc.intervalEyeHidden, "Legend interval eye icon permanently hidden via CSS override", lc);
    assert(lc.allNowrap, "Legend valuesWrapper and valuesAdditionalWrapper enforce white-space: nowrap", lc);

    // ── Screenshot Capture ─────────────────────────────────────────────
    console.log("\n--- Check 9: Full Visual Verification Artifact ---");
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      const screenshotPath = path.resolve(__dirname, '../screenshots/e2e_pinets_verified.png');
      fs.writeFileSync(screenshotPath, Buffer.from(shot.result.data, 'base64'));
      console.log(`Saved screenshot artifact to: ${screenshotPath}`);
      assert(fs.existsSync(screenshotPath), "Screenshot artifact captured and saved to disk", { screenshotPath });
    }

    console.log("\n========================================================");
    console.log(`E2E TEST RUN FINISHED: ${results.passed} PASSED, ${results.failed} FAILED`);
    console.log("========================================================");

    ws.close();
  } catch (err) {
    console.error("E2E Test Failure Exception:", err);
    results.failed++;
    results.assertions.push({ status: "FAIL", message: `Exception: ${err.message}`, details: err.stack });
  } finally {
    proc.kill('SIGKILL');
  }

  return results;
}

runE2ETest().then(res => {
  if (res.failed > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}).catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
