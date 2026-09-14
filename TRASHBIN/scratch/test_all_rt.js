const { spawn } = require('child_process');
const fs = require('fs');

async function testAllRtButtons() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9286',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-rt-test-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9286/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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

  // Capture screenshot of initial state
  const snap1 = await call('Page.captureScreenshot');
  fs.writeFileSync('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\rt_snap_initial.png', Buffer.from(snap1.result.data, 'base64'));

  // Click Alerts button
  const alertClick = await call('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const doc = iframe?.contentDocument;
      const btn = doc?.querySelector('[data-name="alerts"]');
      if (!btn) return 'no alert btn';
      btn.click();
      return 'alert clicked';
    })()`
  });
  console.log('Alert clicked:', alertClick.result);
  await new Promise(r => setTimeout(r, 1000));
  const snap2 = await call('Page.captureScreenshot');
  fs.writeFileSync('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\rt_snap_alert.png', Buffer.from(snap2.result.data, 'base64'));

  // Open Pine Editor
  const pineClick = await call('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const doc = iframe?.contentDocument;
      const btn = doc?.querySelector('[data-name="pine-editor"]');
      if (!btn) return 'no pine btn';
      btn.click();
      return 'pine clicked';
    })()`
  });
  console.log('Pine clicked:', pineClick.result);
  await new Promise(r => setTimeout(r, 1000));
  const snap3 = await call('Page.captureScreenshot');
  fs.writeFileSync('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\rt_snap_pine.png', Buffer.from(snap3.result.data, 'base64'));

  ws.close();
  proc.kill();
  process.exit(0);
}
testAllRtButtons().catch(console.error);
