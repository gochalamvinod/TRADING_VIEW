const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

async function run() {
  try {
    execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
  } catch (e) {}

  await sleep(1000);

  console.log('================================================================');
  console.log('   Full TradingView + MT5Broker Native Verification');
  console.log('================================================================');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-full-test-' + Date.now();

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

  let ws = null;
  try {
    const putResp = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    const consoleLogs = [];

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data);
        pending.delete(data.id);
      } else if (data.method === 'Runtime.consoleAPICalled') {
        const text = data.params.args.map(a => (a.value !== undefined ? a.value : JSON.stringify(a))).join(' ');
        consoleLogs.push({ type: data.params.type, text });
      } else if (data.method === 'Runtime.exceptionThrown') {
        const text = data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text || JSON.stringify(data.params);
        consoleLogs.push({ type: 'exception', text });
        console.error('[Browser Exception]', text);
      }
    };

    await new Promise(r => ws.onopen = r);

    function call(method, params = {}) {
      const curId = id++;
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          pending.delete(curId);
          reject(new Error('CDP timeout for ' + method));
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

    console.log('[1/5] Waiting 15s for Chart, UDF Datafeed, and MT5 Broker sync...');
    await sleep(15000);

    // 1. Inspect Chart Legend and Toolbar
    console.log('[2/5] Inspecting Legend and Drawing Toolbar...');
    const legendEval = await call('Runtime.evaluate', {
      expression: `(function() {
        var iframe = document.querySelector('#tv_chart_container iframe');
        var doc = iframe ? iframe.contentDocument : null;
        if (!doc) return { error: 'No chart iframe document' };

        // Toolbar
        var dt = doc.querySelector('[data-name=\"drawing-toolbar\"], .drawingToolbar, #drawing-toolbar');
        var dtVisible = false;
        var dtRect = null;
        if (dt) {
          var r = dt.getBoundingClientRect();
          dtVisible = r.width > 0 && r.height > 0;
          dtRect = { width: r.width, height: r.height };
        }

        // Legend
        var legend = doc.querySelector('[data-name=\"legend\"], .legend, [class*=\"legend-\"]');
        var legendText = legend ? legend.innerText : '';

        // Symbol and Description
        var titles = doc.querySelectorAll('[data-name=\"legend-source-title\"], [class*=\"title-\"], [class*=\"seriesTitle\"], [class*=\"sourceTitle-\"]');
        var seriesTitle = '';
        titles.forEach(function(t) { if (t.innerText) seriesTitle += ' ' + t.innerText.trim(); });

        // OHLC
        var ohlcEls = doc.querySelectorAll('[class*=\"valuesWrapper-\"], [class*=\"valueItem-\"], [class*=\"ohlc-\"]');
        var ohlcText = '';
        ohlcEls.forEach(function(o) { if (o.innerText) ohlcText += ' ' + o.innerText.trim(); });

        // Buy/Sell buttons
        var bsEls = doc.querySelectorAll('[class*=\"tradingButtons\"], [data-name=\"buy-sell-buttons\"], [class*=\"buyButton\"], [class*=\"sellButton\"]');
        var bsText = '';
        bsEls.forEach(function(b) { if (b.innerText) bsText += ' ' + b.innerText.trim(); });

        return {
          dtVisible: dtVisible,
          dtRect: dtRect,
          legendFound: !!legend,
          legendText: legendText,
          seriesTitle: seriesTitle.trim(),
          ohlcText: ohlcText.trim(),
          bsText: bsText.trim()
        };
      })()`,
      returnByValue: true
    });
    console.log('Legend & Toolbar Evaluation:');
    console.log(JSON.stringify(legendEval.result?.result?.value, null, 2));

    // 2. Inspect Broker Positions and Orders in state
    console.log('[3/5] Inspecting MT5Broker positions and orders in state...');
    const brokerEval = await call('Runtime.evaluate', {
      expression: `(function() {
        if (!window._mt5Broker) return { error: 'No _mt5Broker' };
        var b = window._mt5Broker;
        var positions = b._getPositionsList();
        var orders = b._getOrdersList();
        var acc = b._accountData;
        return {
          positionsCount: positions.length,
          positions: positions.map(function(p) {
            return {
              id: p.id,
              ticket: p.ticket,
              symbol: p.symbol,
              side: p.side,
              qty: p.qty,
              avgPrice: p.avgPrice,
              price: p.price,
              sl: p.stopLoss,
              tp: p.takeProfit,
              canBeClosed: p.canBeClosed
            };
          }),
          ordersCount: orders.length,
          orders: orders.map(function(o) {
            return {
              id: o.id,
              symbol: o.symbol,
              side: o.side,
              type: o.type,
              qty: o.qty,
              status: o.status,
              price: o.price,
              limitPrice: o.limitPrice,
              stopPrice: o.stopPrice,
              parentId: o.parentId,
              parentType: o.parentType,
              isPositionBracket: o.isPositionBracket
            };
          }),
          account: {
            balance: acc.balance,
            equity: acc.equity,
            pl: acc.pl,
            margin: acc.margin,
            freeMargin: acc.freeMargin
          }
        };
      })()`,
      returnByValue: true
    });
    console.log('Broker Positions & Orders:');
    console.log(JSON.stringify(brokerEval.result?.result?.value, null, 2));

    // 3. Inspect Chart TradedGroup custom sources (canvas/model position & order lines)
    console.log('[4/5] Inspecting Chart TradedGroup sources...');
    const tradedGroupEval = await call('Runtime.evaluate', {
      expression: `(function() {
        if (!window.widget || !window.widget.activeChart) return { error: 'No widget' };
        var chart = window.widget.activeChart();
        var iframe = document.querySelector('#tv_chart_container iframe');
        var doc = iframe ? iframe.contentDocument : null;

        // Check if chart canvas has custom sources for trading
        var innerWin = (typeof window.widget._innerWindow === 'function') ? window.widget._innerWindow() : (iframe ? iframe.contentWindow : null);
        var customSources = [];
        if (innerWin && innerWin.TradingView) {
          try {
            var model = chart._model || (chart.model && chart.model());
            if (model && model.sources) {
              var srcs = model.sources();
              srcs.forEach(function(s) {
                if (s._tradedGroupData || (s.name && s.name().includes('traded')) || (s._sourceId && s._sourceId.includes('traded'))) {
                  customSources.push({ id: s._sourceId || s.name(), type: typeof s });
                }
              });
            }
          } catch(e) {}
        }

        // Check Account Manager DOM
        var amTable = doc ? doc.querySelector('[data-name=\"account-manager\"], [class*=\"accountManager-\"], [class*=\"tableWrapper-\"]') : null;
        var amRows = doc ? doc.querySelectorAll('[data-name=\"account-manager\"] [class*=\"row-\"], [class*=\"tableRow-\"]') : [];

        return {
          chartSymbol: chart.symbol(),
          customSourcesCount: customSources.length,
          customSources: customSources,
          hasAccountManager: !!amTable,
          amRowsCount: amRows.length
        };
      })()`,
      returnByValue: true
    });
    console.log('Chart TradedGroup & Account Manager:');
    console.log(JSON.stringify(tradedGroupEval.result?.result?.value, null, 2));

    // 4. Test Modifying Position Brackets (drag simulation via editPositionBrackets)
    console.log('[5/5] Testing position bracket modification...');
    const modifyEval = await call('Runtime.evaluate', {
      expression: `(async function() {
        if (!window._mt5Broker) return { error: 'No broker' };
        var b = window._mt5Broker;
        var plist = b._getPositionsList();
        if (plist.length === 0) return { error: 'No position to modify' };
        var pos = plist[0];
        console.log('Testing editPositionBrackets on ticket ' + pos.id + ' with new SL: 4375.0, TP: 4415.0');
        try {
          var res = await b.editPositionBrackets(pos.id, { stopLoss: 4375.0, takeProfit: 4415.0 });
          return { success: true, posId: pos.id, result: res };
        } catch(e) {
          return { error: e.message };
        }
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Modify Position Brackets Result:');
    console.log(JSON.stringify(modifyEval.result?.result?.value, null, 2));

    await sleep(3000);

    // Capture final screenshots
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.join(SCREENSHOT_DIR, 'full_verification_chart.png');
    fs.writeFileSync(shotPath, Buffer.from(screenshot.result.data, 'base64'));
    console.log('Final Screenshot saved to:', shotPath);

    // Final console errors summary
    const errors = consoleLogs.filter(l => l.type === 'error' || l.type === 'exception');
    console.log(`================================================================`);
    console.log(`Verification Summary:`);
    console.log(`  Console Errors: ${errors.length}`);
    if (errors.length > 0) {
      console.log('  Error Details:', JSON.stringify(errors, null, 2));
    } else {
      console.log('  All console logs clean! Zero errors.');
    }
    console.log(`================================================================`);

  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    if (ws) ws.close();
    try {
      execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
    } catch (e) {}
  }
}

run();
