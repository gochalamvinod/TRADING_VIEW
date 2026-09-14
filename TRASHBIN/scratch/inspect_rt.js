const { spawn } = require('child_process');
const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-inspect-' + Date.now();
const proc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9223',
  '--window-size=1920,1080',
  '--disable-gpu',
  '--no-sandbox',
  '--user-data-dir=' + userDataDir
]);

setTimeout(async () => {
  try {
    const putResp = await fetch('http://127.0.0.1:9223/json/new?http://127.0.0.1:9000', { method: 'PUT' });
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
    await new Promise(r => setTimeout(r, 6000));
    const rtInfo = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const rt = doc?.querySelector('[data-name="right-toolbar"]');
        const rect = rt ? rt.getBoundingClientRect() : null;
        const btns = Array.from(rt?.querySelectorAll("button") || []).map(b => ({
          name: b.getAttribute("data-name"),
          className: b.className,
          rect: b.getBoundingClientRect()
        }));
        return { rect, btns };
      })()`,
      returnByValue: true
    });
    console.log('Right toolbar info:', JSON.stringify(rtInfo.result?.result?.value, null, 2));
    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    proc.kill('SIGKILL');
  }
}, 2000);
