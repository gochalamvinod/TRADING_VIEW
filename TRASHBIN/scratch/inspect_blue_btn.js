const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function inspect() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9292',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-blue-' + Date.now()
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9292/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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

  // Open Pine Editor tab first
  await call('Runtime.evaluate', {
    expression: `(() => {
      // Find Pine Editor button in bottom dock
      const btn = Array.from(document.querySelectorAll('button, div[role="tab"]')).find(b => b.innerText && b.innerText.includes('Pine Editor'));
      if (btn) btn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 2000));

  const res = await call('Runtime.evaluate', {
    expression: `(() => {
      const items = [];
      function check(doc, docName) {
        if (!doc) return;
        const els = doc.querySelectorAll('*');
        for (const el of els) {
          const rect = el.getBoundingClientRect();
          if (rect.width <= 0 || rect.height <= 0) continue;
          const comp = window.getComputedStyle(el);
          const bg = comp.backgroundColor || '';
          const border = comp.borderColor || '';
          // Blue check: rgba or rgb with strong blue
          const isBlueBg = (bg.includes('29, 99') || bg.includes('41, 98') || bg.includes('0, 122') || bg.includes('41, 98, 255') || bg.includes('21, 101, 192'));
          const isBlueBorder = (border.includes('41, 98') || border.includes('29, 99'));
          const isSvg = el.tagName.toLowerCase() === 'svg' || el.querySelector('svg');
          if ((isBlueBg || isBlueBorder) && rect.width < 100 && rect.height < 100) {
            items.push({
              doc: docName,
              tag: el.tagName,
              id: el.id,
              class: (el.className || '').toString().slice(0, 50),
              title: el.getAttribute('title'),
              aria: el.getAttribute('aria-label'),
              dataName: el.getAttribute('data-name'),
              x: Math.round(rect.x), y: Math.round(rect.y),
              w: Math.round(rect.width), h: Math.round(rect.height),
              bg, border,
              html: el.outerHTML.slice(0, 200)
            });
          }
        }
      }
      check(document, 'main');
      document.querySelectorAll('iframe').forEach((ifr, i) => {
        try {
          const idoc = ifr.contentDocument || ifr.contentWindow.document;
          check(idoc, 'iframe_' + i);
        } catch(e) {}
      });
      return items;
    })()`,
    returnByValue: true
  });

  console.log('Results:', JSON.stringify(res.result?.value, null, 2));

  ws.close();
  proc.kill();
  process.exit(0);
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
