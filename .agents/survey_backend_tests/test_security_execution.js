const p = require('../../PineTS-main/dist/pinets.min.cjs');

const code = `//@version=5
indicator("Custom Symbol Candles", overlay=false)
sym = input.symbol("AAPL", "Symbol")
res = input.timeframe("D", "Timeframe")
showCandles = input.bool(true, "Show Candles")
upCol = input.color(color.green, "Up Color")
dnCol = input.color(color.red, "Down Color")
upWick = input.color(color.green, "Up Wick")
dnWick = input.color(color.red, "Down Wick")
upBorder = input.color(color.green, "Up Border")
dnBorder = input.color(color.red, "Down Border")

[o, h, l, c] = request.security(sym, res, [open, high, low, close])
plotcandle(showCandles ? o : na, h, l, c, color=c >= o ? upCol : dnCol, wickcolor=c >= o ? upWick : dnWick, bordercolor=c >= o ? upBorder : dnBorder)
`;

async function main() {
  const ind = p.Indicator.from(code);
  
  const bars = [];
  const t0 = new Date('2024-01-01T00:00:00Z').getTime();
  const DAY = 86_400_000;
  for (let i = 0; i < 20; i++) {
    const base = 100 + i * 0.6;
    bars.push({
      openTime: t0 + i * DAY,
      open: base,
      high: base + 1.5,
      low: base - 0.8,
      close: base + 0.4,
      volume: 1000,
      closeTime: t0 + (i + 1) * DAY - 1
    });
  }

  try {
    // Pass bars, symbol 'AAPL', timeframe 'D'
    const pine = new p.PineTS(bars, 'AAPL', 'D');
    const ctx = await pine.run(ind);
    console.log('Success running with request.security!');
    console.log('Plots:', Object.keys(ctx.plots || {}));
    if (ctx.plots && ctx.plots['plot']) {
      console.log('Candle plot data sample 0:', ctx.plots['plot'].data[0]);
    }
  } catch (err) {
    console.error('Failed running with request.security:', err);
  }
}

main();
