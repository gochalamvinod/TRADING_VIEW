const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

async function run() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-integ-check-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9225',
    '--remote-allow-origins=*',
    '--disable-web-security',
    '--disable-extensions',
    '--no-first-run',
    '--no-default-browser-check',
    '--no-sandbox',
    '--window-size=1920,1080',
    '--user-data-dir=' + userDataDir,
    'http://127.0.0.1:9000/'
  ]);

  await new Promise(r => setTimeout(r, 2500));

  let ws = null;
  const consoleErrors = [];
  const uncaughtExceptions = [];

  try {
    const listResp = await fetch('http://127.0.0.1:9225/json');
    const pages = await listResp.json();
    console.log('Discovered targets:', pages.map(p => ({ type: p.type, url: p.url })));
    const targetPage = pages.find(p => p.type === 'page') || pages[0];
    if (!targetPage) throw new Error('No target page found');
    
    const wsUrl = targetPage.webSocketDebuggerUrl;
    ws = new WebSocket(wsUrl);

    let id = 1;
    const pending = new Map();
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data);
        pending.delete(data.id);
      }
      if (data.method === 'Runtime.consoleAPICalled') {
        if (data.params.type === 'error') {
          consoleErrors.push(data.params.args.map(a => a.value || a.description).join(' '));
        }
      }
      if (data.method === 'Runtime.exceptionThrown') {
        uncaughtExceptions.push(data.params.exceptionDetails.text + ' ' + (data.params.exceptionDetails.exception?.description || ''));
      }
    };
    await new Promise(r => ws.onopen = r);

    function call(method, params = {}) {
      const curId = id++;
      return new Promise(resolve => {
        pending.set(curId, resolve);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    await call('Page.enable');
    await call('Runtime.enable');

    console.log('Waiting 12s for full chart, datafeed, and broker loading...');
    await new Promise(r => setTimeout(r, 12000));

    const checkState = await call('Runtime.evaluate', {
      expression: `(function() {
        var hasWidget = typeof window.widget !== 'undefined';
        var hasBroker = typeof window._mt5Broker !== 'undefined';
        var brokerData = null;
        if (hasBroker && window._mt5Broker) {
          brokerData = {
            backendUrl: window._mt5Broker._backendUrl,
            accountData: window._mt5Broker._accountData,
            positionsCount: Object.keys(window._mt5Broker._positionById || {}).length,
            ordersCount: Object.keys(window._mt5Broker._orderById || {}).length
          };
        }
        var chartSymbol = null;
        var activeChartReady = false;
        if (hasWidget && window.widget && typeof window.widget.activeChart === 'function') {
          try {
            var ac = window.widget.activeChart();
            if (ac) {
              chartSymbol = ac.symbol();
              activeChartReady = true;
            }
          } catch(e) {}
        }
        return {
          href: location.href,
          title: document.title,
          hasWidget: hasWidget,
          hasBroker: hasBroker,
          activeChartReady: activeChartReady,
          chartSymbol: chartSymbol,
          brokerData: brokerData
        };
      })()`,
      returnByValue: true
    });

    const val = checkState.result?.result?.value || {};
    console.log('Browser State Evaluation:', JSON.stringify(val, null, 2));

    console.log('Console Errors caught (' + consoleErrors.length + '):', consoleErrors);
    console.log('Uncaught Exceptions caught (' + uncaughtExceptions.length + '):', uncaughtExceptions);

    const success = val.hasWidget && val.hasBroker && val.brokerData?.accountData?.balance > 0;
    console.log('\nCDP Integration Test Result:', success ? 'PASSED' : 'FAILED');

    if (!success) {
      process.exitCode = 1;
    }
  } catch (err) {
    console.error('Test error:', err);
    process.exitCode = 1;
  } finally {
    if (ws) ws.close();
    proc.kill('SIGTERM');
    try {
      fs.rmSync(userDataDir, { recursive: true, force: true });
    } catch(e) {}
  }
}

run();
