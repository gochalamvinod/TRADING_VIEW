const fs = require('fs');
const path = require('path');

const filePath = path.resolve('pine_editor_ide.js');
let code = fs.readFileSync(filePath, 'utf8');

// 1. toggleAlertsPanel
const p1_target = `  function toggleAlertsPanel(forceOpen) {
    const panel = document.getElementById('tv_alerts_panel');`;
const p1_replace = `  function toggleAlertsPanel(forceOpen) {
    mountAlertsPanelAndModal();
    const panel = document.getElementById('tv_alerts_panel');`;
if (!code.includes(p1_target)) throw new Error('p1_target not found');
code = code.replace(p1_target, p1_replace);

// 2. openCreateAlertDialog
const p2_target = `  function openCreateAlertDialog(prefillPrice, prefillSource) {
    const modalBackdrop = document.getElementById('tv_alert_create_backdrop');`;
const p2_replace = `  function openCreateAlertDialog(prefillPrice, prefillSource) {
    mountAlertsPanelAndModal();
    const modalBackdrop = document.getElementById('tv_alert_create_backdrop');`;
if (!code.includes(p2_target)) throw new Error('p2_target not found');
code = code.replace(p2_target, p2_replace);

// 3. showReadOnlyCopyPrompt & loadScript
const p3_target = `  function showReadOnlyCopyPrompt() {
    showTVConfirmDialog({
      title: "Create a copy to edit",
      message: \`You should create a copy to edit this built-in indicator. Would you like to create a working copy now?\`,
      confirmText: "Create a copy",
      cancelText: "Cancel",
      isDanger: false,
      onConfirm: () => {
        makeScriptCopy();
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
      activeStudyId: savedActiveId || null
    };`;

const p3_replace = `  function showReadOnlyCopyPrompt() {
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
    }`;

if (!code.includes(p3_target)) throw new Error('p3_target not found');
code = code.replace(p3_target, p3_replace);

// 4. beforeinput & paste listeners
const p4_target = `    // Keybindings: Autocomplete Nav, Tab, Ctrl+S, Ctrl+B, Ctrl+Shift+Enter, Ctrl+Enter, Ctrl+Shift+T, Ctrl+Space
    codeInput.addEventListener('keydown', (e) => {`;

const p4_replace = `    codeInput.addEventListener('beforeinput', (e) => {
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

    // Keybindings: Autocomplete Nav, Tab, Ctrl+S, Ctrl+B, Ctrl+Shift+Enter, Ctrl+Enter, Ctrl+Shift+T, Ctrl+Space
    codeInput.addEventListener('keydown', (e) => {`;

if (!code.includes(p4_target)) throw new Error('p4_target not found');
code = code.replace(p4_target, p4_replace);

// 5. saveBtn read-only check
const p5_target = `    // Save Action
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        const currentCode = (codeInput ? codeInput.value : _currentScript.code) || '';`;

const p5_replace = `    // Save Action
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (_currentScript.isReadOnly) {
          showReadOnlyCopyPrompt();
          return;
        }
        const currentCode = (codeInput ? codeInput.value : _currentScript.code) || '';`;

if (!code.includes(p5_target)) throw new Error('p5_target not found');
code = code.replace(p5_target, p5_replace);

// 6. showTVConfirmDialog assignment
const p6_target = `  root.showTVConfirmDialog = function(opts) {
    if (!opts) return;
    if (window.confirm(opts.message || 'Are you sure?')) {
      if (typeof opts.onConfirm === 'function') opts.onConfirm();
    } else {
      if (typeof opts.onCancel === 'function') opts.onCancel();
    }
  };`;

const p6_replace = `  root.showTVConfirmDialog = showTVConfirmDialog;`;

if (!code.includes(p6_target)) throw new Error('p6_target not found');
code = code.replace(p6_target, p6_replace);

// 7. Initial mounts at bottom
const p7_target = `  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => mountIndicatorsModal());
    } else {
      mountIndicatorsModal();
    }
  }`;

const p7_replace = `  if (typeof document !== 'undefined') {
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

if (!code.includes(p7_target)) throw new Error('p7_target not found');
code = code.replace(p7_target, p7_replace);

fs.writeFileSync(filePath, code, 'utf8');
console.log('All 7 patches applied cleanly!');
