const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f';

async function captureModalHover() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9295',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-ind-' + Date.now()
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
  await call('DOM.enable');
  await new Promise(r => setTimeout(r, 6000));

  // Open indicators modal and hover over the first row
  await call('Runtime.evaluate', {
    expression: `(() => {
      window.openIndicatorsModal('technicals');
      const row = document.querySelector('.tv-indicator-row');
      if (row) {
        row.classList.add('hover');
        const actions = row.querySelector('.tv-indicator-actions');
        if (actions) actions.style.display = 'flex';
      }
    })()`
  });

  await new Promise(r => setTimeout(r, 500));
  const snap = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(brainDir, 'snap_indicators_modal_hover.png'), Buffer.from(snap.result.data, 'base64'));
  console.log('Saved snap_indicators_modal_hover.png');

  ws.close();
  proc.kill();
  process.exit(0);
}
captureModalHover().catch(console.error);
