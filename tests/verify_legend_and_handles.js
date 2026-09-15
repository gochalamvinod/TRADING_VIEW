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

  console.log('--- Starting Chrome Headless CDP Verification ---');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-verify-prof-' + Date.now();

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
    console.log('Opening tab via /json/new ...');
    const putResp = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    console.log('Opened Tab ID:', tabInfo.id);
    console.log('WebSocket Debugger URL:', tabInfo.webSocketDebuggerUrl);

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
        if (data.params.type === 'error') {
          console.error('[Browser Error]', text);
        }
      } else if (data.method === 'Runtime.exceptionThrown') {
        const text = data.params.exceptionDetails?.exception?.description || data.params.exceptionDetails?.text || JSON.stringify(data.params);
        consoleLogs.push({ type: 'exception', text });
        console.error('[Browser Exception Details]', text);
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

    console.log('Waiting 15 seconds for Chart, Datafeed, MT5Broker, and WebSockets to fully initialize...');
    await sleep(15000);

    // Evaluate the state
    const evalRes = await call('Runtime.evaluate', {
      expression: `(function() {
        var result = {
          hasWidget: typeof window.widget !== 'undefined',
          hasBroker: typeof window._mt5Broker !== 'undefined',
          chartReady: false,
          chartSymbol: null,
          positionsCount: 0,
          positionList: [],
          drawingToolbarVisible: false,
          drawingToolbarRect: null,
          legendFound: false,
          legendText: '',
          symbolTitleFound: false,
          seriesTitleText: '',
          ohlcFound: false,
          ohlcText: '',
          buySellButtonsFound: false,
          buySellText: '',
          legendSourcesCount: 0,
          legendAllTexts: [],
          orderLinesCount: 0,
          positionLinesCount: 0
        };

        if (window._mt5Broker) {
          try {
            var plist = window._mt5Broker._getPositionsList();
            result.positionsCount = plist.length;
            result.positionList = plist.map(function(p) {
              return { id: p.id, symbol: p.symbol, side: p.side, qty: p.qty, avgPrice: p.avgPrice, price: p.price, sl: p.stopLoss, tp: p.takeProfit };
            });
          } catch(e) {}
        }

        if (window.widget && window.widget.activeChart) {
          try {
            result.chartSymbol = window.widget.activeChart().symbol();
            result.chartReady = true;
          } catch(e) {}
        }

        var iframe = document.querySelector('#tv_chart_container iframe');
        if (iframe && iframe.contentDocument) {
          var doc = iframe.contentDocument;

          // 1. Drawing toolbar
          var dt = doc.querySelector('[data-name=\"drawing-toolbar\"], .drawingToolbar, #drawing-toolbar');
          if (dt) {
            var rect = dt.getBoundingClientRect();
            result.drawingToolbarVisible = rect.width > 0 && rect.height > 0;
            result.drawingToolbarRect = { width: rect.width, height: rect.height, left: rect.left, top: rect.top };
          }

          // 2. Legend inspect
          var legend = doc.querySelector('[data-name=\"legend\"], .legend, [class*=\"legend-\"]');
          if (legend) {
            result.legendFound = true;
            result.legendText = legend.innerText;
          }

          // Series Title (Symbol Name + Description)
          var titles = doc.querySelectorAll('[data-name=\"legend-source-title\"], [class*=\"title-\"], [class*=\"seriesTitle\"], [class*=\"sourceTitle-\"], [class*=\"symbolTitle-\"]');
          titles.forEach(function(t) {
            if (t.innerText && t.innerText.trim()) {
              result.symbolTitleFound = true;
              result.seriesTitleText += ' ' + t.innerText.trim();
            }
          });

          // OHLC elements
          var ohlc = doc.querySelectorAll('[class*=\"valuesWrapper-\"], [class*=\"valueItem-\"], [class*=\"ohlc-\"], [class*=\"seriesValues-\"]');
          ohlc.forEach(function(o) {
            if (o.innerText && o.innerText.trim()) {
              result.ohlcFound = true;
              result.ohlcText += ' ' + o.innerText.trim();
            }
          });

          // Buy/Sell buttons in legend or chart
          var bs = doc.querySelectorAll('[class*=\"tradingButtons\"], [data-name=\"buy-sell-buttons\"], [class*=\"buyButton\"], [class*=\"sellButton\"]');
          bs.forEach(function(b) {
            if (b.innerText && b.innerText.trim()) {
              result.buySellButtonsFound = true;
              result.buySellText += ' ' + b.innerText.trim();
            }
          });

          // All texts in the legend container
          var allSources = doc.querySelectorAll('[class*=\"sources-\"] > div, [class*=\"sourcesWrapper-\"] > div, [class*=\"sources-\"] [class*=\"item-\"]');
          result.legendSourcesCount = allSources.length;
          allSources.forEach(function(s) {
            result.legendAllTexts.push(s.innerText.replace(/\\n/g, ' '));
          });
        }

        return result;
      })()`,
      returnByValue: true
    });

    console.log('=== Browser Inspection Results ===');
    console.log(JSON.stringify(evalRes.result?.result?.value, null, 2));

    // Also query symbol specific trading options from broker
    const optsRes = await call('Runtime.evaluate', {
      expression: `(async function() {
        if (window._mt5Broker && window._mt5Broker.getSymbolSpecificTradingOptions) {
          return await window._mt5Broker.getSymbolSpecificTradingOptions('XAUUSD.');
        }
        return null;
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log('Broker getSymbolSpecificTradingOptions("XAUUSD."):');
    console.log(JSON.stringify(optsRes.result?.result?.value, null, 2));

    // Capture screenshot
    const screenshot = await call('Page.captureScreenshot', { format: 'png' });
    const shotPath = path.join(SCREENSHOT_DIR, 'legend_and_chart.png');
    fs.writeFileSync(shotPath, Buffer.from(screenshot.result.data, 'base64'));
    console.log('Screenshot saved to:', shotPath);

    // Check console errors
    const errors = consoleLogs.filter(l => l.type === 'error' || l.type === 'exception');
    console.log(`Console errors count: ${errors.length}`);
    if (errors.length > 0) {
      console.log('Errors:', JSON.stringify(errors, null, 2));
    }

  } catch (err) {
    console.error('Test execution failed:', err);
  } finally {
    if (ws) ws.close();
    try {
      execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
    } catch (e) {}
    console.log('--- Verification Finished ---');
  }
}

run();
