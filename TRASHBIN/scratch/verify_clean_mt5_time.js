const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testCleanChart() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join('C:\\Users\\gocha\\AppData\\Local\\Temp', 'chrome-clean-' + Date.now());
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9295',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9295/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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
          chart.setResolution('1S', () => resolve(true));
        });
      });
    })`,
    awaitPromise: true
  });

  console.log('Switched to BTCUSD 1S, waiting 4s for render...');
  await new Promise(r => setTimeout(r, 4000));

  const scr = await call('Page.captureScreenshot', { format: 'png' });
  const outPath = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\screenshot_clean_mt5_sync.png';
  fs.writeFileSync(outPath, Buffer.from(scr.result.data, 'base64'));
  console.log('Saved screenshot to:', outPath);

  ws.close();
  proc.kill();
  process.exit(0);
}

testCleanChart().catch(err => {
  console.error(err);
  process.exit(1);
});
