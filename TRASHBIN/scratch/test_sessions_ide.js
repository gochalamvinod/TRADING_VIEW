const { spawn } = require('child_process');

async function testSessionsIDE() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-sessions-ide-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9235',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const putResp = await fetch('http://127.0.0.1:9235/json/new?http://127.0.0.1:8080', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled') {
        const text = d.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        console.log(`[Browser Console ${d.params.type}]`, text);
      }
      if (d.method === 'Runtime.exceptionThrown') {
        console.log('🚨 [Browser Exception]', d.params.exceptionDetails?.text, d.params.exceptionDetails?.exception?.description);
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

    console.log("Waiting 10s for TradingView chart to fully load...");
    await new Promise(r => setTimeout(r, 10000));

    // Step 1: Open Pine Editor IDE
    console.log("Opening PineEditorIDE...");
    await call('Runtime.evaluate', {
      expression: `window.PineEditorIDE.open()`
    });

    await new Promise(r => setTimeout(r, 2000));

    // Step 2: Check current script in editor
    const scriptInfo = await call('Runtime.evaluate', {
      expression: `(() => {
        const titleEl = document.getElementById('pine_script_title_display');
        const codeInput = document.getElementById('pine_code_input');
        return {
          title: titleEl ? titleEl.textContent : null,
          codeLength: codeInput ? codeInput.value.length : 0,
          first50: codeInput ? codeInput.value.substring(0, 50) : ''
        };
      })()`,
      returnByValue: true
    });
    console.log("Script Info:", JSON.stringify(scriptInfo.result?.value, null, 2));

    // Step 3: Test compilation directly
    console.log("Running compilation check...");
    const compRes = await call('Runtime.evaluate', {
      expression: `window.PineEditorIDE.runCompilation(false)`,
      awaitPromise: true,
      returnByValue: true
    });
    console.log("Compilation Result:", JSON.stringify(compRes.result?.value, null, 2));

    // Step 4: Test clicking Add to Chart
    console.log("Clicking Add to Chart button...");
    const addRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const btn = document.getElementById('pine_add_to_chart_btn');
        if (btn) {
          btn.click();
          return { clicked: true };
        }
        return { clicked: false };
      })()`,
      returnByValue: true
    });
    console.log("Click Result:", JSON.stringify(addRes.result?.value, null, 2));

    await new Promise(r => setTimeout(r, 4000));

  } finally {
    proc.kill();
  }
}

testSessionsIDE().catch(console.error);
