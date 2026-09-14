const { spawn } = require('child_process');

async function test() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9280',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-study-test-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9280/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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
    expression: `(async () => {
      const ch = window.widget?.activeChart?.() || window._chartWidget?.activeChart?.();
      if (!ch) return 'no chart';
      try {
        const r1 = await ch.createStudy('Moving Average', false, false);
        const r2 = await ch.createStudy('Relative Strength Index', false, false);
        const r3 = await ch.createStudy('Bollinger Bands', false, false);
        const allStudies = ch.getAllStudies?.() || [];
        return { r1, r2, r3, allStudies };
      } catch (err) {
        return { error: err.message };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Result:', JSON.stringify(res.result?.result?.value, null, 2));
  ws.close();
  proc.kill();
  process.exit(0);
}
test().catch(console.error);
