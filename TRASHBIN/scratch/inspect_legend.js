const { spawn } = require('child_process');

async function inspectLegend() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9293',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-leg-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9293/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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
  await new Promise(r => setTimeout(r, 6000));

  const res = await call('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const innerDoc = iframe?.contentDocument;
      if (!innerDoc) return { error: 'No innerDoc' };

      const legendItems = Array.from(innerDoc.querySelectorAll('[class*="item-"], [data-name="legend-source-item"], [data-name="legend-study-item"]'));
      return {
        itemCount: legendItems.length,
        items: legendItems.map(it => ({
          className: it.className,
          title: it.querySelector('[class*="title-"]')?.innerText,
          actions: Array.from(it.querySelectorAll('[class*="action-"], button')).map(b => ({
            title: b.getAttribute('title') || b.getAttribute('aria-label'),
            dataName: b.getAttribute('data-name'),
            text: b.innerText
          }))
        }))
      };
    })()`,
    returnByValue: true
  });
  console.log('Legend items:', JSON.stringify(res.result?.result?.value, null, 2));

  // Also check top toolbar alert button
  const topBtns = await call('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const innerDoc = iframe?.contentDocument;
      if (!innerDoc) return { error: 'No innerDoc' };
      const allBtns = Array.from(innerDoc.querySelectorAll('button, [data-role="button"], [data-name]')).map(b => ({
        dataName: b.getAttribute('data-name'),
        id: b.id,
        title: b.getAttribute('title'),
        ariaLabel: b.getAttribute('aria-label'),
        text: b.innerText?.trim()
      })).filter(b => (b.dataName || b.title || b.ariaLabel || b.id || '').toLowerCase().includes('alert'));
      return { alertButtons: allBtns };
    })()`,
    returnByValue: true
  });
  console.log('Alert buttons found in iframe:', JSON.stringify(topBtns.result?.result?.value, null, 2));

  ws.close();
  proc.kill();
  process.exit(0);
}
inspectLegend().catch(console.error);
