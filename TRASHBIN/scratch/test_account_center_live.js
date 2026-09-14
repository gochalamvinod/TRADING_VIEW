const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testUrl(targetUrl, screenshotName) {
  console.log(`\n================================================================`);
  console.log(`TESTING: ${targetUrl}`);
  console.log(`================================================================`);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join('C:\\Users\\gocha\\AppData\\Local\\Temp', 'chrome-test-' + Date.now());
  const port = 9250 + Math.floor(Math.random() * 100);

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
    const putResp = await fetch(`http://127.0.0.1:${port}/json/new?${encodeURIComponent(targetUrl)}`, { method: 'PUT' });
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

    console.log('Waiting 12s for TradingView chart & broker initialization...');
    await new Promise(r => setTimeout(r, 12000));

    // Evaluate state in main page
    const stateEval = await call('Runtime.evaluate', {
      expression: `(() => {
        const b = window._mt5Broker;
        return {
          brokerExists: !!b,
          accountData: b ? b._accountData : null,
          positionsCount: b ? Object.keys(b._positionById || {}).length : 0,
          positions: b ? b._getPositionsList() : [],
          ordersCount: b ? Object.keys(b._orderById || {}).length : 0,
          nodeState: !!window.__NODE_SERVER_STATE__,
          nodePositions: window.__NODE_SERVER_STATE__ ? (window.__NODE_SERVER_STATE__.positions || []).length : 0,
          documentTitle: document.title
        };
      })()`,
      returnByValue: true
    });

    const state = stateEval.result?.result?.value || stateEval.result?.value;
    console.log('State evaluation:', JSON.stringify(state, null, 2));

    // Capture screenshot
    const scr = await call('Page.captureScreenshot', { format: 'png' });
    if (scr.result?.data) {
      const outPath = path.join(__dirname, '..', screenshotName);
      fs.writeFileSync(outPath, Buffer.from(scr.result.data, 'base64'));
      console.log(`Saved screenshot to: ${outPath}`);
    }

    // Inspect critical errors
    const errorLogs = consoleLogs.filter(l => l.type === 'error' || l.text.includes('Error') || l.text.includes('Cannot read'));
    console.log(`\nFiltered Error Logs (${errorLogs.length}):`);
    errorLogs.forEach(l => console.log(`  [${l.type}] ${l.text.slice(0, 150)}`));

    console.log(`\nExceptions (${exceptions.length}):`);
    exceptions.forEach(e => console.log(`  [EXCEPTION] ${e.slice(0, 150)}`));

    return {
      state,
      errorCount: errorLogs.length,
      exceptionCount: exceptions.length
    };
  } finally {
    proc.kill();
  }
}

async function run() {
  const res9000 = await testUrl('http://localhost:9000', 'screenshot_test_9000.png');
  const res9999 = await testUrl('http://127.0.0.1:9999', 'screenshot_test_9999.png');

  console.log('\n================================================================');
  console.log('FINAL SUMMARY:');
  console.log('  Port 9000 Broker Exists:', res9000.state?.brokerExists, 'Positions:', res9000.state?.positionsCount);
  console.log('  Port 9999 Broker Exists:', res9999.state?.brokerExists, 'Positions:', res9999.state?.positionsCount);
  console.log('================================================================');
}

run().catch(console.error);
