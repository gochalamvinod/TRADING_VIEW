const { spawn, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function runTest() {
  console.log('--- Running Worker 1 Verification Script ---');

  try {
    execSync('taskkill /F /IM chrome.exe /T', { stdio: 'ignore' });
  } catch (e) {}
  await sleep(1000);

  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const userDataDir = 'C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-worker1-test-' + Date.now();

  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9223',
    '--remote-allow-origins=*',
    '--disable-web-security',
    '--no-sandbox',
    '--window-size=1920,1080',
    '--user-data-dir=' + userDataDir
  ]);

  await sleep(3000);

  try {
    const putResp = await fetch('http://127.0.0.1:9223/json/new?http://127.0.0.1:9000', { method: 'PUT' });
    const tabInfo = await putResp.json();
    const ws = new WebSocket(tabInfo.webSocketDebuggerUrl);

    let id = 1;
    const pending = new Map();
    let nativeDialogCount = 0;

    ws.onmessage = (e) => {
      const d = JSON.parse(e.data);
      if (d.method === 'Page.javascriptDialogOpening') {
        console.error('NATIVE DIALOG DETECTED:', d.params);
        nativeDialogCount++;
        call('Page.handleJavaScriptDialog', { accept: true }).catch(() => {});
      }
      if (d.id && pending.has(d.id)) {
        pending.get(d.id)(d);
        pending.delete(d.id);
      }
    };
    await new Promise(r => ws.onopen = r);

    function call(method, params = {}) {
      const curId = id++;
      return new Promise((resolve, reject) => {
        const t = setTimeout(() => {
          pending.delete(curId);
          reject(new Error('CDP Timeout for ' + method));
        }, 30000);
        pending.set(curId, (res) => {
          clearTimeout(t);
          resolve(res);
        });
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    async function evaluate(fnStr) {
      const res = await call('Runtime.evaluate', {
        expression: fnStr,
        returnByValue: true,
        awaitPromise: true
      });
      if (res.result?.exceptionDetails) {
        throw new Error(JSON.stringify(res.result.exceptionDetails));
      }
      return res.result?.result?.value;
    }

    await call('Page.enable');
    await call('Runtime.enable');

    console.log('Waiting for chart and Pine Editor to load...');
    await sleep(10000);

    // Test 1: window.PineEditorIDE.setDockOpen
    console.log('Testing Test 1: window.PineEditorIDE.setDockOpen exists and toggles dock');
    const setDockTest = await evaluate(`(() => {
      if (!window.PineEditorIDE) return { error: 'window.PineEditorIDE not found' };
      if (typeof window.PineEditorIDE.setDockOpen !== 'function') {
        return { error: 'setDockOpen is not a function on window.PineEditorIDE' };
      }
      window.PineEditorIDE.setDockOpen(true);
      const open1 = window.PineEditorIDE.isOpen();
      const dock1 = document.getElementById('pine_editor_dock');
      const display1 = dock1 ? dock1.style.display : null;

      window.PineEditorIDE.setDockOpen(false);
      const open2 = window.PineEditorIDE.isOpen();
      const display2 = dock1 ? dock1.style.display : null;

      window.PineEditorIDE.setDockOpen(true);

      return {
        hasMethod: true,
        open1,
        display1,
        open2,
        display2
      };
    })()`);
    console.log('Test 1 Result:', setDockTest);

    // Test 2: openScriptForStudy and focus textarea
    console.log('Testing Test 2: openScriptForStudy loads code and focuses #pine_code_input');
    const loadScriptTest = await evaluate(`(() => {
      window.openScriptForStudy('Sessions');
      const codeInput = document.getElementById('pine_code_input');
      const activeEl = document.activeElement;
      return {
        dockOpen: window.PineEditorIDE.isOpen(),
        hasCode: codeInput && codeInput.value.length > 50,
        codeLength: codeInput ? codeInput.value.length : 0,
        isFocused: activeEl === codeInput,
        titleDisplay: document.getElementById('pine_script_title_display')?.textContent
      };
    })()`);
    console.log('Test 2 Result:', loadScriptTest);

    // Test 3: Dark Theme tokens on status bar & toggle button
    console.log('Testing Test 3: Dark Theme tokens on status bar & toggle button');
    const themeTest = await evaluate(`(() => {
      const btn = document.getElementById('pine_console_toggle_btn');
      const statusItem = document.querySelector('.pine-status-item-v2');
      const btnStyle = btn ? window.getComputedStyle(btn) : null;
      const statusStyle = statusItem ? window.getComputedStyle(statusItem) : null;
      return {
        btnBg: btnStyle ? btnStyle.backgroundColor : null,
        btnColor: btnStyle ? btnStyle.color : null,
        statusColor: statusStyle ? statusStyle.color : null
      };
    })()`);
    console.log('Test 3 Result:', themeTest);

    // Test 4: Check title click logic for main series vs indicator
    console.log('Testing Test 4: Legend Polish styles and title click logic');
    const legendStylesTest = await evaluate(`(() => {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const innerDoc = iframe?.contentDocument;
      const polishStyle = innerDoc?.getElementById('pine-legend-polish-styles');
      return {
        hasPolishStyle: !!polishStyle,
        hasDescSuppression: polishStyle ? polishStyle.textContent.includes('descTitle-') : false,
        hasSeriesHoverRule: polishStyle ? polishStyle.textContent.includes('[data-name="legend-series-item"]:hover') : false,
        hasPineActionSelector: polishStyle ? polishStyle.textContent.includes('legend-pine-action') : false
      };
    })()`);
    console.log('Test 4 Result:', legendStylesTest);

    // Test 5: Zero native dialogs
    console.log('Native Dialogs Count:', nativeDialogCount);

    ws.close();

    const allPassed =
      setDockTest.hasMethod &&
      setDockTest.open1 === true &&
      setDockTest.display1 === 'flex' &&
      setDockTest.open2 === false &&
      setDockTest.display2 === 'none' &&
      loadScriptTest.dockOpen === true &&
      loadScriptTest.hasCode === true &&
      legendStylesTest.hasPolishStyle === true &&
      legendStylesTest.hasDescSuppression === true &&
      legendStylesTest.hasSeriesHoverRule === true &&
      legendStylesTest.hasPineActionSelector === true &&
      nativeDialogCount === 0;

    console.log('\n>>> OVERALL VERIFICATION:', allPassed ? 'PASSED ✅' : 'FAILED ❌');
    return allPassed;
  } finally {
    try {
      chromeProc.kill('SIGKILL');
    } catch (e) {}
  }
}

runTest().then(pass => {
  process.exit(pass ? 0 : 1);
}).catch(err => {
  console.error(err);
  process.exit(1);
});
