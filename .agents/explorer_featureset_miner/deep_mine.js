const fs = require('fs');
const path = require('path');

const rootDir = 'E:/TRADINGVIEW ADVANCED';
const bundlesDir = path.join(rootDir, 'charting_library/bundles');
const standaloneFile = path.join(rootDir, 'charting_library/charting_library.standalone.js');

const jsFiles = fs.readdirSync(bundlesDir).filter(f => f.endsWith('.js')).map(f => path.join(bundlesDir, f));
if (fs.existsSync(standaloneFile)) jsFiles.push(standaloneFile);

// Read 2614 base tree
const file2614 = path.join(bundlesDir, '2614.3c6e9a4d2c016c8e0d98.js');
let baseTree = {};
if (fs.existsSync(file2614)) {
  const content = fs.readFileSync(file2614, 'utf8');
  const match = content.match(/const\s+r\s*=\s*JSON\.parse\('([^']+)'\)/);
  if (match) baseTree = JSON.parse(match[1]);
}

const allFeatures = new Map(); // feature -> info

// Add all from baseTree
for (const [feat, val] of Object.entries(baseTree)) {
  allFeatures.set(feat, {
    feature: feat,
    inBaseTree: true,
    subsets: val.subsets || [],
    parentFeatures: [],
    sources: new Set(['2614.js (baseTree)']),
    contexts: []
  });
}

// Map parents and subsets
for (const [feat, val] of Object.entries(baseTree)) {
  if (val.subsets && Array.isArray(val.subsets)) {
    for (const sub of val.subsets) {
      if (!allFeatures.has(sub)) {
        allFeatures.set(sub, {
          feature: sub,
          inBaseTree: true,
          subsets: [],
          parentFeatures: [feat],
          sources: new Set(['2614.js (baseTree subset)']),
          contexts: []
        });
      } else {
        allFeatures.get(sub).parentFeatures.push(feat);
      }
    }
  }
}

// Now search across all files for:
// 1. .enabled("...")
// 2. is_enabled("...")
// 3. hasFeature("...")
// 4. isFeatureEnabled("...")
// 5. setFeatureEnabled("...")
// 6. disabledFeatures / enabledFeatures
// 7. e.enabled("...") where e is any variable
const regexes = [
  { name: 'dot_enabled', re: /\.enabled\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g },
  { name: 'bare_enabled', re: /\benabled\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g },
  { name: 'is_enabled', re: /\bis_enabled\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g },
  { name: 'hasFeature', re: /\bhasFeature\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g },
  { name: 'isFeatureEnabled', re: /\bisFeatureEnabled\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g },
  { name: 'setFeatureEnabled', re: /\bsetFeatureEnabled\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*,/g },
  { name: 'includes', re: /(?:enabledFeatures|disabledFeatures|enabled_features|disabled_features)(?:\?\.|\.)includes\(\s*['"]([a-zA-Z0-9_-]+)['"]\s*\)/g }
];

console.log(`Scanning ${jsFiles.length} files...`);

for (const filePath of jsFiles) {
  const baseName = path.basename(filePath);
  const content = fs.readFileSync(filePath, 'utf8');

  for (const { name, re } of regexes) {
    re.lastIndex = 0;
    let match;
    while ((match = re.exec(content)) !== null) {
      const feat = match[1];
      // Filter out obvious false positives like "true", "false", "undefined", single character
      if (feat.length < 2) continue;
      if (['true', 'false', 'undefined', 'null'].includes(feat)) continue;

      if (!allFeatures.has(feat)) {
        allFeatures.set(feat, {
          feature: feat,
          inBaseTree: false,
          subsets: [],
          parentFeatures: [],
          sources: new Set(),
          contexts: []
        });
      }
      const item = allFeatures.get(feat);
      item.sources.add(baseName);

      // Grab snippet context
      if (item.contexts.length < 3) {
        const start = Math.max(0, match.index - 50);
        const end = Math.min(content.length, match.index + match[0].length + 50);
        item.contexts.push(content.slice(start, end).replace(/\s+/g, ' '));
      }
    }
  }
}

console.log(`Found ${allFeatures.size} unique feature flags.`);

// Also let's search for studies, line tools, and chart types
const studies = new Set();
const lineTools = new Set();

// Scan for studies definitions or study names
const studyPattern = /\bname\s*:\s*['"]([A-Z0-9_@]+)['"],\s*metainfo/g; // or Study meta info
// Also find standard studies
for (const filePath of jsFiles) {
  const content = fs.readFileSync(filePath, 'utf8');
  let m;
  while ((m = studyPattern.exec(content)) !== null) {
    studies.add(m[1]);
  }
}

// Convert allFeatures to array
const featuresArray = Array.from(allFeatures.values()).map(f => ({
  feature: f.feature,
  inBaseTree: f.inBaseTree,
  subsets: f.subsets,
  parentFeatures: f.parentFeatures,
  sourcesCount: f.sources.size,
  sources: Array.from(f.sources).slice(0, 5),
  contexts: f.contexts
}));

featuresArray.sort((a, b) => a.feature.localeCompare(b.feature));

fs.writeFileSync(
  path.join(__dirname, 'all_mined_features.json'),
  JSON.stringify({
    totalFeatures: featuresArray.length,
    features: featuresArray
  }, null, 2),
  'utf8'
);

console.log(`Successfully written all_mined_features.json with ${featuresArray.length} features.`);
