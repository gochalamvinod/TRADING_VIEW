const { spawn } = require('child_process');

async function test() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-diag-' + Date.now();
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--remote-allow-origins=*',
    '--disable-web-security',
    '--no-sandbox',
    '--window-size=1920,1080',
    '--user-data-dir=' + userDataDir
  ]);
  await new Promise(r => setTimeout(r, 3000));
  const putResp = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:9000', { method: 'PUT' });
  const tabInfo = await putResp.json();
  const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();
  ws.onmessage = (e) => {
    const d = JSON.parse(e.data);
    if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); }
  };
  await new Promise(r => ws.onopen = r);
  function call(method, params = {}) {
    const curId = id++;
    return new Promise((resolve, reject) => {
      pending.set(curId, resolve);
      ws.send(JSON.stringify({ id: curId, method, params }));
    });
  }
  await call('Page.enable');
  await call('Runtime.enable');
  console.log('Waiting 12s...');
  await new Promise(r => setTimeout(r, 12000));

  const diag = await call('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const doc = iframe?.contentDocument;
      
      const fxBtn = doc?.querySelector('.layout__area--top button[aria-label*="Indicator"]');
      if (fxBtn) fxBtn.click();
      
      return { fxClicked: !!fxBtn };
    })()`
  });
  console.log('fx clicked:', diag.result?.result?.value);
  await new Promise(r => setTimeout(r, 1500));

  const diag2 = await call('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const doc = iframe?.contentDocument;
      const allDivs = Array.from(doc?.querySelectorAll('div, [role="dialog"], input') || []).map(el => ({
        tag: el.tagName,
        className: el.className,
        dataName: el.getAttribute('data-name'),
        role: el.getAttribute('role'),
        text: el.textContent?.trim().slice(0, 40)
      }));
      return allDivs.filter(d => d.role === 'dialog' || (d.dataName && d.dataName.includes('dialog')) || (d.text && d.text.includes('Indicators, metrics')));
    })()`
  });
  console.log('Dialog elements found:', diag2.result?.result?.value);

  // Close dialog
  await call('Runtime.evaluate', {
    expression: `(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const doc = iframe?.contentDocument;
      doc?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true }));
    })()`
  });
  await new Promise(r => setTimeout(r, 500));

  // Check candle style dropdown
  const diag3 = await call('Runtime.evaluate', {
    awaitPromise: true,
    returnByValue: true,
    expression: `(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const doc = iframe?.contentDocument;
      const btns = Array.from(doc?.querySelectorAll('.layout__area--top button') || []);
      const candleBtn = btns.find(b => b.getAttribute('aria-label')?.includes('Candle') || b.getAttribute('aria-label')?.includes('style') || b.querySelector('svg'));
      return {
        allTopButtons: btns.map(b => ({
          ariaLabel: b.getAttribute('aria-label'),
          text: b.textContent?.trim(),
          dataName: b.getAttribute('data-name')
        }))
      };
    })()`
  });
  console.log('All top buttons:', diag3.result?.result?.value);

  ws.close();
  chromeProc.kill('SIGKILL');
}
test().catch(console.error);
