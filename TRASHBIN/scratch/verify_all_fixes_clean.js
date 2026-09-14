const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f';

async function verifyAll() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9292',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-vclean-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9292/json/new?http://127.0.0.1:9999', { method: 'PUT' });
  const tab = await putResp.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();
  const consoleErrors = [];

  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.method === 'Runtime.consoleAPICalled') {
      if (d.params.type === 'error' || d.params.type === 'warning') {
        const text = (d.params.args || []).map(a => a.value || a.description || '').join(' ');
        if (text.includes('Error delegating') || text.includes('Maximum call stack')) {
          consoleErrors.push(text);
        }
      }
    }
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

  console.log('--- TEST 1: Indicators Modal and 3 Categories ---');
  const t1 = await call('Runtime.evaluate', {
    expression: `(() => {
      window.openIndicatorsModal('technicals');
      const cats = Array.from(document.querySelectorAll('.tv-indicators-nav-item')).map(el => el.innerText.trim());
      const totalBuiltins = document.querySelectorAll('.tv-indicator-row').length;
      return { cats, totalBuiltins };
    })()`,
    returnByValue: true
  });
  console.log('Test 1 (Modal & Technicals):', JSON.stringify(t1.result?.result?.value, null, 2));

  console.log('--- TEST 2: Save Script and View in My Scripts ---');
  const t2 = await call('Runtime.evaluate', {
    expression: `(() => {
      // Seed a user script into tv_pine_user_scripts
      const scripts = [
        {
          id: 'user_script_custom_scalper',
          name: 'SuperTrend Dynamic Scalper',
          code: '//@version=5\\nindicator("SuperTrend Dynamic Scalper", overlay=true)\\nplot(close)\\n',
          isFavorite: false,
          createdAt: Date.now()
        }
      ];
      localStorage.setItem('tv_pine_user_scripts', JSON.stringify(scripts));

      // Switch to My scripts
      window.openIndicatorsModal('myscripts');
      const scriptNames = Array.from(document.querySelectorAll('.tv-indicator-name')).map(el => el.innerText.trim());
      const delBtn = document.querySelector('.delete-script-btn');
      return { scriptNames, hasDeleteBtn: Boolean(delBtn) };
    })()`,
    returnByValue: true
  });
  console.log('Test 2 (My Scripts list & Delete button):', JSON.stringify(t2.result?.result?.value, null, 2));

  // Screenshot of My scripts showing the saved script and the red delete button
  const snap1 = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(brainDir, 'snap_myscripts_with_delete.png'), Buffer.from(snap1.result.data, 'base64'));

  console.log('--- TEST 3: Click Delete Button -> Confirmation Dialog ---');
  const t3 = await call('Runtime.evaluate', {
    expression: `(() => {
      const delBtn = document.querySelector('.delete-script-btn');
      if (delBtn) delBtn.click();
      const confirmOverlay = document.getElementById('tv_confirm_dialog_overlay');
      const confirmTitle = confirmOverlay?.querySelector('div > div')?.innerText;
      return {
        confirmDialogVisible: Boolean(confirmOverlay),
        confirmTitle: confirmTitle
      };
    })()`,
    returnByValue: true
  });
  console.log('Test 3 (Delete confirmation dialog):', JSON.stringify(t3.result?.result?.value, null, 2));

  // Screenshot of confirm dialog
  const snap2 = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(brainDir, 'snap_delete_confirm_dialog.png'), Buffer.from(snap2.result.data, 'base64'));

  console.log('--- TEST 4: Confirm Delete -> Script Removed ---');
  const t4 = await call('Runtime.evaluate', {
    expression: `(() => {
      const actionBtn = document.querySelector('#tv_confirm_action');
      if (actionBtn) actionBtn.click();
      const remainingNames = Array.from(document.querySelectorAll('.tv-indicator-name')).map(el => el.innerText.trim());
      const storageAfter = JSON.parse(localStorage.getItem('tv_pine_user_scripts') || '[]');
      return {
        remainingNames,
        storageCount: storageAfter.length,
        deletedSuccessfully: !remainingNames.includes('SuperTrend Dynamic Scalper')
      };
    })()`,
    returnByValue: true
  });
  console.log('Test 4 (Script deleted successfully):', JSON.stringify(t4.result?.result?.value, null, 2));

  console.log('--- TEST 5: Verify NO { } on Drawing Toolbar ---');
  const t5 = await call('Runtime.evaluate', {
    expression: `(() => {
      window.closeIndicatorsModal();
      const iframe = document.querySelector('#tv_chart_container iframe');
      const innerDoc = iframe?.contentDocument;
      const iframeCodeBtns = innerDoc ? Array.from(innerDoc.querySelectorAll('[data-name="source-code"], .tv-floating-code-btn')) : [];
      const outerCodeBtns = Array.from(document.querySelectorAll('.tv-floating-code-btn, [data-name="source-code"]'));
      return {
        iframeDrawingCodeBtns: iframeCodeBtns.length,
        outerDrawingCodeBtns: outerCodeBtns.length
      };
    })()`,
    returnByValue: true
  });
  console.log('Test 5 (Drawing toolbar { } check):', JSON.stringify(t5.result?.result?.value, null, 2));

  console.log('--- TEST 6: Verify Zero Recursion Errors on Settings ---');
  const t6 = await call('Runtime.evaluate', {
    expression: `(() => {
      if (window.PineIndicators && typeof window.PineIndicators.openSettingsDialog === 'function') {
        window.PineIndicators.openSettingsDialog('test_study');
      }
      return {
        noOverlayExists: !document.getElementById('tv_settings_modal_overlay')
      };
    })()`,
    returnByValue: true
  });
  console.log('Test 6 (Settings Dialog & Recursion check):', JSON.stringify(t6.result?.result?.value, null, 2));
  console.log('Total recursion/call stack errors detected:', consoleErrors.length);

  ws.close();
  proc.kill();
  process.exit(0);
}

verifyAll().catch(console.error);
