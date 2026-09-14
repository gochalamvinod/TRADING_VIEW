const { spawn } = require('child_process');
const fs = require('fs');

async function test() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-ind-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9232',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const putResp = await fetch('http://127.0.0.1:9232/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();
    const consoleLogs = [];
    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled') {
        const text = d.params.args.map(a => a.value || a.description || JSON.stringify(a)).join(' ');
        consoleLogs.push(`[${d.params.type}] ${text}`);
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
    console.log('Waiting 10s...');
    await new Promise(r => setTimeout(r, 10000));

    // Inspect iframe targets
    const targets = await (await fetch('http://127.0.0.1:9232/json')).json();
    console.log('Targets:', targets.map(t => ({ type: t.type, title: t.title, url: t.url.slice(0, 50) })));

    // Try finding the button and clicking it inside the iframe or calling executeActionById
    const evalResult = await call('Runtime.evaluate', {
      expression: `(function() {
        const iframe = document.querySelector('#tv_chart_container iframe');
        if (!iframe) return { error: 'No iframe found' };
        let doc;
        try { doc = iframe.contentDocument || iframe.contentWindow.document; } catch(e) { return { error: 'Cannot access iframe doc: ' + e.message }; }
        
        // Find the Indicators button
        const btn = doc.querySelector('[data-name="indicators"], #header-toolbar-indicators, [data-role="button"][title*="Indicator"]');
        if (!btn) {
          // List buttons in header
          const allBtns = Array.from(doc.querySelectorAll('[data-role="button"]')).map(b => ({
            id: b.id,
            name: b.getAttribute('data-name'),
            title: b.getAttribute('title'),
            text: b.innerText
          }));
          return { error: 'Button not found', allBtns: allBtns.slice(0, 15) };
        }

        // Try clicking it!
        const beforeClick = {
          btnTag: btn.tagName,
          btnId: btn.id,
          btnText: btn.innerText
        };
        btn.click();
        return { success: true, clicked: beforeClick };
      })()`,
      returnByValue: true
    });

    console.log('Click eval result:', JSON.stringify(evalResult, null, 2));

    await new Promise(r => setTimeout(r, 2000));

    // Check if dialog appeared
    const afterCheck = await call('Runtime.evaluate', {
      expression: `(function() {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe ? iframe.contentDocument || iframe.contentWindow.document : document;
        const dialogs = Array.from(doc.querySelectorAll('[data-name*="dialog"], [class*="dialog"], [role="dialog"]')).map(d => ({
          tag: d.tagName,
          className: d.className,
          text: d.innerText ? d.innerText.slice(0, 100) : ''
        }));
        return { dialogsCount: dialogs.length, dialogs };
      })()`,
      returnByValue: true
    });
    console.log('After check:', JSON.stringify(afterCheck, null, 2));

    console.log('Console logs:');
    consoleLogs.forEach(l => console.log(l));

    ws.close();
  } catch(err) {
    console.error(err);
  } finally {
    proc.kill();
  }
}

test();
