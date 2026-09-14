const { spawn } = require('child_process');
const fs = require('fs');

async function testToolbar() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-tb-test-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9247',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const putResp = await fetch('http://127.0.0.1:9247/json/new?http://127.0.0.1:9000', { method: 'PUT' });
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

    console.log('Waiting 8s for chart load...');
    await new Promise(r => setTimeout(r, 8000));

    // Open Pine Editor dock
    await call('Runtime.evaluate', { expression: `window.PineEditorIDE.open()` });
    await new Promise(r => setTimeout(r, 1000));

    const evalRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const tb = document.querySelector('.pine-toolbar-v2');
        const right = document.querySelector('.pine-toolbar-v2-right');
        const pub = document.getElementById('pine_publish_btn');
        const moreWrap = document.getElementById('pine_more_wrapper');
        const moreBtn = document.getElementById('pine_more_btn');
        const moreMenu = document.getElementById('pine_more_menu');

        return {
          tbRect: tb ? tb.getBoundingClientRect() : null,
          tbHtml: tb ? tb.outerHTML.substring(0, 500) : null,
          rightRect: right ? right.getBoundingClientRect() : null,
          rightHtml: right ? right.outerHTML : null,
          pubRect: pub ? pub.getBoundingClientRect() : null,
          moreWrapRect: moreWrap ? moreWrap.getBoundingClientRect() : null,
          moreBtnRect: moreBtn ? moreBtn.getBoundingClientRect() : null,
          moreBtnComputed: moreBtn ? {
            display: window.getComputedStyle(moreBtn).display,
            visibility: window.getComputedStyle(moreBtn).visibility,
            opacity: window.getComputedStyle(moreBtn).opacity,
            width: window.getComputedStyle(moreBtn).width,
            height: window.getComputedStyle(moreBtn).height,
            color: window.getComputedStyle(moreBtn).color
          } : null
        };
      })()`,
      returnByValue: true
    });

    console.log('DOM Details:', JSON.stringify(evalRes, null, 2));

    ws.close();
  } catch (err) {
    console.error('Error:', err);
  } finally {
    proc.kill();
  }
}

testToolbar();
