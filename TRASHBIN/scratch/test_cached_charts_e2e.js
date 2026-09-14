const { spawn } = require('child_process');
const fs = require('fs');

async function runTest() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-cc-test-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9224',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const putResp = await fetch('http://127.0.0.1:9224/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id && pending.has(d.id)) pending.get(d.id)(d); };
    await new Promise(r => ws.onopen = r);

    const call = (method, params = {}) => new Promise(res => {
      const cid = id++;
      pending.set(cid, res);
      ws.send(JSON.stringify({ id: cid, method, params }));
    });

    await call('Page.enable');
    await call('Runtime.enable');

    console.log("1. Waiting 10s for page and TradingView iframe to load...");
    await new Promise(r => setTimeout(r, 10000));

    // 1. Check right toolbar button and initial drawer state
    const initCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const rt = doc?.querySelector('[data-name="right-toolbar"]');
        const ccBtn = rt?.querySelector('[data-name="cached-charts"]');
        const drawer = document.getElementById('cached_charts_drawer');
        const countBadge = document.getElementById('cc_count_badge')?.textContent;
        const cards = Array.from(document.querySelectorAll('.cc-symbol-card .cc-card-ticker')).map(e => e.textContent);

        return {
          hasRightToolbar: !!rt,
          hasCcBtn: !!ccBtn,
          ccBtnClasses: ccBtn?.className,
          drawerPresent: !!drawer,
          drawerActive: drawer?.classList.contains('active'),
          countBadge,
          cachedSymbols: cards,
          hasZeroPill: !document.getElementById('cached_charts_floating_pill')
        };
      })()`,
      returnByValue: true
    });
    console.log("1. Initial Inspection:", JSON.stringify(initCheck.result?.result?.value, null, 2));

    // 2. Click the small button in the right toolbar to open the drawer
    console.log("2. Clicking CachedCharts button in right toolbar...");
    const clickRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const ccBtn = doc?.querySelector('[data-name="cached-charts"]');
        if (ccBtn) {
          ccBtn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()`,
      returnByValue: true
    });
    console.log("Click result:", clickRes.result?.result?.value);

    await new Promise(r => setTimeout(r, 1200));

    // Check drawer opened
    const drawerOpenCheck = await call('Runtime.evaluate', {
      expression: `(() => {
        const drawer = document.getElementById('cached_charts_drawer');
        const rect = drawer?.getBoundingClientRect();
        const overflowX = drawer ? window.getComputedStyle(drawer).overflowX : null;
        const countBadge = document.getElementById('cc_count_badge')?.textContent;
        const cards = Array.from(document.querySelectorAll('.cc-symbol-card .cc-card-ticker')).map(e => e.textContent);
        const broker = document.getElementById('cc_broker_label')?.textContent;
        const offset = document.getElementById('cc_offset_label')?.textContent;

        return {
          isOpen: drawer?.classList.contains('active'),
          rect,
          overflowX,
          countBadge,
          cards,
          broker,
          offset
        };
      })()`,
      returnByValue: true
    });
    console.log("2. Drawer Open State:", JSON.stringify(drawerOpenCheck.result?.result?.value, null, 2));

    // Capture screenshot of opened drawer
    let shot = await call('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      fs.writeFileSync('screenshots/test_cc_drawer_open.png', Buffer.from(shot.result.data, 'base64'));
      console.log("Saved screenshots/test_cc_drawer_open.png");
    }

    // 3. Test TradingView-Styled Real-Time Symbol Search Dropdown
    console.log("3. Testing Real-Time Symbol Search Dropdown by typing 'GOLD'...");
    const searchRes = await call('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const input = document.getElementById('cc_symbol_search_input');
        if (!input) return { error: "No search input" };
        input.value = "GOLD";
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 500));
        const dd = document.getElementById('cc_search_dropdown');
        const rows = Array.from(dd?.querySelectorAll('.cc-dropdown-row') || []).map(r => ({
          ticker: r.querySelector('.cc-dropdown-ticker span')?.textContent,
          desc: r.querySelector('.cc-dropdown-desc')?.textContent,
          cat: r.querySelector('.cc-cat-badge')?.textContent,
          exchange: r.querySelector('.cc-exchange-badge')?.textContent
        }));
        return {
          dropdownVisible: dd?.style.display !== 'none',
          rowCount: rows.length,
          rows: rows.slice(0, 5)
        };
      })()`,
      returnByValue: true
    });
    console.log("3. Search 'GOLD' Dropdown:", JSON.stringify(searchRes.result?.result?.value, null, 2));

    // Capture screenshot of search dropdown
    shot = await call('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      fs.writeFileSync('screenshots/test_cc_search_dropdown.png', Buffer.from(shot.result.data, 'base64'));
      console.log("Saved screenshots/test_cc_search_dropdown.png");
    }

    // 4. Test adding a 3rd symbol (e.g. BTCUSD.)
    console.log("4. Testing adding BTCUSD...");
    const addRes = await call('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const input = document.getElementById('cc_symbol_search_input');
        input.value = "BTC";
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await new Promise(r => setTimeout(r, 500));
        const dd = document.getElementById('cc_search_dropdown');
        const firstRow = dd?.querySelector('.cc-dropdown-row');
        if (firstRow) {
          firstRow.click();
          await new Promise(r => setTimeout(r, 1200));
        }
        const countBadge = document.getElementById('cc_count_badge')?.textContent;
        const cards = Array.from(document.querySelectorAll('.cc-symbol-card .cc-card-ticker')).map(e => e.textContent);
        return {
          countBadge,
          cards
        };
      })()`,
      returnByValue: true
    });
    console.log("4. After adding symbol:", JSON.stringify(addRes.result?.result?.value, null, 2));

    // Capture screenshot after symbol added
    shot = await call('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      fs.writeFileSync('screenshots/test_cc_symbol_added.png', Buffer.from(shot.result.data, 'base64'));
      console.log("Saved screenshots/test_cc_symbol_added.png");
    }

    ws.close();
  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    proc.kill('SIGKILL');
  }
}

runTest();
