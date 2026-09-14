const fs = require('fs');

let c = fs.readFileSync('e:\\TRADINGVIEW ADVANCED\\pine_editor_ide.js', 'utf8');

const targetLine = "saveBtn.addEventListener('click', async () => {";
const idx = c.indexOf(targetLine);
if (idx === -1) {
  console.error('Target not found');
  process.exit(1);
}

// Find the closing of this event listener block
const closePattern = "await runCompilation(false);\n      });\n    }";
const closePatternCRLF = "await runCompilation(false);\r\n      });\r\n    }";

let closeIdx = c.indexOf(closePattern, idx);
let closeLen = closePattern.length;
if (closeIdx === -1) {
  closeIdx = c.indexOf(closePatternCRLF, idx);
  closeLen = closePatternCRLF.length;
}

if (closeIdx === -1) {
  console.error('Closing block not found');
  process.exit(1);
}

const before = c.substring(0, idx);
const after = c.substring(closeIdx + closeLen);

const replacement = `saveBtn.addEventListener('click', async () => {
        const currentCode = (codeInput ? codeInput.value : _currentScript.code) || '';
        _currentScript.code = currentCode;

        // Auto-detect title from indicator("...") or strategy("...") if Untitled
        if (!_currentScript.name || _currentScript.name === 'Untitled Script' || _currentScript.name === 'My Script') {
          const m = currentCode.match(/(?:indicator|strategy|library)\\s*\\(\\s*["']([^"']+)["']/);
          if (m && m[1]) {
            _currentScript.name = m[1].trim();
            const titleDisp = document.getElementById('pine_script_title_display');
            if (titleDisp) titleDisp.textContent = _currentScript.name;
          }
        }

        _currentScript.isDirty = false;
        if (dirtyInd) dirtyInd.style.display = 'none';
        saveCurrentToStorage();
        saveScriptRevision(_currentScript.id, _currentScript.name, currentCode);

        // Sync into User Saved Scripts so it appears in My scripts
        const allScripts = getUserSavedScripts();
        const existingIdx = allScripts.findIndex(s => s.id === _currentScript.id || s.name === _currentScript.name);
        if (existingIdx >= 0) {
          allScripts[existingIdx] = {
            ...allScripts[existingIdx],
            name: _currentScript.name,
            code: currentCode,
            updatedAt: Date.now()
          };
        } else {
          allScripts.unshift({
            id: _currentScript.id || ('user_script_' + Date.now()),
            name: _currentScript.name,
            code: currentCode,
            isFavorite: false,
            createdAt: Date.now()
          });
        }
        saveUserSavedScripts(allScripts);
        pushRecentlyUsedScript(_currentScript.name);

        logConsole(\`Script "\${_currentScript.name}" saved successfully.\`, "success");
        logConsoleV2(\`\${formatLogTime()} "\${_currentScript.name}" saved successfully\`);
        await runCompilation(false);
      });
    }`;

c = before + replacement + after;
fs.writeFileSync('e:\\TRADINGVIEW ADVANCED\\pine_editor_ide.js', c, 'utf8');
console.log('Successfully patched saveBtn in pine_editor_ide.js');
