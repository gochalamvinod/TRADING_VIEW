const fs = require('fs');
const path = require('path');

const rootDir = 'E:/TRADINGVIEW ADVANCED';
const bundlesDir = path.join(rootDir, 'charting_library/bundles');
const standaloneFile = path.join(rootDir, 'charting_library/charting_library.standalone.js');

// 1. Extract the tree from 2614
const file2614 = path.join(bundlesDir, '2614.3c6e9a4d2c016c8e0d98.js');
let baseFeaturesJson = {};
if (fs.existsSync(file2614)) {
  const content = fs.readFileSync(file2614, 'utf8');
  const match = content.match(/const\s+r\s*=\s*JSON\.parse\('([^']+)'\)/);
  if (match) {
    baseFeaturesJson = JSON.parse(match[1]);
  }
}

console.log('Features defined in 2614 module 440891 base tree:', Object.keys(baseFeaturesJson).length);

// Extract subsets
const baseSet = new Set(Object.keys(baseFeaturesJson));
for (const [feat, val] of Object.entries(baseFeaturesJson)) {
  if (val.subsets && Array.isArray(val.subsets)) {
    for (const sub of val.subsets) {
      baseSet.add(sub);
    }
  }
}
console.log('Total features in 2614 including subsets:', baseSet.size);

// 2. Scan all files in bundles and standalone
const jsFiles = fs.readdirSync(bundlesDir).filter(f => f.endsWith('.js')).map(f => path.join(bundlesDir, f));
if (fs.existsSync(standaloneFile)) {
  jsFiles.push(standaloneFile);
}

// Check other js files in the project (e.g. datafeeds, etc.)
const udfBundle = path.join(rootDir, 'datafeeds/udf/dist/bundle.js');
if (fs.existsSync(udfBundle)) jsFiles.push(udfBundle);

console.log(`Scanning ${jsFiles.length} JS files...`);

// Multiple regex patterns for feature flag checks
const patterns = [
  // .enabled("feature_name") or enabled('feature_name')
  /\.enabled\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g,
  // is_enabled("...")
  /\bis_enabled\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g,
  // isFeatureEnabled("...")
  /\bisFeatureEnabled\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g,
  // hasFeature("...")
  /\bhasFeature\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g,
  // setFeatureEnabled("...", ...)
  /\bsetFeatureEnabled\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*,/g,
  // enabled_features?.includes("...") or disabled_features?.includes("...")
  /(?:enabled_features|disabled_features)(?:\?\.|\.)includes\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g,
  // featureset: "..."
  /\bfeatureset\s*:\s*['"]([a-zA-Z0-9_-]+)['"]/g
];

const discovered = new Map(); // feature -> { count: number, sources: Set<string>, patterns: Set<string> }

function recordFeature(feat, file, patName) {
  // Discard empty or purely numeric if not real
  if (!feat) return;
  const fileName = path.basename(file);
  if (!discovered.has(feat)) {
    discovered.set(feat, { count: 0, sources: new Set(), patterns: new Set(), inBaseTree: baseSet.has(feat) });
  }
  const item = discovered.get(feat);
  item.count++;
  item.sources.add(fileName);
  item.patterns.add(patName);
}

// Add all features from baseSet first
for (const feat of baseSet) {
  discovered.set(feat, { count: 0, sources: new Set(['2614 (base tree)']), patterns: new Set(['base_tree']), inBaseTree: true });
}

for (const filePath of jsFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  patterns.forEach((pat, idx) => {
    pat.lastIndex = 0;
    let m;
    while ((m = pat.exec(content)) !== null) {
      recordFeature(m[1], filePath, `pattern_${idx}`);
    }
  });
}

console.log('Total unique features discovered:', discovered.size);

// Also let's inspect the distribution
const list = Array.from(discovered.entries()).map(([k, v]) => ({
  feature: k,
  count: v.count,
  sourcesCount: v.sources.size,
  sources: Array.from(v.sources).slice(0, 5),
  inBaseTree: v.inBaseTree
}));

list.sort((a, b) => b.count - a.count);

console.log('Top 30 most referenced features:');
console.log(list.slice(0, 30).map(x => `${x.feature} (${x.count} refs across ${x.sourcesCount} files)`).join('\n'));

// Save complete json output
fs.writeFileSync(
  path.join(__dirname, 'discovered_features.json'),
  JSON.stringify({ total: list.length, features: list }, null, 2),
  'utf8'
);
console.log('Saved to discovered_features.json');
