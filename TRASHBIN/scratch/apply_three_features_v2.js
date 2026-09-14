const fs = require('fs');

console.log('--- Applying 3 Requested Features (v2) ---');
const idePath = 'e:/TRADINGVIEW ADVANCED/pine_editor_ide.js';
let code = fs.readFileSync(idePath, 'utf8');

// 1. Mount Alerts Modal & Panel inside openCreateAlertDialog and toggleAlertsPanel
if (!code.includes('mountAlertsPanelAndModal();\n    const modalBackdrop = document.getElementById(\'tv_alert_create_backdrop\');')) {
  code = code.replace(
    `function openCreateAlertDialog(prefillPrice, prefillSource) {\n    const modalBackdrop = document.getElementById('tv_alert_create_backdrop');`,
    `function openCreateAlertDialog(prefillPrice, prefillSource) {\n    mountAlertsPanelAndModal();\n    const modalBackdrop = document.getElementById('tv_alert_create_backdrop');`
  );
}

if (!code.includes('mountAlertsPanelAndModal();\n    const panel = document.getElementById(\'tv_alerts_panel\');')) {
  code = code.replace(
    `function toggleAlertsPanel(forceOpen) {\n    const panel = document.getElementById('tv_alerts_panel');`,
    `function toggleAlertsPanel(forceOpen) {\n    mountAlertsPanelAndModal();\n    const panel = document.getElementById('tv_alerts_panel');`
  );
}

// 2. Add Built-in Pine Script generator helper, openScriptForStudy, and showReadOnlyCopyPrompt
const builtinHelper = `
  function getBuiltinScriptCode(name) {
    const cleanName = name || 'Indicator';
    if (cleanName.includes('Moving Average') || cleanName === 'SMA') {
      return \`//@version=5\\nindicator(title="Moving Average", shorttitle="MA", overlay=true)\\nlen = input.int(9, minval=1, title="Length")\\nsrc = input.source(close, title="Source")\\nout = ta.sma(src, len)\\nplot(out, color=color.blue, title="MA")\\n\`;
    }
    if (cleanName.includes('Exponential') || cleanName === 'EMA') {
      return \`//@version=5\\nindicator(title="Moving Average Exponential", shorttitle="EMA", overlay=true)\\nlen = input.int(9, minval=1, title="Length")\\nsrc = input.source(close, title="Source")\\nout = ta.ema(src, len)\\nplot(out, color=color.blue, title="EMA")\\n\`;
    }
    if (cleanName.includes('RSI') || cleanName.includes('Relative Strength Index')) {
      return \`//@version=5\\nindicator(title="Relative Strength Index", shorttitle="RSI", format=format.price, precision=2)\\nlen = input.int(14, minval=1, title="Length")\\nsrc = input.source(close, title="Source")\\nup = ta.rma(math.max(ta.change(src), 0), len)\\ndown = ta.rma(-math.min(ta.change(src), 0), len)\\nrsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))\\nplot(rsi, "RSI", color=#7E57C2)\\nh1 = hline(70, "Upper Band", color=#787B86)\\nh2 = hline(30, "Lower Band", color=#787B86)\\nfill(h1, h2, color=color.rgb(126, 87, 194, 90), title="Background")\\n\`;
    }
    if (cleanName.includes('MACD')) {
      return \`//@version=5\\nindicator(title="Moving Average Convergence Divergence", shorttitle="MACD")\\nfast_length = input.int(title="Fast Length", defval=12)\\nslow_length = input.int(title="Slow Length", defval=26)\\nsignal_length = input.int(title="Signal Length", defval=9)\\nfast_ma = ta.ema(close, fast_length)\\nslow_ma = ta.ema(close, slow_length)\\nmacd = fast_ma - slow_ma\\nsignal = ta.ema(macd, signal_length)\\nhist = macd - signal\\nplot(hist, title="Histogram", style=plot.style_columns, color=(hist>=0 ? (hist[1] < hist ? #26A69A : #B2DFDB) : (hist[1] < hist ? #FFCDD2 : #FF5252)))\\nplot(macd, title="MACD", color=#2962FF)\\nplot(signal, title="Signal", color=#FF6D00)\\n\`;
    }
    if (cleanName.includes('Bollinger') || cleanName.includes('BB')) {
      return \`//@version=5\\nindicator(shorttitle="BB", title="Bollinger Bands", overlay=true)\\nlength = input.int(20, minval=1)\\nsrc = input.source(close, title="Source")\\nmult = input.float(2.0, minval=0.001, maxval=50, title="StdDev")\\nbasis = ta.sma(src, length)\\ndev = mult * ta.stdev(src, length)\\nupper = basis + dev\\nlower = basis - dev\\nplot(basis, "Basis", color=#FF6D00)\\np1 = plot(upper, "Upper", color=#2962FF)\\np2 = plot(lower, "Lower", color=#2962FF)\\nfill(p1, p2, title="Background", color=color.rgb(33, 150, 243, 95))\\n\`;
    }
    return \`//@version=5\\nindicator("\${cleanName}", overlay=true)\\nplot(close, "\${cleanName}", color=color.blue)\\n\`;
  }

  function openScriptForStudy(studyTitle) {
    if (!studyTitle) return;
    const cleanTitle = studyTitle.trim();
    const userScripts = getUserSavedScripts();
    const userMatch = userScripts.find(s => s.name === cleanTitle || cleanTitle.includes(s.name) || s.name.includes(cleanTitle));
    if (userMatch) {
      loadScript(userMatch.name, userMatch.code, userMatch.id, false);
      setDockOpen(true);
      return;
    }
    // Built-in script -> read-only
    const bCode = getBuiltinScriptCode(cleanTitle);
    loadScript(cleanTitle, bCode, 'builtin_' + cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_'), true);
    setDockOpen(true);
  }

  function showReadOnlyCopyPrompt() {
    showTVConfirmDialog({
      title: "Create a copy to edit",
      message: "This script is read-only. You should create a copy to edit it. Would you like to create a working copy now?",
      confirmText: "Create a copy",
      cancelText: "Cancel",
      isDanger: false,
      onConfirm: () => {
        makeCopyOfCurrentScript();
      }
    });
  }
`;

