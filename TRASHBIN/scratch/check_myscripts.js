const { spawn } = require('child_process');

async function test() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9289',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-diag-' + Date.now()
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

  const res = await call('Runtime.evaluate', {
    expression: `(() => {
      try {
        // Save a test script to localStorage
        const allScripts = [
          {
            id: 'user_script_custom_1',
            name: 'MACD Momentum Scalper',
            code: '//@version=5\\nindicator("MACD Momentum Scalper")\\nplot(close)\\n',
            isFavorite: false,
            createdAt: Date.now()
          }
        ];
        localStorage.setItem('user_saved_scripts', JSON.stringify(allScripts));

        // Open indicators modal to myscripts
        window.openIndicatorsModal('myscripts');

        const rows = document.querySelectorAll('.tv-indicator-row');
        const names = Array.from(document.querySelectorAll('.tv-indicator-name')).map(x => x.innerText.trim());
        const delBtn = document.querySelector('.delete-script-btn');
        const delBtnHtml = delBtn ? delBtn.outerHTML : null;

        return {
          rowCount: rows.length,
          names: names,
          hasDeleteBtn: Boolean(delBtn),
          delBtnHtml: delBtnHtml,
          activeCat: document.querySelector('.tv-indicators-nav-item.active')?.innerText?.trim()
        };
      } catch(err) {
        return { error: err.message, stack: err.stack };
      }
    })()`,
    returnByValue: true
  });
  console.log('Test result:', JSON.stringify(res.result?.result?.value, null, 2));

  // Now test clicking delete
  const delRes = await call('Runtime.evaluate', {
    expression: `(() => {
      try {
        window.confirm = () => true;
        const delBtn = document.querySelector('.delete-script-btn');
        if (!delBtn) return { error: 'No delete button found' };
        delBtn.click();
        const namesAfter = Array.from(document.querySelectorAll('.tv-indicator-name')).map(x => x.innerText.trim());
        const storageAfter = JSON.parse(localStorage.getItem('user_saved_scripts') || '[]');
        return {
          namesAfter,
          storageLength: storageAfter.length,
          success: !namesAfter.includes('MACD Momentum Scalper')
        };
      } catch(err) {
        return { error: err.message, stack: err.stack };
      }
    })()`,
    returnByValue: true
  });
  console.log('Delete click result:', JSON.stringify(delRes.result?.result?.value, null, 2));

  ws.close();
  proc.kill();
  process.exit(0);
}
test().catch(console.error);
