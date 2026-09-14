const fs = require('fs');
const assert = require('assert');
require('./pine_indicators.js');
const PineIndicators = globalThis.PineIndicators;

const source = fs.readFileSync('scratch/luxalgo_sessions.pine', 'utf-8');

try {
  console.log("Compiling LuxAlgo Sessions script...");
  const result = PineIndicators.compileAndRegisterPine(source);
  console.log("Compilation success!");
  console.log("Study name:", result.study.name);
  console.log("Metainfo id:", result.study.metainfo.id);
  console.log("Plots count:", result.study.metainfo.plots.length);
  console.log("Inputs count:", result.study.metainfo.inputs.length);

  const instance = new result.study.constructor();
  instance.init({}, (id) => result.study.metainfo.defaults.inputs[id]);
  console.log("Instance initialized.");

  // Test executing main for 5 bars
  const dummyCtx = {
    symbol: {
      open: 100,
      high: 105,
      low: 95,
      close: 102,
      volume: 1000,
      time: 1725890000000,
      index: 0
    },
    new_var: (val) => ({
      get: (offset) => val
    })
  };

  const output = instance.main(dummyCtx, (id) => result.study.metainfo.defaults.inputs[id]);
  console.log("Main output length:", output.length);
  console.log("Main output sample:", output.slice(0, 10));
} catch (e) {
  console.error("Error testing LuxAlgo script:", e);
}
