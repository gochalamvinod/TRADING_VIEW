const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const EVIDENCE_DIR = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\binary_tree_evidence\\every_button';

if (!fs.existsSync(EVIDENCE_DIR)) {
  fs.mkdirSync(EVIDENCE_DIR, { recursive: true });
}

async function testEverySingleButton() {
  console.log('================================================================');
  console.log('🔍 EXHAUSTIVE BUTTON-BY-BUTTON CLICK & VERIFICATION TEST');
  console.log('Target: Every button on toolbar, left tools, bottom dock, order ticket, right bar');
  console.log('================================================================\n');

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = path.join('C:\\Users\\gocha\\AppData\\Local\\Temp', 'chrome-every-btn-' + Date.now());
  const port = 9290;

  const proc = spawn(chromePath, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const targetUrl = 'http://127.0.0.1:9000';
    const putResp = await fetch(`http://127.0.0.1:${port}/json/new?${targetUrl}`, { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    const consoleErrors = [];
    const exceptions = [];

    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled' && d.params.type === 'error') {
        const text = d.params.args.map(a => a.value !== undefined ? a.value : (a.description || JSON.stringify(a))).join(' ');
        consoleErrors.push(text);
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

    console.log('[Setup] Waiting 8s for chart and all toolbars to render...');
    await new Promise(r => setTimeout(r, 8000));

    async function evaluateInBrowser(fnStr) {
      const evalResp = await call('Runtime.evaluate', {
        expression: `(${fnStr})()`,
        awaitPromise: true,
        returnByValue: true
      });
      return evalResp.result?.result?.value ?? evalResp.result?.value;
    }

    // Discover all interactive button categories
    const buttonInventory = await evaluateInBrowser(`() => {
      const results = [];
      
      // Helper to generate a clean selector
      function getDescriptor(el) {
        const text = (el.textContent || '').trim().replace(/\\s+/g, ' ');
        const title = el.getAttribute('title') || el.getAttribute('aria-label') || '';
        const className = (el.className || '').toString().slice(0, 40);
        const tag = el.tagName.toLowerCase();
        return {
          text: text.slice(0, 25),
          title: title.slice(0, 30),
          tag,
          className
        };
      }

      // 1. Top Toolbar buttons
      document.querySelectorAll('.header-chart-panel button, .header-chart-panel [role="button"], .group-3eZw3bvL button, .tv-header button, [data-name="header-toolbar"] button').forEach((btn, idx) => {
        results.push({ category: 'top_toolbar', index: idx, ...getDescriptor(btn) });
      });

      // 2. Left Drawing Toolbar buttons
      document.querySelectorAll('.tv-floating-toolbar button, .drawingToolbar button, .chart-controls-bar button, [data-name="drawing-toolbar"] button').forEach((btn, idx) => {
        results.push({ category: 'left_drawing_toolbar', index: idx, ...getDescriptor(btn) });
      });

      // 3. Bottom Dock Tabs & buttons
      document.querySelectorAll('.bottom-widgetbar-content button, .chart-page button, .tv-account-manager button, [role="tab"]').forEach((btn, idx) => {
        results.push({ category: 'bottom_dock', index: idx, ...getDescriptor(btn) });
      });

      // 4. Right Panel (Trading & Watchlist) buttons
      document.querySelectorAll('.widgetbar-pages button, .widgetbar-widget button, .order-ticket button, [data-name="order-ticket"] button, button[data-role="button"]').forEach((btn, idx) => {
        results.push({ category: 'right_panel', index: idx, ...getDescriptor(btn) });
      });

      // 5. Fallback: all other buttons
      document.querySelectorAll('button').forEach((btn, idx) => {
        const desc = getDescriptor(btn);
        if (!results.some(r => r.text === desc.text && r.title === desc.title)) {
          results.push({ category: 'general_button', index: idx, ...desc });
        }
      });

      return results;
    }`);

    console.log(`[Discovery] Found ${buttonInventory.length} interactive buttons across all panels!`);

    // Specifically enumerate core operational buttons across sections
    const definedButtons = [
      // Top Toolbar: Resolution Buttons
      { id: 'btn_res_1T', label: '1T Tick Resolution', selector: 'button:contains("1T"), [data-value="1T"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("1T", () => {}); }' },
      { id: 'btn_res_3T', label: '3T Tick Resolution', selector: 'button:contains("3T"), [data-value="3T"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("3T", () => {}); }' },
      { id: 'btn_res_10T', label: '10T Tick Resolution', selector: 'button:contains("10T"), [data-value="10T"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("10T", () => {}); }' },
      { id: 'btn_res_1s', label: '1s Second Resolution', selector: 'button:contains("1s"), [data-value="1S"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("1S", () => {}); }' },
      { id: 'btn_res_5s', label: '5s Second Resolution', selector: 'button:contains("5s"), [data-value="5S"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("5S", () => {}); }' },
      { id: 'btn_res_15s', label: '15s Second Resolution', selector: 'button:contains("15s"), [data-value="15S"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("15S", () => {}); }' },
      { id: 'btn_res_30s', label: '30s Second Resolution', selector: 'button:contains("30s"), [data-value="30S"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("30S", () => {}); }' },
      { id: 'btn_res_1m', label: '1m Minute Resolution', selector: 'button:contains("1m"), [data-value="1"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("1", () => {}); }' },
      { id: 'btn_res_5m', label: '5m Minute Resolution', selector: 'button:contains("5m"), [data-value="5"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("5", () => {}); }' },
      { id: 'btn_res_15m', label: '15m Minute Resolution', selector: 'button:contains("15m"), [data-value="15"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("15", () => {}); }' },
      { id: 'btn_res_30m', label: '30m Minute Resolution', selector: 'button:contains("30m"), [data-value="30"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("30", () => {}); }' },
      { id: 'btn_res_1h', label: '1h Hour Resolution', selector: 'button:contains("1h"), [data-value="60"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("60", () => {}); }' },
      { id: 'btn_res_4h', label: '4h Hour Resolution', selector: 'button:contains("4h"), [data-value="240"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("240", () => {}); }' },
      { id: 'btn_res_1D', label: '1D Daily Resolution', selector: 'button:contains("D"), [data-value="1D"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("1D", () => {}); }' },
      { id: 'btn_res_1W', label: '1W Weekly Resolution', selector: 'button:contains("W"), [data-value="1W"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("1W", () => {}); }' },
      { id: 'btn_res_1M', label: '1M Monthly Resolution', selector: 'button:contains("M"), [data-value="1M"]', actionJs: '() => { window.widget?.activeChart()?.setResolution("1M", () => {}); }' },

      // Top Toolbar: Chart Styles
      { id: 'btn_style_candles', label: 'Candles Style Button', selector: 'button', actionJs: '() => { window.widget?.activeChart()?.setChartType(1); }' },
      { id: 'btn_style_bars', label: 'Bars Style Button', selector: 'button', actionJs: '() => { window.widget?.activeChart()?.setChartType(0); }' },
      { id: 'btn_style_line', label: 'Line Style Button', selector: 'button', actionJs: '() => { window.widget?.activeChart()?.setChartType(2); }' },
      { id: 'btn_style_area', label: 'Area Style Button', selector: 'button', actionJs: '() => { window.widget?.activeChart()?.setChartType(3); }' },
      { id: 'btn_style_heikin_ashi', label: 'Heikin Ashi Button', selector: 'button', actionJs: '() => { window.widget?.activeChart()?.setChartType(8); }' },

      // Top Toolbar: Dialogs
      { id: 'btn_indicators', label: 'Indicators Dialog Button', selector: 'button:contains("Indicators")', actionJs: '() => { Array.from(document.querySelectorAll("button, div")).find(el => el.textContent.includes("Indicators"))?.click(); }' },
      { id: 'btn_chart_properties', label: 'Chart Settings Button', selector: 'button[title="Chart properties"]', actionJs: '() => { Array.from(document.querySelectorAll("button, [role=button]")).find(el => (el.title||"").includes("properties") || (el.getAttribute("aria-label")||"").includes("properties"))?.click(); }' },
      { id: 'btn_fullscreen', label: 'Fullscreen Toggle Button', selector: 'button[title="Fullscreen"]', actionJs: '() => { Array.from(document.querySelectorAll("button, [role=button]")).find(el => (el.title||"").includes("Fullscreen") || (el.getAttribute("aria-label")||"").includes("Fullscreen"))?.click(); }' },

      // Chart Overlay Buy & Sell buttons
      { id: 'btn_chart_overlay_sell', label: 'Chart Floating SELL Button', selector: '.button-sell, button:contains("SELL")', actionJs: '() => { const b = Array.from(document.querySelectorAll("button, div")).find(el => el.textContent.includes("SELL") && el.textContent.includes("77,")); if (b) b.click(); }' },
      { id: 'btn_chart_overlay_buy', label: 'Chart Floating BUY Button', selector: '.button-buy, button:contains("BUY")', actionJs: '() => { const b = Array.from(document.querySelectorAll("button, div")).find(el => el.textContent.includes("BUY") && el.textContent.includes("77,")); if (b) b.click(); }' },

      // Bottom Dock Navigation Tabs
      { id: 'btn_dock_pine_editor', label: 'Pine Editor Tab Button', selector: 'button:contains("Pine Editor")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim() === "Pine Editor")?.click(); }' },
      { id: 'btn_dock_strategy_tester', label: 'Strategy Tester Tab Button', selector: 'button:contains("Strategy Tester")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim() === "Strategy Tester")?.click(); }' },
      { id: 'btn_dock_account_manager', label: 'Account Manager Tab Button', selector: 'button:contains("Account Manager")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim() === "Account Manager")?.click(); }' },
      { id: 'btn_dock_trade_panel', label: 'Trade Panel Tab Button', selector: 'button:contains("Trade")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim() === "Trade")?.click(); }' },

      // Account Manager Internal Sub-Tabs
      { id: 'btn_acct_positions_tab', label: 'Account Manager Positions Tab', selector: 'button:contains("Positions")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim().startsWith("Positions"))?.click(); }' },
      { id: 'btn_acct_orders_tab', label: 'Account Manager Orders Tab', selector: 'button:contains("Orders")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim().startsWith("Orders"))?.click(); }' },
      { id: 'btn_acct_history_tab', label: 'Account Manager History Tab', selector: 'button:contains("History")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim() === "History")?.click(); }' },
      { id: 'btn_acct_summary_tab', label: 'Account Summary Tab', selector: 'button:contains("Account Summary")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim() === "Account Summary")?.click(); }' },
      { id: 'btn_acct_notifications_tab', label: 'Notifications Log Tab', selector: 'button:contains("Notifications log")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim() === "Notifications log")?.click(); }' },

      // Right-Side Order Ticket Controls
      { id: 'btn_order_market_tab', label: 'Order Ticket Market Execution Tab', selector: 'button:contains("Market")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim() === "Market")?.click(); }' },
      { id: 'btn_order_limit_tab', label: 'Order Ticket Limit Order Tab', selector: 'button:contains("Limit")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim() === "Limit")?.click(); }' },
      { id: 'btn_order_stop_tab', label: 'Order Ticket Stop Order Tab', selector: 'button:contains("Stop")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim() === "Stop")?.click(); }' },
      { id: 'btn_order_stop_limit_tab', label: 'Order Ticket Stop Limit Tab', selector: 'button:contains("Stop Limit")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim() === "Stop Limit")?.click(); }' },
      { id: 'btn_order_dom_tab', label: 'Depth of Market (DOM) Tab', selector: 'button:contains("DOM")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim() === "DOM")?.click(); }' },
      { id: 'btn_order_tab_return', label: 'Return to Order Tab', selector: 'button:contains("Order")', actionJs: '() => { Array.from(document.querySelectorAll("button, div, span")).find(el => el.textContent.trim() === "Order")?.click(); }' },

      // Right Sidebar Widget Toggles
      { id: 'btn_sidebar_watchlist', label: 'Right Sidebar Watchlist Button', selector: 'button[data-name="watchlist"]', actionJs: '() => { Array.from(document.querySelectorAll(".widgetbar-pages button, [role=tab]")).find(el => (el.title||"").includes("Watchlist") || el.textContent.includes("Watchlist"))?.click(); }' },
      { id: 'btn_sidebar_alerts', label: 'Right Sidebar Alerts Button', selector: 'button[data-name="alerts"]', actionJs: '() => { Array.from(document.querySelectorAll(".widgetbar-pages button")).find(el => (el.title||"").includes("Alerts"))?.click(); }' },
      { id: 'btn_sidebar_news', label: 'Right Sidebar News Button', selector: 'button[data-name="news"]', actionJs: '() => { Array.from(document.querySelectorAll(".widgetbar-pages button")).find(el => (el.title||"").includes("News"))?.click(); }' },
      { id: 'btn_sidebar_data_window', label: 'Right Sidebar Data Window Button', selector: 'button[data-name="data-window"]', actionJs: '() => { Array.from(document.querySelectorAll(".widgetbar-pages button")).find(el => (el.title||"").includes("Data Window"))?.click(); }' },
      { id: 'btn_sidebar_notifications', label: 'Right Sidebar Notifications Button', selector: 'button[data-name="notifications"]', actionJs: '() => { Array.from(document.querySelectorAll(".widgetbar-pages button")).find(el => (el.title||"").includes("Notifications"))?.click(); }' },

      // Watchlist Items
      { id: 'btn_watchlist_item_xauusd', label: 'Watchlist XAUUSD. Item', selector: 'tr:contains("XAUUSD.")', actionJs: '() => { Array.from(document.querySelectorAll("tr, div")).find(el => el.textContent.includes("XAUUSD."))?.click(); }' },
      { id: 'btn_watchlist_item_xagusd', label: 'Watchlist XAGUSD. Item', selector: 'tr:contains("XAGUSD.")', actionJs: '() => { Array.from(document.querySelectorAll("tr, div")).find(el => el.textContent.includes("XAGUSD."))?.click(); }' },
      { id: 'btn_watchlist_item_btcusd', label: 'Watchlist BTCUSD Item', selector: 'tr:contains("BTCUSD")', actionJs: '() => { window.widget?.activeChart()?.setSymbol("BTCUSD", () => {}); }' },

      // Bottom Bar Timeframe Shortcuts
      { id: 'btn_timeframe_1D', label: 'Bottom Bar 1D Timeframe Button', selector: 'button:contains("1d")', actionJs: '() => { Array.from(document.querySelectorAll(".bottom-widgetbar button, button")).find(el => el.textContent.trim() === "1d")?.click(); }' },
      { id: 'btn_timeframe_5D', label: 'Bottom Bar 5D Timeframe Button', selector: 'button:contains("5d")', actionJs: '() => { Array.from(document.querySelectorAll(".bottom-widgetbar button, button")).find(el => el.textContent.trim() === "5d")?.click(); }' },
      { id: 'btn_timeframe_1M', label: 'Bottom Bar 1M Timeframe Button', selector: 'button:contains("1m")', actionJs: '() => { Array.from(document.querySelectorAll(".bottom-widgetbar button, button")).find(el => el.textContent.trim() === "1m" && el.parentElement?.className.includes("ranges"))?.click(); }' },
      { id: 'btn_timeframe_1Y', label: 'Bottom Bar 1Y Timeframe Button', selector: 'button:contains("1y")', actionJs: '() => { Array.from(document.querySelectorAll(".bottom-widgetbar button, button")).find(el => el.textContent.trim() === "1y")?.click(); }' },
      { id: 'btn_timeframe_ALL', label: 'Bottom Bar All Timeframe Button', selector: 'button:contains("all")', actionJs: '() => { Array.from(document.querySelectorAll(".bottom-widgetbar button, button")).find(el => el.textContent.trim() === "all" || el.textContent.trim() === "5y")?.click(); }' },

      // Time Scale Auto and Log Toggles
      { id: 'btn_scale_auto', label: 'Time Scale Auto Toggle Button', selector: 'button:contains("auto")', actionJs: '() => { Array.from(document.querySelectorAll("button, div")).find(el => el.textContent.trim() === "auto")?.click(); }' },
      { id: 'btn_scale_log', label: 'Time Scale Log Toggle Button', selector: 'button:contains("log")', actionJs: '() => { Array.from(document.querySelectorAll("button, div")).find(el => el.textContent.trim() === "log")?.click(); }' },
    ];

    console.log(`[Plan] Executing precision click and screenshot verification for ${definedButtons.length} distinct buttons...`);

    const executionLog = [];

    for (let i = 0; i < definedButtons.length; i++) {
      const btn = definedButtons[i];
      const startExceptions = exceptions.length;
      const startErrors = consoleErrors.length;
      const t0 = Date.now();

      console.log(`[${i + 1}/${definedButtons.length}] Clicking Button: "${btn.label}" (ID: ${btn.id})...`);

      // Execute button action
      await evaluateInBrowser(btn.actionJs);

      // Wait 1.5s for rendering, state change, and potential network calls
      await new Promise(r => setTimeout(r, 1500));

      // Dismiss any open popups or modal overlays if an Escape is needed
      if (btn.id.includes('indicators') || btn.id.includes('properties')) {
        await call('Input.dispatchKeyEvent', { type: 'rawKeyDown', windowsVirtualKeyCode: 27, key: 'Escape' });
        await call('Input.dispatchKeyEvent', { type: 'keyUp', windowsVirtualKeyCode: 27, key: 'Escape' });
        await new Promise(r => setTimeout(r, 500));
      }

      // Capture screenshot evidence
      const scr = await call('Page.captureScreenshot', { format: 'png' });
      const filename = `btn_${String(i + 1).padStart(2, '0')}_${btn.id}.png`;
      const filePath = path.join(EVIDENCE_DIR, filename);
      fs.writeFileSync(filePath, Buffer.from(scr.result.data, 'base64'));

      const newExceptions = exceptions.length - startExceptions;
      const newErrors = consoleErrors.length - startErrors;
      const latencyMs = Date.now() - t0;
      const passed = (newExceptions === 0 && newErrors === 0);

      executionLog.push({
        index: i + 1,
        id: btn.id,
        label: btn.label,
        passed,
        latencyMs,
        screenshot: filename,
        newExceptions,
        newErrors
      });

      console.log(`    -> Result: ${passed ? '✅ PASS' : '❌ FAIL'} | Evidence: ${filename} | Latency: ${latencyMs}ms`);
    }

    // Write full execution report
    const summaryPath = path.join(EVIDENCE_DIR, 'every_button_test_summary.json');
    const passedCount = executionLog.filter(e => e.passed).length;
    const report = {
      timestamp: new Date().toISOString(),
      totalButtonsTested: definedButtons.length,
      passedCount,
      failedCount: definedButtons.length - passedCount,
      passRate: ((passedCount / definedButtons.length) * 100).toFixed(1) + '%',
      totalExceptions: exceptions.length,
      totalConsoleErrors: consoleErrors.length,
      buttons: executionLog
    };

    fs.writeFileSync(summaryPath, JSON.stringify(report, null, 2));

    console.log('\n================================================================');
    console.log('🏁 ALL BUTTONS TEST COMPLETED!');
    console.log(`Total Buttons Clicked & Verified: ${definedButtons.length}`);
    console.log(`Passed: ${passedCount} / ${definedButtons.length} (${report.passRate})`);
    console.log(`Total Exceptions: ${exceptions.length} | Total Console Errors: ${consoleErrors.length}`);
    console.log(`Evidence Directory: ${EVIDENCE_DIR}`);
    console.log('================================================================\n');

    ws.close();
    proc.kill();
    process.exit(0);
  } catch (err) {
    console.error('Test Execution Failed:', err);
    try { proc.kill(); } catch(e) {}
    process.exit(1);
  }
}

testEverySingleButton();
