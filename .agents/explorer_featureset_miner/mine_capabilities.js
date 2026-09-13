const fs = require('fs');
const path = require('path');

const rootDir = 'E:/TRADINGVIEW ADVANCED';
const bundlesDir = path.join(rootDir, 'charting_library/bundles');
const standaloneFile = path.join(rootDir, 'charting_library/charting_library.standalone.js');

const jsFiles = fs.readdirSync(bundlesDir).filter(f => f.endsWith('.js')).map(f => path.join(bundlesDir, f));
if (fs.existsSync(standaloneFile)) jsFiles.push(standaloneFile);

// 1. Find all ActionIds from standalone
const standaloneContent = fs.readFileSync(standaloneFile, 'utf8');
const actionIdRegex = /t\.([a-zA-Z0-9_]+)\s*=\s*["']([a-zA-Z0-9_.-]+)["']/g;
const actionIds = [];
let am;
const actionStart = standaloneContent.indexOf('e.ActionId=void 0');
const actionEnd = standaloneContent.indexOf('function(e){e.extractErrorReason');
if (actionStart !== -1 && actionEnd !== -1) {
  const actionChunk = standaloneContent.substring(actionStart, actionEnd);
  while ((am = actionIdRegex.exec(actionChunk)) !== null) {
    actionIds.push({ name: am[1], id: am[2] });
  }
}
console.log(`Discovered ActionIds: ${actionIds.length}`);

// 2. Discover ChartStyles
const chartStyles = [];
const csMatch = standaloneContent.match(/e\.ChartStyle=void 0,.*?\(de=e\.ChartStyle\|\|\(e\.ChartStyle={}\)\)(.*?);e\.TimeHoursFormat/);
if (csMatch) {
  const csChunk = csMatch[1];
  const csRe = /de\[de\.([a-zA-Z0-9_]+)=(\d+)\]="([a-zA-Z0-9_]+)"/g;
  let csm;
  while ((csm = csRe.exec(csChunk)) !== null) {
    chartStyles.push({ name: csm[1], id: parseInt(csm[2]), key: csm[3] });
  }
}
console.log(`Discovered ChartStyles: ${chartStyles.length}`);

// 3. Discover Studies / Indicators
// In TradingView, studies are defined in study bundles or have names like "Moving Average", etc.
const studyNames = new Set();
const studyRegexes = [
  /\bname\s*:\s*["']([a-zA-Z0-9 _@&/-]+)["'],\s*description\s*:\s*["']([^"']+)["']/g,
  /\bdescription\s*:\s*["']([^"']+)["'],\s*name\s*:\s*["']([a-zA-Z0-9 _@&/-]+)["']/g,
  /id\s*:\s*["']([A-Za-z0-9_]+@tv-basicstudies(?::\d+)?)["']/g,
  /name\s*:\s*["']([a-zA-Z0-9_-]+@tv-basicstudies)["']/g
];

for (const f of jsFiles) {
  const content = fs.readFileSync(f, 'utf8');
  studyRegexes.forEach(re => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(content)) !== null) {
      if (m[1] && m[1].length > 2 && m[1].length < 80) studyNames.add(m[1]);
      if (m[2] && m[2].length > 2 && m[2].length < 80) studyNames.add(m[2]);
    }
  });
}
console.log(`Discovered Study & Indicator descriptors: ${studyNames.size}`);

// 4. Discover Drawing Tools / LineTools
const lineTools = new Set();
// Search for LineTool definitions
const lineToolRegex = /LineTool([A-Z][a-zA-Z0-9]+)/g;
for (const f of jsFiles) {
  const content = fs.readFileSync(f, 'utf8');
  let m;
  while ((m = lineToolRegex.exec(content)) !== null) {
    lineTools.add(m[1]);
  }
}
console.log(`Discovered Line Tools / Drawing Tools: ${lineTools.size}`);

fs.writeFileSync(
  path.join(__dirname, 'library_capabilities.json'),
  JSON.stringify({
    actionIdsCount: actionIds.length,
    actionIds,
    chartStylesCount: chartStyles.length,
    chartStyles,
    studyCount: studyNames.size,
    studiesSample: Array.from(studyNames).slice(0, 50),
    lineToolsCount: lineTools.size,
    lineTools: Array.from(lineTools).sort()
  }, null, 2),
  'utf8'
);

console.log('Saved library_capabilities.json');
