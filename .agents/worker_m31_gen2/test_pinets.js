const fs = require('fs');
const src = fs.readFileSync('E:/TRADINGVIEW ADVANCED/scratch_luxalgo.pine', 'utf8');
const p = require('../../PineTS-main/dist/pinets.min.cjs');
global.root = global;
global.window = global;
global.PineTSLib = p;

// Load pine_indicators logic
require('E:/TRADINGVIEW ADVANCED/pine_indicators.js');
const meta = global.PineIndicators.parsePineMetadata(src);
console.log('Title:', meta.title);
console.log('ShortTitle:', meta.shortTitle);
console.log('Overlay:', meta.isOverlay);
console.log('Plots count:', meta.plots.length);
console.log('Shapes count:', meta.shapes.length);
console.log('First 3 plots:', meta.plots.slice(0, 3));
console.log('First 3 shapes:', meta.shapes.slice(0, 3));
