const fs = require('fs');

const cssPath = 'e:\\TRADINGVIEW ADVANCED\\pine_editor.css';
let css = fs.readFileSync(cssPath, 'utf8');

// Define color mappings for dark and light
const colors = {
  bg: { dark: '#131722', light: '#ffffff' },
  toolbar: { dark: '#1e222d', light: '#ffffff' },
  border: { dark: '#2a2e39', light: '#e0e3eb' },
  textPrimary: { dark: '#d1d4dc', light: '#131722' },
  textMuted: { dark: '#787b86', light: '#787b86' }, // keep same or change
  accent: { dark: '#2962ff', light: '#2962ff' },
  accentHover: { dark: '#1e53e5', light: '#1e53e5' },
  error: { dark: '#f23645', light: '#f23645' },
  success: { dark: '#089981', light: '#089981' },
  warning: { dark: '#ff9800', light: '#ff9800' }
};

// Insert at top
const variables = `
:root, [data-theme="dark"] {
  --tv-color-bg: #131722;
  --tv-color-toolbar: #1e222d;
  --tv-color-border: #2a2e39;
  --tv-color-border-hover: #363a45;
  --tv-color-border-active: #4a4e59;
  --tv-color-text: #d1d4dc;
  --tv-color-text-muted: #787b86;
  --tv-color-accent: #2962ff;
  --tv-color-accent-hover: #1e53e5;
  --tv-color-error: #f23645;
  --tv-color-success: #089981;
  --tv-color-warning: #ff9800;
  --tv-color-item-hover: #2a2e39;
}
[data-theme="light"] {
  --tv-color-bg: #ffffff;
  --tv-color-toolbar: #ffffff;
  --tv-color-border: #e0e3eb;
  --tv-color-border-hover: #d1d4dc;
  --tv-color-border-active: #b2b5be;
  --tv-color-text: #131722;
  --tv-color-text-muted: #787b86;
  --tv-color-accent: #2962ff;
  --tv-color-accent-hover: #1e53e5;
  --tv-color-error: #f23645;
  --tv-color-success: #089981;
  --tv-color-warning: #ff9800;
  --tv-color-item-hover: #f0f3fa;
}
`;

// Simple hex map to variable for easy replacements
const hexMap = {
  '#131722': 'var(--tv-color-bg)',
  '#ffffff': 'var(--tv-color-bg)', // wait, #ffffff in dark theme means text or bg? In v2 it means bg.
  '#1e222d': 'var(--tv-color-toolbar)',
  '#2a2e39': 'var(--tv-color-border)',
  '#e0e3eb': 'var(--tv-color-border)',
  '#363a45': 'var(--tv-color-border-hover)',
  '#4a4e59': 'var(--tv-color-border-active)',
  '#d1d4dc': 'var(--tv-color-text)',
  '#787b86': 'var(--tv-color-text-muted)',
  '#2962ff': 'var(--tv-color-accent)',
  '#1e53e5': 'var(--tv-color-accent-hover)',
  '#f23645': 'var(--tv-color-error)',
  '#089981': 'var(--tv-color-success)',
  '#ff9800': 'var(--tv-color-warning)',
  '#f0f3fa': 'var(--tv-color-item-hover)'
};

// We want to replace colors case insensitively
for (let hex of Object.keys(hexMap)) {
  const regex = new RegExp(hex + '(?![a-zA-Z0-9])', 'gi');
  css = css.replace(regex, hexMap[hex]);
}

css = variables + "\n" + css;

fs.writeFileSync(cssPath, css);
console.log("CSS updated!");
