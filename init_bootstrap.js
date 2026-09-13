/**
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
