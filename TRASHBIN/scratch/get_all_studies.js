const { spawn } = require('child_process');

async function getStudies() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9281',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-studies2-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9281/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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
      ch.executeActionById('insertIndicator');
      await new Promise(r => setTimeout(r, 1000));
      const iframe = document.querySelector('#tv_chart_container iframe');
      const idoc = iframe?.contentDocument;
      if (!idoc) return 'no idoc';
      // Find the dialog container
      const dialog = idoc.querySelector('[data-name="indicators-dialog"]') || idoc.querySelector('[class*="dialog-"]') || idoc.body;
      const rows = idoc.querySelectorAll('[class*="item-"], [class*="cell-"], [role="row"], [data-role="list-item"]');
      const names = new Set();
      rows.forEach(r => {
        const text = (r.innerText || '').trim().split('\\n')[0];
        if (text && text.length > 2 && text.length < 50 && !text.includes('SCRIPT NAME') && !text.includes('Search') && !text.includes('Favorites') && !text.includes('Indicators')) {
          names.add(text);
        }
      });
      return Array.from(names);
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Result count:', res.result?.result?.value?.length);
  console.log('Result names:', JSON.stringify(res.result?.result?.value, null, 2));
  ws.close();
  proc.kill();
  process.exit(0);
}
getStudies().catch(console.error);
