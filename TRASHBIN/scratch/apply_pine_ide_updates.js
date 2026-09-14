const fs = require('fs');
const path = require('path');

const filePath = 'e:\\\\TRADINGVIEW ADVANCED\\\\pine_editor_ide.js';
let code = fs.readFileSync(filePath, 'utf8');

// The 107 authentic built-in indicators supported by TradingView Charting Library
const BUILTIN_TECHNICALS = [
  "52 Week High/Low",
  "Accelerator Oscillator",
  "Accumulation/Distribution",
  "Accumulative Swing Index",
  "Advance/Decline",
  "Arnaud Legoux Moving Average",
  "Aroon",
  "Average Directional Index",
  "Average Price",
  "Average True Range",
  "Awesome Oscillator",
  "Balance of Power",
  "Bollinger Bands",
  "Bollinger Bands %B",
  "Bollinger Bands Width",
  "Chaikin Money Flow",
  "Chaikin Oscillator",
  "Chaikin Volatility",
  "Chande Kroll Stop",
  "Chande Momentum Oscillator",
  "Chop Zone",
  "Choppiness Index",
  "Commodity Channel Index",
  "Connors RSI",
  "Coppock Curve",
  "Correlation - Log",
  "Correlation Coefficient",
  "Detrended Price Oscillator",
  "Directional Movement",
  "Donchian Channels",
  "Double EMA",
  "Ease Of Movement",
  "Elder's Force Index",
  "EMA Cross",
  "Envelopes",
  "Fisher Transform",
  "Guppy Multiple Moving Average",
  "Historical Volatility",
  "Hull Moving Average",
  "Ichimoku Cloud",
  "Keltner Channels",
  "Klinger Oscillator",
  "Know Sure Thing",
  "Least Squares Moving Average",
  "Linear Regression Curve",
  "Linear Regression Slope",
  "MA Cross",
  "MA with EMA Cross",
  "MACD",
  "Majority Rule",
  "Mass Index",
  "McGinley Dynamic",
  "Median Price",
  "Momentum",
  "Money Flow Index",
  "Moving Average",
  "Moving Average Adaptive",
  "Moving Average Channel",
  "Moving Average Double",
  "Moving Average Exponential",
  "Moving Average Hamming",
  "Moving Average Multiple",
  "Moving Average Triple",
  "Moving Average Weighted",
  "Net Volume",
  "On Balance Volume",
  "Parabolic SAR",
  "Pivot Points Standard",
  "Price Channel",
  "Price Oscillator",
  "Price Volume Trend",
  "Rank Correlation Index",
  "Rate Of Change",
  "Ratio",
  "Relative Strength Index",
  "Relative Vigor Index",
  "Relative Volatility Index",
  "SMI Ergodic Indicator/Oscillator",
  "Smoothed Moving Average",
  "Spread",
  "Standard Deviation",
  "Standard Error",
  "Standard Error Bands",
  "Stochastic",
  "Stochastic RSI",
  "SuperTrend",
  "Trend Strength Index",
  "Triple EMA",
  "TRIX",
  "True Strength Index",
  "Typical Price",
  "Ultimate Oscillator",
  "Volatility Close-to-Close",
  "Volatility Index",
  "Volatility O-H-L-C",
  "Volatility Zero Trend Close-to-Close",
  "Volume",
  "Volume Oscillator",
  "Volume Profile Fixed Range",
  "Volume Profile Visible Range",
  "Vortex Indicator",
  "VWAP",
  "VWMA",
  "Williams %R",
  "Williams Alligator",
  "Williams Fractal",
  "Zig Zag"
];

console.log('Original code length:', code.length);

// 1. Ensure BUILTIN_TECHNICALS is defined in the script
const builtinDef = `  const BUILTIN_TECHNICALS = ${JSON.stringify(BUILTIN_TECHNICALS, null, 2)};\n`;

// Insert BUILTIN_TECHNICALS after FAVORITE_BUILTINS_KEY definition
if (!code.includes('const BUILTIN_TECHNICALS =')) {
  code = code.replace(
    'const FAVORITE_BUILTINS_KEY = "tv_favorite_builtins";',
    'const FAVORITE_BUILTINS_KEY = "tv_favorite_builtins";\n' + builtinDef
  );
  console.log('1. Added BUILTIN_TECHNICALS array.');
}

