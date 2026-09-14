const fs = require('fs');
const path = require('path');

const rootDir = 'e:/TRADINGVIEW ADVANCED';

// 1. Create init_bootstrap.js
const bootstrapContent = `/**
 * init_bootstrap.js
 * External bootstrap logic for theme initialization, error suppression, and PineTS runtime binding.
 */
(function() {
  'use strict';

  // 1. Theme Initialization
  try {
    var t = (localStorage.getItem("tv_chart_theme") || "Dark").toLowerCase();
    document.documentElement.setAttribute('data-theme', t);
    document.documentElement.className = t === 'light' ? 'theme-light' : 'theme-dark';
  } catch (e) {}

  // 2. Filter benign internal library notices
  var _err = console.error;
  console.error = function() {
    if (arguments[0] && typeof arguments[0] === 'string' && arguments[0].indexOf('not enough depth') !== -1) return;
    return _err.apply(console, arguments);
  };

  // 3. PineTS Runtime Binding helper
  window.ensurePineTSBinding = function() {
    if (typeof window.PineTSLib !== 'undefined') {
      window.PineTS = window.PineTS || {};
      window.PineTS.Indicator = window.PineTSLib.Indicator;
      window.PineTSLib.Indicator = window.PineTSLib.Indicator || window.PineTS.Indicator;
    } else if (typeof window.PineTS !== 'undefined' && window.PineTS.Indicator) {
      window.PineTSLib = window.PineTSLib || {};
      window.PineTSLib.Indicator = window.PineTS.Indicator;
    }
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.ensurePineTSBinding);
  } else {
    window.ensurePineTSBinding();
  }
})();
`;

fs.writeFileSync(path.join(rootDir, 'init_bootstrap.js'), bootstrapContent, 'utf8');
console.log('Created init_bootstrap.js');

// 2. Append index.html styles into custom.css
const cssToAppend = `
/* ==========================================================================
   Root Application Layout & CSS Custom Properties
   ========================================================================== */
:root {
  --tv-bg-primary: #131722;
  --tv-bg-secondary: #1e222d;
  --tv-bg-tertiary: #2a2e39;
  --tv-border: #363a45;
  --tv-border-hover: #4a4e59;
  --tv-text-primary: #d1d4dc;
  --tv-text-secondary: #787b86;
  --tv-accent: #2962ff;
  --tv-accent-hover: #1e53e5;
  --tv-success: #089981;
  --tv-error: #f23645;
  --tv-warning: #ff9800;
}

* {
  box-sizing: border-box;
}

body, html {
  margin: 0;
  padding: 0;
  height: 100%;
  background-color: #000;
  color: var(--tv-text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Trebuchet MS', Roboto, Ubuntu, sans-serif;
  overflow: hidden;
}

#app_root {
  display: flex;
  flex-direction: row;
  width: 100vw;
  height: 100vh;
  overflow: hidden;
}

#tv_chart_container {
  flex: 1;
  min-width: 0;
  height: 100%;
  position: relative;
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  will-change: transform;
  contain: layout size;
}

#tv_chart_container iframe,
#tv_chart_container canvas {
  transform: translateZ(0);
  -webkit-transform: translateZ(0);
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  will-change: transform;
}

/* Legend Fixes & Crossed-Eye Interval Icon Suppression */
[data-name="legend-interval-show-hide-action"],
.intervalEye,
[class*="intervalEye"] {
  display: none !important;
  visibility: hidden !important;
  width: 0 !important;
  height: 0 !important;
  pointer-events: none !important;
  margin: 0 !important;
  padding: 0 !important;
  opacity: 0 !important;
  position: absolute !important;
  left: -9999px !important;
}

.valuesWrapper,
.valuesAdditionalWrapper,
[class*="valuesWrapper"],
[class*="valuesAdditionalWrapper"] {
  white-space: nowrap !important;
  display: inline-flex !important;
  flex-wrap: nowrap !important;
}

/* ── CachedCharts HUD & Top Floating Pill ────────────────────────── */
.cached-charts-pill {
  position: fixed;
  top: 6px;
  right: 60px;
  z-index: 9999;
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(19, 23, 34, 0.92);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid #2a2e39;
  border-radius: 20px;
  padding: 4px 12px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: #d1d4dc;
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.45);
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  user-select: none;
}
.cached-charts-pill:hover {
  border-color: #00e676;
  background: rgba(30, 34, 45, 0.96);
  box-shadow: 0 4px 18px rgba(0, 230, 118, 0.25);
  transform: translateY(-1px);
}
.pulse-dot-green {
  width: 8px;
  height: 8px;
  background-color: #00e676;
  border-radius: 50%;
  box-shadow: 0 0 8px #00e676;
  animation: pulse-glow-green 1.6s infinite ease-in-out;
}
@keyframes pulse-glow-green {
  0%, 100% { opacity: 1; transform: scale(1); box-shadow: 0 0 8px #00e676; }
  50% { opacity: 0.35; transform: scale(0.85); box-shadow: 0 0 2px #00e676; }
}
.pill-badge {
  background: rgba(0, 230, 118, 0.15);
  color: #00e676;
  padding: 1px 6px;
  border-radius: 10px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
`;

const customCssPath = path.join(rootDir, 'custom.css');
let existingCss = fs.readFileSync(customCssPath, 'utf8');
if (!existingCss.includes('cached-charts-pill')) {
  existingCss += '\n' + cssToAppend;
  fs.writeFileSync(customCssPath, existingCss, 'utf8');
  console.log('Appended styles to custom.css');
}

// 3. Rewrite index.html to be 100% clean
const cleanHtml = `<!DOCTYPE html>
<html lang="en" class="theme-dark" data-theme="dark">
  <head>
    <meta charset="UTF-8">
    <title>TradingView Advanced Charts</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="TradingView Advanced Charts with real-time financial market data, custom Pine Script indicators, and technical analysis.">
    <meta http-equiv="Cache-Control" content="no-cache, no-store, must-revalidate">
    <meta http-equiv="Pragma" content="no-cache">
    <meta http-equiv="Expires" content="0">
    <link rel="icon" type="image/png" href="tv-icon.png">
    <link rel="shortcut icon" href="favicon.ico" type="image/x-icon">
    <link rel="apple-touch-icon" href="tv-icon.png">

    <!-- External Stylesheets -->
    <link rel="stylesheet" href="custom.css?v=4.6.0">
    <link rel="stylesheet" href="pine_editor.css?v=4.6.0">

    <!-- External JavaScript Modules -->
    <script src="init_bootstrap.js?v=4.6.0"></script>
    <script src="charting_library/charting_library.standalone.js"></script>
    <script src="datafeeds/udf/dist/bundle.js?v=4.3.0"></script>
    <script src="mt5_broker.js?v=4.4.1"></script>
    <script src="PineTS-main/dist/pinets.min.browser.js?v=4.5.0"></script>
    <script src="pine_indicators.js?v=4.6.0"></script>
    <script src="pine_editor_ide.js?v=4.6.0"></script>
  </head>

  <body>
    <main id="app_root" role="main">
      <div id="tv_chart_container"></div>
    </main>
    <script src="chart_app.js?v=4.6.0"></script>
  </body>
</html>
`;

fs.writeFileSync(path.join(rootDir, 'index.html'), cleanHtml, 'utf8');
console.log('Successfully rewrote clean index.html!');
