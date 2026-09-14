const fs = require('fs');
const file = 'e:/TRADINGVIEW ADVANCED/pine_editor_ide.js';
let code = fs.readFileSync(file, 'utf8');

const confirmFunc = `
  function showTVConfirmDialog(opts) {
    if (!opts) return;
    const existing = document.getElementById('tv_confirm_dialog_overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'tv_confirm_dialog_overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; z-index: 999999; background: rgba(0,0,0,0.65); display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif; backdrop-filter: blur(2px);';

    overlay.innerHTML = \`
      <div style="background: #1e222d; color: #d1d4dc; border: 1px solid #2a2e39; border-radius: 8px; width: 380px; max-width: 90vw; padding: 20px; box-shadow: 0 16px 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 16px;">
        <div style="font-size: 16px; font-weight: 600; color: #ffffff;">\${escapeHtml(opts.title || 'Delete script')}</div>
        <div style="font-size: 13px; color: #787b86; line-height: 1.4;">\${escapeHtml(opts.message || 'Are you sure you want to delete this script? This action cannot be undone.')}</div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
          <button type="button" id="tv_confirm_cancel" style="background: transparent; border: 1px solid #363a45; color: #d1d4dc; padding: 7px 16px; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer;">\${escapeHtml(opts.cancelText || 'Cancel')}</button>
          <button type="button" id="tv_confirm_action" style="background: \${opts.isDanger ? '#f23645' : '#2962ff'}; border: none; color: #ffffff; padding: 7px 18px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;">\${escapeHtml(opts.confirmText || 'Delete')}</button>
        </div>
      </div>
    \`;

    document.body.appendChild(overlay);

    overlay.querySelector('#tv_confirm_cancel')?.addEventListener('click', () => {
      overlay.remove();
      if (typeof opts.onCancel === 'function') opts.onCancel();
    });

    overlay.querySelector('#tv_confirm_action')?.addEventListener('click', () => {
      overlay.remove();
      if (typeof opts.onConfirm === 'function') opts.onConfirm();
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        overlay.remove();
        if (typeof opts.onCancel === 'function') opts.onCancel();
      }
    });
  }
`;

if (!code.includes('function showTVConfirmDialog')) {
  const mountIdx = code.indexOf('function mountIndicatorsModal()');
  if (mountIdx !== -1) {
    code = code.slice(0, mountIdx) + confirmFunc + '\n\n  ' + code.slice(mountIdx);
    console.log('Inserted showTVConfirmDialog before mountIndicatorsModal');
  }
}

// Ensure delete button uses showTVConfirmDialog with fallback
const oldDel = /row\.querySelector\('\.delete-script-btn'\)\?\.addEventListener\('click'[\s\S]*?renderIndicatorsModal\(\);\s*\}\s*\}\);\s*\}\);/;
const newDel = `row.querySelector('.delete-script-btn')?.addEventListener('click', (e) => {
        e.stopPropagation();
        e.preventDefault();
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

if (oldDel.test(code)) {
  code = code.replace(oldDel, newDel);
  console.log('Updated delete button listener to use showTVConfirmDialog');
} else {
  // Try matching simpler pattern
  const idx = code.indexOf("row.querySelector('.delete-script-btn')");
  if (idx !== -1) {
    const endIdx = code.indexOf("renderIndicatorsModal();", idx);
    if (endIdx !== -1) {
      const closeIdx = code.indexOf("});", endIdx);
      if (closeIdx !== -1) {
        code = code.slice(0, idx) + newDel + code.slice(closeIdx + 3);
        console.log('Replaced delete listener via index match');
      }
    }
  }
}

fs.writeFileSync(file, code, 'utf8');
console.log('pine_editor_ide.js updated successfully');
