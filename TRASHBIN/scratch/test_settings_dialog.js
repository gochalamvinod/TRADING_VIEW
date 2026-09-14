const { spawn } = require('child_process');
const fs = require('fs');

const ARTIFACTS_DIR = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f';

async function testSettingsDialog() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-settings-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9253',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const putResp = await fetch('http://127.0.0.1:9253/json/new?http://127.0.0.1:9000', { method: 'PUT' });
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

    console.log('Waiting 8s for chart load...');
    await new Promise(r => setTimeout(r, 8000));

    // Open Pine Editor and add Sessions LuxAlgo to chart
    console.log('Adding Sessions [LuxAlgo] to chart...');
    await call('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        window.PineEditorIDE.open();
        const addBtn = document.getElementById('pine_add_to_chart_btn');
        if (addBtn) addBtn.click();
        await new Promise(r => setTimeout(r, 1500));
      })()`
    });

    // Now trigger openSettingsDialog for the active study
    console.log('Opening Indicator Settings Dialog...');
    const res = await call('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const chart = window.widget?.activeChart();
        const studies = chart?.getAllStudies ? chart.getAllStudies() : [];
        const sessionStudy = studies.find(s => s.name && s.name.toLowerCase().includes('session')) || studies[0];
        const sId = sessionStudy ? sessionStudy.id : null;
        let callResult = null;
        if (window.PineIndicators && typeof window.PineIndicators.openSettingsDialog === 'function') {
          callResult = window.PineIndicators.openSettingsDialog(sId, chart);
        }
        await new Promise(r => setTimeout(r, 800));
        const modal = document.getElementById('tv_settings_modal_overlay');
        return {
          studyId: sId,
          callResult,
          opened: !!modal,
          modalId: modal ? modal.id : null,
          title: modal ? modal.querySelector('.tv-settings-title, span')?.textContent : null,
          tabsCount: modal ? modal.querySelectorAll('.tv-settings-tab').length : 0,
          inputsCount: modal ? modal.querySelectorAll('input, select').length : 0
        };
      })()`
    });

    console.log('Settings Dialog Evaluation:', res.result?.result?.value);

    // Capture screenshot of the settings dialog
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync(ARTIFACTS_DIR + '\\verified_indicator_settings_dialog.png', Buffer.from(shot.result.data, 'base64'));
    console.log('Saved verified_indicator_settings_dialog.png');

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    proc.kill();
  }
}

testSettingsDialog();
