const fs = require('fs');

let code = fs.readFileSync('pine_editor_ide.js', 'utf8');
const isCrlf = code.includes('\r\n');
if (isCrlf) {
  code = code.replace(/\r\n/g, '\n');
}

const target = `        <div class="tv-indicator-actions">
          <button type="button" class="tv-indicator-action-btn add-chart-btn" title="Add to chart">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="12" y2="12"/></svg>
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
        if (confirm(\`Delete script "\${item.name}"?\`)) {
          const allScripts = getUserSavedScripts().filter(s => s.id !== item.id && s.name !== item.name);
          saveUserSavedScripts(allScripts);
          renderIndicatorsModal();
        }
      });

      // Row click loads into editor
      row.addEventListener('click', () => {
        loadScript(item.name, item.code, item.id);
        setDockOpen(true);
        closeIndicatorsModal();
      });`;

const replacement = `        <div class="tv-indicator-actions">
          <button type="button" class="tv-indicator-action-btn add-chart-btn" title="Add to chart">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="12" y2="12"/></svg>
            Add to chart
          </button>
          <button type="button" class="tv-indicator-action-btn open-editor-btn" title="Open script in Pine Editor">
            <span style="font-family: monospace; font-weight: 700; font-size: 13px;">{ }</span>
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
        openScriptForStudy(item.name);
      });

      // Delete custom script
      row.querySelector('.delete-script-btn')?.addEventListener('click', (e) => {
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

if (!code.includes(target)) {
  console.error('Target not found in pine_editor_ide.js!');
  process.exit(1);
}

code = code.replace(target, replacement);
if (isCrlf) {
  code = code.replace(/\n/g, '\r\n');
}
fs.writeFileSync('pine_editor_ide.js', code, 'utf8');
console.log('Successfully updated indicators modal actions!');
