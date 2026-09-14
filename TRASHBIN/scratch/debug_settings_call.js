const { spawn } = require('child_process');

async function debugSettingsCall() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-set-call-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9254',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const putResp = await fetch('http://127.0.0.1:9254/json/new?http://127.0.0.1:9000', { method: 'PUT' });
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

    // Open Pine Editor and add Sessions LuxAlgo
    await call('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        window.PineEditorIDE.open();
        document.getElementById('pine_add_to_chart_btn')?.click();
        await new Promise(r => setTimeout(r, 1500));
      })()`
    });

    // Evaluate openSettingsDialog in detail
    const res = await call('Runtime.evaluate', {
      expression: `(() => {
        const diag = {
          hasPineIndicators: !!window.PineIndicators,
          hasOpenSettings: typeof window.PineIndicators?.openSettingsDialog === 'function',
          regStudiesSize: window.PineIndicators?.getStudyCount?.(),
          regStudies: window.PineIndicators?.getRegisteredStudies?.().map(s => ({ name: s.name, id: s.metainfo?.id }))
        };

        try {
          const chart = window.widget?.activeChart();
          diag.hasChart = !!chart;
          const studies = chart?.getAllStudies ? chart.getAllStudies() : [];
          diag.chartStudies = studies.map(s => ({ id: s.id, name: s.name }));
          
          // Call openSettingsDialog
          const ret = window.PineIndicators.openSettingsDialog(studies[0]?.id || "Sessions [LuxAlgo]", chart);
          diag.openSettingsReturn = ret;

          const modal = document.getElementById('tv_settings_modal_overlay');
          diag.modalInDom = !!modal;
          if (modal) {
            diag.modalDisplay = window.getComputedStyle(modal).display;
            diag.modalZIndex = window.getComputedStyle(modal).zIndex;
          }
        } catch (err) {
          diag.error = err.message;
          diag.stack = err.stack;
        }

        return diag;
      })()`,
      returnByValue: true
    });

    console.log('DIAGNOSTICS:', JSON.stringify(res.result?.result?.value || res, null, 2));

    ws.close();
  } catch (err) {
    console.error(err);
  } finally {
    proc.kill();
  }
}

debugSettingsCall();
