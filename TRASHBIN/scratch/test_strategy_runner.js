const path = require('path');
const p = require(path.resolve('E:/TRADINGVIEW ADVANCED/pinets.min.cjs'));
const PineTS = p.PineTS;

const sampleBars = [];
let price = 2000;
const now = Date.now();
for (let i = 0; i < 200; i++) {
  const change = (Math.random() - 0.48) * 10;
  const o = price;
  const c = price + change;
  const h = Math.max(o, c) + Math.random() * 5;
  const l = Math.min(o, c) - Math.random() * 5;
  price = c;
  sampleBars.push({
    time: now - (200 - i) * 60000,
    open: o,
    high: h,
    low: l,
    close: c,
    volume: 100 + Math.floor(Math.random() * 50)
  });
}

const strategyCode = `//@version=5
strategy("Test SMA Strategy", overlay=true, initial_capital=10000)

fastSMA = ta.sma(close, 9)
slowSMA = ta.sma(close, 21)

longCondition = ta.crossover(fastSMA, slowSMA)
shortCondition = ta.crossunder(fastSMA, slowSMA)

if (longCondition)
    strategy.entry("Long", strategy.long)

if (shortCondition)
    strategy.close("Long")
`;

async function run() {
  try {
    const pine = new PineTS(sampleBars);
    const ctx = await pine.run(strategyCode);
    console.log('Execution completed!');
    console.log('Strategy keys on ctx:', Object.keys(ctx.strategy || {}));
    if (ctx.strategy) {
      console.log('netprofit:', ctx.strategy.netprofit);
      console.log('closedtrades count:', ctx.strategy.closedtrades?.length);
      console.log('opentrades count:', ctx.strategy.opentrades?.length);
      console.log('max_drawdown:', ctx.strategy.max_drawdown);
      console.log('wintrades:', ctx.strategy.wintrades);
      console.log('losstrades:', ctx.strategy.losstrades);
      if (ctx.strategy.closedtrades?.length > 0) {
        console.log('Sample closed trade:', ctx.strategy.closedtrades[0]);
      }
    }
  } catch (err) {
    console.error('Error running strategy:', err);
  }
}

run();
