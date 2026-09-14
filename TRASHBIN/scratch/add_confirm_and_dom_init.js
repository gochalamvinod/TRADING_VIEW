const fs = require('fs');

const idePath = 'e:/TRADINGVIEW ADVANCED/pine_editor_ide.js';
let code = fs.readFileSync(idePath, 'utf8');

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
        <div style="font-size: 16px; font-weight: 600; color: #ffffff;">\${escapeHtml(opts.title || 'Confirmation')}</div>
        <div style="font-size: 13px; color: #787b86; line-height: 1.4;">\${escapeHtml(opts.message || 'Are you sure?')}</div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
          <button type="button" id="tv_confirm_cancel" style="background: transparent; border: 1px solid #363a45; color: #d1d4dc; padding: 7px 16px; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer;">\${escapeHtml(opts.cancelText || 'Cancel')}</button>
          <button type="button" id="tv_confirm_action" style="background: \${opts.isDanger ? '#f23645' : '#2962ff'}; border: none; color: #ffffff; padding: 7px 18px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;">\${escapeHtml(opts.confirmText || 'OK')}</button>
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
  code = code.replace('function mountIndicatorsModal() {', confirmFunc + '\n  function mountIndicatorsModal() {');
  console.log('Added showTVConfirmDialog function');
}

const bottomTarget = `  // Intercept any legacy openPineEditorModal calls and redirect cleanly to the authentic dock
  root.openPineEditorModal = function(w) {
    PineEditorIDE.open();
  };

})(typeof window !== 'undefined' ? window : globalThis);`;

const bottomReplacement = `  // Intercept any legacy openPineEditorModal calls and redirect cleanly to the authentic dock
  root.openPineEditorModal = function(w) {
    PineEditorIDE.open();
  };

  root.showTVConfirmDialog = showTVConfirmDialog;

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        mountIndicatorsModal();
        mountAlertsPanelAndModal();
      });
    } else {
      mountIndicatorsModal();
      mountAlertsPanelAndModal();
    }
  }

})(typeof window !== 'undefined' ? window : globalThis);`;

if (code.includes(bottomTarget)) {
  code = code.replace(bottomTarget, bottomReplacement);
  console.log('Updated bottom initialization and exported showTVConfirmDialog');
} else {
  console.log('bottomTarget not found!');
}

fs.writeFileSync(idePath, code, 'utf8');
