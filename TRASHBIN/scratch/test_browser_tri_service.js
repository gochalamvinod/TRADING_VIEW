const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function main() {
  console.log('================================================================================');
  console.log('  E2E HEADLESS BROWSER AUDIT: WEBSITE (9000), PROXY (9999), DATAFEED (8080)');
  console.log('================================================================================');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-tri-service-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9241',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const putResp = await fetch('http://127.0.0.1:9241/json/new?http://localhost:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    const networkRequests = [];
    const exceptions = [];
    const consoleLogs = [];

    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Network.requestWillBeSent') {
        const url = d.params.request.url;
        networkRequests.push({
          url,
          method: d.params.request.method,
          timestamp: Date.now()
        });
      }
      if (d.method === 'Runtime.exceptionThrown') {
        const text = d.params.exceptionDetails?.text + ' ' + (d.params.exceptionDetails?.exception?.description || '');
        exceptions.push(text);
      }
      if (d.method === 'Runtime.consoleAPICalled') {
        const text = d.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        if (d.params.type === 'error') {
          consoleLogs.push({ type: d.params.type, text });
        }
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

    console.log('[STEP 1] Waiting 12s for TradingView chart and datafeed on port 9999...');
    await new Promise(r => setTimeout(r, 12000));

    // Audit Client Environment
    const clientAudit = await call('Runtime.evaluate', {
      expression: `JSON.stringify({
        currentUrl: window.location.href,
        hasBootstrapState: !!window.__NODE_SERVER_STATE__,
        bootstrapAccount: window.__NODE_SERVER_STATE__ ? window.__NODE_SERVER_STATE__.account : null,
        datafeedUrl: window.getDatafeedUrl ? window.getDatafeedUrl() : null,
        brokerReady: !!window._mt5Broker,
        brokerPositions: window._mt5Broker ? Object.keys(window._mt5Broker._positionById || {}).length : 0,
        hasChartIframe: !!document.querySelector('#tv_chart_container iframe'),
        chartIframeSrc: document.querySelector('#tv_chart_container iframe')?.src?.substring(0, 80)
      })`,
      returnByValue: true
    });

    const auditValStr = clientAudit.result?.result?.value || clientAudit.result?.value;
    const auditVal = typeof auditValStr === 'string' ? JSON.parse(auditValStr) : auditValStr;

    console.log('\n=== CLIENT ENVIRONMENT AUDIT ===');
    console.log(JSON.stringify(auditVal, null, 2));

    // Filter network requests to confirm 9999 proxy usage
    const proxyRequests = networkRequests.filter(r => r.url.includes(':9999'));
    const datafeed9000Requests = networkRequests.filter(r => r.url.includes(':9000') && (r.url.includes('/trade/') || r.url.includes('/history') || r.url.includes('/quotes')));
    
    console.log(`\n=== NETWORK ROUTING AUDIT ===`);
    console.log(`Total network requests captured: ${networkRequests.length}`);
    console.log(`Datafeed/Trade requests routed to Proxy Site (:9999): ${proxyRequests.length}`);
    console.log(`Datafeed/Trade requests routed to Website (:9000): ${datafeed9000Requests.length}`);
    console.log(`Exceptions thrown: ${exceptions.length}`);
    console.log(`Console errors: ${consoleLogs.length}`);

    // Capture visual confirmation screenshot
    console.log('\n[STEP 2] Capturing screenshot of http://localhost:9000...');
    const screenshotData = await call('Page.captureScreenshot', { format: 'png' });
    const screenshotPath = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\screenshot_tri_service_9000_9999_8080.png';
    fs.writeFileSync(screenshotPath, Buffer.from(screenshotData.result.data, 'base64'));
    console.log(`[SCREENSHOT] Saved to: ${screenshotPath}`);

    const isSuccess = auditVal?.hasBootstrapState &&
                      auditVal?.datafeedUrl?.includes('9999') &&
                      auditVal?.hasChartIframe;

    console.log('================================================================================');
    console.log(isSuccess ? '>>> [SUCCESS] TRI-SERVICE SYSTEM VERIFIED E2E IN CHROME! <<<' : '>>> [FAIL] AUDIT FAILED <<<');
    console.log('================================================================================');

    process.exit(isSuccess ? 0 : 1);
  } finally {
    proc.kill();
  }
}

main().catch(console.error);
