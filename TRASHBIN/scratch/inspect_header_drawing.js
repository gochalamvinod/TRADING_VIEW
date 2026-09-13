const { spawn, execSync } = require('child_process');

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function inspectHeaderAndDrawing() {
  try {
    execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
  } catch (e) {}
  await sleep(1000);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-inspect2-' + Date.now();

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
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (!doc) return { error: 'no doc' };

        // Find header elements
        const headerContainers = Array.from(doc.querySelectorAll('[class*="header-"], [id*="header"], [data-name*="header"]')).map(el => ({
          tag: el.tagName,
          id: el.id,
          className: el.className,
          dataName: el.getAttribute('data-name'),
          rect: el.getBoundingClientRect()
        }));

        // Top bar buttons
        const topButtons = Array.from(doc.querySelectorAll('div, button, [role="button"]'))
          .filter(el => {
            const r = el.getBoundingClientRect();
            return r.y >= 0 && r.y < 45 && r.width > 15 && r.height > 15;
          })
          .map(el => ({
            tag: el.tagName,
            id: el.id,
            className: el.className,
            dataName: el.getAttribute('data-name'),
            ariaLabel: el.getAttribute('aria-label'),
            title: el.getAttribute('title'),
            text: el.textContent?.trim().slice(0, 30),
            role: el.getAttribute('role'),
            rect: { x: Math.round(el.getBoundingClientRect().x), y: Math.round(el.getBoundingClientRect().y), w: Math.round(el.getBoundingClientRect().width), h: Math.round(el.getBoundingClientRect().height) }
          }));

        // All drawing toolbar buttons
        const drawingToolbar = doc.querySelector('#drawing-toolbar, [data-name="drawing-toolbar"], [class*="drawingToolbar"]');
        const allDrawing = Array.from(drawingToolbar?.querySelectorAll('button, [data-role="button"]') || []).map(b => ({
          ariaLabel: b.getAttribute('aria-label'),
          dataName: b.getAttribute('data-name'),
          title: b.getAttribute('title'),
          className: b.className,
          rect: b.getBoundingClientRect()
        }));

        // Legend elements
        const legend = doc.querySelector('[data-name="legend"]');
        const legendItem = doc.querySelector('[data-name="legend-series-item"], [data-name="legend-source-item"], [class*="item-"]');
        let legendActions = [];
        if (legendItem) {
          // Simulate mouseenter on legend item
          legendItem.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
          await new Promise(r => setTimeout(r, 500));
          legendActions = Array.from(legendItem.querySelectorAll('button, [class*="action-"], [data-name*="action"]')).map(b => ({
            tag: b.tagName,
            dataName: b.getAttribute('data-name'),
            ariaLabel: b.getAttribute('aria-label'),
            title: b.getAttribute('title'),
            className: b.className,
            visible: b.getBoundingClientRect().width > 0
          }));
        }

        return {
          topButtonsCount: topButtons.length,
          topButtons,
          allDrawingCount: allDrawing.length,
          allDrawing,
          legendActions
        };
      })()`,
      returnByValue: true
    });

    console.log('HEADER & DRAWING & LEGEND:\n', JSON.stringify(res.result?.result?.value, null, 2));

    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    try {
      chromeProc.kill('SIGKILL');
    } catch (e) {}
  }
}

inspectHeaderAndDrawing();
