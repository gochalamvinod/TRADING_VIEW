const fs = require('fs');
const path = require('path');

const studiesPath = 'E:/TRADINGVIEW ADVANCED/charting_library/bundles/studies.df9d03d5d71d89aed43c.js';
const content = fs.readFileSync(studiesPath, 'utf8');

console.log(`studies.js size: ${(content.length / 1024).toFixed(1)} KB`);

// Find all study IDs and names
const idRe = /name:\s*["']([^"']+)@tv-basicstudies["']/g;
const studies = new Set();
let m;
while ((m = idRe.exec(content)) !== null) {
  studies.add(m[1]);
}

console.log(`Built-in studies found: ${studies.size}`);
const sortedStudies = Array.from(studies).sort();
console.log('Sample studies:');
console.log(sortedStudies.slice(0, 30).join(', '));

fs.writeFileSync(
  path.join(__dirname, 'built_in_studies.json'),
  JSON.stringify({ count: sortedStudies.length, studies: sortedStudies }, null, 2),
  'utf8'
);