if (!code.includes('function getBuiltinScriptCode')) {
  code = code.replace('function loadScript(name, code, id) {', builtinHelper + '\n  function loadScript(name, code, id, isReadOnly) {');
}

// 3. Update makeCopyOfCurrentScript to assign newId and add to getUserSavedScripts
const oldMakeCopy = `  function makeCopyOfCurrentScript() {
    const code = document.getElementById('pine_code_input')?.value || _currentScript.code;
    const baseName = _currentScript.name.replace(/\\s*\\((Copy|\\d+)\\)$/, '');
    const copyName = \`\${baseName} (Copy)\`;
    _currentScript = {
      id: 'copy_' + Date.now(),
      name: copyName,
      code: code,
      isDirty: false,
      isReadOnly: false,
      activeStudyId: null
    };`;

const newMakeCopy = `  function makeCopyOfCurrentScript() {
    const code = document.getElementById('pine_code_input')?.value || _currentScript.code;
    const baseName = _currentScript.name.replace(/\\s*\\((Copy|\\d+)\\)$/, '');
    const copyName = \`\${baseName} (Copy)\`;
    const newId = 'user_script_' + Date.now();
    _currentScript = {
      id: newId,
      name: copyName,
      code: code,
      isDirty: false,
      isReadOnly: false,
      activeStudyId: null
    };`;

if (code.includes(oldMakeCopy)) {
  code = code.replace(oldMakeCopy, newMakeCopy);
}

if (!code.includes('const allScripts = getUserSavedScripts();\n    allScripts.unshift({')) {
  code = code.replace(
    `saveCurrentToStorage();\n  }`,
    `saveCurrentToStorage();\n\n    const allScripts = getUserSavedScripts();\n    allScripts.unshift({\n      id: _currentScript.id,\n      name: _currentScript.name,\n      code: _currentScript.code,\n      isFavorite: false,\n      createdAt: Date.now()\n    });\n    saveUserSavedScripts(allScripts);\n  }`
  );
}

// 4. Update loadScript implementation
const oldLoadScriptImpl = `  function loadScript(name, code, id) {
    const scriptId = id || 'custom_script';
    const savedActiveId = localStorage.getItem('tv_pine_active_study_' + scriptId);
    _currentScript = {
      id: scriptId,
      name: name,
      code: code,
      isDirty: false,
      activeStudyId: savedActiveId || null
    };`;

