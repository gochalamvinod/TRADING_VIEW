const fs = require('fs');
const file = 'e:/TRADINGVIEW ADVANCED/charting_library/bundles/floating-toolbars.435f06c307950384d090.js';
let code = fs.readFileSync(file, 'utf8');

// 1. Remove call in _createCommonButtons
const target1 = 'this._createSettingsButton(),this._createSourceCodeButton(),this._createSourceActions()';
const repl1 = 'this._createSettingsButton(),this._createSourceActions()';

// 2. Disable _createSourceCodeButton definition
const target2 = '_createSourceCodeButton(){const t={component:SourceCodeBtn,props:{title:"Source code",activeChartWidget:this.activeChartWidget()},showForSmallScreen:!0};this._addCommonButton(t)}';
const repl2 = '_createSourceCodeButton(){}';

let count = 0;
if (code.includes(target1)) {
  code = code.replace(target1, repl1);
  count++;
}
if (code.includes(target2)) {
  code = code.replace(target2, repl2);
  count++;
}

fs.writeFileSync(file, code, 'utf8');
console.log('Fixed floating-toolbars. Patched count:', count);
