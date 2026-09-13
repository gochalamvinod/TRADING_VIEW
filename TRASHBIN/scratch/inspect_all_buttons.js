const { spawn, execSync } = require('child_process');
const fs = require('fs');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function inspectAll() {
  try {
    execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
  } catch (e) {}
  await sleep(1000);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-inspect-' + Date.now();

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    '--disable-web-security',
    '--no-sandbox',
    '--window-size=1920,1080',
    '--user-data-dir=' + userDataDir
  ]);

  await sleep(3000);

  try {
    const putResp = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    ws.onmessage = (e) => {
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
        }, 30000);
        pending.set(curId, (res) => {
          clearTimeout(t);
          resolve(res);
        });
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    await call('Page.enable');
    await call('Runtime.enable');

    console.log('Waiting 12s for full load...');
    await sleep(12000);

    const inspection = await call('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const topDoc = document;
        const iframe = document.querySelector('#tv_chart_container iframe');
        const innerDoc = iframe?.contentDocument;

        function getInfo(el) {
          if (!el) return null;
          const rect = el.getBoundingClientRect();
          return {
            tagName: el.tagName,
            id: el.id,
            className: el.className,
            dataName: el.getAttribute('data-name'),
            ariaLabel: el.getAttribute('aria-label'),
            title: el.getAttribute('title'),
            text: el.textContent?.trim().slice(0, 30),
            visible: rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).display !== 'none',
            rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) }
          };
        }

        // 1. Header Toolbar buttons
        const headerButtons = Array.from(innerDoc?.querySelectorAll('#header-toolbar button, [data-name="header-toolbar"] button, div[id*="header-toolbar"] [role="button"]') || []).map(getInfo);

        // 2. Chart Legend items
        const legendItems = Array.from(innerDoc?.querySelectorAll('[data-name="legend"] [data-name*="legend-"], [class*="legend-"] [class*="item-"]') || []).map(getInfo);
        const legendButtons = Array.from(innerDoc?.querySelectorAll('[data-name="legend"] button, [class*="legend-"] button, [data-name*="action-"]') || []).map(getInfo);

        // 3. Drawing Toolbar buttons
        const drawingToolbar = innerDoc?.querySelector('#drawing-toolbar, [data-name="drawing-toolbar"], [class*="drawingToolbar"]');
        const drawingButtons = Array.from(drawingToolbar?.querySelectorAll('button, [data-role="button"], [class*="button-"]') || []).map(getInfo);

        // 4. Right Toolbar buttons
        const rightToolbar = innerDoc?.querySelector('[data-name="right-toolbar"], [class*="widgetbar-pages"]');
        const rightButtons = Array.from(rightToolbar?.querySelectorAll('button, [class*="button-"]') || []).map(getInfo);

        // 5. Bottom Dock Tabs
        const footerPanel = innerDoc?.querySelector('#footer-chart-panel');
        const bottomTabs = Array.from(footerPanel?.querySelectorAll('.tab-n3UmcVi3, [class*="tab-"], button[class*="tab-"]') || []).map(getInfo);

        // 6. Pine Editor in topDoc
        const pineDock = topDoc.querySelector('#pine_editor_dock');
        const pineButtons = {
          winMin: getInfo(topDoc.querySelector('#pine_win_minimize')),
          winMax: getInfo(topDoc.querySelector('#pine_win_maximize')),
          winClose: getInfo(topDoc.querySelector('#pine_win_close')),
          scriptDropdown: getInfo(topDoc.querySelector('#pine_script_dropdown_trigger')),
          addToChart: getInfo(topDoc.querySelector('#pine_add_to_chart_btn')),
          saveBtn: getInfo(topDoc.querySelector('#pine_menu_save_script, #pine_save_btn')),
          publishBtn: getInfo(topDoc.querySelector('#pine_publish_btn')),
          moreBtn: getInfo(topDoc.querySelector('#pine_more_btn')),
          moreMenu: getInfo(topDoc.querySelector('#pine_more_menu')),
          moreItems: Array.from(topDoc.querySelectorAll('#pine_more_menu .pine-menu-item-v2') || []).map(getInfo),
          consoleDrawer: getInfo(topDoc.querySelector('#pine_console_drawer_v2, #pine_console_drawer'))
        };

        return {
          headerCount: headerButtons.length,
          headerButtons,
          legendButtonsCount: legendButtons.length,
          legendButtons,
          drawingCount: drawingButtons.length,
          drawingButtons: drawingButtons.slice(0, 20),
          rightCount: rightButtons.length,
          rightButtons,
          bottomCount: bottomTabs.length,
          bottomTabs,
          pineDockPresent: !!pineDock,
          pineButtons
        };
      })()`,
      returnByValue: true
    });

    console.log('RESULT:\n', JSON.stringify(inspection.result?.result?.value, null, 2));

    ws.close();
  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    try {
      chromeProc.kill('SIGKILL');
    } catch (e) {}
  }
}

inspectAll();
