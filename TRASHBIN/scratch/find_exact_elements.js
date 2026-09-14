const { spawn } = require('child_process');
const fs = require('fs');

async function findExactElements() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9294',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-find-' + Date.now()
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9294/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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

  // Find all elements on the entire page (main + iframes) with 'svg' that have 3 horizontal rects/lines
  const resp = await call('Runtime.evaluate', {
    expression: `(() => {
      const results = [];
      function checkDoc(doc, name) {
        doc.querySelectorAll('button, div[role="button"]').forEach(el => {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            const svg = el.querySelector('svg');
            const lines = el.querySelectorAll('line, rect, path');
            const aria = el.getAttribute('aria-label') || '';
            const title = el.getAttribute('title') || '';
            const dataName = el.getAttribute('data-name') || '';
            results.push({
              doc: name,
              tag: el.tagName,
              aria, title, dataName,
              className: (el.className || '').toString().slice(0, 40),
              x: Math.round(rect.x), y: Math.round(rect.y),
              w: Math.round(rect.width), h: Math.round(rect.height),
              svgCount: el.querySelectorAll('svg').length,
              lineCount: lines.length
            });
          }
        });
      }
      checkDoc(document, 'main');
      document.querySelectorAll('iframe').forEach((ifr, i) => {
        try {
          const idoc = ifr.contentDocument || ifr.contentWindow.document;
          if (idoc) checkDoc(idoc, 'iframe_' + i);
        } catch(e) {}
      });
      return results;
    })()`,
    returnByValue: true
  });

  const all = resp.result?.result?.value || [];
  // Filter for elements with x < 60 (left toolbar)
  const leftToolbar = all.filter(e => e.x < 60);
  console.log('--- LEFT TOOLBAR ELEMENTS ---');
  leftToolbar.forEach(e => console.log(JSON.stringify(e)));

  // Filter for alerts
  const alerts = all.filter(e => e.aria.toLowerCase().includes('alert') || e.title.toLowerCase().includes('alert') || e.dataName.toLowerCase().includes('alert'));
  console.log('--- ALERT ELEMENTS ---');
  alerts.forEach(e => console.log(JSON.stringify(e)));

  ws.close();
  proc.kill();
  process.exit(0);
}

findExactElements().catch(console.error);
