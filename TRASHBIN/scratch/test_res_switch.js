const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testResolutionAndSymbol() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join('C:\\Users\\gocha\\AppData\\Local\\Temp', 'chrome-test-res-' + Date.now());
  const port = 9260;

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
    const putResp = await fetch(`http://127.0.0.1:${port}/json/new?http://localhost:9000`, { method: 'PUT' });
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
        consoleLogs.push({ type: d.params.type, text });
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

    console.log('Waiting 8s for chart ready...');
    await new Promise(r => setTimeout(r, 8000));

    // Test changing resolution to 1T and symbol to EURUSD. via TV widget API
    const resTest = await call('Runtime.evaluate', {
      expression: `(async () => {
        const w = window.widget;
        if (!w) return { success: false, reason: 'window.widget not found' };
        
        return new Promise((resolve) => {
          w.onChartReady(() => {
            const chart = w.activeChart();
            const initialSymbol = chart.symbol();
            const initialRes = chart.resolution();

            // Set resolution to 1T
            chart.setResolution('1T', () => {
              const resAfter = chart.resolution();
              // Set symbol to EURUSD.
              chart.setSymbol('EURUSD.', () => {
                const symAfter = chart.symbol();
                resolve({
                  success: true,
                  initialSymbol,
                  initialRes,
                  resAfter,
                  symAfter
                });
              });
            });
          });
        });
      })()`,
      awaitPromise: true,
      returnByValue: true
    });

    console.log('Resolution & Symbol switch result:', JSON.stringify(resTest.result?.result?.value || resTest.result?.value, null, 2));

    await new Promise(r => setTimeout(r, 5000));

    const symbolErrors = consoleLogs.filter(l => l.text.includes('Unexpected token') || l.text.includes('Symbol Error'));
    console.log('Symbol / JSON error count:', symbolErrors.length);
    symbolErrors.forEach(l => console.log(`  ERROR: ${l.text}`));

    const scr = await call('Page.captureScreenshot', { format: 'png' });
    if (scr.result?.data) {
      const outPath = path.join(__dirname, '..', 'screenshot_test_1T_switch.png');
      fs.writeFileSync(outPath, Buffer.from(scr.result.data, 'base64'));
      console.log(`Saved screenshot to: ${outPath}`);
    }

    return {
      switchResult: resTest.result?.result?.value || resTest.result?.value,
      symbolErrorsCount: symbolErrors.length
    };
  } finally {
    proc.kill();
  }
}

testResolutionAndSymbol().then(r => console.log('DONE', r)).catch(console.error);
