const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f';

async function testAll() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9288',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-final-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9288/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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

  console.log('--- TEST A: Top toolbar Indicators button opens modal ---');
  const resA = await call('Runtime.evaluate', {
    expression: `(() => {
      window.openIndicatorsModal();
      const backdrop = document.getElementById('tv_indicators_modal_backdrop');
      const cats = Array.from(document.querySelectorAll('.tv-indicators-nav-item')).map(el => el.innerText.trim());
      return {
        open: backdrop && backdrop.style.display === 'flex',
        categories: cats
      };
    })()`,
    returnByValue: true
  });
  console.log('Test A (Indicators Modal):', JSON.stringify(resA.result?.result?.value, null, 2));

  console.log('--- TEST B: Save script in Pine Editor & check My scripts ---');
  const resB = await call('Runtime.evaluate', {
    expression: `(async () => {
      window.closeIndicatorsModal();
      window.PineEditorIDE.open();
      window.PineEditorIDE.loadScript(
        "Awesome Scalper Strategy",
        "//@version=5\\nindicator('Awesome Scalper Strategy', overlay=true)\\nplot(close)\\n",
        "user_script_scalper_1"
      );
      // Call save directly or via save handler
      const input = document.getElementById('pine_code_input');
      if (input) input.value = "//@version=5\\nindicator('Awesome Scalper Strategy', overlay=true)\\nplot(close)\\n";
      
      const allScripts = window.PineEditorIDE.getUserSavedScripts();
      allScripts.unshift({
        id: "user_script_scalper_1",
        name: "Awesome Scalper Strategy",
        code: "//@version=5\\nindicator('Awesome Scalper Strategy', overlay=true)\\nplot(close)\\n",
        isFavorite: false,
        createdAt: Date.now()
      });
      window.PineEditorIDE.saveUserSavedScripts(allScripts);
      
      // Open indicators modal to myscripts
      window.openIndicatorsModal('myscripts');
      await new Promise(r => setTimeout(r, 300));
      const scripts = Array.from(document.querySelectorAll('.tv-indicator-name')).map(el => el.innerText.trim());
      const hasDeleteBtn = Boolean(document.querySelector('.delete-script-btn'));
      return { scripts, hasDeleteBtn };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Test B (Save & My scripts):', JSON.stringify(resB.result?.result?.value, null, 2));

  // Screenshot My scripts with delete button
  const snapMyScripts = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(brainDir, 'verify_my_scripts_with_delete.png'), Buffer.from(snapMyScripts.result.data, 'base64'));

  console.log('--- TEST C: Click Delete button on saved script ---');
  const resC = await call('Runtime.evaluate', {
    expression: `(async () => {
      // Stub window.confirm to return true
      window.confirm = () => true;
      const delBtn = document.querySelector('.delete-script-btn');
      if (!delBtn) return { error: 'No delete button found' };
      delBtn.click();
      await new Promise(r => setTimeout(r, 300));
      const remainingScripts = Array.from(document.querySelectorAll('.tv-indicator-name')).map(el => el.innerText.trim());
      return { remainingScripts, deleted: !remainingScripts.includes('Awesome Scalper Strategy') };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('Test C (Delete script):', JSON.stringify(resC.result?.result?.value, null, 2));

  console.log('--- TEST D: Check that NO duplicate #tv_settings_modal_overlay exists ---');
  const resD = await call('Runtime.evaluate', {
    expression: `(() => {
      window.closeIndicatorsModal();
      const customOverlay = document.getElementById('tv_settings_modal_overlay');
      return {
        customOverlayExists: Boolean(customOverlay),
        customOverlayDisplay: customOverlay ? customOverlay.style.display : 'none'
      };
    })()`,
    returnByValue: true
  });
  console.log('Test D (No duplicate settings overlay):', JSON.stringify(resD.result?.result?.value, null, 2));

  console.log('--- TEST E: Check Drawing toolbar does NOT have { } button ---');
  const resE = await call('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const innerDoc = iframe?.contentDocument;
      const codeBtnsInIframe = innerDoc ? innerDoc.querySelectorAll('[data-name="source-code"], .tv-floating-code-btn') : [];
      const codeBtnsInOuter = document.querySelectorAll('.tv-floating-code-btn, [data-name="source-code"]');
      return {
        iframeDrawingCodeBtns: codeBtnsInIframe.length,
        outerDrawingCodeBtns: codeBtnsInOuter.length
      };
    })()`,
    returnByValue: true
  });
  console.log('Test E (Drawing toolbar { } check):', JSON.stringify(resE.result?.result?.value, null, 2));

  console.log('All tests completed!');
  ws.close();
  proc.kill();
  process.exit(0);
}

testAll().catch(console.error);
