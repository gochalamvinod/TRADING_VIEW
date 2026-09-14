const { spawn } = require('child_process');
const fs = require('fs');

async function main() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-debug-acc-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9245',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const putResp = await fetch('http://127.0.0.1:9245/json/new?http://localhost:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    const networkRequests = [];
    const consoleLogs = [];
    const exceptions = [];

    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Network.requestWillBeSent') {
        networkRequests.push({
          url: d.params.request.url,
          method: d.params.request.method
        });
      }
      if (d.method === 'Runtime.consoleAPICalled') {
        const text = d.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        consoleLogs.push({ type: d.params.type, text });
      }
      if (d.method === 'Runtime.exceptionThrown') {
        const text = d.params.exceptionDetails?.text + ' ' + (d.params.exceptionDetails?.exception?.description || '');
        exceptions.push(text);
      }
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

    console.log('Waiting 10s for initial load...');
    await new Promise(r => setTimeout(r, 10000));

    // Check bottom panel / account manager in iframe and main page
    const inspection = await call('Runtime.evaluate', {
      expression: `(() => {
        const ifr = document.querySelector('#tv_chart_container iframe');
        let ifrErrors = [];
        let ifrHtml = '';
        let ifrBroker = null;
        if (ifr && ifr.contentWindow) {
          try {
            ifrBroker = !!ifr.contentWindow._mt5Broker;
          } catch(e) {
            ifrErrors.push(e.message);
          }
        }
        return {
          window_mt5Broker: !!window._mt5Broker,
          window_mt5Broker_acc: window._mt5Broker ? window._mt5Broker._accountData : null,
          datafeedUrl: window.getDatafeedUrl ? window.getDatafeedUrl() : null,
          chartIframeExists: !!ifr,
          chartIframeSrc: ifr?.src,
          ifrErrors
        };
      })()`,
      returnByValue: true
    });

    console.log('Inspection result:', JSON.stringify(inspection.result?.result?.value || inspection.result?.value, null, 2));

    console.log('\n--- ALL CONSOLE LOGS ---');
    consoleLogs.forEach(l => console.log(`[${l.type}] ${l.text}`));

    console.log('\n--- ALL EXCEPTIONS ---');
    exceptions.forEach(e => console.log(`[EXCEPTION] ${e}`));

    console.log('\n--- NETWORK REQUESTS MATCHING /trade OR broker OR 9999 ---');
    const matched = networkRequests.filter(r => r.url.includes('/trade') || r.url.includes('9999') || r.url.includes('broker'));
    matched.forEach(r => console.log(`${r.method} ${r.url}`));

  } finally {
    proc.kill();
  }
}

main().catch(console.error);
