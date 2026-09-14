const fs = require('fs');

let code = fs.readFileSync('e:\\TRADINGVIEW ADVANCED\\pine_editor_ide.js', 'utf8');

// Find renderIndicatorsModal
const modalFuncIdx = code.indexOf('function renderIndicatorsModal()');
if (modalFuncIdx === -1) {
  throw new Error('renderIndicatorsModal not found');
}

// Find if (_activeIndicatorsCategory === 'myscripts') after modalFuncIdx
const ifCategoryIdx = code.indexOf("if (_activeIndicatorsCategory === 'myscripts')", modalFuncIdx);
if (ifCategoryIdx === -1) {
  throw new Error('if (_activeIndicatorsCategory === myscripts) not found');
}

// Find the end of that if-else chain: itemsToRender = [];\n    }
const elseEndIdx = code.indexOf("itemsToRender = [];\n    }", ifCategoryIdx);
if (elseEndIdx === -1) {
  throw new Error('End of category if-else chain not found');
}

const fullEndIdx = elseEndIdx + "itemsToRender = [];\n    }".length;

const newCategoryLogic = `if (_activeIndicatorsCategory === 'myscripts') {
      itemsToRender = getUserSavedScripts();
    } else if (_activeIndicatorsCategory === 'favorites') {
      itemsToRender = getUserSavedScripts().filter(s => s.isFavorite);
    } else if (_activeIndicatorsCategory === 'technicals') {
      itemsToRender = BUILTIN_TECHNICALS.map(name => ({
        id: "builtin_" + name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name: name,
        isFavorite: false,
        isBuiltIn: true
      }));
    } else if (_activeIndicatorsCategory === 'top' || _activeIndicatorsCategory === 'trending' || _activeIndicatorsCategory === 'editors_picks') {
      let filtered = POPULAR_BUILTINS;
      if (_activeIndicatorsCategory === 'trending') {
        filtered = ["SuperTrend", "Bollinger Bands", "Moving Average Exponential", "Relative Strength Index", "Average True Range", "MACD"];
      } else if (_activeIndicatorsCategory === 'editors_picks') {
        filtered = ["Volume Weighted Average Price", "MACD", "Ichimoku Cloud", "Stochastic RSI", "Average Directional Index", "SuperTrend"];
      }
      itemsToRender = filtered.map(name => ({
        id: "builtin_" + name.toLowerCase().replace(/[^a-z0-9]/g, '_'),
        name: name,
        isFavorite: false,
        isBuiltIn: true
      }));
    } else {
      itemsToRender = [];
    }`;

code = code.slice(0, ifCategoryIdx) + newCategoryLogic + code.slice(fullEndIdx);

// Also check the empty state in renderIndicatorsModal
const emptyStateIdx = code.indexOf("if (itemsToRender.length === 0) {", modalFuncIdx);
if (emptyStateIdx !== -1) {
  const returnIdx = code.indexOf("return;\n    }", emptyStateIdx);
  if (returnIdx !== -1) {
    const fullEmptyEnd = returnIdx + "return;\n    }".length;
    const newEmptyBlock = `if (itemsToRender.length === 0) {
      if (_activeIndicatorsCategory === 'myscripts' && !q) {
        list.innerHTML = \`
          <div style="padding: 60px 20px; text-align: center; color: #787b86; display: flex; flex-direction: column; align-items: center; justify-content: center;">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin-bottom: 16px; opacity: 0.5;">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
            <div style="font-size: 15px; font-weight: 500; color: #d1d4dc; margin-bottom: 8px;">No custom scripts yet</div>
            <div style="font-size: 13px; color: #787b86; max-width: 320px; line-height: 1.5;">Open the Pine Editor at the bottom of the chart to write and save your custom indicators and strategies.</div>
          </div>
        \`;
      } else {
        list.innerHTML = \`
          <div style="padding: 40px 16px; text-align: center; color: #787b86; font-size: 13px;">
            No indicators found matching "\${escapeHtml(q || _activeIndicatorsCategory)}".
          </div>
        \`;
      }
      return;
    }`;
    code = code.slice(0, emptyStateIdx) + newEmptyBlock + code.slice(fullEmptyEnd);
  }
}

fs.writeFileSync('e:\\TRADINGVIEW ADVANCED\\pine_editor_ide.js', code, 'utf8');
console.log('Successfully updated category and empty state logic in pine_editor_ide.js!');
