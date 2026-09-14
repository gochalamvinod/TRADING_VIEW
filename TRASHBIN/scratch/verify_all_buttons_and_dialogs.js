const { spawn } = require('child_process');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f';

async function verifyAllButtonsAndDialogs() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-verify-all-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9252',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const putResp = await fetch('http://127.0.0.1:9252/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();
    const logs = [];

    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled') {
        logs.push({ type: d.params.type, text: d.params.args.map(a => a.value || a.description).join(' ') });
      }
      if (d.method === 'Page.javascriptDialogOpening') {
        // DETECT NATIVE BROWSER DIALOG!
        logs.push({ type: 'NATIVE_BROWSER_DIALOG_DETECTED', message: d.params.message, dialogType: d.params.type });
        call('Page.handleJavaScriptDialog', { accept: true });
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

    console.log('Waiting 8s for chart load...');
    await new Promise(r => setTimeout(r, 8000));

    // TEST 1: Open Pine Editor Dock
    console.log('1. Testing Pine Editor Dock Open...');
    await call('Runtime.evaluate', {
      expression: `window.PineEditorIDE.open()`
    });
    await new Promise(r => setTimeout(r, 500));

    // TEST 2: Click Pine Editor More Options (•••)
    console.log('2. Testing Pine Editor 3-Dots Button Click...');
    const moreRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const moreBtn = document.getElementById('pine_more_btn');
        const moreMenu = document.getElementById('pine_more_menu');
        if (!moreBtn || !moreMenu) return { success: false, reason: 'Buttons missing' };
        moreBtn.click();
        return {
          success: true,
          isOpen: moreMenu.classList.contains('show'),
          display: window.getComputedStyle(moreMenu).display,
          itemsCount: moreMenu.querySelectorAll('.pine-menu-item-v2').length
        };
      })()`,
      returnByValue: true
    });
    console.log('More menu test:', moreRes.result?.result?.value);

    // Capture screenshot of opened more menu
    const shot1 = await call('Page.captureScreenshot', {
      format: 'png',
      clip: { x: 1200, y: 0, width: 720, height: 450, scale: 1 }
    });
    fs.writeFileSync(ARTIFACTS_DIR + '\\verified_more_menu_final.png', Buffer.from(shot1.result.data, 'base64'));

    // TEST 3: Click "Editor settings..." inside More Menu
    console.log('3. Testing Editor Settings Modal Open...');
    const settingsRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const settingsItem = document.getElementById('pine_menu_editor_settings');
        if (settingsItem) settingsItem.click();
        const modal = document.getElementById('pine_editor_settings_modal');
        return {
          modalOpened: !!modal,
          display: modal ? window.getComputedStyle(modal).display : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Editor settings modal test:', settingsRes.result?.result?.value);

    const shot2 = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(ARTIFACTS_DIR + '\\verified_editor_settings_dialog.png', Buffer.from(shot2.result.data, 'base64'));

    // Close editor settings modal
    await call('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.getElementById('pine_editor_settings_modal');
        if (modal) modal.remove();
      })()`
    });

    // TEST 4: Click "Create new" script (test authentic modal instead of prompt)
    console.log('4. Testing Create New Script In-Chart Modal...');
    const newScriptRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const newBtn = document.getElementById('pine_menu_create_new');
        if (newBtn) newBtn.click();
        const modal = document.getElementById('tv_new_script_modal');
        return {
          modalOpened: !!modal,
          optionsCount: modal ? modal.querySelectorAll('.tv-new-script-opt').length : 0
        };
      })()`,
      returnByValue: true
    });
    console.log('New script modal test:', newScriptRes.result?.result?.value);

    const shot3 = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(ARTIFACTS_DIR + '\\verified_new_script_modal.png', Buffer.from(shot3.result.data, 'base64'));

    // Close new script modal
    await call('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.getElementById('tv_new_script_modal');
        if (modal) modal.remove();
      })()`
    });

    // TEST 5: Test in-chart prompt for Rename
    console.log('5. Testing Rename In-Chart Modal...');
    const renameRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const renameBtn = document.getElementById('pine_menu_rename');
        if (renameBtn) renameBtn.click();
        const modal = document.getElementById('tv_prompt_modal_overlay');
        return {
          promptOpened: !!modal,
          title: modal ? modal.querySelector('span').textContent : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Rename prompt modal test:', renameRes.result?.result?.value);

    const shot4 = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(ARTIFACTS_DIR + '\\verified_rename_prompt_modal.png', Buffer.from(shot4.result.data, 'base64'));

    // Close prompt modal
    await call('Runtime.evaluate', {
      expression: `(() => {
        const modal = document.getElementById('tv_prompt_modal_overlay');
        if (modal) modal.remove();
      })()`
    });

    // TEST 6: Check Legend Buttons in Chart
    console.log('6. Testing Chart Legend Buttons...');
    const legendRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (!doc) return { error: 'no doc' };

        const moreActionBtn = doc.querySelector('[data-name="legend-more-action"]');
        const showHideBtn = doc.querySelector('[data-name="legend-show-hide-action"]');

        return {
          moreActionBtn: moreActionBtn ? {
            name: moreActionBtn.getAttribute('data-name'),
            display: window.getComputedStyle(moreActionBtn).display,
            visibility: window.getComputedStyle(moreActionBtn).visibility,
            rect: moreActionBtn.getBoundingClientRect()
          } : null,
          showHideBtn: showHideBtn ? {
            name: showHideBtn.getAttribute('data-name'),
            display: window.getComputedStyle(showHideBtn).display,
            visibility: window.getComputedStyle(showHideBtn).visibility,
            rect: showHideBtn.getBoundingClientRect()
          } : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Legend buttons test:', legendRes.result?.result?.value);

    // Check if any native browser dialogs were triggered
    const nativeAlerts = logs.filter(l => l.type === 'NATIVE_BROWSER_DIALOG_DETECTED');
    console.log('Native Browser Dialogs Detected (MUST BE 0):', nativeAlerts.length);
    if (nativeAlerts.length > 0) {
      console.warn('FAIL: Native browser dialog was spawned:', nativeAlerts);
    } else {
      console.log('SUCCESS: Zero native browser dialogs detected!');
    }

    ws.close();
  } catch (err) {
    console.error('Error during verification:', err);
  } finally {
    proc.kill();
  }
}

verifyAllButtonsAndDialogs();
