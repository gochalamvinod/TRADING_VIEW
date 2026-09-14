const fs = require('fs');

// 1. Fix chart_app.js
console.log('Fixing chart_app.js...');
const chartAppPath = 'e:/TRADINGVIEW ADVANCED/chart_app.js';
let chartAppCode = fs.readFileSync(chartAppPath, 'utf8');

// Normalize line endings to LF for regex/string matching
const chartAppIsCRLF = chartAppCode.includes('\r\n');
chartAppCode = chartAppCode.replace(/\r\n/g, '\n');

// Replace showPropertiesDialog hook in chart_app.js
const hookRegex = /\/\/ Hook chart\.showPropertiesDialog[\s\S]*?activeCh\.showPropertiesDialog = function\(sId\)[\s\S]*?return origShowProps\(sId\);\s*\};\s*\}\s*\}\s*catch\s*\(e\)\s*\{\}/;
if (hookRegex.test(chartAppCode)) {
  chartAppCode = chartAppCode.replace(hookRegex, '// Native chart.showPropertiesDialog preserved');
  console.log('Successfully removed showPropertiesDialog hook from chart_app.js');
} else {
  console.log('Could not find hookRegex in chart_app.js, checking alternate match...');
}

// Remove PineIndicators.openSettingsDialog in gesture handler
const gestureRegex = /if\s*\(window\.PineIndicators\s*&&\s*typeof\s*window\.PineIndicators\.openSettingsDialog\s*===\s*'function'\)\s*\{\s*if\s*\(window\.PineIndicators\.openSettingsDialog\(srcId,\s*activeChart\)\)\s*\{\s*targetStudyOpened\s*=\s*true;\s*break;\s*\}\s*\}/;
if (gestureRegex.test(chartAppCode)) {
  chartAppCode = chartAppCode.replace(gestureRegex, '// Native properties dialog used');
  console.log('Successfully removed PineIndicators.openSettingsDialog from gesture handler in chart_app.js');
}

fs.writeFileSync(chartAppPath, chartAppIsCRLF ? chartAppCode.replace(/\n/g, '\r\n') : chartAppCode, 'utf8');

// 2. Fix pine_indicators.js
console.log('Fixing pine_indicators.js...');
const pineIndPath = 'e:/TRADINGVIEW ADVANCED/pine_indicators.js';
let pineIndCode = fs.readFileSync(pineIndPath, 'utf8');
const pineIndIsCRLF = pineIndCode.includes('\r\n');
pineIndCode = pineIndCode.replace(/\r\n/g, '\n');

// In hookChartSettings: remove chart.showPropertiesDialog hook
const indShowPropsRegex = /\/\/ 1\. Hook chart\.showPropertiesDialog[\s\S]*?chart\.showPropertiesDialog = function\(sId\)[\s\S]*?return origShowProps\(sId\);\s*\};\s*\}/;
if (indShowPropsRegex.test(pineIndCode)) {
  pineIndCode = pineIndCode.replace(indShowPropsRegex, '// 1. Native showPropertiesDialog preserved');
  console.log('Removed showPropertiesDialog hook from pine_indicators.js');
}

// In hookChartSettings: remove cw.showChartPropertiesForSource hook
const indShowSourceRegex = /\/\/ 2\. Hook chart\._chartWidget\.showChartPropertiesForSource[\s\S]*?cw\.showChartPropertiesForSource = function[\s\S]*?return origShowForSource\(source, tabName, options, undoCheckpoint\);\s*\};\s*\}/;
if (indShowSourceRegex.test(pineIndCode)) {
  pineIndCode = pineIndCode.replace(indShowSourceRegex, '// 2. Native showChartPropertiesForSource preserved');
  console.log('Removed showChartPropertiesForSource hook from pine_indicators.js');
}

// In hookChartSettings: remove gear click interception
const indGearRegex = /const gear = e\.target\.closest\('\[data-name="legend-settings-action"\], \[class\*="formatButton"\]'\);[\s\S]*?openSettingsDialog\(match\.id, chart\);\s*\}\s*\}\s*\}/;
if (indGearRegex.test(pineIndCode)) {
  pineIndCode = pineIndCode.replace(indGearRegex, '// Gear click handled natively by TradingView');
  console.log('Removed gear click hijacking from pine_indicators.js');
}

// In openSettingsDialog: NEVER call chart.showPropertiesDialog recursively
const openSettingsFuncRegex = /function openSettingsDialog\(studyId, chartInstance\) \{[\s\S]*?console\.warn\('\[PineIndicators\] Error delegating to chart\.showPropertiesDialog:', e\);\s*\}\s*return false;\s*\}/;
const safeOpenSettings = `function openSettingsDialog(studyId, chartInstance) {
    const existing = document.getElementById('tv_settings_modal_overlay');
    if (existing) existing.remove();
    return true;
  }`;

if (openSettingsFuncRegex.test(pineIndCode)) {
  pineIndCode = pineIndCode.replace(openSettingsFuncRegex, safeOpenSettings);
  console.log('Replaced openSettingsDialog with safe non-recursive version in pine_indicators.js');
} else {
  console.log('openSettingsFuncRegex did not match, checking alternate...');
  const idx = pineIndCode.indexOf('function openSettingsDialog(studyId, chartInstance)');
  if (idx !== -1) {
    const endIdx = pineIndCode.indexOf('const PineIndicators = {', idx);
    if (endIdx !== -1) {
      pineIndCode = pineIndCode.slice(0, idx) + safeOpenSettings + '\n\n  ' + pineIndCode.slice(endIdx);
      console.log('Replaced openSettingsDialog via index search in pine_indicators.js');
    }
  }
}

fs.writeFileSync(pineIndPath, pineIndIsCRLF ? pineIndCode.replace(/\n/g, '\r\n') : pineIndCode, 'utf8');

console.log('Infinite recursion fixes applied successfully!');
