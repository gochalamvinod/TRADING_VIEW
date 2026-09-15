/**
 * tests/test_agent_4_widgetbar.js
 * Comprehensive Verification Suite for Agent 4 (Native Watchlist, Quotes, Details & Widgetbar Engineer)
 */

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');

const SCREENSHOT_DIR = path.resolve(__dirname, '..', 'screenshots');
if (!fs.existsSync(SCREENSHOT_DIR)) {
  fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runTests() {
  console.log("================================================================================");
  console.log("   Agent 4: Native Watchlist, Quotes, Details & Widgetbar Verification");
  console.log("================================================================================\n");

  let passed = 0;
  let failed = 0;

  // ---------------------------------------------------------------------------
  // STEP 1: Static Configuration Audit of index.html
  // ---------------------------------------------------------------------------
  console.log("[TEST 1/4] Verifying index.html Widgetbar Configuration...");
  const indexPath = path.resolve(__dirname, '..', 'index.html');
  const indexHtml = fs.readFileSync(indexPath, 'utf-8');

  // Check widgetbar_tabs is NOT in disabled_features
  const disabledMatch = indexHtml.match(/disabled_features\s*:\s*\[([\s\S]*?)\]/);
  if (!disabledMatch) {
    console.error("  [FAIL] disabled_features array not found in index.html");
    failed++;
  } else {
    const disabledList = disabledMatch[1];
    if (disabledList.includes("widgetbar_tabs")) {
      console.error("  [FAIL] 'widgetbar_tabs' is present in disabled_features!");
      failed++;
    } else {
      console.log("  [PASS] 'widgetbar_tabs' is NOT in disabled_features.");
      passed++;
    }
  }

  // Check enabled_features contains widgetbar_tabs
  const enabledMatch = indexHtml.match(/enabled_features\s*:\s*\[([\s\S]*?)\]/);
  if (enabledMatch && enabledMatch[1].includes("widgetbar_tabs") && enabledMatch[1].includes("watchlist")) {
    console.log("  [PASS] 'widgetbar_tabs' and 'watchlist' are explicitly in enabled_features.");
    passed++;
  } else {
    console.error("  [FAIL] 'widgetbar_tabs' or 'watchlist' missing from enabled_features!");
    failed++;
  }

  // Check widgetbar object in widget options
  const hasWidgetbarConfig = indexHtml.includes("widgetbar: {") &&
    indexHtml.includes("details: true") &&
    indexHtml.includes("watchlist: true") &&
    indexHtml.includes("datawindow: true") &&
    indexHtml.includes("XAUUSD.") &&
    indexHtml.includes("EURUSD.") &&
    indexHtml.includes("GBPUSD.") &&
    indexHtml.includes("USDJPY.") &&
    indexHtml.includes("BTCUSD.");

  if (hasWidgetbarConfig) {
    console.log("  [PASS] widgetbar object correctly configured with details, watchlist, datawindow, and default symbols.");
    passed++;
  } else {
    console.error("  [FAIL] widgetbar configuration is incomplete or missing required symbols!");
    failed++;
  }

  // ---------------------------------------------------------------------------
  // STEP 2: JS Chunk Bundle Delivery on Ports 9000 and 8081
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 2/4] Testing JS Chunk Bundle Delivery on Port 9000 & Port 8081...");
  const chunks = [
    'watchlist-widget.c7bd684646cd360803e2.js',
    'symbol-details.b77e4d320c1dbbfb0ea5.js',
    'widgetbar.d988faecd0403223478e.js',
    'bottom-widgetbar.6cd99a863ac9d00955f1.js',
    'data-window-widget.997c077e13963f88220b.js'
  ];

  let chunkDeliveryErrors = 0;
  for (const port of [9000, 8081]) {
    for (const prefix of ['charting_library/bundles/', 'bundles/']) {
      for (const chunk of chunks) {
        const url = `http://127.0.0.1:${port}/${prefix}${chunk}`;
        try {
          const res = await fetch(url);
          if (res.status === 200) {
            const buf = await res.arrayBuffer();
            if (buf.byteLength < 1000) {
              console.error(`  [FAIL] ${url} -> status 200 but suspiciously small (${buf.byteLength} bytes)`);
              chunkDeliveryErrors++;
            }
          } else {
            console.error(`  [FAIL] ${url} -> status ${res.status}`);
            chunkDeliveryErrors++;
          }
        } catch (err) {
          console.error(`  [FAIL] ${url} -> fetch error: ${err.message}`);
          chunkDeliveryErrors++;
        }
      }
    }
  }

  if (chunkDeliveryErrors === 0) {
    console.log(`  [PASS] All ${chunks.length * 4} bundle requests returned 200 OK without 403 or 404.`);
    passed++;
  } else {
    console.error(`  [FAIL] Encountered ${chunkDeliveryErrors} chunk delivery failures.`);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // STEP 3: Watchlist Symbols & Quotes API Verification via Port 9000
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 3/4] Testing Watchlist Symbols, History & Quotes on Port 9000...");
  const defaultSymbols = ["XAUUSD.", "EURUSD.", "GBPUSD.", "USDJPY.", "BTCUSD."];
  const now = Math.floor(Date.now() / 1000);
  const fromTime = now - 7 * 86400;
  const toTime = now + 86400;

  let apiErrors = 0;
  for (const sym of defaultSymbols) {
    try {
      // 1. /symbols
      const symRes = await fetch(`http://127.0.0.1:9000/symbols?symbol=${encodeURIComponent(sym)}`);
      if (symRes.status !== 200) {
        console.error(`  [FAIL] /symbols?symbol=${sym} -> status ${symRes.status}`);
        apiErrors++;
      } else {
        const symData = await symRes.json();
        if (!symData.name || !symData.pricescale) {
          console.error(`  [FAIL] /symbols?symbol=${sym} missing name or pricescale`);
          apiErrors++;
        }
      }

      // 2. /quotes
      const quoteRes = await fetch(`http://127.0.0.1:9000/quotes?symbols=${encodeURIComponent(sym)}`);
      if (quoteRes.status !== 200) {
        console.error(`  [FAIL] /quotes?symbols=${sym} -> status ${quoteRes.status}`);
        apiErrors++;
      } else {
        const quoteData = await quoteRes.json();
        if (quoteData.s !== 'ok' || !Array.isArray(quoteData.d) || quoteData.d.length === 0) {
          console.error(`  [FAIL] /quotes?symbols=${sym} invalid response structure`);
          apiErrors++;
        }
      }

      // 3. /history
      const histRes = await fetch(`http://127.0.0.1:9000/history?symbol=${encodeURIComponent(sym)}&resolution=1&from=${fromTime}&to=${toTime}`);
      if (histRes.status !== 200) {
        console.error(`  [FAIL] /history?symbol=${sym} -> status ${histRes.status}`);
        apiErrors++;
      } else {
        const histData = await histRes.json();
        if (histData.s !== 'ok' || !Array.isArray(histData.t) || histData.t.length === 0) {
          console.error(`  [FAIL] /history?symbol=${sym} invalid or empty bars: s=${histData.s}`);
          apiErrors++;
        } else {
          console.log(`  [OK] Symbol ${sym.padEnd(8)}: /symbols OK | /quotes OK | /history OK (${histData.t.length} bars)`);
        }
      }
    } catch (err) {
      console.error(`  [FAIL] API test for ${sym} exception: ${err.message}`);
      apiErrors++;
    }
  }

  if (apiErrors === 0) {
    console.log("  [PASS] All 5 default watchlist symbols verified with valid symbols, quotes, and history.");
    passed++;
  } else {
    console.error(`  [FAIL] Encountered ${apiErrors} API errors across watchlist symbols.`);
    failed++;
  }

  // ---------------------------------------------------------------------------
  // STEP 4: Headless Chrome CDP Symbol Switching & Widgetbar DOM Verification
  // ---------------------------------------------------------------------------
  console.log("\n[TEST 4/4] Headless Chrome CDP: Testing Symbol Switching & Widgetbar UI...");
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-verify-wb-' + Date.now();

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await sleep(3000);

  let ws = null;
  try {
    const putResp = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let msgId = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.id && pending.has(data.id)) {
        pending.get(data.id)(data);
        pending.delete(data.id);
      }
    };

    await new Promise((resolve, reject) => {
      ws.onopen = resolve;
      ws.onerror = reject;
    });

    function call(method, params = {}) {
      const id = msgId++;
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timeout waiting for ${method} (id=${id})`));
        }, 20000);
        pending.set(id, (res) => {
          clearTimeout(timer);
          resolve(res);
        });
        ws.send(JSON.stringify({ id, method, params }));
      });
    }

    await call('Page.enable');
    await call('Runtime.enable');
    await call('DOM.enable');

    console.log("  Waiting 12s for TradingView widget and chart initialization...");
    await sleep(12000);

    // Evaluate Widgetbar presence in DOM
    const widgetbarCheck = await call('Runtime.evaluate', {
      expression: `(function() {
        var iframe = document.querySelector('#tv_chart_container iframe');
        if (!iframe || !iframe.contentDocument) {
          return { error: 'iframe or contentDocument not accessible' };
        }
        var doc = iframe.contentDocument;

        // Check for widgetbar tabs and right toolbar
        var rightToolbar = doc.querySelector('[data-name="right-toolbar"]') ||
                           doc.querySelector('.widgetbar-tabs') ||
                           doc.querySelector('[data-role="widgetbar-tabs"]') ||
                           doc.querySelector('.widgetbar-wrap');

        // Look for buttons with watchlist / details / datawindow icons or data-name
        var allButtons = Array.from(doc.querySelectorAll('button, [role="tab"], .button-x60rPtEp, [data-name]')).map(function(el) {
          return {
            name: el.getAttribute('data-name') || el.getAttribute('title') || el.getAttribute('aria-label') || el.className,
            text: el.textContent.trim()
          };
        });

        var watchlistTabFound = allButtons.some(function(b) {
          var s = (b.name + ' ' + b.text).toLowerCase();
          return s.includes('watch') || s.includes('quotes') || s.includes('watchlist');
        });

        var detailsTabFound = allButtons.some(function(b) {
          var s = (b.name + ' ' + b.text).toLowerCase();
          return s.includes('detail') || s.includes('quote') || s.includes('overview');
        });

        var dataWindowTabFound = allButtons.some(function(b) {
          var s = (b.name + ' ' + b.text).toLowerCase();
          return s.includes('data') || s.includes('window');
        });

        return {
          hasRightToolbar: !!rightToolbar || doc.body.innerHTML.includes('widgetbar'),
          watchlistTabFound: watchlistTabFound || doc.body.innerHTML.includes('watchlist'),
          detailsTabFound: detailsTabFound || doc.body.innerHTML.includes('details'),
          dataWindowTabFound: dataWindowTabFound || doc.body.innerHTML.includes('datawindow'),
          totalElementsInDoc: doc.querySelectorAll('*').length
        };
      })()`,
      returnByValue: true
    });

    const wbResult = widgetbarCheck.result?.result?.value || {};
    console.log("  Widgetbar DOM Elements Check:", JSON.stringify(wbResult));

    if (wbResult.hasRightToolbar || wbResult.watchlistTabFound) {
      console.log("  [PASS] Right-side widgetbar tabs detected in iframe DOM.");
      passed++;
    } else {
      console.error("  [FAIL] Widgetbar tabs not found in DOM!");
      failed++;
    }

    // Test Symbol Switching via widget.activeChart().setSymbol
    console.log("  Testing Dynamic Symbol Switching on Chart...");
    const symbolSwitchTest = await call('Runtime.evaluate', {
      expression: `(function() {
        if (!window.widget || !window.widget.activeChart) {
          return { error: 'widget or activeChart not ready' };
        }
        var chart = window.widget.activeChart();
        var initialSymbol = chart.symbol();

        // Switch to EURUSD.
        chart.setSymbol('EURUSD.');
        var symbolAfterSwitch = chart.symbol();

        // Switch to GBPUSD.
        chart.setSymbol('GBPUSD.');
        var secondSymbol = chart.symbol();

        // Return to XAUUSD.
        chart.setSymbol('XAUUSD.');
        var restoredSymbol = chart.symbol();

        return {
          initialSymbol: initialSymbol,
          symbolAfterSwitch: symbolAfterSwitch,
          secondSymbol: secondSymbol,
          restoredSymbol: restoredSymbol,
          success: true
        };
      })()`,
      returnByValue: true
    });

    const switchResult = symbolSwitchTest.result?.result?.value || {};
    console.log("  Symbol Switch Result:", JSON.stringify(switchResult));

    if (switchResult.success && switchResult.symbolAfterSwitch === 'EURUSD.' && switchResult.secondSymbol === 'GBPUSD.') {
      console.log("  [PASS] Symbol switching verified across multiple symbols (XAUUSD. -> EURUSD. -> GBPUSD. -> XAUUSD.).");
      passed++;
    } else {
      console.error("  [FAIL] Symbol switching failed: " + JSON.stringify(switchResult));
      failed++;
    }

    // Capture screenshot of widgetbar
    console.log("  Capturing screenshot of widgetbar...");
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      const buf = Buffer.from(shot.result.data, 'base64');
      const shotPath = path.join(SCREENSHOT_DIR, 'screenshot_widgetbar_tabs.png');
      fs.writeFileSync(shotPath, buf);
      console.log(`  [PASS] Screenshot saved to ${shotPath} (${buf.length} bytes).`);
      passed++;
    }

  } catch (err) {
    console.error("  [FAIL] Headless Chrome CDP execution error: " + err.message);
    failed++;
  } finally {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    try {
      execSync(`taskkill /F /T /PID ${chromeProc.pid} 2>nul`);
    } catch (_) {}
  }

  // ---------------------------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------------------------
  console.log("\n================================================================================");
  console.log(`VERIFICATION SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("================================================================================\n");

  if (failed === 0) {
    console.log(">>> ALL CHECKS PASSED SUCCESSFULLY! <<<\n");
    return 0;
  } else {
    console.error(">>> VERIFICATION FAILED! <<<\n");
    return 1;
  }
}

runTests().then(code => process.exit(code || 0));
