const Transpiler = require('../../pine_transpiler.bundle.js');
const fs = require('fs');
const path = require('path');

const examplesDir = path.join(__dirname, '../../Pine-A-Script-master/examples');
const files = fs.readdirSync(examplesDir).filter(f => f.endsWith('.pine'));

const globalRefs = new Set();

files.forEach(f => {
  const code = fs.readFileSync(path.join(examplesDir, f), 'utf8');
  try {
    const res = Transpiler.transpile(code);
    if (res.success) {
      const matches = res.code.match(/globalThis\.[a-zA-Z0-9_$]+/g) || [];
      matches.forEach(m => globalRefs.add(m));
    }
  } catch (e) {}
});

console.log('All globalThis references in transpiled code:');
console.log(Array.from(globalRefs).sort());
