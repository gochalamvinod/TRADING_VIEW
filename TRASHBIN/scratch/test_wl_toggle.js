const { spawn } = require('child_process');
const fs = require('fs');

async function testWatchlistToggle() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9285',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-wl-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9285/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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
  await new Promise(r => setTimeout(r, 6000));

  // 1. Open Pine Editor
  await call('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const doc = iframe?.contentDocument;
      doc?.querySelector('[data-name="pine-editor"]')?.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));

  // Take screenshot 1 (Pine open, Watchlist open)
  const snap1 = await call('Page.captureScreenshot');
  fs.writeFileSync('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\wl_state_1.png', Buffer.from(snap1.result.data, 'base64'));

  // 2. Click Watchlist button (base)
  const clickRes = await call('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const doc = iframe?.contentDocument;
      const btn = doc?.querySelector('[data-name="base"]');
      if (!btn) return 'not found';
      btn.click();
      return 'clicked';
    })()`
  });
  console.log('Click result:', clickRes);
  await new Promise(r => setTimeout(r, 1000));

  // Take screenshot 2 (After clicking Watchlist)
  const snap2 = await call('Page.captureScreenshot');
  fs.writeFileSync('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\wl_state_2.png', Buffer.from(snap2.result.data, 'base64'));

  ws.close();
  proc.kill();
  process.exit(0);
}
testWatchlistToggle().catch(console.error);
