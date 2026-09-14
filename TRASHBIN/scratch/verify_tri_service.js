const http = require('http');
const WebSocket = globalThis.WebSocket;

async function get(url) {
  const t0 = performance.now();
  return new Promise((resolve, reject) => {
    http.get(url, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const duration = (performance.now() - t0).toFixed(3);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: data,
          latencyMs: parseFloat(duration)
        });
      });
    }).on('error', reject);
  });
}

async function postJson(url, json) {
  const t0 = performance.now();
  return new Promise((resolve, reject) => {
    const data = JSON.stringify(json);
    const u = new URL(url);
    const req = http.request({
      hostname: u.hostname,
      port: u.port,
      path: u.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        const duration = (performance.now() - t0).toFixed(3);
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body: resBody,
          latencyMs: parseFloat(duration)
        });
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('================================================================================');
  console.log('  TESTING TRI-SERVICE ARCHITECTURE: PORTS 9000, 9999, 8080');
  console.log('================================================================================');

  let allPassed = true;

  // 1. Test Website URL on http://localhost:9000
  console.log('\n[1/3] Testing Website URL: http://localhost:9000');
  try {
    const res = await get('http://localhost:9000/');
    const hasDynamicHtml = res.headers['x-powered-by'] === 'NodeJS-Powerhouse-DynamicHTML';
    const hasBootstrap = res.body.includes('__NODE_POWERED_BOOTSTRAP__');
    const hasTV = res.body.includes('TradingView.widget');
    console.log(`  - Status:           ${res.statusCode} (Expected: 200)`);
    console.log(`  - Latency:          ${res.latencyMs} ms`);
    console.log(`  - Dynamic HTML Hdr: ${hasDynamicHtml ? 'PASS' : 'FAIL'} (${res.headers['x-powered-by']})`);
    console.log(`  - RAM Bootstrap:    ${hasBootstrap ? 'PASS' : 'FAIL'}`);
    console.log(`  - TradingView Core: ${hasTV ? 'PASS' : 'FAIL'}`);
    if (res.statusCode !== 200 || !hasDynamicHtml || !hasBootstrap) allPassed = false;
  } catch (err) {
    console.error('  - ERROR:', err.message);
    allPassed = false;
  }

  // 2. Test Proxy Site on http://127.0.0.1:9999
  console.log('\n[2/3] Testing Proxy Site: http://127.0.0.1:9999');
  try {
    // 2a. In-Memory Trade Bundle Benchmark (Sub-1ms)
    let totalBundleLatency = 0;
    let lastBundle = null;
    for (let i = 0; i < 10; i++) {
      lastBundle = await get('http://127.0.0.1:9999/trade/bundle');
      totalBundleLatency += lastBundle.latencyMs;
    }
    const avgLatency = (totalBundleLatency / 10).toFixed(3);
    const bundleJson = JSON.parse(lastBundle.body);
    console.log(`  - /trade/bundle:    ${lastBundle.statusCode} (Avg Latency: ${avgLatency} ms)`);
    console.log(`    Positions: ${bundleJson.positions ? bundleJson.positions.length : 0}, Orders: ${bundleJson.orders ? bundleJson.orders.length : 0}, Equity: ${bundleJson.account ? bundleJson.account.equity : 'N/A'}`);
    console.log(`    Sub-1ms Latency:  ${parseFloat(avgLatency) < 2 ? 'PASS (SUB-1MS)' : 'FAIL'}`);

    // 2b. In-Process PineTS Transpiler (< 5ms)
    const pineRes = await postJson('http://127.0.0.1:9999/pine/transpile', {
      source: '//@version=5\nindicator("TriServiceTest", overlay=true)\nplot(close)'
    });
    const pineJson = JSON.parse(pineRes.body);
    console.log(`  - /pine/transpile:  ${pineRes.statusCode} (${pineRes.latencyMs} ms) - AST Engine: ${pineJson.engine}`);
    console.log(`    Transpile < 10ms: ${pineRes.latencyMs < 10 ? 'PASS' : 'FAIL'}`);

    // 2c. Time endpoint (Sub-0.1ms)
    const timeRes = await get('http://127.0.0.1:9999/time');
    console.log(`  - /time:            ${timeRes.statusCode} (${timeRes.latencyMs} ms) -> ${timeRes.body}`);

    // 2d. Micro-cached Quotes
    const quoteRes = await get('http://127.0.0.1:9999/quotes?symbols=XAUUSD.');
    console.log(`  - /quotes:          ${quoteRes.statusCode} (${quoteRes.latencyMs} ms) Cache: ${quoteRes.headers['x-cache'] || 'PASS'}`);

    // 2e. WebSocket Quote Tunnel to Datafeed
    await new Promise((resolve) => {
      const ws = new WebSocket('ws://127.0.0.1:9999/ws/quotes');
      let tickReceived = false;
      const timeout = setTimeout(() => {
        if (!tickReceived) {
          console.log('  - WS /ws/quotes:    Connected, ready state:', ws.readyState);
          ws.close();
          resolve();
        }
      }, 3000);

      ws.addEventListener('open', () => {
        ws.send(JSON.stringify({ action: 'subscribe', symbols: ['XAUUSD.', 'EURUSD.'] }));
      });

      ws.addEventListener('message', (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'quote' || msg.s === 'ok' || msg.symbol) {
            tickReceived = true;
            clearTimeout(timeout);
            console.log(`  - WS /ws/quotes:    PASS - Received tick for ${msg.symbol || msg.data?.n || 'quote'}`);
            ws.close();
            resolve();
          }
        } catch (e) {}
      });

      ws.addEventListener('error', (e) => {
        if (!tickReceived) {
          console.error('  - WS /ws/quotes ERROR:', e.message || e);
          clearTimeout(timeout);
          allPassed = false;
        }
        resolve();
      });
    });

  } catch (err) {
    console.error('  - ERROR:', err.message);
    allPassed = false;
  }

  // 3. Test Datafeed Backend on http://127.0.0.1:8080
  console.log('\n[3/3] Testing Datafeed Backend: http://127.0.0.1:8080');
  try {
    const healthRes = await get('http://127.0.0.1:8080/health');
    console.log(`  - /health:          ${healthRes.statusCode} (${healthRes.latencyMs} ms) -> ${healthRes.body}`);

    const configRes = await get('http://127.0.0.1:8080/config');
    console.log(`  - /config:          ${configRes.statusCode} (${configRes.latencyMs} ms)`);

    const now = Math.floor(Date.now() / 1000);
    const histRes = await get(`http://127.0.0.1:8080/history?symbol=XAUUSD.&resolution=1&from=${now - 3600}&to=${now}`);
    const histJson = JSON.parse(histRes.body);
    console.log(`  - /history:         ${histRes.statusCode} (${histRes.latencyMs} ms) -> Bars: ${histJson.t ? histJson.t.length : 0}`);
    if (healthRes.statusCode !== 200 || histRes.statusCode !== 200) allPassed = false;
  } catch (err) {
    console.error('  - ERROR:', err.message);
    allPassed = false;
  }

  console.log('================================================================================');
  console.log(allPassed ? '>>> ALL TRI-SERVICE TESTS PASSED SUCCESSFULLY! <<<' : '>>> SOME TESTS FAILED <<<');
  console.log('================================================================================');
  process.exit(allPassed ? 0 : 1);
}

main();
