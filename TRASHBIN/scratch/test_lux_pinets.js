const fs = require('fs');
const path = require('path');
const pinets = require('e:/TRADINGVIEW ADVANCED/PineTS-main/dist/pinets.min.cjs');

const luxCode = fs.readFileSync('e:/TRADINGVIEW ADVANCED/scratch_luxalgo.pine', 'utf8');
console.log('Testing pineToJS on scratch_luxalgo.pine (length: ' + luxCode.length + ')...');

try {
  const res = pinets.pineToJS(luxCode);
  console.log('pineToJS success:', res ? res.success : 'no result');
  if (res && !res.success) {
    console.log('pineToJS error:', res.error);
  } else if (res) {
    console.log('pineToJS generated code length:', res.code ? res.code.length : 0);
  }
} catch (e) {
  console.log('pineToJS thrown exception:', e.message);
}

try {
  const ind = pinets.Indicator.from(luxCode);
  console.log('Indicator.from success, preparing...');
  if (ind && typeof ind.prepare === 'function') {
    ind.prepare();
  }
  console.log('Indicator.prepare success!');
} catch (e) {
  console.log('Indicator error:', e.message);
}
