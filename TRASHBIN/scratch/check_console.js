const { spawn } = require('child_process');

async function checkConsole() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9286',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-chk-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9286/json/new?http://127.0.0.1:9999', { method: 'PUT' });
  const tab = await putResp.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.method === 'Runtime.consoleAPICalled') {
      console.log('BROWSER CONSOLE:', d.params.type, d.params.args.map(a => a.value || a.description).join(' '));
    }
    if (d.method === 'Runtime.exceptionThrown') {
      console.error('BROWSER EXCEPTION:', d.params.exceptionDetails?.text, d.params.exceptionDetails?.exception?.description);
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
  await new Promise(r => setTimeout(r, 5000));

  const res = await call('Runtime.evaluate', {
    expression: `(() => {
      return {
        hasOpenIndicatorsModal: typeof window.openIndicatorsModal,
        hasPineEditorIDE: typeof window.PineEditorIDE,
        hasPineIndicators: typeof window.PineIndicators,
        openIndicatorsModalFn: window.PineEditorIDE ? typeof window.PineEditorIDE.openIndicatorsModal : 'none'
      };
    })()`,
    returnByValue: true
  });
  console.log('Result:', JSON.stringify(res.result?.result?.value, null, 2));

  ws.close();
  proc.kill();
  process.exit(0);
}
checkConsole().catch(console.error);
