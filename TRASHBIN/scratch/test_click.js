const { spawn } = require('child_process');

async function testClick() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9289',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-click-' + Date.now()
  ]);
  await new Promise(r => setTimeout(r, 2000));
  const putResp = await fetch('http://127.0.0.1:9289/json/new?http://127.0.0.1:9999', { method: 'PUT' });
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

  // Listen to console logs
  ws.onmessage = e => {
    const d = JSON.parse(e.data);
    if (d.method === 'Runtime.consoleAPICalled') {
      console.log('CONSOLE:', d.params.type, d.params.args.map(a => a.value || a.description).join(' '));
    }
    if (d.id && pending.has(d.id)) pending.get(d.id)(d);
  };

  console.log('--- Clicking Alerts button ---');
  const alertRes = await call('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const doc = iframe?.contentDocument;
      const btn = doc?.querySelector('[data-name="alerts"]');
      if (!btn) return 'alerts btn not found';
      btn.click();
      const panel = document.getElementById('tv_alerts_panel');
      return {
        clicked: true,
        panelExists: !!panel,
        panelClasses: panel?.className,
        panelStyleDisplay: panel?.style.display,
        panelOffsetWidth: panel?.offsetWidth,
        panelOffsetHeight: panel?.offsetHeight,
        panelComputedDisplay: panel ? window.getComputedStyle(panel).display : null,
        panelRect: panel ? panel.getBoundingClientRect() : null
      };
    })()`,
    returnByValue: true
  });
  console.log('Alert Click Result:', JSON.stringify(alertRes.result?.result?.value, null, 2));

  console.log('--- Clicking Watchlist (base) button ---');
  const baseRes = await call('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const doc = iframe?.contentDocument;
      const btn = doc?.querySelector('[data-name="base"]');
      if (!btn) return 'base btn not found';
      const beforeClass = btn.className;
      btn.click();
      const afterClass = btn.className;
      // Also check if widgetbar pages changed
      const pages = Array.from(doc.querySelectorAll('[class*="widgetbar-pages"], [class*="pages"]')).map(p => ({
        class: p.className,
        rect: p.getBoundingClientRect()
      }));
      return {
        clicked: true,
        beforeClass,
        afterClass,
        pages
      };
    })()`,
    returnByValue: true
  });
  console.log('Base Click Result:', JSON.stringify(baseRes.result?.result?.value, null, 2));

  ws.close();
  proc.kill();
  process.exit(0);
}
testClick().catch(console.error);
