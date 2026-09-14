const fs = require('fs');
let code = fs.readFileSync('pine_editor_ide.js', 'utf8');
const isCrlf = code.includes('\r\n');
if (isCrlf) {
  code = code.replace(/\r\n/g, '\n');
}

const target = `  function loadScript(name, code, id, isReadOnly) {
    const scriptId = id || 'custom_script';
    const savedActiveId = localStorage.getItem('tv_pine_active_study_' + scriptId);
    _currentScript = {
      id: scriptId,
      name: name,
      code: code,
      isDirty: false,
      activeStudyId: savedActiveId || null
    };`;

const replacement = `  function loadScript(name, code, id, isReadOnly) {
    const scriptId = id || 'custom_script';
    const savedActiveId = localStorage.getItem('tv_pine_active_study_' + scriptId);
    const isBuiltinOrReadonly = (isReadOnly !== undefined) ? !!isReadOnly : (
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
    if (banner) banner.style.display = isBuiltinOrReadonly ? 'flex' : 'none';

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

if (!code.includes(target)) {
  console.error('Target not found even after normalizing CRLF!');
  process.exit(1);
}

code = code.replace(target, replacement);
if (isCrlf) {
  code = code.replace(/\n/g, '\r\n');
}
fs.writeFileSync('pine_editor_ide.js', code, 'utf8');
console.log('Successfully updated loadScript with isReadOnly handling!');
