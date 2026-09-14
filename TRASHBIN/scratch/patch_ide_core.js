const fs = require('fs');
const path = require('path');

const filePath = path.resolve('pine_editor_ide.js');
let code = fs.readFileSync(filePath, 'utf8');

const target = `  function showReadOnlyCopyPrompt() {
    showTVConfirmDialog({
      title: "Create a copy to edit",
      message: "This script is read-only. You should create a copy to edit it. Would you like to create a working copy now?",
      confirmText: "Create a copy",
      cancelText: "Cancel",
      isDanger: false,
      onConfirm: () => {
  function bindEvents() {`;

const replacement = `  function showReadOnlyCopyPrompt() {
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

  function loadScript(name, code, id, isReadOnly) {
    const scriptId = id || 'custom_script';
    const savedActiveId = localStorage.getItem('tv_pine_active_study_' + scriptId);
    _currentScript = {
      id: scriptId,
      name: name,
      code: code,
      isDirty: false,
      isReadOnly: !!isReadOnly,
      activeStudyId: savedActiveId || null
    };

    const display = document.getElementById('pine_script_title_display');
    if (display) display.textContent = name;

    const codeInput = document.getElementById('pine_code_input');
    if (codeInput) {
      codeInput.value = code;
      updateGutter();
    }

    const dirtyEl = document.getElementById('pine_dirty_indicator');
    if (dirtyEl) dirtyEl.style.display = 'none';

    const banner = document.getElementById('pine_readonly_banner');
    if (banner) banner.style.display = isReadOnly ? 'flex' : 'none';

    const saveScriptBtn = document.getElementById('pine_menu_save_script');
    if (saveScriptBtn) {
      if (isReadOnly) saveScriptBtn.classList.add('disabled');
      else saveScriptBtn.classList.remove('disabled');
    }
    const renameBtn = document.getElementById('pine_menu_rename');
    if (renameBtn) {
      if (isReadOnly) renameBtn.classList.add('disabled');
      else renameBtn.classList.remove('disabled');
    }

    const verMatch = code ? code.match(/\\/\\/\\s*@version\\s*=\\s*(\\d+)/) : null;
    const verEl = document.getElementById('pine_version_display');
    if (verEl) {
      verEl.textContent = verMatch ? ('PineScript v' + verMatch[1]) : 'PineScript v6';
    }

    setStatus('Ready', 'ready');
    saveCurrentToStorage();
    pushRecentlyUsedScript(name);
    renderRecentlyUsedList();
    updateAddButtonLabel();
  }

  function closeDropdown() {
    const wrapper = document.getElementById('pine_dropdown_wrapper');
    const menu = document.getElementById('pine_dropdown_menu');
    if (wrapper) wrapper.classList.remove('open');
    if (menu) menu.classList.remove('show');
  }

  /* =========================================================================
   * 3. Event Handlers & Core Actions
   * ========================================================================= */
  function bindEvents() {`;

if (!code.includes(target)) {
  console.error('Target not found in file!');
  process.exit(1);
}

code = code.replace(target, replacement);
fs.writeFileSync(filePath, code, 'utf8');
console.log('Successfully updated pine_editor_ide.js with loadScript and showReadOnlyCopyPrompt!');
