const { spawn } = require('child_process');
const fs = require('fs');

async function testPineEditorRightToolbar() {
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-pe-test-' + Date.now();
  const proc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=' + userDataDir
  ]);

  await new Promise(r => setTimeout(r, 2500));

  try {
    const putResp = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    ws.onmessage = e => { const d = JSON.parse(e.data); if (d.id && pending.has(d.id)) pending.get(d.id)(d); };
    await new Promise(r => ws.onopen = r);

    const call = (method, params = {}) => new Promise(res => {
      const cid = id++;
      pending.set(cid, res);
      ws.send(JSON.stringify({ id: cid, method, params }));
    });

    await call('Page.enable');
    await call('Runtime.enable');

    console.log("1. Waiting 10s for page and iframe to load...");
    await new Promise(r => setTimeout(r, 10000));

    // Check right toolbar buttons
    const checkBtn = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        if (!iframe || !iframe.contentDocument) return { error: "No iframe" };
        const doc = iframe.contentDocument;
        const rt = doc.querySelector('[data-name="right-toolbar"]');
        if (!rt) return { error: "No right-toolbar" };
        const pineBtn = rt.querySelector('[data-name="pine-editor"]');
        return {
          hasPineButton: !!pineBtn,
          buttonCount: rt.querySelectorAll('button').length,
          allButtons: Array.from(rt.querySelectorAll('button')).map(b => b.getAttribute('data-name')),
          dockPresent: !!document.getElementById('pine_editor_dock'),
          dockVisible: document.getElementById('pine_editor_dock')?.style.display !== 'none'
        };
      })()`,
      returnByValue: true
    });
    console.log("Initial Toolbar & Dock state:", JSON.stringify(checkBtn.result?.result?.value, null, 2));

    // Capture screenshot 1 (initial state)
    let shot = await call('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      fs.writeFileSync('screenshots/test_rt_1_initial.png', Buffer.from(shot.result.data, 'base64'));
      console.log("Saved screenshots/test_rt_1_initial.png");
    }

    // Click the Pine Editor button in the right toolbar
    console.log("2. Clicking Pine Editor button in right toolbar...");
    const clickRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const pineBtn = doc?.querySelector('[data-name="pine-editor"]');
        if (pineBtn) {
          pineBtn.click();
          return {
            clicked: true,
            isDockOpen: window.PineEditorIDE.isOpen(),
            dockDisplay: document.getElementById('pine_editor_dock')?.style.display,
            ariaPressed: pineBtn.getAttribute('aria-pressed'),
            hasActiveClass: pineBtn.classList.contains('isActive-I_wb5FjE')
          };
        }
        return { clicked: false };
      })()`,
      returnByValue: true
    });
    console.log("After Click Result:", JSON.stringify(clickRes.result?.result?.value, null, 2));

    await new Promise(r => setTimeout(r, 1000));

    // Capture screenshot 2 (open Pine Editor dock)
    shot = await call('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      fs.writeFileSync('screenshots/test_rt_2_dock_opened.png', Buffer.from(shot.result.data, 'base64'));
      console.log("Saved screenshots/test_rt_2_dock_opened.png");
    }

    // Test Compile button
    console.log("3. Testing Compile button...");
    const compileRes = await call('Runtime.evaluate', {
      expression: `(() => {
        const compileBtn = document.getElementById('pine_compile_btn');
        if (compileBtn) {
          compileBtn.click();
          const status = document.getElementById('pine_compiler_status')?.textContent;
          const logCount = document.querySelectorAll('.pine-console-entry').length;
          return { compileClicked: true, status, logCount };
        }
        return { compileClicked: false };
      })()`,
      returnByValue: true
    });
    console.log("Compile Result:", JSON.stringify(compileRes.result?.result?.value, null, 2));

    // Test Add to Chart button
    console.log("4. Testing Add to chart button...");
    const addChartRes = await call('Runtime.evaluate', {
      awaitPromise: true,
      expression: `(async () => {
        const addBtn = document.getElementById('pine_add_to_chart_btn');
        if (addBtn) {
          addBtn.click();
          await new Promise(r => setTimeout(r, 1500));
          const chart = window.widget?.activeChart();
          const studies = chart ? chart.getAllStudies() : [];
          return {
            addClicked: true,
            status: document.getElementById('pine_compiler_status')?.textContent,
            studyCount: studies.length,
            studies: studies.map(s => ({ id: s.id, name: s.name }))
          };
        }
        return { addClicked: false };
      })()`,
      returnByValue: true
    });
    console.log("Add to Chart Result:", JSON.stringify(addChartRes.result?.result?.value, null, 2));

    await new Promise(r => setTimeout(r, 2000));

    // Capture screenshot 3 (study added on chart)
    shot = await call('Page.captureScreenshot', { format: 'png' });
    if (shot.result?.data) {
      fs.writeFileSync('screenshots/test_rt_3_study_added.png', Buffer.from(shot.result.data, 'base64'));
      console.log("Saved screenshots/test_rt_3_study_added.png");
    }

    ws.close();
  } catch (err) {
    console.error("Test Error:", err);
  } finally {
    proc.kill('SIGKILL');
  }
}

testPineEditorRightToolbar();
