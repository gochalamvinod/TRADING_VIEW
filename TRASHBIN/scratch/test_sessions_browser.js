const { spawn } = require('child_process');

async function testSessionsCompile() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-sessions-test-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9234',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const putResp = await fetch('http://127.0.0.1:9234/json/new?http://127.0.0.1:8080', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
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

    console.log("Waiting 10s for TradingView to load...");
    await new Promise(r => setTimeout(r, 10000));

    // Evaluate compile on Sessions [LuxAlgo]
    const compileEval = await call('Runtime.evaluate', {
      expression: `(() => {
        if (!window.PineIndicators || typeof window.PineIndicators.compilePineScript !== 'function') {
          return { error: 'PineIndicators.compilePineScript not found' };
        }
        const codeInput = document.getElementById('pine_code_input');
        const code = codeInput ? codeInput.value : '';
        const res = window.PineIndicators.compilePineScript(code);
        return {
          codeLength: code.length,
          success: res.success,
          errors: res.errors,
          hasStudy: Boolean(res.study),
          studyName: res.study ? res.study.name : null
        };
      })()`,
      returnByValue: true
    });

    console.log("Compilation Evaluation:", JSON.stringify(compileEval.result?.value, null, 2));

  } finally {
    proc.kill();
  }
}

testSessionsCompile().catch(console.error);
