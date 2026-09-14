const { spawn } = require('child_process');

async function inspectChart() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-inspect-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9237',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const putResp = await fetch('http://127.0.0.1:9237/json/new?http://127.0.0.1:8080', { method: 'PUT' });
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

    await call('Network.enable');
    await call('Page.enable');
    await call('Runtime.enable');

    console.log("Waiting 12s for TradingView chart to load...");
    await new Promise(r => setTimeout(r, 12000));

    const chartDetails = await call('Runtime.evaluate', {
      expression: `(() => {
        const w = window.widget;
        if (!w || typeof w.activeChart !== 'function') return { error: 'No active chart' };
        const chart = w.activeChart();
        const studies = typeof chart.getAllStudies === 'function' ? chart.getAllStudies() : [];
        const shapes = typeof chart.getAllShapes === 'function' ? chart.getAllShapes() : [];
        const symbol = chart.symbol ? chart.symbol() : null;
        const resolution = chart.resolution ? chart.resolution() : null;
        
        // Check text elements in DOM
        const textElements = [];
        document.querySelectorAll('text, span, div').forEach(el => {
          if (el.textContent && el.textContent.includes('0.00003')) {
            textElements.push({
              tag: el.tagName,
              text: el.textContent,
              className: el.className,
              color: window.getComputedStyle(el).color,
              parent: el.parentElement ? el.parentElement.className : null
            });
          }
        });

        return {
          symbol,
          resolution,
          studiesCount: studies.length,
          studies: studies.map(s => ({ id: s.id, name: s.name })),
          shapesCount: shapes.length,
          textElementsWith3: textElements
        };
      })()`,
      returnByValue: true
    });

    console.log("Chart Inspection Result:", JSON.stringify(chartDetails.result?.value, null, 2));

  } finally {
    proc.kill();
  }
}

inspectChart().catch(console.error);
