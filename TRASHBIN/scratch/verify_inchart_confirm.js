const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const ARTIFACTS_DIR = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f';

async function testInChartConfirm() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-confirm-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9244',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const putResp = await fetch('http://127.0.0.1:9244/json/new?http://127.0.0.1:9000', { method: 'PUT' });
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
    await call('DOM.enable');

    console.log('Waiting 8s for chart...');
    await new Promise(r => setTimeout(r, 8000));

    // Open Indicators modal
    await call('Runtime.evaluate', {
      expression: `window.PineEditorIDE.openIndicatorsModal('myscripts')`
    });

    await new Promise(r => setTimeout(r, 1000));

    // Trigger delete action on the first delete button or showTVConfirmDialog directly
    console.log('Triggering delete confirm modal...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const delBtn = document.querySelector('.tv-indicators-list .delete-script-btn');
        if (delBtn) {
          delBtn.click();
        } else {
          window.showTradingViewConfirm({
            title: "Delete script",
            message: 'Are you sure you want to delete script "TIME CYCLE"? This action cannot be undone.',
            confirmText: "Delete",
            cancelText: "Cancel",
            isDanger: true
          });
        }
      })()`
    });

    await new Promise(r => setTimeout(r, 1000));

    // Capture screenshot
    console.log('Capturing screenshot of in-chart confirm dialog...');
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.join(ARTIFACTS_DIR, 'verified_inchart_confirm_dialog.png');
    fs.writeFileSync(shotPath, Buffer.from(shot.result.data, 'base64'));
    console.log('Saved to:', shotPath);

    ws.close();
  } catch(err) {
    console.error('Error:', err);
  } finally {
    proc.kill();
  }
}

testInChartConfirm();
