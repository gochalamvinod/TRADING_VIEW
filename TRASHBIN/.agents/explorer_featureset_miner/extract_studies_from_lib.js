const fs = require('fs');
const path = require('path');

const libPath = 'E:/TRADINGVIEW ADVANCED/charting_library/bundles/library.e8d44337c84d65489d2c.js';
const content = fs.readFileSync(libPath, 'utf8');

// Match all descriptions or names of studies
const re = /description:\s*["']([^"']+)["'],\s*shortDescription:\s*["']([^"']+)["']/g;
const studies = [];
let m;
while ((m = re.exec(content)) !== null) {
  studies.push({ description: m[1], shortDescription: m[2] });
}

console.log(`Extracted ${studies.length} built-in studies from library.js!`);
console.log('First 20 studies:');
console.log(studies.slice(0, 20).map(s => `${s.description} (${s.shortDescription})`).join('\n'));

fs.writeFileSync(
  path.join(__dirname, 'extracted_studies.json'),
  JSON.stringify({ count: studies.length, studies }, null, 2),
  'utf8'
);
