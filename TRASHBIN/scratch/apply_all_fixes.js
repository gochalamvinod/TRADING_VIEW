const fs = require('fs');

// 1. PATCH pine_editor_ide.js
console.log('--- Patching pine_editor_ide.js ---');
const idePath = 'e:/TRADINGVIEW ADVANCED/pine_editor_ide.js';
let ideCode = fs.readFileSync(idePath, 'utf8');

// Fix delete button
const oldDeleteBlock = `      // Delete custom script
      row.querySelector('.delete-script-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        showTVConfirmDialog({
          title: "Delete script",
          message: \`Are you sure you want to delete script "\${item.name}"? This action cannot be undone.\`,
          confirmText: "Delete",
          cancelText: "Cancel",
          isDanger: true,
          onConfirm: () => {
            const allScripts = getUserSavedScripts().filter(s => s.id !== item.id && s.name !== item.name);
            saveUserSavedScripts(allScripts);
            renderIndicatorsModal();
          }
        });
      });`;

const newDeleteBlock = `      // Delete custom script
      row.querySelector('.delete-script-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        const ok = window.confirm(\`Are you sure you want to delete script "\${item.name}"? This action cannot be undone.\`);
        if (ok) {
          const allScripts = getUserSavedScripts().filter(s => s.id !== item.id && s.name !== item.name);
          saveUserSavedScripts(allScripts);
          renderIndicatorsModal();
        }
      });`;

if (ideCode.includes(oldDeleteBlock)) {
  ideCode = ideCode.replace(oldDeleteBlock, newDeleteBlock);
  console.log('Successfully patched delete button in pine_editor_ide.js');
} else {
  console.log('Trying regex replacement for delete button...');
  ideCode = ideCode.replace(/row\.querySelector\('\.delete-script-btn'\)\?\.addEventListener\('click'[\s\S]*?renderIndicatorsModal\(\);\s*\}\s*\}\);\s*\}\);/,
    `row.querySelector('.delete-script-btn')?.addEventListener('click', (e) => {\n        e.stopPropagation();\n        const ok = window.confirm(\`Are you sure you want to delete script "\${item.name}"? This action cannot be undone.\`);\n        if (ok) {\n          const allScripts = getUserSavedScripts().filter(s => s.id !== item.id && s.name !== item.name);\n          saveUserSavedScripts(allScripts);\n          renderIndicatorsModal();\n        }\n      });`
  );
  console.log('Applied regex replacement for delete button');
}

// Fix recursive saveBtn.click() at line ~4019
const oldSaveClick = `    document.getElementById('pine_menu_save_script')?.addEventListener('click', () => {
      closeDropdown();
      saveBtn.click();
    });`;
const newSaveClick = `    document.getElementById('pine_menu_save_script')?.addEventListener('click', () => {
      closeDropdown();
    });`;

if (ideCode.includes(oldSaveClick)) {
  ideCode = ideCode.replace(oldSaveClick, newSaveClick);
  console.log('Fixed recursive saveBtn click');
}

// Add showTVConfirmDialog helper to root
if (!ideCode.includes('root.showTVConfirmDialog')) {
  ideCode = ideCode.replace('root.PineEditorIDE = PineEditorIDE;',
    `root.showTVConfirmDialog = function(opts) {
    if (!opts) return;
    if (window.confirm(opts.message || 'Are you sure?')) {
      if (typeof opts.onConfirm === 'function') opts.onConfirm();
    } else {
      if (typeof opts.onCancel === 'function') opts.onCancel();
    }
  };
  root.PineEditorIDE = PineEditorIDE;`);
}

