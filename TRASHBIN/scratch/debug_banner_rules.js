const { spawn } = require('child_process');

async function debugBanner() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9295',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-debug-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9295/json/new?http://127.0.0.1:9999', { method: 'PUT' });
  const tab = await putResp.json();
  const ws = new WebSocket(tab.webSocketDebuggerUrl);
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
  await call('Page.enable');
  await call('Runtime.enable');
  await new Promise(r => setTimeout(r, 6000));

  const res = await call('Runtime.evaluate', {
    expression: `(() => {
      window.openScriptForStudy('Relative Strength Index');
      const b = document.getElementById('pine_readonly_banner');
      const dock = document.getElementById('pine_editor_dock');
      
      const matched = [];
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            if (b.matches(rule.selectorText)) {
              matched.push({ selector: rule.selectorText, cssText: rule.cssText });
            }
          }
        } catch(e) {}
      }
      
      return {
        dockDisplay: dock ? dock.style.display : 'no dock',
        dockComputedDisplay: dock ? window.getComputedStyle(dock).display : 'no dock',
        bannerInlineDisplay: b ? b.style.display : 'no banner',
        bannerComputedDisplay: b ? window.getComputedStyle(b).display : 'no banner',
        matchedRules: matched
      };
    })()`,
    returnByValue: true
  });

  console.log('CSS Rules debug:', JSON.stringify(res.result?.result?.value, null, 2));
  ws.close();
  proc.kill();
  process.exit(0);
}
debugBanner().catch(console.error);
