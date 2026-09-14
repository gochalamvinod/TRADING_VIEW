const { spawn } = require('child_process');
const fs = require('fs');

async function testMoreMenuVisual() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-more-menu-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9251',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const putResp = await fetch('http://127.0.0.1:9251/json/new?http://127.0.0.1:9000', { method: 'PUT' });
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

    await new Promise(r => setTimeout(r, 8000));

    // Open dock and click more button
    await call('Runtime.evaluate', {
      expression: `(() => {
        window.PineEditorIDE.open();
        const btn = document.getElementById('pine_more_btn');
        if (btn) btn.click();
      })()`
    });

    await new Promise(r => setTimeout(r, 300));

    const shot = await call('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 1250, y: 0, width: 670, height: 450, scale: 1 }
    });
    fs.writeFileSync('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\verified_more_menu_visible.png', Buffer.from(shot.result.data, 'base64'));
    console.log('Saved verified_more_menu_visible.png');

    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    proc.kill();
  }
}

testMoreMenuVisual();