// Ensure injectLegendPolishStyles includes hover-only rule for { } button inside iframe
const legendHoverRule = `
          /* Authentic Source Code { } Button in Indicator Legend: ONLY visible on hover */
          [data-name="legend-source-code-action"],
          .tv-legend-code-btn {
            display: none !important;
            opacity: 0 !important;
            pointer-events: none !important;
            align-items: center !important;
            justify-content: center !important;
            width: 24px !important;
            height: 24px !important;
            min-width: 24px !important;
            cursor: pointer !important;
            color: #787b86 !important;
            font-family: -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, monospace, sans-serif !important;
            font-weight: 700 !important;
            font-size: 12px !important;
            line-height: 1 !important;
            white-space: nowrap !important;
            border-radius: 4px !important;
            box-sizing: border-box !important;
            padding: 0 !important;
          }

          [data-name="legend-source-code-action"] span,
          .tv-legend-code-btn span {
            display: inline-block !important;
            white-space: nowrap !important;
            line-height: 1 !important;
            font-family: monospace !important;
            font-weight: 700 !important;
            font-size: 11px !important;
            letter-spacing: -0.5px !important;
          }

          [data-name="legend-study-item"]:hover [data-name="legend-source-code-action"],
          [data-name="legend-study-item"]:hover .tv-legend-code-btn,
          [class*="item-"]:hover [data-name="legend-source-code-action"],
          [class*="item-"]:hover .tv-legend-code-btn,
          [class*="selected-"] [data-name="legend-source-code-action"],
          [class*="selected-"] .tv-legend-code-btn,
          [class*="withAction-"] [data-name="legend-source-code-action"],
          [class*="withAction-"] .tv-legend-code-btn {
            display: inline-flex !important;
            opacity: 1 !important;
            pointer-events: auto !important;
          }
`;

if (!ideCode.includes('legend-source-code-action"],') || !ideCode.includes('.tv-legend-code-btn {')) {
  ideCode = ideCode.replace(`/* Hover action buttons in legend */`, `${legendHoverRule}\n          /* Hover action buttons in legend */`);
  console.log('Injected legend hover rule into injectLegendPolishStyles');
}

fs.writeFileSync(idePath, ideCode, 'utf8');
console.log('pine_editor_ide.js updated.');

// 2. PATCH pine_indicators.js
console.log('--- Patching pine_indicators.js ---');
const indPath = 'e:/TRADINGVIEW ADVANCED/pine_indicators.js';
let indCode = fs.readFileSync(indPath, 'utf8');

// A. In hookChartSettings: remove gear click interception
const gearClickBlock = `          const gear = e.target.closest('[data-name="legend-settings-action"], [class*="formatButton"]');
          if (gear) {
            const item = gear.closest('[data-name="legend-source-item"], [data-name="legend-study-item"], [class*="item-"]');
            if (item) {
              const titleEl = item.querySelector('[class*="title-"], [data-name="legend-source-title"]');
              const titleText = titleEl ? titleEl.textContent.trim() : '';
              const studies = chart.getAllStudies ? chart.getAllStudies() : [];
              const match = studies.find(s => titleText && s.name && (s.name.includes(titleText) || titleText.includes(s.name))) || studies[0];
              if (match && typeof openSettingsDialog === 'function') {
                e.stopPropagation();
                e.preventDefault();
                openSettingsDialog(match.id, chart);
              }
            }
          }`;

if (indCode.includes(gearClickBlock)) {
  indCode = indCode.replace(gearClickBlock, '// Let TradingView natively open its own settings dialog on gear click');
  console.log('Removed gear click hijacking in pine_indicators.js');
}

// B. Remove chart.showPropertiesDialog hijacking in hookChartSettings
const showPropsHook = `    // 1. Hook chart.showPropertiesDialog
    if (typeof chart.showPropertiesDialog === 'function' && !chart._pineSettingsHooked) {
      chart._pineSettingsHooked = true;
      const origShowProps = chart.showPropertiesDialog.bind(chart);
      chart.showPropertiesDialog = function(sId) {
        if (typeof openSettingsDialog === 'function' && openSettingsDialog(sId, chart)) {
          return;
        }
        return origShowProps(sId);
      };
    }`;

if (indCode.includes(showPropsHook)) {
  indCode = indCode.replace(showPropsHook, '// Native chart.showPropertiesDialog preserved');
  console.log('Removed showPropertiesDialog hook in pine_indicators.js');
}

// C. Remove cw.showChartPropertiesForSource hook in hookChartSettings
const showSourceHook = `    // 2. Hook chart._chartWidget.showChartPropertiesForSource
    const cw = chart._chartWidget;
    if (cw && typeof cw.showChartPropertiesForSource === 'function' && !cw._pineSettingsHooked) {
      cw._pineSettingsHooked = true;
      const origShowForSource = cw.showChartPropertiesForSource.bind(cw);
      cw.showChartPropertiesForSource = function(source, tabName, options, undoCheckpoint) {
        const isMain = typeof source?.isMainSeries === 'function' ? source.isMainSeries() : false;
        const sId = typeof source?.id === 'function' ? source.id() : (source?._id || source?.id);
        if (!isMain && sId && typeof openSettingsDialog === 'function') {
          if (openSettingsDialog(sId, chart)) {
            return Promise.resolve(null);
          }
        }
        return origShowForSource(source, tabName, options, undoCheckpoint);
      };
    }`;

