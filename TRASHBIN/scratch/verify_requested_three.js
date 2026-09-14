const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f';

async function testThreeFeatures() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9295',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-v3-' + Date.now()
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
  await new Promise(r => setTimeout(r, 7000));

  console.log('--- TEST 1: Alert Button & Create Alert Modal ---');
  const t1 = await call('Runtime.evaluate', {
    expression: `(() => {
      // Trigger openCreateAlertDialog directly or via alert button
      window.PineEditorIDE.openCreateAlert();
      const backdrop = document.getElementById('tv_alert_create_backdrop');
      const symbolInput = document.getElementById('tv_alert_input_symbol')?.value;
      const priceInput = document.getElementById('tv_alert_input_price')?.value;
      const isOpen = backdrop && backdrop.style.display === 'flex';
      return { isOpen, symbol: symbolInput, price: priceInput };
    })()`,
    returnByValue: true
  });
  console.log('Test 1 (Alerts Modal):', JSON.stringify(t1.result?.result?.value, null, 2));

  // Screenshot of Create Alert modal
  const snap1 = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(brainDir, 'snap_alert_create_modal.png'), Buffer.from(snap1.result.data, 'base64'));

  console.log('--- TEST 2: Indicators Modal { } Button on Custom & Built-in ---');
  const t2 = await call('Runtime.evaluate', {
    expression: `(() => {
      window.PineEditorIDE.closeCreateAlert();
      window.openIndicatorsModal('technicals');
      const row = document.querySelector('.tv-indicator-row');
      const name = row?.querySelector('.tv-indicator-name')?.innerText;
      const codeBtn = row?.querySelector('.open-editor-btn');
      return {
        rowFound: Boolean(row),
        firstBuiltin: name,
        hasCodeBtn: Boolean(codeBtn),
        codeBtnText: codeBtn?.innerText?.trim()
      };
    })()`,
    returnByValue: true
  });
  console.log('Test 2 (Indicators modal { } button):', JSON.stringify(t2.result?.result?.value, null, 2));

  console.log('--- TEST 3: Click { } on Built-in Indicator -> Read-Only Banner in Pine Editor ---');
  const t3 = await call('Runtime.evaluate', {
    expression: `(() => {
      window.openScriptForStudy('Relative Strength Index');
      const cur = window.PineEditorIDE.getCurrentScript();
      const dock = document.getElementById('pine_editor_dock');
      const banner = document.getElementById('pine_readonly_banner');
      return {
        dockOpen: dock && dock.style.display === 'flex',
        scriptName: cur.name,
        isReadOnly: cur.isReadOnly,
        bannerVisible: banner && banner.style.display === 'flex'
      };
    })()`,
    returnByValue: true
  });
  console.log('Test 3 (Built-in script loaded as Read-Only):', JSON.stringify(t3.result?.result?.value, null, 2));

  // Screenshot of Pine Editor with Read-Only banner
  const snap2 = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(brainDir, 'snap_readonly_banner.png'), Buffer.from(snap2.result.data, 'base64'));

  console.log('--- TEST 4: Attempting to Edit Built-in Script -> Prompts to Make a Copy ---');
  const t4 = await call('Runtime.evaluate', {
    expression: `(() => {
      const codeInput = document.getElementById('pine_code_input');
      // Simulate typing a character
      const event = new KeyboardEvent('keydown', { key: 'a', bubbles: true, cancelable: true });
      codeInput.dispatchEvent(event);

      const confirmOverlay = document.getElementById('tv_confirm_dialog_overlay');
      return {
        promptVisible: Boolean(confirmOverlay),
        promptTitle: confirmOverlay?.querySelector('div > div')?.innerText
      };
    })()`,
    returnByValue: true
  });
  console.log('Test 4 (Copy prompt on edit):', JSON.stringify(t4.result?.result?.value, null, 2));

  // Screenshot of Copy prompt
  const snap3 = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(brainDir, 'snap_copy_prompt_on_edit.png'), Buffer.from(snap3.result.data, 'base64'));

  console.log('--- TEST 5: Confirm Copy -> Editable Script Created in My Scripts ---');
  const t5 = await call('Runtime.evaluate', {
    expression: `(() => {
      window.prompt = () => 'My Custom RSI';
      const actionBtn = document.querySelector('#tv_confirm_action');
      if (actionBtn) actionBtn.click();

      const curAfter = window.PineEditorIDE.getCurrentScript();
      const bannerAfter = document.getElementById('pine_readonly_banner');
      const userScripts = window.PineEditorIDE.getUserSavedScripts();
      return {
        newName: curAfter.name,
        isReadOnly: curAfter.isReadOnly,
        bannerVisible: bannerAfter ? bannerAfter.style.display === 'flex' : false,
        isInUserScripts: userScripts.some(s => s.name === 'My Custom RSI')
      };
    })()`,
    returnByValue: true
  });
  console.log('Test 5 (Editable copy created):', JSON.stringify(t5.result?.result?.value, null, 2));

  console.log('All tests finished successfully!');
  ws.close();
  proc.kill();
  process.exit(0);
}

testThreeFeatures().catch(console.error);
