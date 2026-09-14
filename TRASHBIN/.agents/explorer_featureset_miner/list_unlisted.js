const fs = require('fs');
const path = require('path');

const categorized = JSON.parse(fs.readFileSync(path.join(__dirname, 'categorized_features.json'), 'utf8')).features;

const unlisted = categorized.filter(f => f.statusInIndex === 'Unlisted');

console.log(`Total unlisted features: ${unlisted.length}`);

// Group by category
const byCat = {};
for (const item of unlisted) {
  if (!byCat[item.category]) byCat[item.category] = [];
  byCat[item.category].push(item);
}

for (const [cat, items] of Object.entries(byCat)) {
  console.log(`\n=== ${cat} (${items.length} features) ===`);
  for (const it of items) {
    console.log(`- ${it.feature} [${it.recommendation}] (refs: ${it.sourcesCount})`);
  }
}
