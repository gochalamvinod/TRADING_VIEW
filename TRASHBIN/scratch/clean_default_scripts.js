const fs = require('fs');

const pineIdePath = 'e:\\TRADINGVIEW ADVANCED\\pine_editor_ide.js';
let c = fs.readFileSync(pineIdePath, 'utf8');

const startMarker = '  // Pre-seeded indicators matching Image 2 ("Indicators, metrics, and strategies" > My scripts)';
const endMarker = '  function pushRecentlyUsedScript(name) {';

const sIdx = c.indexOf(startMarker);
const eIdx = c.indexOf(endMarker);

if (sIdx === -1 || eIdx === -1) {
  console.error('Markers not found', { sIdx, eIdx });
  process.exit(1);
}

const replacement = `  // 100% clean user scripts - zero predefined/hardcoded template scripts
  const DEFAULT_USER_SCRIPTS = [];

  const FAVORITE_BUILTINS_KEY = "tv_favorite_builtins";
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
          return parsed.filter(s => {
            if (!s || !s.name) return false;
            const n = String(s.name || '').toLowerCase();
            return !n.includes('vinod') && n !== 'sessions [luxalgo]';
          });
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

  function getRecentlyUsedScripts() {
    try {
      const raw = localStorage.getItem(RECENTLY_USED_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          return list.filter(n => !n.toLowerCase().includes('vinod') && !n.includes('LuxAlgo') && !n.includes('TIME CYCLE'));
        }
      }
    } catch(e) {}
    return [];
  }

`;

c = c.substring(0, sIdx) + replacement + c.substring(eIdx);
fs.writeFileSync(pineIdePath, c, 'utf8');
console.log('Successfully eliminated pre-seeded template scripts from pine_editor_ide.js');
