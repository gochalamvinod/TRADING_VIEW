const { spawn } = require('child_process');
const fs = require('fs');

async function inspect() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9298',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-inspect-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9298/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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
      const innerDoc = iframe ? iframe.contentDocument : null;
      if (!innerDoc) return { error: 'No iframe doc' };

      const btns = Array.from(innerDoc.querySelectorAll('*')).filter(el => {
        const id = el.id || '';
        const name = el.getAttribute('data-name') || '';
        const aria = el.getAttribute('aria-label') || '';
        const title = el.getAttribute('title') || '';
        const t = (id + ' ' + name + ' ' + aria + ' ' + title).toLowerCase();
        return t.includes('indicat') || t.includes('alert') || t.includes('pine');
      }).map(el => ({
        tag: el.tagName,
        id: el.id,
        dataName: el.getAttribute('data-name'),
        aria: el.getAttribute('aria-label'),
        title: el.getAttribute('title'),
        text: el.innerText ? el.innerText.trim().substring(0, 30) : ''
      }));

      // Also check top window
      const topAlertModal = document.getElementById('tv_alert_create_backdrop');
      const topIndModal = document.getElementById('tv_indicators_modal_backdrop');

      return {
        iframeFound: Boolean(iframe),
        btnsCount: btns.length,
        btns: btns.slice(0, 15),
        topAlertModal: Boolean(topAlertModal),
        topIndModal: Boolean(topIndModal)
      };
    })()`,
    returnByValue: true
  });

  console.log('Inspection result:', JSON.stringify(res.result?.result?.value, null, 2));
  ws.close();
  proc.kill();
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