if (indCode.includes(showSourceHook)) {
  indCode = indCode.replace(showSourceHook, '// Native cw.showChartPropertiesForSource preserved');
  console.log('Removed showChartPropertiesForSource hook in pine_indicators.js');
}

// D. Replace openSettingsDialog implementation so it NEVER creates #tv_settings_modal_overlay and simply delegates to native dialog
const openSettingsIdx = indCode.indexOf('function openSettingsDialog(studyId, chartInstance) {');
if (openSettingsIdx !== -1) {
  // Find where openSettingsDialog ends (before exports / public API)
  const exportIdx = indCode.indexOf('const PineIndicators = {', openSettingsIdx);
  if (exportIdx !== -1) {
    const cleanOpenSettings = `function openSettingsDialog(studyId, chartInstance) {
    // Remove any legacy overlay element from DOM
    const existing = document.getElementById('tv_settings_modal_overlay');
    if (existing) existing.remove();

    const chart = chartInstance || (root.widget && typeof root.widget.activeChart === 'function' ? root.widget.activeChart() : null);
    if (!chart || !studyId) return false;

    let actualStudyId = studyId;
    if (typeof studyId === 'object') {
      actualStudyId = typeof studyId.id === 'function' ? studyId.id() : (studyId._id || studyId.id || studyId.name);
    }

    try {
      if (typeof chart.showPropertiesDialog === 'function') {
        chart.showPropertiesDialog(actualStudyId);
        return true;
      }
    } catch (e) {
      console.warn('[PineIndicators] Error delegating to chart.showPropertiesDialog:', e);
    }
    return false;
  }

  `;
    indCode = indCode.slice(0, openSettingsIdx) + cleanOpenSettings + indCode.slice(exportIdx);
    console.log('Replaced openSettingsDialog with clean native delegation in pine_indicators.js');
  }
}

fs.writeFileSync(indPath, indCode, 'utf8');
console.log('pine_indicators.js updated.');

// 3. PATCH chart_app.js
console.log('--- Patching chart_app.js ---');
const appPath = 'e:/TRADINGVIEW ADVANCED/chart_app.js';
let appCode = fs.readFileSync(appPath, 'utf8');

// Remove showPropertiesDialog hook in chart_app.js
const appHookTarget = `          // Hook chart.showPropertiesDialog to route to authentic Settings dialog
          try {
            const activeCh = widget.activeChart();
            if (activeCh && typeof activeCh.showPropertiesDialog === 'function' && !activeCh._settingsHooked) {
              activeCh._settingsHooked = true;
              const origShowProps = activeCh.showPropertiesDialog.bind(activeCh);
              activeCh.showPropertiesDialog = function(sId) {
                if (window.PineIndicators && typeof window.PineIndicators.openSettingsDialog === 'function') {
                  if (window.PineIndicators.openSettingsDialog(sId, activeCh)) {
                    return;
                  }
                }
                return origShowProps(sId);
              };
            }
          } catch (e) {}`;

if (appCode.includes(appHookTarget)) {
  appCode = appCode.replace(appHookTarget, '// Native chart properties dialog preserved');
  console.log('Removed showPropertiesDialog hook in chart_app.js');
}

// Remove window.PineIndicators.openSettingsDialog in gesture handler
const gestureTarget = `                          if (window.PineIndicators && typeof window.PineIndicators.openSettingsDialog === 'function') {
                            if (window.PineIndicators.openSettingsDialog(srcId, activeChart)) {
                              targetStudyOpened = true;
                              break;
                            }
                          }`;

if (appCode.includes(gestureTarget)) {
  appCode = appCode.replace(gestureTarget, '// Open native properties dialog');
  console.log('Cleaned gesture handler in chart_app.js');
}

fs.writeFileSync(appPath, appCode, 'utf8');
console.log('chart_app.js updated.');
console.log('All patches applied cleanly!');
