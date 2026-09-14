const { spawn } = require('child_process');

async function checkCoords() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-coords-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9250',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const putResp = await fetch('http://127.0.0.1:9250/json/new?http://127.0.0.1:9000', { method: 'PUT' });
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

    await new Promise(r => setTimeout(r, 8000));

    const res = await call('Runtime.evaluate', {
      expression: `(() => {
        window.PineEditorIDE.open();
        const getRect = el => {
          if (!el) return null;
          const r = el.getBoundingClientRect();
          return { x: r.x, y: r.y, left: r.left, top: r.top, right: r.right, width: r.width, height: r.height };
        };
        const dock = document.getElementById('pine_editor_dock');
        const tb = document.querySelector('.pine-toolbar-v2');
        const pub = document.getElementById('pine_publish_btn');
        const moreBtn = document.getElementById('pine_more_btn');
        const moreMenu = document.getElementById('pine_more_menu');
        if (moreBtn) moreBtn.click();

        return {
          windowWidth: window.innerWidth,
          dock: getRect(dock),
          toolbar: getRect(tb),
          publishBtn: getRect(pub),
          moreBtn: getRect(moreBtn),
          moreMenu: getRect(moreMenu),
          moreMenuZIndex: moreMenu ? window.getComputedStyle(moreMenu).zIndex : null,
          moreMenuDisplay: moreMenu ? window.getComputedStyle(moreMenu).display : null,
          dockZIndex: dock ? window.getComputedStyle(dock).zIndex : null
        };
      })()`,
      returnByValue: true
    });

    const val = res.result?.result?.value || res.result?.value || res;
    console.log('EXACT RECTS:', JSON.stringify(val, null, 2));

    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    proc.kill();
  }
}

checkCoords();
