const { spawn } = require('child_process');

async function verifyAllFixes() {
  console.log('=== STARTING END-TO-END VERIFICATION ===');
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-verify-all-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9236',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const putResp = await fetch('http://127.0.0.1:9236/json/new?http://127.0.0.1:8080', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    const exceptions = [];
    const consoleLogs = [];

    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.exceptionThrown') {
        const text = d.params.exceptionDetails?.text + ' ' + (d.params.exceptionDetails?.exception?.description || '');
        exceptions.push(text);
        console.log('🚨 [Exception]', text);
      }
      if (d.method === 'Runtime.consoleAPICalled') {
        const text = d.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        if (d.params.type === 'error' || text.includes('time is not a function') || text.includes('Cannot read properties of null') || text.includes('consoleDrawer is not defined')) {
          consoleLogs.push({ type: d.params.type, text });
          console.log(`⚠️ [Console ${d.params.type}]`, text);
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

    console.log("Waiting 10s for TradingView chart to initialize...");
    await new Promise(r => setTimeout(r, 10000));

    // TEST 1: Open Pine Editor
    console.log("TEST 1: Opening Pine Editor IDE...");
    await call('Runtime.evaluate', {
      expression: `window.PineEditorIDE.open()`
    });
    await new Promise(r => setTimeout(r, 2000));

    const editorOpen = await call('Runtime.evaluate', {
      expression: `Boolean(document.getElementById('pine_editor_dock') && document.getElementById('pine_editor_dock').style.display !== 'none')`,
      returnByValue: true
    });
    console.log("Pine Editor Open:", editorOpen.result?.value);

    // TEST 2: Type in Pine Editor and verify Autocomplete / IntelliSense
    console.log("TEST 2: Typing in Pine Editor to verify inline autocomplete popover...");
    const acRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const input = document.getElementById('pine_code_input');
        if (!input) return { error: 'No code input found' };
        
        // Save current code
        const origVal = input.value;
        // Append a new line with 'ta.'
        input.value += '\\nta.';
        input.selectionStart = input.selectionEnd = input.value.length;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        const popover = document.getElementById('pine_autocomplete_popover');
        const acList = document.getElementById('pine_ac_list');
        const dirty = document.getElementById('pine_dirty_indicator');
        
        const isPopoverVisible = popover && popover.style.display !== 'none';
        const itemCount = acList ? acList.children.length : 0;
        const dirtyVisible = dirty && dirty.style.display !== 'none';
        
        // Restore original code
        input.value = origVal;
        input.selectionStart = input.selectionEnd = origVal.length;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        
        return {
          isPopoverVisible,
          itemCount,
          dirtyVisible,
          firstSuggestion: acList && acList.children[0] ? acList.children[0].textContent.trim().replace(/\\s+/g, ' ') : null
        };
      })()`,
      returnByValue: true
    });
    console.log("Autocomplete Test Result:", JSON.stringify(acRes.result?.value, null, 2));

    // TEST 3: Check Dropdown menu opening (~ Sessions [LuxAlgo] by ... ... ▼)
    console.log("TEST 3: Checking script dropdown menu...");
    const dropdownRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const trigger = document.getElementById('pine_script_dropdown_trigger');
        const menu = document.getElementById('pine_dropdown_menu');
        if (!trigger || !menu) return { error: 'Trigger or menu not found' };
        trigger.click();
        const isOpen = menu.classList.contains('show');
        trigger.click(); // close
        return { dropdownWorks: isOpen };
      })()`,
      returnByValue: true
    });
    console.log("Dropdown Menu Test Result:", JSON.stringify(dropdownRes.result?.value, null, 2));

    // TEST 4: Compile & Add to Chart (Play Button) for Sessions [LuxAlgo]
    console.log("TEST 4: Clicking Add to Chart (Play Button) for Sessions [LuxAlgo]...");
    const playRes = await call('Runtime.evaluate', {
      expression: `(async () => {
        const btn = document.getElementById('pine_add_to_chart_btn');
        if (!btn) return { error: 'Play button not found' };
        
        // Click play button
        btn.click();
        await new Promise(r => setTimeout(r, 3000));
        
        const statusEl = document.getElementById('pine_status_text');
        const compErrors = window._compilerErrors || [];
        const activeStudies = window.PineEditorIDE ? window.PineEditorIDE.getCurrentScript() : null;
        
        return {
          clicked: true,
          statusText: statusEl ? statusEl.textContent : null,
          compileErrors: compErrors.length,
          activeStudyId: activeStudies ? activeStudies.activeStudyId : null
        };
      })()`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log("Play Button Result:", JSON.stringify(playRes.result?.value, null, 2));

    // Wait 3 seconds to observe chart rendering and any runtime errors
    await new Promise(r => setTimeout(r, 3000));

    console.log('\n=== FINAL VERIFICATION SUMMARY ===');
    console.log('Exceptions thrown:', exceptions.length);
    console.log('Critical console warnings/errors:', consoleLogs.length);
    if (exceptions.length > 0) {
      console.log('Exceptions list:', exceptions);
    }
    if (consoleLogs.length > 0) {
      console.log('Console warnings/errors:', consoleLogs);
    }

  } finally {
    proc.kill();
  }
}

verifyAllFixes().catch(console.error);
