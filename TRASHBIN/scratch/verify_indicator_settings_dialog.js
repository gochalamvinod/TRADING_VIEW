const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function run() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-test-dialog-' + Date.now();
  const targetScreenshotDir = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f';

  if (!fs.existsSync(targetScreenshotDir)) {
    fs.mkdirSync(targetScreenshotDir, { recursive: true });
  }

  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9231',
    '--remote-allow-origins=*',
    '--disable-web-security',
    '--disable-extensions',
    '--no-sandbox',
    '--window-size=1920,1080',
    '--user-data-dir=' + userDataDir,
    'http://127.0.0.1:9000'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const listResp = await fetch('http://127.0.0.1:9231/json/list');
    const tabs = await listResp.json();
    const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('9000'));
    if (!pageTab) throw new Error('No page tab found: ' + JSON.stringify(tabs));

    const ws = new WebSocket(pageTab.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.id && pending.has(d.id)) {
        pending.get(d.id)(d);
        pending.delete(d.id);
      }
    };
    await new Promise(r => ws.onopen = r);

    function call(method, params = {}) {
      const curId = id++;
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          pending.delete(curId);
          reject(new Error('Timeout ' + method));
        }, 35000);
        pending.set(curId, res => {
          clearTimeout(t);
          resolve(res);
        });
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    await call('Page.enable');
    await call('Runtime.enable');

    console.log('Waiting for TradingView chart to be ready...');
    let chartReady = false;
    for (let i = 0; i < 35; i++) {
      const res = await call('Runtime.evaluate', {
        expression: `(() => {
          try {
            if (window.widget && typeof window.widget.activeChart === 'function') {
              const ch = window.widget.activeChart();
              if (ch && typeof ch.createStudy === 'function') return true;
            }
          } catch(e) {}
          return false;
        })()`,
        returnByValue: true
      });
      if (res.result?.result?.value === true) {
        console.log(`? Chart is ready after ${i + 1}s!`);
        chartReady = true;
        break;
      }
      await new Promise(r => setTimeout(r, 1000));
    }

    if (!chartReady) {
      throw new Error('Chart did not become ready within 35s');
    }

    // Step 1: Add Sessions [LuxAlgo] study to chart
    console.log('Adding Sessions [LuxAlgo] study...');
    const addStudyRes = await call('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const chart = window.widget.activeChart();
        let sId = null;
        if (window.PineIndicators && typeof window.PineIndicators.addStudyToChart === 'function') {
          sId = await window.PineIndicators.addStudyToChart(chart, 'Sessions [LuxAlgo]', true);
        } else {
          sId = await chart.createStudy('Sessions [LuxAlgo]', true, false);
        }
        await new Promise(r => setTimeout(r, 2000));

        const studies = chart.getAllStudies ? chart.getAllStudies() : [];
        return {
          studyId: sId,
          allStudies: studies.map(s => ({ id: s.id, name: s.name }))
        };
      })()`
    });

    console.log('Add study result:', JSON.stringify(addStudyRes.result?.result?.value, null, 2));

    // Step 2: Open settings dialog via chart.showPropertiesDialog(studyId)
    console.log('Opening settings dialog via chart.showPropertiesDialog...');
    const openRes = await call('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const chart = window.widget.activeChart();
        const studies = chart.getAllStudies ? chart.getAllStudies() : [];
        const sId = (studies[0] && studies[0].id) || 'Sessions [LuxAlgo]';

        chart.showPropertiesDialog(sId);
        await new Promise(r => setTimeout(r, 600));

        const overlay = document.getElementById('tv_settings_modal_overlay');
        const dialog = overlay?.querySelector('.tv-settings-dialog');
        if (!overlay || !dialog) return { error: 'Dialog overlay not found in DOM' };

        // Inspect headers
        const groupHeaders = Array.from(dialog.querySelectorAll('.tv-settings-group-header')).map(h => h.textContent.trim());

        // Inspect inline rows
        const inlineRows = Array.from(dialog.querySelectorAll('.tv-settings-row-inline')).map(row => ({
          checkboxes: Array.from(row.querySelectorAll('input[type="checkbox"]')).map(cb => cb.parentElement.textContent.trim()),
          textboxes: Array.from(row.querySelectorAll('input[type="text"]')).map(tb => ({ placeholder: tb.placeholder, value: tb.value })),
          hasTooltip: !!row.querySelector('.tv-settings-tooltip-wrapper')
        }));

        // Inspect session pickers
        const sessionPickers = Array.from(dialog.querySelectorAll('.tv-session-picker')).map(p => {
          const start = p.querySelector('.tv-time-btn[data-type="start"] .tv-time-text')?.textContent;
          const end = p.querySelector('.tv-time-btn[data-type="end"] .tv-time-text')?.textContent;
          const clockIcons = p.querySelectorAll('svg').length;
          return { start, end, clockIcons };
        });

        // Inspect tooltips
        const tooltips = Array.from(dialog.querySelectorAll('.tv-settings-tooltip-wrapper')).map(t => ({
          icon: t.querySelector('.tv-tooltip-icon')?.textContent,
          popupText: t.querySelector('.tv-tooltip-popup')?.textContent
        }));

        // Inspect tabs
        const tabs = Array.from(dialog.querySelectorAll('.tv-settings-tab')).map(t => t.textContent.trim());

        // Inspect footer
        const defaultsBtn = !!dialog.querySelector('#tv_settings_defaults_btn');
        const cancelBtn = !!dialog.querySelector('#tv_settings_cancel_btn');
        const okBtn = !!dialog.querySelector('#tv_settings_ok_btn');

        return {
          isOpen: true,
          title: dialog.querySelector('div[style*="font-size: 16px"]')?.textContent?.trim(),
          groupHeaders,
          inlineRowsCount: inlineRows.length,
          inlineRowsSample: inlineRows.slice(0, 3),
          sessionPickersCount: sessionPickers.length,
          sessionPickersSample: sessionPickers.slice(0, 2),
          tooltipsCount: tooltips.length,
          tooltipsSample: tooltips.slice(0, 3),
          tabs,
          footer: { defaultsBtn, cancelBtn, okBtn }
        };
      })()`
    });

    console.log('Dialog verification details:', JSON.stringify(openRes.result?.result?.value, null, 2));

    // Step 3: Hover a tooltip to reveal popup
    await call('Runtime.evaluate', {
      expression: `(() => {
        const firstTip = document.querySelector('.tv-settings-tooltip-wrapper');
        if (firstTip) {
          const pop = firstTip.querySelector('.tv-tooltip-popup');
          if (pop) pop.style.display = 'block';
        }
      })()`
    });

    // Step 4: Capture screenshot of the dialog on top of the chart
    console.log('Capturing screenshot of indicator settings dialog...');
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = path.join(targetScreenshotDir, 'indicator_settings_dialog.png');
    fs.writeFileSync(screenshotPath, Buffer.from(screenshot.result.data, 'base64'));
    console.log('? Screenshot successfully saved to:', screenshotPath);

    // Also save locally in scratch
    const localScreenshotPath = path.join(__dirname, 'indicator_settings_dialog.png');
    fs.writeFileSync(localScreenshotPath, Buffer.from(screenshot.result.data, 'base64'));
    console.log('? Local screenshot saved to:', localScreenshotPath);

    // Step 5: Close dialog, then test clicking the gear icon in the legend inside the iframe
    console.log('Testing legend gear icon click...');
    await call('Runtime.evaluate', {
      expression: `(() => {
        const overlay = document.getElementById('tv_settings_modal_overlay');
        if (overlay) overlay.remove();
      })()`
    });
    await new Promise(r => setTimeout(r, 600));

    const legendGearRes = await call('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (!doc) return { error: 'No iframe doc' };

        const items = Array.from(doc.querySelectorAll('[data-name="legend-study-item"], [data-name="legend-source-item"], [class*="item-"]'));
        const studyItem = items.find(it => it.textContent.includes('Sessions') || it.getAttribute('data-name') === 'legend-study-item') || items[0];
        if (!studyItem) return { error: 'No study item in legend', totalItems: items.length };

        studyItem.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        studyItem.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));

        const gearBtn = studyItem.querySelector('[data-name="legend-settings-action"], [class*="formatButton"]');
        if (!gearBtn) return { error: 'No gear button found in study legend item', studyText: studyItem.textContent.slice(0, 50) };

        gearBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await new Promise(r => setTimeout(r, 800));

        const overlay = document.getElementById('tv_settings_modal_overlay');
        return {
          gearFound: true,
          dialogOpenedAfterGearClick: !!overlay
        };
      })()`
    });

    console.log('Legend gear click verification:', JSON.stringify(legendGearRes.result?.result?.value, null, 2));

    ws.close();
  } catch (err) {
    console.error('Execution error:', err);
  } finally {
    proc.kill('SIGKILL');
  }
}

run();
