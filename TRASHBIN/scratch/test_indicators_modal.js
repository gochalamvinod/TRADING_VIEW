const { spawn } = require('child_process');
const fs = require('fs');

async function testModal() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9276',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-ind-snap-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9276/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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

  // 1. Open Indicators modal
  await call('Runtime.evaluate', {
    expression: `(() => {
      window.openIndicatorsModal('technicals');
    })()`
  });
  await new Promise(r => setTimeout(r, 800));

  // Inspect sidebar categories and items
  const state1 = await call('Runtime.evaluate', {
    expression: `(() => {
      const categories = Array.from(document.querySelectorAll('.tv-indicators-nav-item')).map(el => el.innerText.trim());
      const items = Array.from(document.querySelectorAll('.tv-indicator-name')).slice(0, 15).map(el => el.innerText.trim());
      const totalItems = document.querySelectorAll('.tv-indicator-row').length;
      return { categories, totalItems, sampleItems: items };
    })()`,
    returnByValue: true
  });
  console.log('Indicators Modal (Technicals):', JSON.stringify(state1.result?.result?.value, null, 2));

  // Screenshot 1: Technicals built-ins
  const snap1 = await call('Page.captureScreenshot');
  fs.writeFileSync('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\indicators_technicals_snap.png', Buffer.from(snap1.result.data, 'base64'));

  // 2. Click "My scripts" tab
  await call('Runtime.evaluate', {
    expression: `(() => {
      const myScriptsTab = Array.from(document.querySelectorAll('.tv-indicators-nav-item')).find(el => el.innerText.includes('My scripts'));
      if (myScriptsTab) myScriptsTab.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 500));

  // Screenshot 2: My scripts (empty clean state)
  const snap2 = await call('Page.captureScreenshot');
  fs.writeFileSync('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\indicators_myscripts_snap.png', Buffer.from(snap2.result.data, 'base64'));

  // 3. Close modal, open Pine Editor, save a new script "My EMA Strategy", and re-open modal
  await call('Runtime.evaluate', {
    expression: `(() => {
      window.closeIndicatorsModal();
      window.PineEditorIDE.open();
      // Set script name to "My EMA Strategy"
      const nameDisp = document.getElementById('pine_script_title_display');
      if (nameDisp) nameDisp.textContent = "My EMA Strategy";
      window.PineEditorIDE.loadScript("My EMA Strategy", "//@version=5\\nindicator('My EMA Strategy', overlay=true)\\nplot(ta.ema(close, 20))", "test_ema_1");
      // Click save
      document.getElementById('pine_menu_save_script')?.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 1000));

  // Re-open Indicators modal on My scripts
  await call('Runtime.evaluate', {
    expression: `(() => {
      window.openIndicatorsModal('myscripts');
    })()`
  });
  await new Promise(r => setTimeout(r, 600));

  const state3 = await call('Runtime.evaluate', {
    expression: `(() => {
      const items = Array.from(document.querySelectorAll('.tv-indicator-name')).map(el => el.innerText.trim());
      return items;
    })()`,
    returnByValue: true
  });
  console.log('My scripts after saving "My EMA Strategy":', JSON.stringify(state3.result?.result?.value, null, 2));

  // Screenshot 3: My scripts showing saved script
  const snap3 = await call('Page.captureScreenshot');
  fs.writeFileSync('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\indicators_saved_script_snap.png', Buffer.from(snap3.result.data, 'base64'));

  ws.close();
  proc.kill();
  process.exit(0);
}
testModal().catch(console.error);
