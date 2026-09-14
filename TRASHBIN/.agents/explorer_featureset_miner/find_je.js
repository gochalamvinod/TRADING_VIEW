const fs = require('fs');
const path = require('path');

const libPath = 'E:/TRADINGVIEW ADVANCED/charting_library/bundles/library.e8d44337c84d65489d2c.js';
const content = fs.readFileSync(libPath, 'utf8');

// Find function je() definition around lines 150-160
const idx = content.indexOf('studiesMetadata(){');
if (idx !== -1) {
  const snippet = content.substring(idx - 10000, idx + 1000);
  // Find je definition
  const m = snippet.match(/function\s+je\s*\(\)\s*\{([^}]+)\}/);
  if (m) {
    console.log('Found function je():', m[0].substring(0, 300));
  } else {
    // Find where je= or const je or let je
    const m2 = snippet.match(/(?:const|let|var|function)\s+je\b[^{;]+(?:\{|=)/g);
    console.log('Matches for je:', m2);
  }
}
