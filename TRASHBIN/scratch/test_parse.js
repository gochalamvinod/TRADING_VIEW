const fs = require('fs');
global.window = global;
require('../pine_indicators.js');
const pineSrc = fs.readFileSync('scratch_luxalgo.pine', 'utf8');
const meta = window.PineIndicators.parsePineMetadata(pineSrc);
console.log('Title:', meta.title);
console.log('Inputs count:', meta.inputs.length);
meta.inputs.forEach((inp, i) => {
  console.log('[' + i + '] id: ' + inp.id + ', name: \"' + inp.name + '\", group: \"' + inp.group + '\", inline: \"' + inp.inline + '\", tooltip: \"' + (inp.tooltip || '').slice(0, 30) + '\", type: ' + inp.type + ', defval: ' + inp.defval);
});
