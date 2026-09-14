const fs = require('fs');
const path = require('path');

const bundlesDir = 'E:/TRADINGVIEW ADVANCED/charting_library/bundles';
const files = fs.readdirSync(bundlesDir).filter(f => f.endsWith('.js'));
files.push('E:/TRADINGVIEW ADVANCED/charting_library/charting_library.standalone.js');

const featureMap = new Map();
const regex = /\b(?:enabled|is_enabled)\s*\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g;

for (const f of files) {
  const fullPath = f.startsWith('E:') ? f : path.join(bundlesDir, f);
  if (!fs.existsSync(fullPath)) continue;
  const content = fs.readFileSync(fullPath, 'utf8');
  let match;
  while ((match = regex.exec(content)) !== null) {
    const feat = match[1];
    featureMap.set(feat, (featureMap.get(feat) || 0) + 1);
  }
}

const sorted = Array.from(featureMap.entries()).sort((a, b) => b[1] - a[1]);
console.log('Total unique features found:', sorted.length);
console.log('Features list:');
sorted.forEach(([feat, count]) => {
  console.log(`${feat}: ${count}`);
});
