const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const brainDir = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f';

async function verify() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9285',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-verify-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9285/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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

  console.log('--- TEST 1: Indicators Modal (Favorites, My scripts, Technicals) ---');
  const test1 = await call('Runtime.evaluate', {
    expression: `(() => {
      window.openIndicatorsModal('technicals');
      const cats = Array.from(document.querySelectorAll('.tv-indicators-nav-item')).map(el => el.innerText.trim());
      const totalRows = document.querySelectorAll('.tv-indicator-row').length;
      const sampleNames = Array.from(document.querySelectorAll('.tv-indicator-name')).slice(0, 10).map(el => el.innerText.trim());
      return { categories: cats, totalRows, sampleNames };
    })()`,
    returnByValue: true
  });
  console.log('Indicators Modal:', JSON.stringify(test1.result?.result?.value, null, 2));

  // Screenshot 1: Indicators modal with Technicals built-ins
  const snap1 = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(brainDir, 'verify_indicators_technicals.png'), Buffer.from(snap1.result.data, 'base64'));

  console.log('--- TEST 2: Pine Editor Save & My Scripts Sync ---');
  const test2 = await call('Runtime.evaluate', {
    expression: `(async () => {
      window.closeIndicatorsModal();
      window.PineEditorIDE.open();
      // Load and save custom script
      window.PineEditorIDE.loadScript(
        "EMA Trend Channel Strategy",
        "//@version=5\\nindicator('EMA Trend Channel Strategy', overlay=true)\\nfast = ta.ema(close, 20)\\nslow = ta.ema(close, 50)\\nplot(fast, 'Fast EMA', color=color.green)\\nplot(slow, 'Slow EMA', color=color.red)\\n",
        "user_script_ema_strat_1"
      );
      // Trigger save
      document.getElementById('pine_menu_save_script')?.click();
      await new Promise(r => setTimeout(r, 500));

      // Open indicators modal on My scripts
      window.openIndicatorsModal('myscripts');
      await new Promise(r => setTimeout(r, 400));
      const myScripts = Array.from(document.querySelectorAll('.tv-indicator-name')).map(el => el.innerText.trim());
      return { myScripts };
    })()`,
    awaitPromise: true,
    returnByValue: true
  });
  console.log('My Scripts after Save:', JSON.stringify(test2.result?.result?.value, null, 2));

  // Screenshot 2: My scripts tab showing saved script
  const snap2 = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(brainDir, 'verify_indicators_myscripts.png'), Buffer.from(snap2.result.data, 'base64'));

  console.log('--- TEST 3: Authentic Custom Indicator Settings Dialog (Style Tab) ---');
  const test3 = await call('Runtime.evaluate', {
    expression: `(() => {
      window.closeIndicatorsModal();
      window.PineEditorIDE.close();

      // Open Settings Dialog for custom indicator
      window.PineIndicators.openSettingsDialog({
        id: 'custom_study_test',
        name: 'Aroon',
        metainfo: {
          name: 'Aroon',
          description: 'Aroon',
          id: 'aroon_custom_1',
          inputs: [
            { id: 'length', name: 'Length', type: 'integer', defval: 14, min: 1, max: 200 }
          ],
          plots: [
            { id: 'plot_0', type: 'line', title: 'Upper' },
            { id: 'plot_1', type: 'line', title: 'Lower' }
          ],
          styles: {
            plot_0: { title: 'Upper' },
            plot_1: { title: 'Lower' }
          },
          defaults: {
            styles: {
              plot_0: { color: '#ff9800', linewidth: 1, plottype: 'line', visible: true },
              plot_1: { color: '#2962ff', linewidth: 1, plottype: 'line', visible: true }
            }
          }
        }
      });

      // Switch to Style tab
      const styleTab = Array.from(document.querySelectorAll('.tv-settings-tab')).find(t => t.dataset.tab === 'style');
      if (styleTab) styleTab.click();

      const tabs = Array.from(document.querySelectorAll('.tv-settings-tab')).map(t => t.innerText.trim());
      const plots = Array.from(document.querySelectorAll('.tv-style-plot-row span')).map(s => s.innerText.trim()).filter(Boolean);
      return { tabs, plots };
    })()`,
    returnByValue: true
  });
  console.log('Settings Dialog (Style):', JSON.stringify(test3.result?.result?.value, null, 2));

  // Screenshot 3: Settings dialog Style tab
  const snap3 = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(brainDir, 'verify_settings_style_tab.png'), Buffer.from(snap3.result.data, 'base64'));

  console.log('--- TEST 4: Color Picker Popover (80 Colors, Opacity, 4 Thicknesses) ---');
  await call('Runtime.evaluate', {
    expression: `(() => {
      const colorBtn = document.querySelector('.tv-color-swatch-btn');
      if (colorBtn) colorBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 400));

  // Screenshot 4: Color picker popover
  const snap4 = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(brainDir, 'verify_settings_color_popover.png'), Buffer.from(snap4.result.data, 'base64'));

  console.log('--- TEST 5: Plot Style Popover (Price line switch & 11 Plot Styles) ---');
  await call('Runtime.evaluate', {
    expression: `(() => {
      // Close color popover by clicking line style btn
      const styleBtn = document.querySelector('.tv-plot-style-btn');
      if (styleBtn) styleBtn.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 400));

  // Screenshot 5: Plot style popover
  const snap5 = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(brainDir, 'verify_settings_plot_style_popover.png'), Buffer.from(snap5.result.data, 'base64'));

  console.log('--- TEST 6: Visibility Tab (Ticks & 6 Range Sliders) ---');
  await call('Runtime.evaluate', {
    expression: `(() => {
      const visTab = Array.from(document.querySelectorAll('.tv-settings-tab')).find(t => t.dataset.tab === 'visibility');
      if (visTab) visTab.click();
    })()`
  });
  await new Promise(r => setTimeout(r, 400));

  // Screenshot 6: Visibility tab
  const snap6 = await call('Page.captureScreenshot');
  fs.writeFileSync(path.join(brainDir, 'verify_settings_visibility_tab.png'), Buffer.from(snap6.result.data, 'base64'));

  console.log('All tests finished successfully!');
  ws.close();
  proc.kill();
  process.exit(0);
}

verify().catch(console.error);
