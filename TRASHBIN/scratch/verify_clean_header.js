const { spawn } = require('child_process');
const fs = require('fs');

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-clean-header-' + Date.now();
const proc = spawn(chromePath, [
  '--headless=new',
  '--remote-debugging-port=9225',
  '--window-size=1920,1080',
  '--disable-gpu',
  '--no-sandbox',
  '--user-data-dir=' + userDataDir
]);

setTimeout(async () => {
  try {
    const putResp = await fetch('http://127.0.0.1:9225/json/new?http://127.0.0.1:9000', { method: 'PUT' });
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
    await new Promise(r => setTimeout(r, 8000));

    const check = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const headerBtns = Array.from(doc?.querySelectorAll('button, [data-role="button"]') || [])
          .map(b => b.textContent)
          .filter(t => t.includes('CachedCharts'));
        const rt = doc?.querySelector('[data-name="right-toolbar"]');
        const ccRtBtn = rt?.querySelector('[data-name="cached-charts"]');
        return {
          headerMatchesCount: headerBtns.length,
          headerMatches: headerBtns,
          hasRightToolbarBtn: !!ccRtBtn
        };
      })()`,
      returnByValue: true
    });
    console.log('Inspection Result:', JSON.stringify(check.result?.result?.value, null, 2));

    const shot = await call('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      fs.writeFileSync('screenshots/test_clean_header_no_btn.png', Buffer.from(shot.result.data, 'base64'));
      console.log('Saved screenshots/test_clean_header_no_btn.png');
    }
    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    proc.kill('SIGKILL');
  }
}, 2000);
