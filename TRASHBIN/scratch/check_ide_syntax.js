const fs = require('fs');
const content = fs.readFileSync('pine_editor_ide.js', 'utf8');

// Check with vm
const vm = require('vm');
try {
  new vm.Script(content);
  console.log('Script syntax is valid.');
} catch (e) {
  console.error('Syntax error:', e);
}
