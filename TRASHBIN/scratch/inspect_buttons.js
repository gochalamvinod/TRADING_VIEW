const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function inspectButtons() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join('C:\\Users\\gocha\\AppData\\Local\\Temp', 'chrome-btn-inspect-' + Date.now());
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9295',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
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
  await new Promise(r => setTimeout(r, 8000));

  // Inspect the left toolbar buttons around y: 550 - 650
  const leftBtns = await call('Runtime.evaluate', {
    expression: `(() => {
      const results = [];
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) continue;
          const all = doc.querySelectorAll('button, div[role="button"], [class*="button"]');
          for (const el of all) {
            const rect = el.getBoundingClientRect();
            if (rect.x >= 0 && rect.x <= 60 && rect.y >= 500 && rect.y <= 700 && rect.width > 0) {
              results.push({
                tag: el.tagName,
                dataName: el.getAttribute('data-name'),
                aria: el.getAttribute('aria-label'),
                title: el.getAttribute('title'),
                className: (el.className || '').toString().slice(0, 50),
                innerHTML: el.innerHTML.slice(0, 150),
                rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
              });
            }
          }
        } catch(e) {}
      }
      return results;
    })()`,
    returnByValue: true
  });

  console.log('Left toolbar buttons (y 500-700):', JSON.stringify(leftBtns.result?.value, null, 2));

  // Also inspect the Alerts button on the right sidebar (Image 3)
  const alertBtns = await call('Runtime.evaluate', {
    expression: `(() => {
      const results = [];
      // Check document
      document.querySelectorAll('[data-name*="alert"], [class*="alert"], [title*="Alert"], [aria-label*="Alert"]').forEach(el => {
        const rect = el.getBoundingClientRect();
        results.push({ context: 'main', tag: el.tagName, id: el.id, title: el.getAttribute('title'), aria: el.getAttribute('aria-label'), rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } });
      });
      // Check iframes
      document.querySelectorAll('iframe').forEach((iframe, idx) => {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) return;
          doc.querySelectorAll('[data-name*="alert"], [class*="alert"], [title*="Alert"], [aria-label*="Alert"]').forEach(el => {
            const rect = el.getBoundingClientRect();
            results.push({ context: 'iframe' + idx, tag: el.tagName, dataName: el.getAttribute('data-name'), title: el.getAttribute('title'), aria: el.getAttribute('aria-label'), rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height } });
          });
        } catch(e) {}
      });
      return results;
    })()`,
    returnByValue: true
  });

  console.log('Alert buttons found:', JSON.stringify(alertBtns.result?.value, null, 2));

  ws.close();
  proc.kill();
  process.exit(0);
}

inspectButtons().catch(console.error);
