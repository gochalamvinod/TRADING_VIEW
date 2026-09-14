const { spawn } = require('child_process');

async function check() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9290',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-rt-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9290/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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
      const iframe = document.querySelector('#tv_chart_container iframe');
      const doc = iframe?.contentDocument;
      if (!doc) return 'no doc';
      const rt = doc.querySelector('[data-name="right-toolbar"]');
      if (!rt) return 'no rt';
      const btns = rt.querySelectorAll('button, [role="button"]');
      return Array.from(btns).map(b => {
        const rect = b.getBoundingClientRect();
        return {
          name: b.getAttribute('data-name'),
          aria: b.getAttribute('aria-label'),
          title: b.getAttribute('title'),
          tooltip: b.getAttribute('data-tooltip'),
          className: b.className,
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          svg: b.querySelector('svg')?.outerHTML.slice(0, 200)
        };
      });
    })()`,
    returnByValue: true
  });
  console.log('res:', JSON.stringify(res, null, 2));
  ws.close();
  proc.kill();
  process.exit(0);
}
check().catch(console.error);
