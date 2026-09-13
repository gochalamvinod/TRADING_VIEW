// Simple CDP test
const { spawn } = require('child_process');
const fs = require('fs');

async function testCDP() {
  console.log("Launching Chrome...");
  const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
  const chromeProc = spawn(chromePath, [
    '--headless=new',
    '--remote-debugging-port=9222',
    '--window-size=1920,1080',
    '--disable-gpu',
    '--no-sandbox',
    '--user-data-dir=C:\\Users\\gocha\\AppData\\Local\\Temp\\chrome-cdp-test'
  ]);

  await new Promise(r => setTimeout(r, 2000));

  try {
    const vResp = await fetch('http://127.0.0.1:9222/json/version');
    const versionData = await vResp.json();
    console.log("Chrome CDP Version:", versionData.Browser);

    const listResp = await fetch('http://127.0.0.1:9222/json');
    const pages = await listResp.json();
    console.log("Found pages:", pages.length);
    const wsUrl = pages[0].webSocketDebuggerUrl;
    console.log("Connecting to:", wsUrl);

    const ws = new WebSocket(wsUrl);
    let id = 1;
    const pending = new Map();

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    };

    await new Promise((res, rej) => {
      ws.onopen = res;
      ws.onerror = rej;
    });

    function send(method, params = {}) {
      const curId = id++;
      return new Promise((res) => {
        pending.set(curId, res);
        ws.send(JSON.stringify({ id: curId, method, params }));
      });
    }

    console.log("Enabling Page and Runtime...");
    await send("Page.enable");
    await send("Runtime.enable");

    console.log("Navigating to http://127.0.0.1:9000 ...");
    await send("Page.navigate", { url: "http://127.0.0.1:9000" });

    await new Promise(r => setTimeout(r, 5000));

    const titleEval = await send("Runtime.evaluate", { expression: "document.title" });
    console.log("Document title:", titleEval.result?.result?.value);

    const shot = await send("Page.captureScreenshot", { format: "png" });
    if (shot.result?.data) {
      fs.writeFileSync("screenshots/test_init_chart.png", Buffer.from(shot.result.data, "base64"));
      console.log("Saved screenshots/test_init_chart.png (bytes:", shot.result.data.length, ")");
    }

    ws.close();
  } catch (err) {
    console.error("CDP Test error:", err);
  } finally {
    chromeProc.kill('SIGKILL');
  }
}

testCDP();
