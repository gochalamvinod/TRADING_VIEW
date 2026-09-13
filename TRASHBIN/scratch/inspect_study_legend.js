const { spawn, execSync } = require('child_process');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function inspectStudyLegend() {
  try {
    execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
  } catch (e) {}
  await sleep(1000);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-inspect3-' + Date.now();

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

    const res = await call('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const chart = window.widget?.activeChart();
        if (!chart) return { error: 'no chart' };

        // Create a study
        await chart.createStudy('Moving Average', false, false, [9, 'close', 0]);
        await new Promise(r => setTimeout(r, 1500));

        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (!doc) return { error: 'no doc' };

        const legendItems = Array.from(doc.querySelectorAll('[data-name="legend-source-item"], [data-name="legend-series-item"], [class*="item-"]')).map(el => {
          // Hover on it
          el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          el.classList.add('selected-l31H9iuA');

          const btns = Array.from(el.querySelectorAll('button, [class*="action-"]')).map(b => ({
            tag: b.tagName,
            dataName: b.getAttribute('data-name'),
            ariaLabel: b.getAttribute('aria-label'),
            title: b.getAttribute('title'),
            className: b.className,
            innerHTML: b.innerHTML.slice(0, 100)
          }));

          return {
            className: el.className,
            title: el.querySelector('[data-name="legend-source-title"], [class*="title-"]')?.textContent?.trim(),
            buttons: btns
          };
        });

        // Also check series item
        const seriesItem = doc.querySelector('[data-name="legend-series-item"]') || doc.querySelector('[class*="mainTitle-"]')?.closest('[class*="item-"]');
        let seriesButtons = [];
        if (seriesItem) {
          seriesItem.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          seriesButtons = Array.from(seriesItem.querySelectorAll('button, [class*="action-"]')).map(b => ({
            dataName: b.getAttribute('data-name'),
            ariaLabel: b.getAttribute('aria-label'),
            title: b.getAttribute('title')
          }));
        }

        return { legendItems, seriesButtons };
      })()`,
      returnByValue: true
    });

    console.log('LEGEND ITEMS:\n', JSON.stringify(res.result?.result?.value, null, 2));

    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    try {
      chromeProc.kill('SIGKILL');
    } catch (e) {}
  }
}

inspectStudyLegend();
