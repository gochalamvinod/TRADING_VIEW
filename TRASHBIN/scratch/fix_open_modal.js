const fs = require('fs');
const path = 'e:/TRADINGVIEW ADVANCED/pine_editor_ide.js';
let code = fs.readFileSync(path, 'utf8');

const marker = '"Zig Zag"';
const markerIdx = code.indexOf(marker);
if (markerIdx === -1) {
  console.error('Zig Zag marker not found');
  process.exit(1);
}

const endBracketIdx = code.indexOf('];', markerIdx);
if (endBracketIdx === -1) {
  console.error(']; not found after Zig Zag');
  process.exit(1);
}

const afterBracket = endBracketIdx + 2;
// Find where closeIndicatorsModal or next function starts
const nextHook = code.indexOf('document.getElementById(\'tv_indicators_modal_backdrop\')', afterBracket);
const newlineType = code.includes('\r\n') ? '\r\n' : '\n';

const insertion = newlineType + newlineType +
`  let _activeIndicatorsCategory = 'myscripts';` + newlineType +
`  let _indicatorsSearchQuery = '';` + newlineType + newlineType +
`  function openIndicatorsModal(initialCategory) {` + newlineType +
`    if (initialCategory) _activeIndicatorsCategory = initialCategory;` + newlineType +
`    mountIndicatorsModal();` + newlineType +
`    const modalBackdrop = document.getElementById('tv_indicators_modal_backdrop');` + newlineType +
`    if (!modalBackdrop) return;` + newlineType +
`    modalBackdrop.style.display = 'flex';` + newlineType +
`    const searchInput = document.getElementById('tv_indicators_search_input');` + newlineType +
`    if (searchInput) {` + newlineType +
`      searchInput.value = '';` + newlineType +
`      _indicatorsSearchQuery = '';` + newlineType +
`      setTimeout(() => searchInput.focus(), 60);` + newlineType +
`    }` + newlineType +
`    renderIndicatorsModal();` + newlineType +
`  }` + newlineType + newlineType +
`  function closeIndicatorsModal() {` + newlineType;

const newCode = code.slice(0, afterBracket) + insertion + code.slice(nextHook);
fs.writeFileSync(path, newCode, 'utf8');
console.log('Successfully patched openIndicatorsModal in pine_editor_ide.js');
