const fs = require('fs');

let code = fs.readFileSync('pine_editor_ide.js', 'utf8');

// 1. Update getUserSavedScripts to not reject user_script_
const oldGetUser = `  function getUserSavedScripts() {
    try {
      const raw = localStorage.getItem(USER_SAVED_SCRIPTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(s => {
            if (!s || !s.name) return false;
            const id = String(s.id || '').toLowerCase();
            const n = String(s.name || '').toLowerCase();
            if (id.startsWith('user_script_') || id === 'sessions_luxalgo' || id === 'custom_symbol_candles') return false;
            if (n.includes('luxalgo') || n.includes('sessions') || n.includes('vinod') || n.includes('time cycle') || n.includes('higher highs') || n.includes('pivot') || n.includes('trend channel') || n.includes('previous tick')) return false;
            return true;
          });
          return clean;
        }
      }
    } catch (e) {}
    return [];
  }`;

const newGetUser = `  const FAVORITE_BUILTINS_KEY = "tv_favorite_builtins";
  function getFavoriteBuiltins() {
    try {
      const raw = localStorage.getItem(FAVORITE_BUILTINS_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return [];
  }
  function saveFavoriteBuiltins(list) {
    try {
      localStorage.setItem(FAVORITE_BUILTINS_KEY, JSON.stringify(list || []));
    } catch(e) {}
  }

  function getUserSavedScripts() {
    try {
      const raw = localStorage.getItem(USER_SAVED_SCRIPTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(s => {
            if (!s || !s.name) return false;
            const n = String(s.name || '').toLowerCase();
            if (n.includes('vinod') || n === 'sessions [luxalgo]') return false;
            return true;
          });
          return clean;
        }
      }
    } catch (e) {}
    return [];
  }`;

code = code.replace(oldGetUser, newGetUser);
console.log('1. getUserSavedScripts updated.');

// 2. Add BUILTIN_TECHNICALS array right above openIndicatorsModal
const builtinTechnicalsArray = `  /* =========================================================================
   * TradingView Built-In Technical Indicators
   * ========================================================================= */
  const BUILTIN_TECHNICALS = [
    "Accumulation/Distribution",
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
    "Rate Of Change",
    "Relative Strength Index",
    "Relative Vigor Index",
    "Relative Volatility Index",
    "SMI Ergodic Indicator/Oscillator",
    "Smoothed Moving Average",
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
    "Volume",
    "Volume Oscillator",
    "Vortex Indicator",
    "VWAP",
    "VWMA",
    "Williams %R",
    "Williams Alligator",
    "Williams Fractal",
    "Zig Zag"
  ];
`;

code = code.replace(
  '  /* =========================================================================\n   * "Indicators, Metrics, and Strategies" Dialog (Image 2)\n   * ========================================================================= */',
  builtinTechnicalsArray + '\n  /* =========================================================================\n   * "Indicators, Metrics, and Strategies" Dialog (Image 2)\n   * ========================================================================= */'
);
console.log('2. BUILTIN_TECHNICALS array added.');

// 3. Update renderIndicatorsModal logic to handle Built-ins, Favorites, My scripts
const oldRenderIndicators = `    if (_activeIndicatorsCategory === 'myscripts') {
      itemsToRender = getUserSavedScripts();
    } else if (_activeIndicatorsCategory === 'favorites') {
      itemsToRender = getUserSavedScripts().filter(s => s.isFavorite);
    } else if (_activeIndicatorsCategory === 'technicals') {
      itemsToRender = [];
    } else if (_activeIndicatorsCategory === 'editors_picks' || _activeIndicatorsCategory === 'top' || _activeIndicatorsCategory === 'trending') {
      itemsToRender = [];
    } else {
      itemsToRender = [];
    }`;

const newRenderIndicators = `    const favBuiltinSet = new Set(getFavoriteBuiltins());

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
    }`;

code = code.replace(oldRenderIndicators, newRenderIndicators);
console.log('3. renderIndicatorsModal categories updated.');

