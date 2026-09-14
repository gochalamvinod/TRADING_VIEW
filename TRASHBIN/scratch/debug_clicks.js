const { spawn } = require('child_process');
const fs = require('fs');

async function debugClicks() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-click-diag-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9249',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const putResp = await fetch('http://127.0.0.1:9249/json/new?http://127.0.0.1:9000', { method: 'PUT' });
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
    await call('Page.enable');
    await call('Runtime.enable');

    console.log('Waiting 8s for chart...');
    await new Promise(r => setTimeout(r, 8000));

    // TEST 1: Open Pine Editor and click pine_more_btn
    const editorRes = await call('Runtime.evaluate', {
      expression: `(() => {
        window.PineEditorIDE.open();
        const btn = document.getElementById('pine_more_btn');
        const menu = document.getElementById('pine_more_menu');
        if (!btn) return { error: 'pine_more_btn not found' };
        if (!menu) return { error: 'pine_more_menu not found' };

        // Click btn
        btn.click();

        return {
          menuClasses: menu.className,
          menuStyleDisplay: menu.style.display,
          computedDisplay: window.getComputedStyle(menu).display,
          computedVisibility: window.getComputedStyle(menu).visibility,
          computedZIndex: window.getComputedStyle(menu).zIndex,
          menuRect: {
            top: menu.getBoundingClientRect().top,
            left: menu.getBoundingClientRect().left,
            width: menu.getBoundingClientRect().width,
            height: menu.getBoundingClientRect().height
          }
        };
      })()`,
      returnByValue: true
    });
    console.log('Editor More Click Result:', JSON.stringify(editorRes, null, 2));

    // Take screenshot of editor more menu
    const shot1 = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\verified_editor_more_click.png', Buffer.from(shot1.result.data, 'base64'));

    // TEST 2: In Chart Iframe, find the main series legend more button
    const legendRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (!doc) return { error: 'no doc' };

        // Let's find all buttons in the legend area
        const allLegendBtns = Array.from(doc.querySelectorAll('[data-name="legend"] button, [class*="legend-"] button, [class*="item-"] button')).map(b => ({
          tag: b.tagName,
          name: b.getAttribute('data-name'),
          aria: b.getAttribute('aria-label'),
          title: b.getAttribute('title'),
          className: b.className,
          rect: {
            top: b.getBoundingClientRect().top,
            left: b.getBoundingClientRect().left,
            width: b.getBoundingClientRect().width,
            height: b.getBoundingClientRect().height
          }
        }));

        // Find more button in legend
        const moreBtn = doc.querySelector('[data-name="legend-more-action"]') ||
                        allLegendBtns.find(b => b.aria === 'More' || b.title === 'More' || (b.name && b.name.includes('more')));

        let clicked = false;
        if (moreBtn) {
          const el = doc.querySelector('[data-name="legend-more-action"]') || doc.querySelector('[aria-label="More"]') || doc.querySelector('button[title="More"]');
          if (el) {
            el.click();
            clicked = true;
          }
        }

        return { allLegendBtns, clicked };
      })()`,
      returnByValue: true
    });
    console.log('Legend More Click Result:', JSON.stringify(legendRes, null, 2));

    await new Promise(r => setTimeout(r, 500));
    const shot2 = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\verified_legend_more_click.png', Buffer.from(shot2.result.data, 'base64'));

    ws.close();
  } catch (err) {
    console.error('Err:', err);
  } finally {
    proc.kill();
  }
}

debugClicks();
