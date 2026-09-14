async function test() {
  const tests = [
    { name: 'User exact URL (5S)', url: 'http://127.0.0.1:9999/history?symbol=XAUUSD.&resolution=5S&from=1789168249&to=1789170519&countback=454&currencyCode=USD' },
    { name: '1S Resolution', url: 'http://127.0.0.1:9999/history?symbol=XAUUSD.&resolution=1S&countback=100' },
    { name: '10S Resolution', url: 'http://127.0.0.1:9999/history?symbol=XAUUSD.&resolution=10S&countback=100' },
    { name: '1T Tick Resolution', url: 'http://127.0.0.1:9999/history?symbol=XAUUSD.&resolution=1T&countback=100' },
    { name: '40T Tick Resolution', url: 'http://127.0.0.1:9999/history?symbol=XAUUSD.&resolution=40T&countback=100' },
    { name: 'Standard 1m', url: 'http://127.0.0.1:9999/history?symbol=XAUUSD.&resolution=1&countback=100' }
  ];

  for (const t of tests) {
    try {
      const start = Date.now();
      const res = await fetch(t.url);
      const data = await res.json();
      const dur = Date.now() - start;
      console.log('[PASS] ' + t.name + ': HTTP ' + res.status + ' ' + (data.s || '') + ', Bars: ' + (data.t ? data.t.length : 0) + ', Duration: ' + dur + 'ms');
    } catch (err) {
      console.error('[FAIL] ' + t.name + ':', err.message);
    }
  }
}
test();
