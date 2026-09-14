function getTfDuration(tf) {
  const s = String(tf || 'D').toUpperCase().trim();
  if (s === '1S') return 1000;
  if (s === '1') return 60000;
  if (s === '5') return 300000;
  if (s === '15') return 900000;
  if (s === '30') return 1800000;
  if (s === '60' || s === '1H') return 3600000;
  if (s === '240' || s === '4H') return 14400000;
  if (s === 'D' || s === '1D') return 86400000;
  if (s === 'W' || s === '1W') return 604800000;
  const num = parseInt(s, 10);
  if (!isNaN(num) && num > 0) return num * 60000;
  return 86400000;
}

const htfAgg = {};
function resolveSecurity(sym, res, t, o, h, l, c, chartSym) {
  const cleanSym = String(sym || '').replace(/^.*:/, '').trim();
  const baseChart = String(chartSym || '').replace(/^.*:/, '').trim();
  
  if (!cleanSym || cleanSym.toLowerCase() === baseChart.toLowerCase()) {
    const dur = getTfDuration(res);
    const periodStart = Math.floor(t / dur) * dur;
    if (!htfAgg[periodStart]) {
      htfAgg[periodStart] = { open: o, high: h, low: l, close: c };
    } else {
      htfAgg[periodStart].high = Math.max(htfAgg[periodStart].high, h);
      htfAgg[periodStart].low = Math.min(htfAgg[periodStart].low, l);
      htfAgg[periodStart].close = c;
    }
    return htfAgg[periodStart];
  }
  return { open: o, high: h, low: l, close: c };
}

// Test aggregation
const baseTime = 1700000000000;
for (let i = 0; i < 5; i++) {
  const barTime = baseTime + i * 60000; // 1-minute bars
  const o = 100 + i;
  const h = 105 + i;
  const l = 95 + i;
  const c = 102 + i;
  const agg = resolveSecurity("AAPL", "D", barTime, o, h, l, c, "AAPL");
  console.log(`Bar ${i} (t=${barTime}):`, agg);
}
