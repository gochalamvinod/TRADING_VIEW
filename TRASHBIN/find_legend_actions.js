const fs = require('fs');
const content = fs.readFileSync('charting_library/bundles/chart-widget-gui.373398f680e71823f0f1.js', 'utf8');
let idx = 0;
while ((idx = content.indexOf('legend-', idx + 1)) !== -1) {
  console.log('Action:', content.slice(Math.max(0, idx - 80), Math.min(content.length, idx + 80)));
}
