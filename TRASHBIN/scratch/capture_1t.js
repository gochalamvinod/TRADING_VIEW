const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function test1T() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join('C:\\Users\\gocha\\AppData\\Local\\Temp', 'chrome-1t-' + Date.now());
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9272',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9272/json/new?http://127.0.0.1:9000', { method: 'PUT' });
  const tab = await putResp.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);

  let id = 1;
  const pending = new Map();
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.id && pending.has(d.id)) pending.get(d.id)(d);
  };
  await new Promise(r => ws.onopen = r);

  const call = (method, params = {}) => new Promise(res => {
    const cid = id++;
    pending.set(cid, res);
    ws.send(JSON.stringify({ id: cid, method, params }));
  });

  await call('Page.enable');
  await call('Runtime.enable');
  await new Promise(r => setTimeout(r, 7000));

  await call('Runtime.evaluate', {
    expression: `new Promise(resolve => {
      window.widget.onChartReady(() => {
        const chart = window.widget.activeChart();
        chart.setSymbol('BTCUSD', () => {
          chart.setResolution('1T', () => resolve(true));
        });
      });
    })`,
    awaitPromise: true
  });

  console.log('Switched to BTCUSD 1T, streaming live ticks for 5 seconds...');
  await new Promise(r => setTimeout(r, 5000));

  const scr = await call('Page.captureScreenshot', { format: 'png' });
  const outPath = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\screenshot_btree_1T.png';
  fs.writeFileSync(outPath, Buffer.from(scr.result.data, 'base64'));
  console.log('Saved 1T screenshot to:', outPath);

  ws.close();
  proc.kill();
  process.exit(0);
}

test1T().catch(err => {
  console.error(err);
  process.exit(1);
});
