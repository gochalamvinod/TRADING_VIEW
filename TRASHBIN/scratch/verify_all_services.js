async function runTests() {
  console.log('--- 1. Testing Julia Health ---');
  let r = await fetch('http://127.0.0.1:8085/health');
  let d = await r.json();
  console.log('Julia 8085 Health:', d);

  r = await fetch('http://127.0.0.1:9000/julia/health');
  d = await r.json();
  console.log('Node Julia Proxy Health:', d);

  console.log('\n--- 2. Testing Julia Compute ---');
  r = await fetch('http://127.0.0.1:8085/compute', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ c: Array.from({length: 500}, (_, i) => 100 + Math.sin(i * 0.1) * 5) })
  });
  d = await r.json();
  console.log('Julia Compute Result:', { engine: d.engine, duration_us: d.duration_us, bar_count: d.bar_count, has_sma: !!d.sma });

  console.log('\n--- 3. Testing Indicators Compute (cuDF/JAX) ---');
  r = await fetch('http://127.0.0.1:9000/indicators/compute?symbol=XAUUSD.&indicator=SMA&bars=200');
  d = await r.json();
  console.log('cuDF/JAX Compute:', { status: d.status, engine: d.engine, compute_time_ms: d.compute_time_ms, bars: d.bars });

  console.log('\n--- 4. Testing Indicators Compute (Julia Engine) ---');
  r = await fetch('http://127.0.0.1:9000/indicators/compute?symbol=XAUUSD.&indicator=SMA&bars=200&engine=julia');
  d = await r.json();
  console.log('Julia via Backend:', { status: d.status, engine: d.engine, compute_time_ms: d.compute_time_ms });

  console.log('\n--- 5. Testing Pine Backend Transpiler ---');
  r = await fetch('http://127.0.0.1:9000/pine/transpile', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({ source: '//@version=5\nindicator("Super Trend Test", overlay=true)\nplot(close, color=color.green)' })
  });
  d = await r.json();
  console.log('Pine Transpile:', { success: d.success, title: d.title, isOverlay: d.isOverlay, durationMs: d.durationMs, engine: d.engine });
}

runTests().catch(e => {
  console.error('Test error:', e);
  process.exit(1);
});
