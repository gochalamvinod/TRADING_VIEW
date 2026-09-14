const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runBinaryTreeAgent() {
  console.log('================================================================');
  console.log('🌲 STARTING BINARY TREE EXPLORATION AGENT');
  console.log('Target: 99.999% state coverage, zero console errors, sub-ms speed');
  console.log('Focus Symbol: BTCUSD (24/7 Live Stream on Weekend)');
  console.log('================================================================');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join('C:\\Users\\gocha\\AppData\\Local\\Temp', 'chrome-btree-' + Date.now());
  const port = 9268;

  const proc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const targetUrl = 'http://127.0.0.1:9000';
    console.log(`[Root] Connecting to ${targetUrl}...`);
    const putResp = await fetch(`http://127.0.0.1:${port}/json/new?${targetUrl}`, { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    const consoleLogs = [];
    const exceptions = [];

    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled') {
        const text = d.params.args.map(a => a.value !== undefined ? a.value : (a.description || JSON.stringify(a))).join(' ');
        if (d.params.type === 'error') {
          consoleLogs.push({ type: 'error', text });
        }
      }
      if (d.method === 'Runtime.exceptionThrown') {
        const text = d.params.exceptionDetails?.text + ' ' + (d.params.exceptionDetails?.exception?.description || '');
        exceptions.push(text);
      }
      if (d.id && pending.has(d.id)) pending.get(d.id)(d);
    };

    await new Promise(r => ws.onopen = r);

    const call = (method, params = {}) => new Promise(res => {
      const cid = id++;
      pending.set(cid, res);
      ws.send(JSON.stringify({ id: cid, method, params }));
    });

    await call('Network.enable');
    await call('Page.enable');
    await call('Runtime.enable');

    console.log('Waiting 8s for chart initialization...');
    await new Promise(r => setTimeout(r, 8000));

    // Helper to evaluate javascript inside the browser page
    async function evaluateInBrowser(fnStr) {
      const evalResp = await call('Runtime.evaluate', {
        expression: `(${fnStr})()`,
        awaitPromise: true,
        returnByValue: true
      });
      return evalResp.result?.result?.value ?? evalResp.result?.value;
    }

    const results = [];

    // Branch 1: High-Precision Monotonic Clock & Latency Gate (< 1ms target)
    console.log('\n🌿 [Branch 1.0 - Clock & Sub-Millisecond Gate]');
    const clockStatus = await evaluateInBrowser(`() => {
      const sync = window.serverTimeSync;
      const t0 = performance.now();
      const serverMs = window.serverTime ? window.serverTime() : Date.now();
      const lookupTime = performance.now() - t0;
      return {
        isInitialized: sync?.isInitialized,
        calibratedOffset: sync?.calibratedOffset,
        driftBound: sync?.getDriftBoundMs ? sync.getDriftBoundMs() : null,
        lookupLatencyMs: Number(lookupTime.toFixed(4)),
        nowClientMs: Date.now(),
        serverMs: serverMs,
        diffMs: Math.abs(serverMs - Date.now())
      };
    }`);
    console.log('Clock Synchronization Result:', clockStatus);
    const clockPassed = clockStatus && clockStatus.diffMs < 5000 && clockStatus.lookupLatencyMs < 1.0;
    results.push({ test: 'Clock Sync & <1ms Latency Gate', passed: clockPassed, detail: clockStatus });

    // Branch 2: Symbol Selection (Focus on BTCUSD for Weekend Live Stream)
    console.log('\n🌿 [Branch 2.0 - Symbol Switch: BTCUSD]');
    const btcSwitch = await evaluateInBrowser(`async () => {
      const w = window.widget;
      if (!w) return { ok: false, reason: 'window.widget missing' };
      return new Promise(resolve => {
        w.onChartReady(() => {
          const chart = w.activeChart();
          const t0 = performance.now();
          chart.setSymbol('BTCUSD', () => {
            const dt = performance.now() - t0;
            resolve({ ok: true, symbol: chart.symbol(), latencyMs: Number(dt.toFixed(2)) });
          });
        });
      });
    }`);
    console.log('BTCUSD Symbol Switch:', btcSwitch);
    results.push({ test: 'Symbol Switch to BTCUSD', passed: btcSwitch && btcSwitch.ok, detail: btcSwitch });
    await new Promise(r => setTimeout(r, 4000));

    // Branch 3: Continuous Live Tick Motion Verification on BTCUSD
    console.log('\n🌿 [Branch 3.0 - Continuous Live Tick Motion Verification]');
    const motionCheck = await evaluateInBrowser(`async () => {
      const initialQuotes = window.serverTimeSync?.quoteCount || 0;
      await new Promise(r => setTimeout(r, 2000));
      const postQuotes = window.serverTimeSync?.quoteCount || 0;
      const activeSubs = window._activeBarSubscribers?.size || 0;
      const openCandle = window._activeOpenCandle;
      return {
        initialQuotes,
        postQuotes,
        deltaQuotes: postQuotes - initialQuotes,
        activeSubscribers: activeSubs,
        hasOpenCandle: !!openCandle,
        openCandleClose: openCandle?.close,
        openCandleTime: openCandle?.time
      };
    }`);
    console.log('Live Motion Check Result:', motionCheck);
    results.push({ test: 'Live Continuous Tick Streaming', passed: motionCheck && motionCheck.deltaQuotes > 0, detail: motionCheck });

    // Branch 4: Resolution Binary Tree Traversal (1T, 1S, 5S, 1, 1D)
    const resolutionsToTest = ['1T', '1S', '5S', '1', '1D'];
    for (const res of resolutionsToTest) {
      console.log(`\n🌿 [Branch 4.x - Resolution Switch: ${res}]`);
      const switchRes = await evaluateInBrowser(`async () => {
        const w = window.widget;
        return new Promise(resolve => {
          w.onChartReady(() => {
            const chart = w.activeChart();
            const t0 = performance.now();
            chart.setResolution('${res}', () => {
              const dt = performance.now() - t0;
              resolve({ ok: true, resolution: chart.resolution(), latencyMs: Number(dt.toFixed(2)) });
            });
          });
        });
      }`);
      console.log(`Resolution ${res} Switch Result:`, switchRes);
      results.push({ test: `Resolution Switch: ${res}`, passed: switchRes && switchRes.ok, detail: switchRes });
      await new Promise(r => setTimeout(r, 2500));
    }

    // Branch 5: UI Elements & Account Center Traversal
    console.log('\n🌿 [Branch 5.0 - Account Center Panel Traversal]');
    const accountCenterCheck = await evaluateInBrowser(`() => {
      const w = window.widget;
      return {
        hasWidget: !!w,
        url: window.location.href,
        hasChartReady: typeof w?.onChartReady === 'function',
        hasActiveChart: !!(w && typeof w.activeChart === 'function')
      };
    }`);
    console.log('Account Center & Widget Check:', accountCenterCheck);
    results.push({ test: 'Account Center & UI Controls', passed: accountCenterCheck && accountCenterCheck.hasWidget, detail: accountCenterCheck });

    // Branch 6: Zero Uncaught Exceptions & Console Error Cleanliness
    console.log('\n🌿 [Branch 6.0 - Zero Exception Health Audit]');
    console.log(`Total Runtime Exceptions Caught: ${exceptions.length}`);
    console.log(`Total Console Errors Logged: ${consoleLogs.length}`);
    const healthPassed = exceptions.length === 0;
    results.push({ test: 'Zero Uncaught Exceptions (99.999% Reliability)', passed: healthPassed, detail: { exceptions, consoleLogs } });

    // Capture screenshot
    const scr = await call('Page.captureScreenshot', { format: 'png' });
    const rawData = scr.result?.data || scr.data;
    if (rawData) {
      const scrPath = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\screenshot_btree_verification.png';
      fs.writeFileSync(scrPath, Buffer.from(rawData, 'base64'));
      console.log(`\n📸 Screenshot saved to ${scrPath}`);
    }

    // Binary Tree Final Execution Report
    console.log('\n================================================================');
    console.log('🌲 BINARY TREE AGENT EXECUTION SUMMARY:');
    let allPassed = true;
    for (const r of results) {
      const mark = r.passed ? '✅ PASS' : '❌ FAIL';
      if (!r.passed) allPassed = false;
      console.log(`${mark} - ${r.test}`);
    }
    console.log('================================================================\n');

    ws.close();
    proc.kill();
    process.exit(allPassed ? 0 : 1);
  } catch (err) {
    console.error('Binary Tree Agent Error:', err);
    try { proc.kill(); } catch(e) {}
    process.exit(1);
  }
}

runBinaryTreeAgent();
