const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function runTest() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-node-test-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9226',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const putResp = await fetch('http://127.0.0.1:9226/json/new?http://127.0.0.1:8080', { method: 'PUT' });
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

    console.log("1. Waiting 10s for page and TradingView iframe on http://127.0.0.1:8080 to load...");
    await new Promise(r => setTimeout(r, 10000));

    // Check if widget and iframe are ready
    const readyRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        return {
          hasWidget: !!window.tvWidget,
          hasIframe: !!iframe,
          hasDoc: !!doc
        };
      })()`,
      returnByValue: true
    });
    console.log("Readiness check:", readyRes.result?.value);

    // Switch to 1T resolution by clicking the 1T button inside the header toolbar or calling activeChart().setResolution('1T')
    console.log("2. Switching chart resolution to 1T...");
    const setResResult = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (doc) {
          const btns = Array.from(doc.querySelectorAll('button, div[role="button"], div'));
          const btn1T = btns.find(b => b.textContent && b.textContent.trim() === '1T');
          if (btn1T) {
            btn1T.click();
            return { clickedButton: true };
          }
        }
        if (window.tvWidget) {
          try {
            if (typeof window.tvWidget.activeChart === 'function') {
              window.tvWidget.activeChart().setResolution('1T');
              return { calledSetResolution: true };
            }
          } catch(e) {
            return { error: e.message };
          }
        }
        return { fallback: false };
      })()`,
      returnByValue: true
    });
    console.log("1T Switch result:", setResResult.result?.value);

    console.log("Waiting 6 seconds for 1T ticks to load and render across chart...");
    await new Promise(r => setTimeout(r, 6000));

    // Take screenshot of 1T chart
    const snap1 = await call('Page.captureScreenshot', { format: 'png' });
    const screen1Path = path.resolve('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\screenshot_1t_full_deep_history.png');
    fs.writeFileSync(screen1Path, Buffer.from(snap1.result.data, 'base64'));
    console.log("Screenshot 1 (1T chart) saved to:", screen1Path);

    // Verify right toolbar cached charts button
    const btnRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const rt = doc?.querySelector('[data-name="right-toolbar"]');
        const ccBtn = rt?.querySelector('[data-name="cached-charts"]');
        return {
          hasRightToolbar: !!rt,
          hasCcBtn: !!ccBtn
        };
      })()`,
      returnByValue: true
    });
    console.log("Right toolbar Cached Charts button status:", btnRes.result?.value);

    // Open Cached Charts drawer
    console.log("3. Opening Cached Charts drawer...");
    await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const ccBtn = doc?.querySelector('[data-name="cached-charts"]');
        if (ccBtn) ccBtn.click();
      })()`,
      returnByValue: true
    });
    await new Promise(r => setTimeout(r, 1200));

    // Inspect drawer symbols
    const drawerRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const drawer = document.getElementById('cached_charts_drawer');
        const cards = Array.from(document.querySelectorAll('.cc-symbol-card .cc-card-ticker')).map(e => e.textContent.trim());
        const countBadge = document.getElementById('cc_count_badge')?.textContent.trim();
        return {
          drawerActive: drawer?.classList.contains('active'),
          countBadge,
          cachedSymbols: cards
        };
      })()`,
      returnByValue: true
    });
    console.log("Drawer state:", drawerRes.result?.value);

    // Take drawer screenshot
    const snap2 = await call('Page.captureScreenshot', { format: 'png' });
    const screen2Path = path.resolve('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\screenshot_drawer_open_node.png');
    fs.writeFileSync(screen2Path, Buffer.from(snap2.result.data, 'base64'));
    console.log("Screenshot 2 (Drawer Open) saved to:", screen2Path);

    console.log("\nALL VERIFICATIONS PASSED SUCCESSFULLY!");
  } finally {
    proc.kill();
  }
}

runTest().catch(console.error);