const newLoadScriptImpl = `  function loadScript(name, code, id, isReadOnly) {
    const scriptId = id || 'custom_script';
    const savedActiveId = localStorage.getItem('tv_pine_active_study_' + scriptId);
    const isBuiltinOrReadonly = (isReadOnly !== undefined) ? isReadOnly : (
      Boolean((scriptId && String(scriptId).startsWith('builtin_')) || BUILTIN_TECHNICALS.includes(name) || !getUserSavedScripts().some(s => s.id === scriptId || s.name === name))
    );
    _currentScript = {
      id: scriptId,
      name: name,
      code: code,
      isDirty: false,
      isReadOnly: isBuiltinOrReadonly,
      activeStudyId: savedActiveId || null
    };

    const banner = document.getElementById('pine_readonly_banner');
    if (banner) {
      banner.style.display = isBuiltinOrReadonly ? 'flex' : 'none';
    }

    const saveScriptBtn = document.getElementById('pine_menu_save_script');
    if (saveScriptBtn) {
      if (isBuiltinOrReadonly) saveScriptBtn.classList.add('disabled');
      else saveScriptBtn.classList.remove('disabled');
    }

    const renameBtn = document.getElementById('pine_menu_rename');
    if (renameBtn) {
      if (isBuiltinOrReadonly) renameBtn.classList.add('disabled');
      else renameBtn.classList.remove('disabled');
    }`;

if (code.includes(oldLoadScriptImpl)) {
  code = code.replace(oldLoadScriptImpl, newLoadScriptImpl);
}

// 5. Update codeInput keydown, beforeinput, paste to enforce read-only copy condition
const oldKeydownStart = `    codeInput.addEventListener('keydown', (e) => {`;
const newKeydownStart = `    codeInput.addEventListener('beforeinput', (e) => {
      if (_currentScript.isReadOnly) {
        e.preventDefault();
        showReadOnlyCopyPrompt();
      }
    });

    codeInput.addEventListener('paste', (e) => {
      if (_currentScript.isReadOnly) {
        e.preventDefault();
        showReadOnlyCopyPrompt();
      }
    });

    codeInput.addEventListener('keydown', (e) => {
      if (_currentScript.isReadOnly) {
        const isNav = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Escape'].includes(e.key);
        const isCopy = (e.ctrlKey || e.metaKey) && ['c', 'a'].includes(e.key.toLowerCase());
        if (!isNav && !isCopy) {
          e.preventDefault();
          showReadOnlyCopyPrompt();
          return;
        }
      }`;

if (!code.includes('codeInput.addEventListener(\'beforeinput\'') && code.includes(oldKeydownStart)) {
  code = code.replace(oldKeydownStart, newKeydownStart);
}

// 6. Update saveBtn action to prompt for copy if read-only
const oldSaveBtn = `    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {`;
const newSaveBtn = `    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (_currentScript.isReadOnly) {
          showReadOnlyCopyPrompt();
          return;
        }`;

if (!code.includes('if (_currentScript.isReadOnly) {\n          showReadOnlyCopyPrompt();') && code.includes(oldSaveBtn)) {
  code = code.replace(oldSaveBtn, newSaveBtn);
}

// 7. Update Indicators Modal action buttons: clean { } button for BOTH custom and built-in
const oldRowHtml = `<button type="button" class="tv-indicator-action-btn open-editor-btn" title="Open in Pine Editor">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            { }
          </button>`;
const newRowHtml = `<button type="button" class="tv-indicator-action-btn open-editor-btn" title="Open script in Pine Editor">
            <span style="font-family: monospace; font-weight: 700; font-size: 13px;">{ }</span>
          </button>`;

if (code.includes(oldRowHtml)) {
  code = code.replace(oldRowHtml, newRowHtml);
}

// Update open-editor-btn click in renderIndicatorsModal
const oldEditorClick = `      row.querySelector('.open-editor-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.isBuiltIn) {
          loadScript(item.name, \`//@version=5\\nindicator("\${item.name}", overlay=true)\\nplot(close)\\n\`, 'editor_' + Date.now());
        } else {
          loadScript(item.name, item.code, item.id);
        }
        setDockOpen(true);
        closeIndicatorsModal();
      });`;

const newEditorClick = `      row.querySelector('.open-editor-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        openScriptForStudy(item.name);
        closeIndicatorsModal();
      });`;

if (code.includes(oldEditorClick)) {
  code = code.replace(oldEditorClick, newEditorClick);
}