// 2. Clean mountPineEditorIDE legacy cleanup: don't delete legitimate user scripts
const oldMountCleanup = `          const cleaned = parsed.filter(s => {
            const n = String(s?.name || '').toLowerCase();
            return !n.includes('luxalgo') && !n.includes('vinod') && !n.includes('sessions') && !n.includes('time cycle') && !n.includes('higher highs') && !n.includes('pivot') && !n.includes('trend channel') && !n.includes('previous tick');
          });`;

const newMountCleanup = `          const cleaned = parsed.filter(s => {
            const n = String(s?.name || '').toLowerCase();
            return !n.includes('vinod') && n !== 'sessions [luxalgo]';
          });`;

if (code.includes(oldMountCleanup)) {
  code = code.replace(oldMountCleanup, newMountCleanup);
  console.log('2. Fixed mount cleanup to preserve user scripts.');
}

// 3. Update makeCopyOfCurrentScript to save to user saved scripts immediately
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
    };
    const titleDisplay = document.getElementById('pine_script_title_display');
    if (titleDisplay) titleDisplay.textContent = copyName;
    const banner = document.getElementById('pine_readonly_banner');
    if (banner) banner.style.display = 'none';
    const codeInput = document.getElementById('pine_code_input');
    if (codeInput) {
      codeInput.readOnly = false;
      codeInput.focus();
    }
    document.getElementById('pine_menu_save_script')?.classList.remove('disabled');
    document.getElementById('pine_menu_rename')?.classList.remove('disabled');
    logConsoleV2(\`\${formatLogTime()} "\${copyName}" created and opened\`);
    pushRecentlyUsedScript(copyName);
    renderRecentlyUsedList();
    saveCurrentToStorage();
  }`;

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
    };
    const titleDisplay = document.getElementById('pine_script_title_display');
    if (titleDisplay) titleDisplay.textContent = copyName;
    const banner = document.getElementById('pine_readonly_banner');
    if (banner) banner.style.display = 'none';
    const codeInput = document.getElementById('pine_code_input');
    if (codeInput) {
      codeInput.readOnly = false;
      codeInput.focus();
    }
    document.getElementById('pine_menu_save_script')?.classList.remove('disabled');
    document.getElementById('pine_menu_rename')?.classList.remove('disabled');
    logConsoleV2(\`\${formatLogTime()} "\${copyName}" created and opened\`);
    pushRecentlyUsedScript(copyName);
    renderRecentlyUsedList();
    saveCurrentToStorage();

    // Immediately save into user saved scripts so it shows in My scripts
    const allScripts = getUserSavedScripts();
    allScripts.unshift({
      id: newId,
      name: copyName,
      code: code,
      isFavorite: false,
      createdAt: Date.now()
    });
    saveUserSavedScripts(allScripts);
  }`;

if (code.includes(oldMakeCopy)) {
  code = code.replace(oldMakeCopy, newMakeCopy);
  console.log('3. Updated makeCopyOfCurrentScript to save to User Saved Scripts.');
}

// 4. Update saveBtn in bindEvents to sync with User Saved Scripts
const oldSaveBtn = `    // Save Action
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        _currentScript.isDirty = false;
        if (dirtyInd) dirtyInd.style.display = 'none';
        saveCurrentToStorage();
        saveScriptRevision(_currentScript.id, _currentScript.name, _currentScript.code);
        logConsole(\`Script "\${_currentScript.name}" saved successfully.\`, "success");
        await runCompilation(false);
      });
    }`;

const newSaveBtn = `    // Save Action (Ctrl+S / Save Script)
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const currentCode = (codeInput ? codeInput.value : _currentScript.code) || '';
        _currentScript.code = currentCode;

        // Auto-detect title from indicator("Title") / strategy("Title") if Untitled
        if (!_currentScript.name || _currentScript.name === 'Untitled Script' || _currentScript.name === 'My Script') {
          const matchTitle = currentCode.match(/(?:indicator|strategy|library)\\s*\\(\\s*["']([^"']+)["']/);
          if (matchTitle && matchTitle[1]) {
            _currentScript.name = matchTitle[1].trim();
            const titleDisp = document.getElementById('pine_script_title_display');
            if (titleDisp) titleDisp.textContent = _currentScript.name;
          }
        }

        _currentScript.isDirty = false;
        if (dirtyInd) dirtyInd.style.display = 'none';
        saveCurrentToStorage();
        saveScriptRevision(_currentScript.id, _currentScript.name, currentCode);

        // Always save / update into User Saved Scripts so it appears in My scripts
        const allScripts = getUserSavedScripts();
        const existingIdx = allScripts.findIndex(s => s.id === _currentScript.id || s.name === _currentScript.name);
        if (existingIdx >= 0) {
          allScripts[existingIdx] = {
            ...allScripts[existingIdx],
            name: _currentScript.name,
            code: currentCode,
            updatedAt: Date.now()
          };
        } else {
          allScripts.unshift({
            id: _currentScript.id || ('user_script_' + Date.now()),
            name: _currentScript.name,
            code: currentCode,
            isFavorite: false,
            createdAt: Date.now()
          });
        }
        saveUserSavedScripts(allScripts);
        pushRecentlyUsedScript(_currentScript.name);

        logConsole(\`Script "\${_currentScript.name}" saved successfully.\`, "success");
        logConsoleV2(\`\${formatLogTime()} "\${_currentScript.name}" saved successfully\`);
        await runCompilation(false);
      });
    }`;

if (code.includes(oldSaveBtn)) {
  code = code.replace(oldSaveBtn, newSaveBtn);
  console.log('4. Updated saveBtn to sync with User Saved Scripts.');
}

// 5. Replace renderIndicatorsModal with full built-in, my scripts, and favorites support
const oldRenderIndicatorsRegex = /function renderIndicatorsModal\(\) \{[\s\S]*?list\.appendChild\(row\);\s*\}\);\s*\}/;

