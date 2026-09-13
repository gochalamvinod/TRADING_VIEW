const { spawn } = require('child_process');

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-test-' + Date.now();

  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9250',
    '--remote-allow-origins=*',
    '--disable-web-security',
    '--disable-extensions',
    '--no-sandbox',
    '--window-size=1920,1080',
    '--user-data-dir=' + userDataDir,
    'http://127.0.0.1:9000'
  ]);

  await new Promise(r => setTimeout(r, 2000));
  try {
    const listResp = await fetch('http://127.0.0.1:9250/json/list');
    const tabs = await listResp.json();
    const pageTab = tabs.find(t => t.type === 'page' && t.url.includes('9000'));
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
        }, 15000);
        pending.set(curId, res => {
          clearTimeout(t);
          resolve(res);
        });
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    await call('Page.enable');
    await call('Runtime.enable');

    console.log('Waiting 10s for init...');
    await new Promise(r => setTimeout(r, 10000));

    // 1. Add study
    await call('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const chart = window.widget?.activeChart();
        await chart.createStudy('SMA Crossover', true, false);
      })()`
    });
    await new Promise(r => setTimeout(r, 2000));

    // 2. Test universal legend context menu helper for both series and study
    const testRes = await call('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        try {
          const iframe = document.querySelector('#tv_chart_container iframe');
          const doc = iframe?.contentDocument;
          const win = iframe?.contentWindow;

          const openContextMenuForLegendBtn = (btn) => {
            const cwc = win?.chartWidgetCollection;
            const acw = cwc?.activeChartWidget?.value?.();
            const panes = acw?._paneWidgets?.value?.() || [];
            const legend = panes[0]?._legendWidget;
            if (!legend || !legend._callbacks?.showContextMenuForSources) return false;

            const item = btn.closest('[data-name="legend-series-item"], [data-name="legend-source-item"], [class*="item-"]');
            if (!item) return false;

            const rect = btn.getBoundingClientRect();
            const pos = { clientX: rect.left, clientY: rect.bottom + 3 };

            const isSeries = item.getAttribute('data-name') === 'legend-series-item' || item.classList.contains('series-l31H9iuA');
            if (isSeries) {
              const ms = acw.model().mainSeries();
              legend._callbacks.showContextMenuForSources([ms], pos, {}, { origin: "LegendPropertiesContextMenu" });
              return true;
            }

            // For study
            const dsVms = legend._dataSourceViewModels ? Array.from(legend._dataSourceViewModels.values()) : [];
            const titleEl = item.querySelector('[class*="title-"], [data-name="legend-source-title"]');
            const titleText = (titleEl ? titleEl.textContent : '').trim().toLowerCase();

            let targetVm = dsVms.find(vm => {
              const sTitle = String(vm._source?.title?.() || vm._source?.name?.() || '').toLowerCase();
              return titleText && (sTitle.includes(titleText) || titleText.includes(sTitle));
            }) || dsVms[0];

            if (targetVm && targetVm._source) {
              legend._callbacks.showContextMenuForSources([targetVm._source], pos, {}, { origin: "LegendPropertiesContextMenu" });
              return true;
            }
            return false;
          };

          // Test study more button
          const studyItem = doc.querySelector('[data-name="legend-source-item"]');
          const studyMoreBtn = studyItem?.querySelector('[data-name="legend-more-action"]');
          const studyOpened = openContextMenuForLegendBtn(studyMoreBtn);

          await new Promise(r => setTimeout(r, 400));

          const menu = doc.querySelector('.menuWrap-Kq3ruQo8, [class*="menuWrap"]');
          const studyItems = Array.from(menu?.querySelectorAll('[data-role="menuitem"], [class*="item-"]') || []).map(x => x.innerText.trim()).filter(Boolean);

          return {
            studyOpened,
            studyMenuFound: !!menu,
            studyMenuRect: menu ? { x: menu.getBoundingClientRect().x, y: menu.getBoundingClientRect().y, w: menu.getBoundingClientRect().width, h: menu.getBoundingClientRect().height } : null,
            studyItemsCount: studyItems.length,
            studyItems
          };
        } catch (err) {
          return { error: err.message, stack: err.stack };
        }
      })()`
    });

    console.log('Universal Helper Study Result:\n', JSON.stringify(testRes.result?.result?.value, null, 2));

    ws.close();
  } catch (e) {
    console.error('Error:', e);
  } finally {
    proc.kill('SIGKILL');
  }
}

main();
