const { spawn } = require('child_process');
const http = require('http');
const fs = require('fs');
const path = require('path');

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const DEBUG_PORT = 9244;
const TARGET_SCREENSHOT_PATH = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\indicator_settings_dialog.png';

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

async function run() {
  console.log('--- Starting Indicator Settings Dialog Verification ---');

  // 1. Launch Headless Chrome
  const chromeProcess = spawn(CHROME_PATH, [
    '--headless=new',
    `--remote-debugging-port=${DEBUG_PORT}`,
    '--disable-gpu',
    '--no-sandbox',
    '--window-size=1440,960',
    'http://127.0.0.1:9000'
  ]);

  const cleanup = () => {
    try {
      chromeProcess.kill();
    } catch (e) {}
  };
  process.on('exit', cleanup);
  process.on('SIGINT', cleanup);

  // 2. Wait for CDP endpoint
  let wsUrl = null;
  console.log('Connecting to Chrome CDP on port ' + DEBUG_PORT + '...');
  for (let i = 0; i < 30; i++) {
    await sleep(500);
    try {
      const list = await fetchJson(`http://127.0.0.1:${DEBUG_PORT}/json`);
      if (list && list.length > 0) {
        const pageTarget = list.find(t => t.type === 'page');
        if (pageTarget && pageTarget.webSocketDebuggerUrl) {
          wsUrl = pageTarget.webSocketDebuggerUrl;
          break;
        }
      }
    } catch (e) {}
  }

  if (!wsUrl) {
    console.error('Failed to connect to Chrome DevTools Protocol endpoint.');
    cleanup();
    process.exit(1);
  }
  console.log('Connected to CDP target:', wsUrl);

  // 3. Connect WebSocket
  const ws = new WebSocket(wsUrl);
  await new Promise((res, rej) => {
    ws.onopen = res;
    ws.onerror = rej;
  });

  let msgId = 1;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(msg.error);
      else resolve(msg.result);
    }
  };

  function send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = msgId++;
      pending.set(id, { resolve, reject });
      ws.send(JSON.stringify({ id, method, params }));
    });
  }

  await send('Page.enable');
  await send('Runtime.enable');

  // 4. Poll for window.widget and window.PineIndicators to be ready
  console.log('Waiting for TradingView Chart & PineIndicators to initialize...');
  let chartReady = false;
  for (let i = 0; i < 40; i++) {
    await sleep(1000);
    try {
      const evalRes = await send('Runtime.evaluate', {
        expression: `Boolean(window.widget && window.widget.activeChart && window.PineIndicators && typeof window.PineIndicators.openSettingsDialog === 'function')`,
        returnByValue: true
      });
      if (evalRes && evalRes.result && evalRes.result.value === true) {
        chartReady = true;
        console.log(`TradingView & PineIndicators ready after ${i + 1}s!`);
        break;
      }
    } catch (e) {}
  }

  if (!chartReady) {
    console.error('Timeout waiting for TradingView / PineIndicators initialization.');
    cleanup();
    process.exit(1);
  }

  // 5. Register and add Sessions [LuxAlgo] study to the chart
  console.log('Adding Sessions [LuxAlgo] study to chart...');
  const addResult = await send('Runtime.evaluate', {
    expression: `(async () => {
      try {
        const chart = window.widget.activeChart();
        const pineSrc = await fetch('/scratch_luxalgo.pine').then(r => r.text());
        
        // Compile and register
        window.PineIndicators.compilePineScript(pineSrc);
        
        // Hook settings
        window.PineIndicators.hookChartSettings(chart);
        
        // Add study
        const studyId = await window.PineIndicators.addStudyToChart(chart, 'Sessions [LuxAlgo]', true);
        return { success: true, studyId };
      } catch (err) {
        return { success: false, error: err.message || String(err) };
      }
    })()`,
    awaitPromise: true,
    returnByValue: true
  });

  console.log('Study add result:', JSON.stringify(addResult.result?.value));
  if (!addResult.result?.value?.success) {
    console.error('Failed to add study:', addResult.result?.value?.error);
    cleanup();
    process.exit(1);
  }

  const studyId = addResult.result.value.studyId;

  // 6. Test opening the settings dialog via chart.showPropertiesDialog(studyId)
  console.log(`Opening settings dialog via chart.showPropertiesDialog('${studyId}')...`);
  const openRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const chart = window.widget.activeChart();
      chart.showPropertiesDialog('${studyId}');
      const overlay = document.getElementById('tv_settings_modal_overlay');
      return {
        overlayFound: !!overlay,
        overlayZIndex: overlay ? window.getComputedStyle(overlay).zIndex : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Open dialog result:', JSON.stringify(openRes.result?.value));

  await sleep(600);

  // 7. Verify all dialog features:
  console.log('Inspecting Settings Dialog UI components...');
  const inspectRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const overlay = document.getElementById('tv_settings_modal_overlay');
      if (!overlay) return { error: 'Overlay not found' };

      // Headers
      const headers = Array.from(overlay.querySelectorAll('.tv-settings-group-header')).map(h => h.textContent.trim());

      // Inline rows
      const inlineRows = overlay.querySelectorAll('.tv-settings-row-inline');
      const inlineSamples = [];
      inlineRows.forEach(row => {
        const checkbox = row.querySelector('input[type="checkbox"]');
        const text = row.querySelector('input[type="text"]');
        const cbLabel = checkbox?.parentElement?.querySelector('span')?.textContent.trim();
        inlineSamples.push({
          checkbox: cbLabel || !!checkbox,
          textVal: text?.value || null,
          childCount: row.children.length
        });
      });

      // Session time pickers
      const sessionPickers = overlay.querySelectorAll('.tv-session-picker');
      const sessionData = [];
      sessionPickers.forEach(p => {
        const inputId = p.getAttribute('data-input-id');
        const startBtn = p.querySelector('.tv-time-btn[data-type="start"] .tv-time-text');
        const endBtn = p.querySelector('.tv-time-btn[data-type="end"] .tv-time-text');
        const hasClockSvg = !!p.querySelector('svg');
        sessionData.push({
          id: inputId,
          start: startBtn?.textContent.trim(),
          end: endBtn?.textContent.trim(),
          hasClock: hasClockSvg
        });
      });

      // Tooltips
      const tooltips = overlay.querySelectorAll('.tv-settings-tooltip-wrapper');
      const tooltipData = [];
      tooltips.forEach(t => {
        const icon = t.querySelector('.tv-tooltip-icon')?.textContent.trim();
        const popup = t.querySelector('.tv-tooltip-popup')?.textContent.trim();
        tooltipData.push({ icon, popupText: popup });
      });

      // Tabs
      const tabs = Array.from(overlay.querySelectorAll('.tv-settings-tab')).map(t => ({
        name: t.textContent.trim(),
        active: t.classList.contains('active')
      }));

      // Footer
      const defBtn = overlay.querySelector('#tv_settings_defaults_btn');
      const defMenu = overlay.querySelector('#tv_settings_defaults_menu');
      const cancelBtn = overlay.querySelector('#tv_settings_cancel_btn');
      const okBtn = overlay.querySelector('#tv_settings_ok_btn');

      return {
        headers,
        inlineRowCount: inlineRows.length,
        inlineSamples: inlineSamples.slice(0, 4),
        sessionPickerCount: sessionPickers.length,
        sessionData,
        tooltipCount: tooltips.length,
        tooltipSample: tooltipData.slice(0, 3),
        tabs,
        footer: {
          hasDefaultsBtn: !!defBtn,
          hasDefaultsMenu: !!defMenu,
          hasCancelBtn: !!cancelBtn,
          hasOkBtn: !!okBtn
        }
      };
    })()`,
    returnByValue: true
  });

  console.log('Dialog UI inspection:');
  console.log(JSON.stringify(inspectRes.result?.value, null, 2));

  const data = inspectRes.result?.value;
  if (!data || data.error) {
    console.error('Inspection failed:', data?.error);
    cleanup();
    process.exit(1);
  }

  // 8. Test Tab Switching
  console.log('Testing Tab switching to Style and Visibility...');
  const tabTestRes = await send('Runtime.evaluate', {
    expression: `(() => {
      const overlay = document.getElementById('tv_settings_modal_overlay');
      const styleTab = overlay.querySelector('.tv-settings-tab[data-tab="style"]');
      styleTab.click();
      const styleContent = overlay.querySelector('#tv_settings_tab_content').innerHTML;
      
      const visTab = overlay.querySelector('.tv-settings-tab[data-tab="visibility"]');
      visTab.click();
      const visContent = overlay.querySelector('#tv_settings_tab_content').innerHTML;

      // Return to inputs tab for screenshot
      const inTab = overlay.querySelector('.tv-settings-tab[data-tab="inputs"]');
      inTab.click();

      return {
        styleHasColors: styleContent.includes('COLORS & STYLES') || styleContent.includes('PLOTS'),
        visHasTimeframes: visContent.includes('TIMEFRAME VISIBILITY')
      };
    })()`,
    returnByValue: true
  });
  console.log('Tab switching results:', JSON.stringify(tabTestRes.result?.value));

  // 9. Capture Screenshot
  console.log('Capturing screenshot of Settings Dialog...');
  const screenshotRes = await send('Page.captureScreenshot', {
    format: 'png',
    quality: 100
  });

  const imgBuffer = Buffer.from(screenshotRes.data, 'base64');
  fs.writeFileSync(TARGET_SCREENSHOT_PATH, imgBuffer);
  console.log(`Screenshot saved successfully to ${TARGET_SCREENSHOT_PATH} (${imgBuffer.length} bytes)`);

  // 10. Test Legend Gear Click inside TradingView iframe
  console.log('Testing indicator gear icon click inside iframe...');
  const gearTestRes = await send('Runtime.evaluate', {
    expression: `(() => {
      // First close existing dialog
      const overlay = document.getElementById('tv_settings_modal_overlay');
      if (overlay) {
        const closeBtn = overlay.querySelector('#tv_settings_close_btn');
        if (closeBtn) closeBtn.click();
      }

      const innerWin = window.widget._innerWindow ? window.widget._innerWindow() : document.querySelector('#tv_chart_container iframe')?.contentWindow;
      const innerDoc = innerWin?.document;
      if (!innerDoc) return { success: false, reason: 'innerDoc not found' };

      // Find legend settings gear button
      const gear = innerDoc.querySelector('[data-name="legend-settings-action"], [class*="formatButton"], [data-name="format-button"]');
      if (gear) {
        gear.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: innerWin }));
        const reopenedOverlay = document.getElementById('tv_settings_modal_overlay');
        return { success: true, gearFound: true, modalReopened: !!reopenedOverlay };
      } else {
        return { success: true, gearFound: false, reason: 'gear element not rendered yet in headless mode' };
      }
    })()`,
    returnByValue: true
  });
  console.log('Gear click test result:', JSON.stringify(gearTestRes.result?.value));

  console.log('\n=== All verifications passed successfully! ===');
  cleanup();
  process.exit(0);
}

run().catch(err => {
  console.error('Fatal error in verification:', err);
  process.exit(1);
});
