const { spawn } = require('child_process');

async function inspectLegend() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-leg-' + Date.now();
  const proc = spawn(chromePath, ['--headless=new', '--remote-debugging-port=9222', '--window-size=1920,1080', '--user-data-dir=' + userDataDir]);
  await new Promise(r => setTimeout(r, 2000));
  try {
    const putResp = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();
    ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id && pending.has(d.id)) pending.get(d.id)(d); };
    await new Promise(r => ws.onopen = r);
    const call = (method, params = {}) => new Promise(res => { const cid = id++; pending.set(cid, res); ws.send(JSON.stringify({ id: cid, method, params })); });
    await call('Page.enable');
    await call('Runtime.enable');
    await new Promise(r => setTimeout(r, 10000));

    // Add Folded RSI or SMA 9/21
    const res = await call('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const chart = window.widget?.activeChart();
        if (!chart) return 'no chart';
        // Add a study
        await chart.createStudy('SMA 9/21 Crossover', true, false);
        await new Promise(r => setTimeout(r, 2000));

        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (!doc) return 'no iframe doc';

        const studyItems = Array.from(doc.querySelectorAll('[data-name="legend-source-item"], [class*="study-"]')).map(el => ({
          className: el.className,
          dataset: Object.assign({}, el.dataset),
          innerHTML: el.innerHTML,
          buttons: Array.from(el.querySelectorAll('button')).map(b => ({
            name: b.getAttribute('data-name'),
            title: b.getAttribute('title') || b.getAttribute('aria-label'),
            className: b.className,
            style: b.getAttribute('style')
          })),
          valuesWrapper: el.querySelector('[class*="valuesWrapper"]')?.outerHTML
        }));

        return { count: studyItems.length, studyItems };
      })()`,
      returnByValue: true
    });
    console.log('LEGEND INSPECTION:', JSON.stringify(res.result?.result?.value, null, 2));
    ws.close();
  } catch (e) {
    console.error(e);
  } finally {
    proc.kill('SIGKILL');
  }
}
inspectLegend();
