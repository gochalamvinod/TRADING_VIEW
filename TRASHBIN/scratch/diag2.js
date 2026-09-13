const { spawn } = require('child_process');

async function test() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-diag2-' + Date.now();
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    '--disable-web-security',
    '--no-sandbox',
    '--window-size=1920,1080',
    '--user-data-dir=' + userDataDir
  ]);
  await new Promise(r => setTimeout(r, 3000));
  const putResp = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:9000', { method: 'PUT' });
  const tabInfo = await putResp.json();
  const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  };
  await new Promise(r => ws.onopen = r);
  function call(method, params = {}) {
    const curId = id++;
    return new Promise((resolve, reject) => {
      pending.set(curId, resolve);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }
  await call('Page.enable');
  await call('Runtime.enable');
  await new Promise(r => setTimeout(r, 12000));

  const res = await call('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(async () => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const doc = iframe?.contentDocument;
      const fxBtn = doc?.querySelector('[data-name="open-indicators-dialog"], button[aria-label*="Indicator"]');
      fxBtn?.click();
      await new Promise(r => setTimeout(r, 1500));

      const inTop = Array.from(document.querySelectorAll('*')).filter(el => el.textContent?.includes('Indicators, metrics, and strategies')).map(el => ({ tag: el.tagName, id: el.id, className: el.className }));
      const inIframe = Array.from(doc?.querySelectorAll('*') || []).filter(el => el.textContent?.includes('Indicators, metrics, and strategies')).map(el => ({ tag: el.tagName, id: el.id, className: el.className }));

      return { inTop, inIframe };
    })()`
  });
  console.log('Dialog location:', JSON.stringify(res.result?.result?.value, null, 2));

  ws.close();
  chromeProc.kill('SIGKILL');
}
test().catch(console.error);