// 8. Inject syncLegendCodeButtons function to inject { } button into study items in chart iframe legend
const syncLegendCode = `
  function syncLegendCodeButtons() {
    try {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const innerDoc = iframe?.contentDocument || (_widget && typeof _widget._innerWindow === 'function' && _widget._innerWindow()?.document);
      if (!innerDoc) return;

      const studyItems = innerDoc.querySelectorAll('[class*="item-"]:not([class*="series-"]), [data-name="legend-study-item"], [data-name="legend-source-item"]:not([class*="series-"])');
      studyItems.forEach(item => {
        const actions = item.querySelector('[class*="actions-"], .actions-l31H9iuA');
        if (!actions) return;
        if (actions.querySelector('.tv-legend-code-btn')) return;

        const codeBtn = innerDoc.createElement('button');
        codeBtn.type = 'button';
        codeBtn.className = 'action-l31H9iuA tv-legend-code-btn';
        codeBtn.setAttribute('data-name', 'legend-source-code-action');
        codeBtn.setAttribute('title', 'Source code');
        codeBtn.setAttribute('aria-label', 'Source code');
        codeBtn.innerHTML = '<span style="font-family: monospace; font-weight: 700; font-size: 11px; white-space: nowrap;">{ }</span>';

        const gear = actions.querySelector('[data-name="legend-settings-action"]');
        if (gear && gear.nextSibling) {
          actions.insertBefore(codeBtn, gear.nextSibling);
        } else {
          actions.appendChild(codeBtn);
        }

        codeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const titleEl = item.querySelector('[class*="title-"], [data-name="legend-source-title"]');
          const titleText = titleEl ? titleEl.textContent.trim() : '';
          openScriptForStudy(titleText);
        });
      });
    } catch(e) {}
  }
`;

if (!code.includes('function syncLegendCodeButtons')) {
  code = code.replace('function hookChartIframeIndicatorButtons', syncLegendCode + '\n  function hookChartIframeIndicatorButtons');
}

// 9. Call syncLegendCodeButtons in hookChartIframeIndicatorButtons and periodically
if (!code.includes('setInterval(syncLegendCodeButtons, 1500)')) {
  code = code.replace('innerDoc._tvIndicatorsModalHooked = true;',
    `innerDoc._tvIndicatorsModalHooked = true;
    syncLegendCodeButtons();
    setInterval(syncLegendCodeButtons, 1500);`
  );
}

// 10. Add Alert button click hook in hookChartIframeIndicatorButtons
const alertHookCode = `
        const alertBtn = e.target.closest('[data-name="alerts"], [data-name="alert"], [data-name="create-alert"], button[aria-label*="Alert"], button[title*="Alert"], #header-toolbar-alerts');
        if (alertBtn) {
          e.preventDefault();
          e.stopPropagation();
          openCreateAlertDialog();
          return;
        }
`;

if (!code.includes('[data-name="alerts"], [data-name="alert"]')) {
  code = code.replace('const indBtn = e.target.closest(', alertHookCode + '\n        const indBtn = e.target.closest(');
}

// 11. Export openScriptForStudy
if (!code.includes('openScriptForStudy,')) {
  code = code.replace('openIndicatorsModal,', 'openIndicatorsModal,\n    openScriptForStudy,');
  code = code.replace('root.openIndicatorsModal = openIndicatorsModal;', 'root.openIndicatorsModal = openIndicatorsModal;\n  root.openScriptForStudy = openScriptForStudy;');
}

// 12. Ensure mountAlertsPanelAndModal is called when DOM is ready
const oldDomInit = `  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => mountIndicatorsModal());
    } else {
      mountIndicatorsModal();
    }
  }`;

const newDomInit = `  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        mountIndicatorsModal();
        mountAlertsPanelAndModal();
      });
    } else {
      mountIndicatorsModal();
      mountAlertsPanelAndModal();
    }
  }`;

if (code.includes(oldDomInit)) {
  code = code.replace(oldDomInit, newDomInit);
}

fs.writeFileSync(idePath, code, 'utf8');
console.log('pine_editor_ide.js updated with all 3 features successfully (v2)!');

// Also patch chart_app.js to hook Alerts button
const chartAppPath = 'e:/TRADINGVIEW ADVANCED/chart_app.js';
let appCode = fs.readFileSync(chartAppPath, 'utf8');
const appAlertHook = `
                  const alertBtn = e.target.closest('[data-name="alerts"], [data-name="alert"], [data-name="create-alert"], button[aria-label*="Alert"], button[title*="Alert"], #header-toolbar-alerts');
                  if (alertBtn) {
                    e.preventDefault();
                    e.stopPropagation();
                    if (window.PineEditorIDE && typeof window.PineEditorIDE.openCreateAlert === 'function') {
                      window.PineEditorIDE.openCreateAlert();
                    }
                    return;
                  }
`;

if (!appCode.includes('[data-name="alerts"], [data-name="alert"]')) {
  appCode = appCode.replace('const btn = e.target.closest(\'#header-toolbar-indicators,', appAlertHook + '\n                  const btn = e.target.closest(\'#header-toolbar-indicators,');
  fs.writeFileSync(chartAppPath, appCode, 'utf8');
  console.log('chart_app.js updated with Alerts button click handler');
}
