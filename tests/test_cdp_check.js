const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

async function test() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-wb-check-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    '--disable-web-security',
    '--no-sandbox',
    '--window-size=1920,1080',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2500));

  let ws = null;
  try {
    const listResp = await fetch('http://127.0.0.1:9222/json');
    const pages = await listResp.json();
    const wsUrl = pages[0].webSocketDebuggerUrl;
    ws = new WebSocket(wsUrl);

    let id = 1;
    const pending = new Map();
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data);
        pending.delete(data.id);
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
    await call('Page.navigate', { url: 'http://127.0.0.1:9000' });

    console.log('Navigated. Waiting 12s for chart and widgetbar to render...');
    await new Promise(r => setTimeout(r, 12000));

    const evalResult = await call('Runtime.evaluate', {
      expression: `(function() {
        var hasWidget = typeof window.widget !== 'undefined';
        var chartReady = false;
        var activeSym = null;
        if (hasWidget && window.widget.activeChart) {
          try {
            activeSym = window.widget.activeChart().symbol();
            chartReady = true;
          } catch(e) {}
        }
        var iframe = document.querySelector('#tv_chart_container iframe');
        var idoc = (iframe && (iframe.contentDocument || iframe.contentWindow.document));
        var widgetbarFound = false;
        var tabsList = [];
        if (idoc) {
          var els = idoc.querySelectorAll('[data-name=\"right-toolbar\"], .widgetbar-tabs, [data-role=\"widgetbar-tab\"], [data-name=\"watchlist\"], [data-name=\"details\"], [data-name=\"data-window\"], [aria-label*=\"Watchlist\"], [aria-label*=\"Details\"], [aria-label*=\"Data Window\"]');
          widgetbarFound = els.length > 0;
          tabsList = Array.from(els).map(function(e) { return e.getAttribute('data-name') || e.getAttribute('aria-label') || e.className; });
        }
        return {
          hasWidget: hasWidget,
          chartReady: chartReady,
          activeSym: activeSym,
          hasIframe: !!iframe,
          hasIdoc: !!idoc,
          widgetbarFound: widgetbarFound,
          tabsList: tabsList
        };
      })()`,
      returnByValue: true
    });

    console.log('DOM Evaluation:', JSON.stringify(evalResult.result?.result?.value, null, 2));

    // Test symbol switching on the chart
    const switchTest = await call('Runtime.evaluate', {
      expression: `(function() {
        if (!window.widget || !window.widget.activeChart) return { error: 'no chart' };
        var chart = window.widget.activeChart();
        var s1 = chart.symbol();
        chart.setSymbol('EURUSD.');
        var s2 = chart.symbol();
        chart.setSymbol('GBPUSD.');
        var s3 = chart.symbol();
        chart.setSymbol('USDJPY.');
        var s4 = chart.symbol();
        chart.setSymbol('BTCUSD.');
        var s5 = chart.symbol();
        chart.setSymbol('XAUUSD.');
        var s6 = chart.symbol();
        return { s1: s1, s2: s2, s3: s3, s4: s4, s5: s5, s6: s6 };
      })()`,
      returnByValue: true
    });

    console.log('Symbol Switch Test:', JSON.stringify(switchTest.result?.result?.value, null, 2));

    // Capture screenshot
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      fs.writeFileSync('screenshots/screenshot_widgetbar_tabs.png', Buffer.from(shot.result.data, 'base64'));
      console.log('Saved screenshots/screenshot_widgetbar_tabs.png');
    }

  } catch(err) {
    console.error('Error:', err);
  } finally {
    if (ws) ws.close();
    try { execSync('taskkill /F /T /PID ' + proc.pid + ' 2>nul'); } catch(e) {}
  }
}

test();
