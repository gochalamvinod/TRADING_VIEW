const { spawn } = require('child_process');

async function inspectBanner() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9295',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-banner-' + Date.now()
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
  await new Promise(r => setTimeout(r, 6000));

  const evalRes = await call('Runtime.evaluate', {
    expression: `(() => {
      window.openScriptForStudy('Relative Strength Index');
      const b = document.getElementById('pine_readonly_banner');
      if (!b) return { error: 'No banner' };
      const rect = b.getBoundingClientRect();
      const style = window.getComputedStyle(b);
      return {
        rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
        display: style.display,
        visibility: style.visibility,
        zIndex: style.zIndex,
        parent: b.parentElement ? (b.parentElement.id || b.parentElement.className) : 'none',
        html: b.outerHTML
      };
    })()`,
    returnByValue: true
  });
  console.log('Banner inspect:', JSON.stringify(evalRes.result?.result?.value, null, 2));
  ws.close();
  proc.kill();
  process.exit(0);
}
inspectBanner().catch(console.error);
