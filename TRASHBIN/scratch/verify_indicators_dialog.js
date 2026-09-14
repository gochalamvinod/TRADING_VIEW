const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f';

async function testIndicators() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-ind-verify-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9235',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const putResp = await fetch('http://127.0.0.1:9235/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);
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
    console.log('Waiting 8s for chart initialization...');
    await new Promise(r => setTimeout(r, 8000));

    // Click the Indicators button in iframe
    console.log('Simulating click on Indicators button in iframe...');
    const clickRes = await call('Runtime.evaluate', {
      expression: `(function() {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe ? (iframe.contentDocument || iframe.contentWindow.document) : document;
        const btn = doc.querySelector('#header-toolbar-indicators, [data-name="indicators"], div[id*="indicators"]');
        if (btn) {
          btn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: window }));
          return { clicked: true, tag: btn.tagName, id: btn.id };
        }
        return { clicked: false, error: 'Button not found' };
      })()`,
      returnByValue: true
    });
    console.log('Click result:', clickRes.result.value);

    await new Promise(r => setTimeout(r, 1500));

    // Take screenshot of chart with Indicators modal open
    console.log('Capturing screenshot of Indicators dialog...');
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.join(ARTIFACTS_DIR, 'verified_indicators_dialog_opened.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.result.data, 'base64'));
    console.log('Saved screenshot to:', shotPath);

    ws.close();
  } catch(err) {
    console.error('Error during test:', err);
  } finally {
    proc.kill();
  }
}

testIndicators();
