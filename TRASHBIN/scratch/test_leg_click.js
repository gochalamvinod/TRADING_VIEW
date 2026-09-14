const { spawn } = require('child_process');

async function testLegendClick() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-leg-click-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9248',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const putResp = await fetch('http://127.0.0.1:9248/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();
    const logs = [];

    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled') {
        logs.push({ type: d.params.type, text: d.params.args.map(a => a.value || a.description).join(' ') });
      }
      if (d.method === 'Runtime.exceptionThrown') {
        logs.push({ type: 'EXCEPTION', text: d.params.exceptionDetails.text, exception: d.params.exceptionDetails.exception });
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

    console.log('Waiting 8s for chart load...');
    await new Promise(r => setTimeout(r, 8000));

    const evalRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (!doc) return { error: 'no doc' };

        // Find main series legend item
        const legendItems = Array.from(doc.querySelectorAll('[data-name="legend-source-item"], [class*="item-"]'));
        const info = legendItems.map(item => {
          const btns = Array.from(item.querySelectorAll('button')).map(b => ({
            name: b.getAttribute('data-name'),
            title: b.getAttribute('title') || b.getAttribute('aria-label'),
            className: b.className,
            innerHTML: b.innerHTML.substring(0, 100)
          }));
          return {
            text: item.textContent.trim().substring(0, 80),
            buttons: btns
          };
        });

        // Let's find more button
        const moreBtn = doc.querySelector('[data-name="legend-more-action"]') ||
                        doc.querySelector('[aria-label="More"]') ||
                        doc.querySelector('button[title="More"]');

        let clickResult = 'no moreBtn found';
        if (moreBtn) {
          moreBtn.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, view: iframe.contentWindow }));
          clickResult = 'clicked moreBtn';
        }

        // Check if any context menu or dropdown opened
        const popups = Array.from(doc.querySelectorAll('[data-name="menu-inner"], [class*="menu-"], [class*="dropdown-"], [role="menu"]')).map(p => ({
          tag: p.tagName,
          className: p.className,
          rect: p.getBoundingClientRect(),
          display: window.getComputedStyle(p).display
        }));

        return { info, clickResult, popups };
      })()`,
      returnByValue: true
    });

    console.log('Eval Results:\n', JSON.stringify(evalRes.result.value, null, 2));
    console.log('Logs:\n', JSON.stringify(logs, null, 2));

    ws.close();
  } catch (err) {
    console.error('Err:', err);
  } finally {
    proc.kill();
  }
}

testLegendClick();