const newRenderIndicatorsCode = `function renderIndicatorsModal() {
    const list = document.getElementById('tv_indicators_list');
    if (!list) return;

    // Update sidebar active class
    document.querySelectorAll('.tv-indicators-nav-item').forEach(item => {
      if (item.dataset.category === _activeIndicatorsCategory) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    const q = (_indicatorsSearchQuery || '').toLowerCase().trim();
    const favBuiltinSet = new Set(getFavoriteBuiltins());
    let itemsToRender = [];

    if (_activeIndicatorsCategory === 'technicals') {
      itemsToRender = BUILTIN_TECHNICALS.map(name => ({
        id: 'builtin_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name: name,
        isBuiltIn: true,
        isFavorite: favBuiltinSet.has(name)
      }));
    } else if (_activeIndicatorsCategory === 'myscripts') {
      itemsToRender = getUserSavedScripts().map(s => ({ ...s, isBuiltIn: false }));
    } else if (_activeIndicatorsCategory === 'favorites') {
      const favUserScripts = getUserSavedScripts().filter(s => s.isFavorite).map(s => ({ ...s, isBuiltIn: false }));
      const favBuiltins = BUILTIN_TECHNICALS.filter(name => favBuiltinSet.has(name)).map(name => ({
        id: 'builtin_' + name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name: name,
        isBuiltIn: true,
        isFavorite: true
      }));
      itemsToRender = [...favUserScripts, ...favBuiltins];
    } else {
      itemsToRender = [];
    }

    if (q) {
      itemsToRender = itemsToRender.filter(item => (item.name || '').toLowerCase().includes(q));
    }

    if (itemsToRender.length === 0) {
      let emptyMsg = 'No indicators found.';
      if (q) {
        emptyMsg = \`No indicators found matching "\${escapeHtml(q)}".\`;
      } else if (_activeIndicatorsCategory === 'myscripts') {
        emptyMsg = 'You have no saved scripts yet. Create or save a script in Pine Editor to see it here.';
      } else if (_activeIndicatorsCategory === 'favorites') {
        emptyMsg = 'You have no favorite indicators yet. Click the star icon next to any indicator to favorite it.';
      }
      list.innerHTML = \`
        <div style="padding: 48px 16px; text-align: center; color: #787b86; font-size: 13px;">
          \${emptyMsg}
        </div>
      \`;
      return;
    }

    list.innerHTML = '';
    itemsToRender.forEach(item => {
      const row = document.createElement('div');
      row.className = 'tv-indicator-row';
      row.innerHTML = \`
        <div class="tv-indicator-left">
          <button type="button" class="tv-indicator-fav-btn \${item.isFavorite ? 'active' : ''}" title="\${item.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
            \${item.isFavorite ? '★' : '☆'}
          </button>
          <span class="tv-indicator-name">\${escapeHtml(item.name)}</span>
        </div>
        <div class="tv-indicator-actions">
          <button type="button" class="tv-indicator-action-btn add-chart-btn" title="Add to chart">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add to chart
          </button>
          <button type="button" class="tv-indicator-action-btn open-editor-btn" title="Open in Pine Editor">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            { }
          </button>
          \${(!item.isBuiltIn && _activeIndicatorsCategory === 'myscripts') ? \`
            <button type="button" class="tv-indicator-action-btn delete delete-script-btn" title="Delete script">
              🗑
            </button>
          \` : ''}
        </div>
      \`;

      // Favorite toggle
      row.querySelector('.tv-indicator-fav-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        item.isFavorite = !item.isFavorite;
        if (item.isBuiltIn) {
          let favs = getFavoriteBuiltins();
          if (item.isFavorite) {
            if (!favs.includes(item.name)) favs.push(item.name);
          } else {
            favs = favs.filter(n => n !== item.name);
          }
          saveFavoriteBuiltins(favs);
        } else {
          const allScripts = getUserSavedScripts();
          const target = allScripts.find(s => s.id === item.id || s.name === item.name);
          if (target) {
            target.isFavorite = item.isFavorite;
            saveUserSavedScripts(allScripts);
          }
        }
        renderIndicatorsModal();
      });

      // Add to chart action
      row.querySelector('.add-chart-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        closeIndicatorsModal();
        const ch = (_widget && typeof _widget.activeChart === 'function') ? _widget.activeChart() : (root.widget && typeof root.widget.activeChart === 'function' ? root.widget.activeChart() : null);
        if (item.isBuiltIn) {
          logConsole(\`Adding built-in "\${item.name}" to chart...\`, "info");
          if (ch) {
            try {
              await ch.createStudy(item.name, false, false);
            } catch (err) {
              console.error('Error adding built-in study:', err);
            }
          }
        } else {
          loadScript(item.name, item.code, item.id);
          logConsole(\`Adding "\${item.name}" to chart...\`, "info");
          if (_addStudyToChartFn) await _addStudyToChartFn(item.code);
        }
      });

      // Open in Pine Editor
      row.querySelector('.open-editor-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.isBuiltIn) {
          loadScript(item.name, \`//@version=5\\nindicator("\${item.name}", overlay=true)\\nplot(close)\\n\`, 'editor_' + Date.now());
        } else {
          loadScript(item.name, item.code, item.id);
        }
        setDockOpen(true);
        closeIndicatorsModal();
      });

      // Delete custom script
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
      });

      // Row click action
      row.addEventListener('click', async () => {
        closeIndicatorsModal();
        const ch = (_widget && typeof _widget.activeChart === 'function') ? _widget.activeChart() : (root.widget && typeof root.widget.activeChart === 'function' ? root.widget.activeChart() : null);
        if (item.isBuiltIn) {
          logConsole(\`Adding built-in "\${item.name}" to chart...\`, "info");
          if (ch) {
            try {
              await ch.createStudy(item.name, false, false);
            } catch (err) {
              console.error('Error adding built-in study:', err);
            }
          }
        } else {
          loadScript(item.name, item.code, item.id);
          setDockOpen(true);
        }
      });

      list.appendChild(row);
    });
  }`;

