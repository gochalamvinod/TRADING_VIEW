const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', '..', '..', '..', '..', '..', 'e:', 'TRADINGVIEW ADVANCED', 'pine_editor_ide.js');
const filePath = fs.existsSync('pine_editor_ide.js') ? 'pine_editor_ide.js' : targetPath;

console.log('Reading from:', filePath);
let code = fs.readFileSync(filePath, 'utf8');

// 1. Replace TEMPLATES
const startIdx = code.indexOf('  const TEMPLATES = [');
const endIdx = code.indexOf('  const CURRENT_SCRIPT_KEY = "tv_pine_current_script";');
if (startIdx !== -1 && endIdx !== -1) {
  code = code.slice(0, startIdx) + '  const TEMPLATES = [];\n\n' + code.slice(endIdx);
  console.log('TEMPLATES cleared successfully.');
} else {
  console.log('Failed to find TEMPLATES bounds:', startIdx, endIdx);
}

// 2. Update _currentScript
code = code.replace(
  /let _currentScript = \{[\s\S]*?activeStudyId: null\s*\};/,
  `let _currentScript = {
    id: "untitled_script",
    name: "Untitled Script",
    code: "//@version=5\\nindicator(\\"My Script\\", overlay=true)\\nplot(close)\\n",
    isDirty: false,
    activeStudyId: null
  };`
);
console.log('_currentScript replaced.');

// 3. Update getUserSavedScripts
const oldGetUser = `  function getUserSavedScripts() {
    try {
      const raw = localStorage.getItem(USER_SAVED_SCRIPTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Filter out any legacy pre-seeded scripts that might be saved in localStorage
        if (Array.isArray(parsed)) {
          const clean = parsed.filter(s => s && s.id && !s.id.startsWith('user_script_') && s.id !== 'sessions_luxalgo' && s.id !== 'custom_symbol_candles');
          return clean;
        }
      }
    } catch (e) {}
    return [];
  }`;

const newGetUser = `  function getUserSavedScripts() {
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
code = code.replace(oldGetUser, newGetUser);
console.log('getUserSavedScripts replaced.');

// 4. Update renderIndicatorsModal categories
const oldCategories = `    } else if (_activeIndicatorsCategory === 'technicals') {
      itemsToRender = TEMPLATES.map(t => ({ id: t.id, name: t.name, code: t.code, isFavorite: false, isBuiltIn: true }));
    } else if (_activeIndicatorsCategory === 'editors_picks' || _activeIndicatorsCategory === 'top' || _activeIndicatorsCategory === 'trending') {
      itemsToRender = [
        { id: "sessions_luxalgo", name: "Sessions [LuxAlgo] by LuxAlgo", code: TEMPLATES[0].code, isFavorite: false },
        { id: "user_script_hh_ll", name: "Higher Highs and Lower Lows", code: DEFAULT_USER_SCRIPTS[0].code, isFavorite: false },
        { id: "user_script_trend_channel", name: "Trend Channel", code: DEFAULT_USER_SCRIPTS[5].code, isFavorite: false },
        { id: "user_script_time_cycle", name: "TIME CYCLE", code: DEFAULT_USER_SCRIPTS[4].code, isFavorite: false },
        { id: "user_script_multi_session", name: "Multi-Session Time Cycles", code: DEFAULT_USER_SCRIPTS[1].code, isFavorite: false }
      ];
    } else {`;

const newCategories = `    } else if (_activeIndicatorsCategory === 'technicals') {
      itemsToRender = [];
    } else if (_activeIndicatorsCategory === 'editors_picks' || _activeIndicatorsCategory === 'top' || _activeIndicatorsCategory === 'trending') {
      itemsToRender = [];
    } else {`;
code = code.replace(oldCategories, newCategories);
console.log('renderIndicatorsModal categories replaced.');

// 5. Ensure mountAlertsPanelAndModal is called in mountPineEditorIDE
if (!code.includes('mountAlertsPanelAndModal();')) {
  code = code.replace('attachBottomDockTabs(_widget);', 'attachBottomDockTabs(_widget);\n    mountAlertsPanelAndModal();');
  console.log('mountAlertsPanelAndModal added to mountPineEditorIDE.');
}

// 6. Ensure toggleAlertsPanel mounts if not present
code = code.replace(
  `function toggleAlertsPanel(forceOpen) {\n    const panel = document.getElementById('tv_alerts_panel');`,
  `function toggleAlertsPanel(forceOpen) {\n    if (!document.getElementById('tv_alerts_panel')) mountAlertsPanelAndModal();\n    const panel = document.getElementById('tv_alerts_panel');`
);
console.log('toggleAlertsPanel guarded.');

// 7. Sanitize localStorage in mountPineEditorIDE
const sanitizeBlock = `    try {
      const savedCur = localStorage.getItem(CURRENT_SCRIPT_KEY);
      if (savedCur && (savedCur.includes('LuxAlgo') || savedCur.includes('Sessions') || savedCur.includes('vinod'))) {
        localStorage.removeItem(CURRENT_SCRIPT_KEY);
      }
      const savedUser = localStorage.getItem(USER_SAVED_SCRIPTS_KEY);
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (Array.isArray(parsed)) {
          const cleaned = parsed.filter(s => {
            const n = String(s?.name || '').toLowerCase();
            return !n.includes('luxalgo') && !n.includes('vinod') && !n.includes('sessions') && !n.includes('time cycle') && !n.includes('higher highs') && !n.includes('pivot') && !n.includes('trend channel') && !n.includes('previous tick');
          });
          localStorage.setItem(USER_SAVED_SCRIPTS_KEY, JSON.stringify(cleaned));
        }
      }
      localStorage.setItem(RECENTLY_USED_KEY, JSON.stringify([]));
    } catch (e) {}`;

if (!code.includes('savedCur.includes(\'LuxAlgo\')')) {
  code = code.replace('// Load saved script if exists', sanitizeBlock + '\n\n    // Load saved script if exists');
  console.log('LocalStorage sanitation added.');
}

fs.writeFileSync(filePath, code);
console.log('pine_editor_ide.js successfully written.');
