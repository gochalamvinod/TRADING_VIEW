const fs = require('fs');

let code = fs.readFileSync('pine_editor_ide.js', 'utf8');

const insertBlock = `
  const CURRENT_SCRIPT_KEY = "tv_pine_current_script";
  const DOCK_WIDTH_KEY = "tv_pine_dock_width";
  const DOCK_HEIGHT_KEY = "tv_pine_dock_height";
  const DOCK_POSITION_KEY = "tv_pine_dock_position";
  const USER_SAVED_SCRIPTS_KEY = "tv_pine_user_scripts";
  const RECENTLY_USED_KEY = "tv_pine_recently_used";
  const ACTIVE_ALERTS_KEY = "tv_active_alerts";
  const ALERTS_HISTORY_KEY = "tv_alerts_history";

  // Zero pre-seeded or hardcoded indicators - 100% clean state
  const DEFAULT_USER_SCRIPTS = [];

  function getUserSavedScripts() {
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
  }

  function saveUserSavedScripts(scripts) {
    try {
      localStorage.setItem(USER_SAVED_SCRIPTS_KEY, JSON.stringify(scripts || []));
    } catch(e) {}
  }
`;

code = code.replace('  const TEMPLATES = [];', '  const TEMPLATES = [];\n' + insertBlock);
fs.writeFileSync('pine_editor_ide.js', code);
console.log('Constants successfully patched.');