if (oldRenderIndicatorsRegex.test(code)) {
  code = code.replace(oldRenderIndicatorsRegex, newRenderIndicatorsCode);
  console.log('5. Updated renderIndicatorsModal.');
} else {
  console.error('Failed to match oldRenderIndicatorsRegex');
}

// 6. Clean mountIndicatorsModal sidebar HTML: STRICTLY Favorites, My scripts, Technicals
const oldModalBodyRegex = /<div class="tv-indicators-sidebar">[\s\S]*?<\/div>\s*<div class="tv-indicators-content">/;

const newModalBody = `<div class="tv-indicators-sidebar">
            <div class="tv-indicators-group-title">Personal</div>
            <div class="tv-indicators-nav-item" data-category="favorites">
              <span class="tv-indicators-nav-icon">★</span>
              <span>Favorites</span>
            </div>
            <div class="tv-indicators-nav-item" data-category="myscripts">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <span>My scripts</span>
            </div>

            <div class="tv-indicators-group-title">Built-in</div>
            <div class="tv-indicators-nav-item active" data-category="technicals">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </span>
              <span>Technicals</span>
            </div>
          </div>
          <div class="tv-indicators-content">`;

if (oldModalBodyRegex.test(code)) {
  code = code.replace(oldModalBodyRegex, newModalBody);
  console.log('6. Cleaned modal sidebar to strictly Favorites, My scripts, Technicals.');
} else {
  console.error('Failed to match oldModalBodyRegex');
}

fs.writeFileSync(filePath, code, 'utf8');
console.log('Updated pine_editor_ide.js successfully. New length:', code.length);
