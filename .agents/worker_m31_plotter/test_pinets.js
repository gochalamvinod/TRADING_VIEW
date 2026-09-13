const fs = require('fs');
const { Indicator, PineTS } = require('../../PineTS-main/dist/pinets.min.cjs');

const source = fs.readFileSync('scratch_luxalgo.pine', 'utf-8');
const ind = Indicator.from(source);

const bars = [];
// Use actual timestamps: a Tuesday starting at 00:00 UTC (e.g. 2024-01-09T00:00:00Z = 1704758400000)
const baseTime = 1704758400000;
let price = 2000;
for (let i = 0; i < 96 * 3; i++) { // 3 days of 15m bars
  price += (Math.random() - 0.5) * 1.5;
  bars.push({
    open: price - 0.5,
    high: price + 1,
    low: price - 1,
    close: price,
    volume: 500,
    openTime: baseTime + i * 15 * 60000
  });
}

const provider = {
  getMarketData: async () => bars,
  getSymbolInfo: async () => ({
    ticker: 'XAUUSD.',
    tickerid: 'XAUUSD.',
    mintick: 0.01,
    pointvalue: 100,
    timezone: 'UTC',
    currency: 'USD',
    type: 'forex'
  })
};

const p = new PineTS(provider, 'XAUUSD.', '15');
p.run(ind).then(ctx => {
  console.log("LuxAlgo executed successfully with provider!");
  console.log("Plots generated:", Object.keys(ctx.plots));
  const boxes = ctx.plots['__boxes__']?.data?.[0]?.value;
  console.log("Boxes count:", boxes?.length);
  if (boxes && boxes.length > 0) {
    console.log("Sample box:", boxes[0]);
  }
  const lines = ctx.plots['__lines__']?.data?.[0]?.value;
  console.log("Lines count:", lines?.length);
  if (lines && lines.length > 0) {
    console.log("Sample line:", lines[0]);
  }
  const tables = ctx.plots['__tables__']?.data?.[0]?.value;
  console.log("Tables count:", tables?.length);
  if (tables && tables.length > 0) {
    console.log("Sample table position:", tables[0]?.position, "rows:", tables[0]?.rows, "cols:", tables[0]?.columns);
  }
}).catch(err => {
  console.error("Run error:", err);
});
