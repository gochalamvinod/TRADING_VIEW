const { spawn } = require('child_process');

async function test() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9288',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-std-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9288/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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

  const res = await call('Runtime.evaluate', {
    expression: `(async () => {
      const widget = window.widget || window._widget;
      if (!widget) return { err: 'no widget' };
      const ch = widget.activeChart();
      if (!ch) return { err: 'no active chart' };
      const repo = (typeof ch.studyMetaInfoRepository === 'function') ? ch.studyMetaInfoRepository() : null;
      if (!repo) return { err: 'no repo' };
      const javaStudies = await repo.findAllJavaStudies();
      return {
        count: javaStudies.length,
        items: javaStudies.map(s => ({
          id: s.id,
          name: s.description || s.shortDescription || s.id,
          isOverlay: Boolean(s.is_price_study)
        }))
      };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Full res:', JSON.stringify(res, null, 2));
  console.log('Sample items:', JSON.stringify(res.result?.result?.value?.items?.slice(0, 40), null, 2));
  ws.close();
  proc.kill();
  process.exit(0);
}
test().catch(console.error);
