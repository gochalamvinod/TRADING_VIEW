const { spawn } = require('child_process');
const fs = require('fs');

async function testButtons() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-btn-test-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9246',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const putResp = await fetch('http://127.0.0.1:9246/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);
    let id = 1;
    const pending = new Map();
    const consoleLogs = [];

    ws.onmessage = e => {
      const d = JSON.parse(e.data);
      if (d.method === 'Runtime.consoleAPICalled') {
        consoleLogs.push({ type: d.params.type, args: d.params.args.map(a => a.value || a.description) });
      }
      if (d.method === 'Runtime.exceptionThrown') {
        consoleLogs.push({ type: 'EXCEPTION', text: d.params.exceptionDetails.text, exception: d.params.exceptionDetails.exception });
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
    await call('DOM.enable');

    console.log('Waiting 8s for chart load...');
    await new Promise(r => setTimeout(r, 8000));

    // Open Pine Editor dock explicitly
    console.log('Opening Pine Editor dock...');
    await call('Runtime.evaluate', {
      expression: `window.PineEditorIDE.open()`
    });
    await new Promise(r => setTimeout(r, 1000));

    // Inspect buttons and test clicks
    const inspectResult = await call('Runtime.evaluate', {
      expression: `(() => {
        const results = {};
        const buttons = [
          'pine_more_btn',
          'pine_more_menu',
          'pine_script_dropdown_trigger',
          'pine_dropdown_menu',
          'pine_save_btn',
          'pine_save_dropdown_btn',
          'pine_add_to_chart_btn',
          'pine_publish_btn',
          'pine_max_btn',
          'pine_close_btn',
          'pine_toggle_console_btn'
        ];
        buttons.forEach(id => {
          const el = document.getElementById(id);
          results[id] = el ? {
            exists: true,
            tagName: el.tagName,
            display: window.getComputedStyle(el).display,
            visibility: window.getComputedStyle(el).visibility,
            opacity: window.getComputedStyle(el).opacity,
            rect: {
              top: el.getBoundingClientRect().top,
              left: el.getBoundingClientRect().left,
              width: el.getBoundingClientRect().width,
              height: el.getBoundingClientRect().height
            }
          } : { exists: false };
        });

        // Test clicking pine_more_btn
        const moreBtn = document.getElementById('pine_more_btn');
        const moreMenu = document.getElementById('pine_more_menu');
        if (moreBtn && moreMenu) {
          const beforeShow = moreMenu.classList.contains('show');
          const beforeDisplay = window.getComputedStyle(moreMenu).display;
          moreBtn.click();
          const afterShow = moreMenu.classList.contains('show');
          const afterDisplay = window.getComputedStyle(moreMenu).display;
          const menuRect = moreMenu.getBoundingClientRect();
          results.moreBtnClick = { beforeShow, beforeDisplay, afterShow, afterDisplay, menuRect };
        }

        return results;
      })()`,
      returnByValue: true
    });

    console.log('Inspect results:\n', JSON.stringify(inspectResult.result.value, null, 2));

    // Take screenshot with more menu open
    const shot = await call('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f\\verified_more_menu_opened.png', Buffer.from(shot.result.data, 'base64'));

    console.log('Console errors/exceptions:');
    consoleLogs.filter(l => l.type === 'error' || l.type === 'EXCEPTION').forEach(l => console.log(JSON.stringify(l)));

    ws.close();
  } catch (err) {
    console.error('Error in test:', err);
  } finally {
    proc.kill();
  }
}

testButtons();
