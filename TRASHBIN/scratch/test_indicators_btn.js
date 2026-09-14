const { spawn } = require('child_process');
const fs = require('fs');

async function test() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-dbg-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9230',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const putResp = await fetch('http://127.0.0.1:9230/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();
    const consoleLogs = [];
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push({ type: d.params.type, args: d.params.args.map(a => a.value || a.description) });
      }
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
    console.log('Waiting 10s for TradingView to initialize...');
    await new Promise(r => setTimeout(r, 10000));

    const evalResult = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        let iframeDoc = null;
        try { iframeDoc = iframe ? iframe.contentDocument || iframe.contentWindow.document : null; } catch(e){}
        
        // Check if there is an indicators button in main DOM or iframe
        const btnMain = document.querySelector('[data-name="indicators"], [data-role="button"][title*="Indicators"], #header-toolbar-indicators');
        const btnIframe = iframeDoc ? iframeDoc.querySelector('[data-name="indicators"], [data-role="button"][title*="Indicators"], #header-toolbar-indicators, div[id*="indicators"]') : null;
        
        // Also check window.tvWidget
        const w = window.tvWidget;
        let chart = null;
        let actions = [];
        try {
          chart = w.activeChart ? w.activeChart() : (w.chart ? w.chart() : null);
          if (chart && chart.getActions) {
            actions = chart.getActions().map(a => ({ id: a.id, text: a.text }));
          }
        } catch(e) {}

        return {
          hasIframe: !!iframe,
          btnMain: btnMain ? btnMain.outerHTML.slice(0, 200) : null,
          btnIframe: btnIframe ? btnIframe.outerHTML.slice(0, 200) : null,
          actionCount: actions.length,
          hasInsertIndicator: actions.some(a => a.id === 'insert_indicator'),
          actions: actions.slice(0, 10)
        };
      })()`,
      returnByValue: true
    });

    console.log('Evaluation result:', JSON.stringify(evalResult.result.value, null, 2));

    // Now let's try to simulate clicking the indicators button or executing insert_indicator
    console.log('Testing executeActionById("insert_indicator")...');
    const actionResult = await call('Runtime.evaluate', {
      expression: `(() => {
        const w = window.tvWidget;
        try {
          const chart = w.activeChart ? w.activeChart() : (w.chart ? w.chart() : null);
          if (chart && chart.executeActionById) {
            chart.executeActionById('insert_indicator');
            return { executed: true };
          }
          return { executed: false, reason: 'no executeActionById' };
        } catch(e) {
          return { executed: false, error: e.message, stack: e.stack };
        }
      })()`,
      returnByValue: true
    });
    console.log('Action result:', JSON.stringify(actionResult.result.value, null, 2));

    await new Promise(r => setTimeout(r, 2000));

    // Check if dialog opened
    const dialogCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        let iframeDoc = null;
        try { iframeDoc = iframe ? iframe.contentDocument || iframe.contentWindow.document : null; } catch(e){}
        const dialogMain = document.querySelector('[data-name="indicators-dialog"], [data-dialog-name="Indicators"], [class*="dialog"]');
        const dialogIframe = iframeDoc ? iframeDoc.querySelector('[data-name="indicators-dialog"], [data-dialog-name="Indicators"], [class*="dialog"]') : null;
        return {
          dialogMain: dialogMain ? dialogMain.className : null,
          dialogIframe: dialogIframe ? dialogIframe.className : null
        };
      })()`,
      returnByValue: true
    });
    console.log('Dialog check:', JSON.stringify(dialogCheck.result.value, null, 2));

    ws.close();
  } catch(err) {
    console.error(err);
  } finally {
    proc.kill();
  }
}

test();