// 4. Update row actions in renderIndicatorsModal for built-in vs custom
const oldRowActions = `      // Favorite toggle
      row.querySelector('.tv-indicator-fav-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        item.isFavorite = !item.isFavorite;
        const allScripts = getUserSavedScripts();
        const target = allScripts.find(s => s.id === item.id || s.name === item.name);
        if (target) {
          target.isFavorite = item.isFavorite;
          saveUserSavedScripts(allScripts);
        }
        renderIndicatorsModal();
      });

      // Add to chart action
      row.querySelector('.add-chart-btn')?.addEventListener('click', async (e) => {
        e.stopPropagation();
        loadScript(item.name, item.code, item.id);
        closeIndicatorsModal();
        logConsole(\`Adding "\${item.name}" to chart...\`, "info");
        await _addStudyToChartFn(item.code);
      });

      // Open in Pine Editor
      row.querySelector('.open-editor-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        loadScript(item.name, item.code, item.id);
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

      // Row click loads into editor
      row.addEventListener('click', () => {
        loadScript(item.name, item.code, item.id);
        setDockOpen(true);
        closeIndicatorsModal();
      });`;

const newRowActions = `      // Favorite toggle
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
          // Create an indicator template for the built-in study in Pine Editor
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
      });`;

code = code.replace(oldRowActions, newRowActions);
console.log('4. Row actions updated.');

// 5. Clean up mountIndicatorsModal sidebar HTML: only Favorites, My scripts, Technicals
const oldSidebarHtml = `          <div class="tv-indicators-sidebar">
            <div class="tv-indicators-group-title">Personal</div>
            <div class="tv-indicators-nav-item" data-category="favorites">
              <span class="tv-indicators-nav-icon">★</span>
              <span>Favorites</span>
            </div>
            <div class="tv-indicators-nav-item active" data-category="myscripts">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <span>My scripts</span>
            </div>
            <div class="tv-indicators-nav-item" data-category="purchased">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="M7 15h10M7 9h2"/>
                </svg>
              </span>
              <span>Purchased</span>
            </div>

            <div class="tv-indicators-group-title">Built-in</div>
            <div class="tv-indicators-nav-item" data-category="technicals">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </span>
              <span>Technicals</span>
            </div>
            <div class="tv-indicators-nav-item" data-category="fundamentals">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4"/>
                </svg>
              </span>
              <span>Fundamentals</span>
            </div>

            <div class="tv-indicators-group-title">Community</div>
            <div class="tv-indicators-nav-item" data-category="editors_picks">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              </span>
              <span>Editors' picks</span>
            </div>
            <div class="tv-indicators-nav-item" data-category="top">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                  <polyline points="17 6 23 6 23 12"/>
                </svg>
              </span>
              <span>Top</span>
            </div>
            <div class="tv-indicators-nav-item" data-category="trending">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>
                </svg>
              </span>
              <span>Trending</span>
            </div>
            <div class="tv-indicators-nav-item" data-category="marketplace">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </span>
              <span>Marketplace</span>
            </div>
          </div>`;

const newSidebarHtml = `          <div class="tv-indicators-sidebar">
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
          </div>`;

code = code.replace(oldSidebarHtml, newSidebarHtml);
console.log('5. Modal sidebar cleaned to ONLY Favorites, My scripts, Technicals.');

// 6. Update initial category to technicals
code = code.replace("let _activeIndicatorsCategory = 'myscripts';", "let _activeIndicatorsCategory = 'technicals';");

// 7. Update saveBtn in Pine Editor to always save to user saved scripts
const oldSaveAction = `    // Save Action
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

const newSaveAction = `    // Save Action
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        _currentScript.isDirty = false;
        if (dirtyInd) dirtyInd.style.display = 'none';
        const currentCode = (codeInput ? codeInput.value : _currentScript.code) || '';
        _currentScript.code = currentCode;
        saveCurrentToStorage();
        saveScriptRevision(_currentScript.id, _currentScript.name, currentCode);

        // Always save / update into User Saved Scripts so it appears in My scripts
        const allScripts = getUserSavedScripts();
        const existingIdx = allScripts.findIndex(s => s.id === _currentScript.id || s.name === _currentScript.name);
        if (existingIdx >= 0) {
          allScripts[existingIdx] = { ..._currentScript, code: currentCode };
        } else {
          allScripts.unshift({
            id: _currentScript.id || ('user_script_' + Date.now()),
            name: _currentScript.name,
            code: currentCode,
            isFavorite: false
          });
        }
        saveUserSavedScripts(allScripts);

        logConsole(\`Script "\${_currentScript.name}" saved successfully.\`, "success");
        await runCompilation(false);
      });
    }`;

code = code.replace(oldSaveAction, newSaveAction);
console.log('7. saveBtn updated to sync with User Saved Scripts.');

fs.writeFileSync('pine_editor_ide.js', code, 'utf8');
console.log('All updates written to pine_editor_ide.js successfully.');
