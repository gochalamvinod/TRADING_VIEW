const { spawn } = require('child_process');
const fs = require('fs');

async function test() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9279',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-native-dlg-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9279/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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

  const res = await call('Runtime.evaluate', {
    expression: `(() => {
      const ch = window.widget?.activeChart?.() || window._chartWidget?.activeChart?.();
      if (!ch) return 'no chart';
      try {
        ch.executeActionById('insertIndicator');
        return 'executed insertIndicator';
      } catch (err) {
        return { error: err.message };
      }
    })()`,
    returnByValue: true
  });
  console.log('Result:', JSON.stringify(res.result?.result?.value));
  await new Promise(r => setTimeout(r, 1000));

  // Screenshot
  const snap = await call('Page.captureScreenshot');
  fs.writeFileSync('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\native_indicator_snap.png', Buffer.from(snap.result.data, 'base64'));

  ws.close();
  proc.kill();
  process.exit(0);
}
test().catch(console.error);
