const { spawn } = require('child_process');
const fs = require('fs');

async function test() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-dev2-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--window-size=1920,1080',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));
  try {
    const putResp = await fetch('http://127.0.0.1:9223/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.id && pending.has(d.id)) pending.get(d.id)(d);
    };
    await new Promise(r => ws.onopen = r);
    const call = (method, params = {}) =>
      new Promise(res => {
        const cid = id++;
        pending.set(cid, res);
        ws.send(JSON.stringify({ id: cid, method, params }));
      });

    await call('Page.enable');
    await call('Runtime.enable');

    console.log('Waiting for chart ready...');
    await new Promise(r => setTimeout(r, 8000));

    // Check chart readiness & inspect legend
    const evalRes = await call('Runtime.evaluate', {
      awaitPromise: true,
      returnByValue: true,
      expression: `(async () => {
        const chart = window.widget?.activeChart();
        if (!chart) return { error: 'no chart' };

        // Add an indicator if none exists
        try {
          await chart.createStudy('Moving Average', false, false, [9]);
        } catch (e) {
          console.error(e);
        }
        await new Promise(r => setTimeout(r, 2000));

        const iframe = document.querySelector('#tv_chart_container iframe');
        if (!iframe) return { error: 'no iframe' };
        const doc = iframe.contentDocument;
        if (!doc) return { error: 'no contentDocument' };

        const legendContainer = doc.querySelector('[data-name="legend"]') || doc.querySelector('[class*="legend-"]');
        const allItems = Array.from(doc.querySelectorAll('[data-name="legend-source-item"], [data-name="legend-series-item"], [data-name="legend-study-item"], [class*="item-"], [class*="study-"]'));
        
        const itemsSummary = allItems.map((item, idx) => {
          const buttons = Array.from(item.querySelectorAll('button, [role="button"], [data-name*="action"]')).map(b => ({
            name: b.getAttribute('data-name'),
            title: b.getAttribute('title') || b.getAttribute('aria-label'),
            className: b.className,
            text: b.innerText,
            tag: b.tagName
          }));
          return {
            index: idx,
            tagName: item.tagName,
            className: item.className,
            dataset: Object.assign({}, item.dataset),
            buttons
          };
        });

        return {
          hasWidget: !!window.widget,
          hasChart: !!chart,
          studies: chart.getAllStudies ? chart.getAllStudies() : [],
          legendFound: !!legendContainer,
          itemsCount: allItems.length,
          itemsSummary
        };
      })()`
    });

    console.log('Eval result:', JSON.stringify(evalRes, null, 2));

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    proc.kill('SIGKILL');
  }
}

test();
