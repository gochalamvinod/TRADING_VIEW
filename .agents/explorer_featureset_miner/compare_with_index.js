const fs = require('fs');
const path = require('path');

const indexHtmlPath = 'E:/TRADINGVIEW ADVANCED/index.html';
const indexHtml = fs.readFileSync(indexHtmlPath, 'utf8');

// Extract enabled_features and disabled_features from index.html
function extractArray(content, key) {
  const re = new RegExp(`${key}\\s*:\\s*\\[([\\s\\S]*?)\\]`, 'm');
  const match = content.match(re);
  if (!match) return [];
  const inside = match[1];
  const items = [];
  const itemRe = /['"]([a-zA-Z0-9_-]+)['"]/g;
  let m;
  while ((m = itemRe.exec(inside)) !== null) {
    items.push(m[1]);
  }
  return items;
}

const currentEnabled = extractArray(indexHtml, 'enabled_features');
const currentDisabled = extractArray(indexHtml, 'disabled_features');

console.log(`Currently enabled in index.html: ${currentEnabled.length}`);
console.log(`Currently disabled in index.html: ${currentDisabled.length}`);

const minedFeaturesData = JSON.parse(fs.readFileSync(path.join(__dirname, 'all_mined_features.json'), 'utf8'));
const allFeatures = minedFeaturesData.features;

console.log(`Total mined features: ${allFeatures.length}`);

const currentEnabledSet = new Set(currentEnabled);
const currentDisabledSet = new Set(currentDisabled);

const notInIndex = allFeatures.filter(f => !currentEnabledSet.has(f.feature) && !currentDisabledSet.has(f.feature));

console.log(`Features NOT explicitly listed in index.html: ${notInIndex.length}`);

fs.writeFileSync(
  path.join(__dirname, 'comparison_summary.json'),
  JSON.stringify({
    totalMined: allFeatures.length,
    currentEnabledCount: currentEnabled.length,
    currentDisabledCount: currentDisabled.length,
    notInIndexCount: notInIndex.length,
    currentEnabled,
    currentDisabled,
    notInIndex: notInIndex.map(f => ({
      feature: f.feature,
      inBaseTree: f.inBaseTree,
      parentFeatures: f.parentFeatures,
      subsets: f.subsets,
      sources: f.sources,
      contexts: f.contexts
    }))
  }, null, 2),
  'utf8'
);

console.log('Saved comparison_summary.json');
