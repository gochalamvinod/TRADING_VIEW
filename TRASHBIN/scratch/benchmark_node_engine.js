const http = require('http');

function testEndpoint(url, headers = {}) {
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    http.get(url, { headers }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const t1 = process.hrtime.bigint();
        const durationMs = Number(t1 - t0) / 1e6;
        resolve({ statusCode: res.statusCode, durationMs, headers: res.headers, body: data });
      });
    }).on('error', reject);
  });
}

function testPost(url, payload) {
  return new Promise((resolve, reject) => {
    const t0 = process.hrtime.bigint();
    const body = JSON.stringify(payload);
    const req = http.request(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body)
      }
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const t1 = process.hrtime.bigint();
        const durationMs = Number(t1 - t0) / 1e6;
        resolve({ statusCode: res.statusCode, durationMs, headers: res.headers, body: data });
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log('=== BENCHMARKING NODE.JS ENGINE ===');
  
  // 1. Initial bundle fetch
  const res1 = await testEndpoint('http://127.0.0.1:8080/trade/bundle');
  console.log('1. /trade/bundle (Initial fetch):', res1.statusCode, res1.durationMs.toFixed(3) + 'ms');
  const body1 = JSON.parse(res1.body);
  console.log('   Payload:', { version: body1.version, backendOnline: body1.backendOnline, positions: body1.positions.length, orders: body1.orders.length });

  // 2. 50 iterations of /trade/bundle with ETag (sub-1ms test)
  const etag = res1.headers['etag'];
  const times = [];
  for (let i = 0; i < 50; i++) {
    const r = await testEndpoint('http://127.0.0.1:8080/trade/bundle', { 'if-none-match': etag });
    times.push(r.durationMs);
  }
  times.sort((a, b) => a - b);
  const p50 = times[Math.floor(times.length * 0.5)];
  const p95 = times[Math.floor(times.length * 0.95)];
  console.log('2. 50x /trade/bundle (304 Cache Check):');
  console.log(`   P50 Latency: ${p50.toFixed(3)}ms`);
  console.log(`   P95 Latency: ${p95.toFixed(3)}ms`);

  // 3. Static asset delivery from RAM
  const staticTimes = [];
  for (let i = 0; i < 20; i++) {
    const r = await testEndpoint('http://127.0.0.1:8080/custom.css', { 'accept-encoding': 'gzip' });
    staticTimes.push(r.durationMs);
  }
  staticTimes.sort((a, b) => a - b);
  console.log('3. In-Memory Static Asset (/custom.css):');
  console.log(`   P50 Latency: ${staticTimes[Math.floor(staticTimes.length * 0.5)].toFixed(3)}ms`);

  // 4. Pine Script Transpilation
  const pineRes = await testPost('http://127.0.0.1:8080/pine/transpile', {
    source: '//@version=5\nindicator("Test RSI", overlay=false)\nlen = input.int(14, "Length")\nplot(ta.rsi(close, len))'
  });
  const parsedPine = JSON.parse(pineRes.body);
  console.log('4. In-Process Pine Transpilation (/pine/transpile):');
  console.log(`   Status: ${pineRes.statusCode}`);
  console.log(`   Total HTTP Roundtrip: ${pineRes.durationMs.toFixed(3)}ms`);
  console.log(`   Node Internal AST Time: ${parsedPine.durationMs}ms`);
  console.log(`   Success: ${parsedPine.success}`);
  console.log(`   Engine: ${parsedPine.engine}`);

  console.log('\n=== ALL BENCHMARKS COMPLETED SUCCESSFULLY ===');
})();
