const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function testMarketStatus() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join('C:\\Users\\gocha\\AppData\\Local\\Temp', 'chrome-status-' + Date.now());
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9297',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9297/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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
  console.log('Waiting 8s for initial load...');
  await new Promise(r => setTimeout(r, 8000));

  // Ensure symbol is XAUUSD.
  await call('Runtime.evaluate', {
    expression: `new Promise(resolve => {
      window.widget.onChartReady(() => {
        window.widget.activeChart().setSymbol('XAUUSD.', () => {
          setTimeout(resolve, 2000);
        });
      });
    })`,
    awaitPromise: true
  });

  console.log('Switched to XAUUSD., finding status indicator...');
  await new Promise(r => setTimeout(r, 3000));

  // Find status dot and hover/click to show tooltip
  const hoverResult = await call('Runtime.evaluate', {
    expression: `(() => {
      const iframes = document.querySelectorAll('iframe');
      for (const iframe of iframes) {
        try {
          const doc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!doc) continue;
          // Look for market status indicator in legend or header
          const els = doc.querySelectorAll('div, span, button');
          for (const el of els) {
            const className = (el.className || '').toString();
            const dataName = el.getAttribute('data-name') || '';
            const title = el.getAttribute('title') || '';
            const aria = el.getAttribute('aria-label') || '';
            if (
              className.includes('status') || className.includes('market') ||
              dataName.includes('status') || dataName.includes('market') ||
              title.includes('Market') || aria.includes('Market')
            ) {
              const rect = el.getBoundingClientRect();
              if (rect.width > 0 && rect.height > 0 && rect.x > 0) {
                // Hover and click
                el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
                el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
                el.click();
                return { found: true, tag: el.tagName, className, title, aria, x: rect.x, y: rect.y };
              }
            }
          }
        } catch(e) {}
      }
      return { found: false };
    })()`,
    returnByValue: true
  });

  console.log('Hover result:', hoverResult.result?.value);
  await new Promise(r => setTimeout(r, 1500));

  const scr = await call('Page.captureScreenshot', { format: 'png' });
  const outPath = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\screenshot_xauusd_market_closed.png';
  fs.writeFileSync(outPath, Buffer.from(scr.result.data, 'base64'));
  console.log('Saved screenshot to:', outPath);

  ws.close();
  proc.kill();
  process.exit(0);
}

testMarketStatus().catch(err => {
  console.error(err);
  process.exit(1);
});
