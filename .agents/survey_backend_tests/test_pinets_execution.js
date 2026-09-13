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

plotcandle(open, high, low, close, color=close >= open ? upCol : dnCol, wickcolor=close >= open ? upWick : dnWick, bordercolor=close >= open ? upBorder : dnBorder)
`;

async function main() {
  const ind = p.Indicator.from(code);
  
  // Create sample bars matching PineTS schema
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
    const pine = new p.PineTS(bars);
    const ctx = await pine.run(ind);
    console.log('PineTS run success!');
    console.log('Plots object keys:', Object.keys(ctx.plots || {}));
    for (const [name, plot] of Object.entries(ctx.plots || {})) {
      console.log(`Plot "${name}": style=${plot.style}, data length=${plot.data ? plot.data.length : 0}`);
      if (plot.data && plot.data.length > 0) {
        console.log(`  Sample bar 0:`, plot.data[0]);
        console.log(`  Sample bar last:`, plot.data[plot.data.length - 1]);
      }
    }
  } catch (err) {
    console.error('PineTS run failed:', err);
  }
}

main();
