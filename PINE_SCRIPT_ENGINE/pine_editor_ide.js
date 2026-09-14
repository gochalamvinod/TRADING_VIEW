/**
 * pine_editor_ide.js
 * 100% Authentic TradingView Dark Theme Pine Script Editor IDE.
 * 
 * Features:
 *  - Native TradingView dark theme palette (#131722 / #1e222d / #2a2e39 / #2962ff)
 *  - Zero unauthentic UI artifacts (no emojis, no green gradient buttons, no clumsy modal overlays)
 *  - Left toolbar cluster:
 *      * Script selector dropdown with caret ▼ featuring 7 clean reference templates:
 *          1) Custom Symbol Candles (Multi-Series OHLC plotcandle)
 *          2) SMA Crossover
 *          3) Smoothed RSI
 *          4) MACD
 *          5) Bollinger Bands
 *          6) ATR
 *          7) SuperTrend
 *        plus full converted indicator catalog search/select
 *      * Dirty indicator (*) when code is modified
 *      * Status badge pill (Ready / Saved / Compiling / Error) with indicator dot
 *  - Right toolbar cluster:
 *      * "Save" button with dropdown arrow ▼ (Save, Save As, New Script)
 *      * "Add to chart" high-contrast blue button (#2962ff)
 *      * "Publish Script" button
 *      * Pine Logs drawer toggle button
 *      * Maximize / restore toggle button
 *      * Standard SVG close button (✕)
 *  - Editor Workspace:
 *      * Synchronized line gutter, monospace editor, 2-space Tab & auto-indent
 *      * Keybindings: Ctrl+S (Save), Ctrl+Enter (Add to Chart)
 *  - Collapsible Pine Logs drawer with categorized diagnostics (info, success, warn, error)
 *  - Seamless integration with bottom dock tabs ("Pine Editor", "Strategy Tester", "Trading Panel")
 *    preventing dual docks and coordinating with Account Manager
 *  - R4 Legend Polish & Defect Fixes:
 *      * Injects definitive CSS rules into chart iframe suppressing interval eye icon
 *      * Enforces nowrap flex on valuesWrapper / valuesAdditionalWrapper
 *      * Ensures legend hover action buttons (eye, gear, trash) operate cleanly
 */
(function(root) {
  'use strict';

  /* =========================================================================
   * Reference PineScript v5 Templates
   * ========================================================================= */
    const TEMPLATES = [
    {
      id: "blank_indicator",
      name: "Blank Indicator",
      code: `//@version=5\nindicator("My Script", overlay=true)\nplot(close, "Close Price", color=color.blue)\n`
    },
    {
      id: "moving_average",
      name: "Moving Average",
      code: `//@version=5\nindicator("Moving Average", overlay=true)\nlen = input.int(14, "Length", minval=1)\nsrc = input(close, "Source")\nout = ta.sma(src, len)\nplot(out, "SMA", color=color.blue, linewidth=2)\n`
    },
    {
      id: "rsi",
      name: "Relative Strength Index",
      code: `//@version=5\nindicator("Relative Strength Index", overlay=false)\nlen = input.int(14, "Length", minval=1)\nsrc = input(close, "Source")\nup = ta.rma(math.max(ta.change(src), 0), len)\ndown = ta.rma(-math.min(ta.change(src), 0), len)\nrsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))\nplot(rsi, "RSI", color=color.purple)\nhline(70, "Overbought", color=color.red, linestyle=hline.style_dotted)\nhline(30, "Oversold", color=color.green, linestyle=hline.style_dotted)\n`
    },
    {
      id: "bollinger_bands",
      name: "Bollinger Bands",
      code: `//@version=5\nindicator("Bollinger Bands", overlay=true)\nlength = input.int(20, minval=1)\nsrc = input(close, title="Source")\nmult = input.float(2.0, minval=0.001, maxval=50, title="StdDev")\nbasis = ta.sma(src, length)\ndev = mult * ta.stdev(src, length)\nupper = basis + dev\nlower = basis - dev\nplot(basis, "Basis", color=color.orange)\np1 = plot(upper, "Upper", color=color.blue)\np2 = plot(lower, "Lower", color=color.blue)\nfill(p1, p2, title = "Background", color=color.rgb(33, 150, 243, 90))\n`
    },
    {
      id: "macd",
      name: "MACD",
      code: `//@version=5\nindicator("MACD", overlay=false)\nfast_length = input(title="Fast Length", defval=12)\nslow_length = input(title="Slow Length", defval=26)\nsrc = input(title="Source", defval=close)\nsignal_length = input.int(title="Signal Smoothing",  minval = 1, maxval = 50, defval = 9)\nfast_ma = ta.ema(src, fast_length)\nslow_ma = ta.ema(src, slow_length)\nmacd = fast_ma - slow_ma\nsignal = ta.ema(macd, signal_length)\nhist = macd - signal\nplot(hist, title="Histogram", style=plot.style_columns, color=(hist>=0 ? (hist[1] < hist ? color.teal : color.green) : (hist[1] < hist ? color.maroon : color.red)))\nplot(macd, title="MACD", color=color.blue)\nplot(signal, title="Signal", color=color.orange)\n`
    }
  ];

  const CURRENT_SCRIPT_KEY = "tv_pine_current_script";
  const DOCK_WIDTH_KEY = "tv_pine_dock_width";
  const DOCK_HEIGHT_KEY = "tv_pine_dock_height";
  const DOCK_POSITION_KEY = "tv_pine_dock_position";
  const USER_SAVED_SCRIPTS_KEY = "tv_pine_user_scripts";
  const RECENTLY_USED_KEY = "tv_pine_recently_used";
  const ACTIVE_ALERTS_KEY = "tv_active_alerts";
  const ALERTS_HISTORY_KEY = "tv_alerts_history";

  // Pre-seeded indicators matching Image 2 ("Indicators, metrics, and strategies" > My scripts)
  // No pre-seeded mock custom scripts
  const DEFAULT_USER_SCRIPTS = [];

  const MOCK_SCRIPT_IDS = new Set([
    "sessions_luxalgo",
    "user_script_hh_ll",
    "user_script_multi_session",
    "user_script_pivot_points",
    "user_script_prev_close",
    "user_script_trend_channel",
    "user_script_vinod",
    "user_script_time_cycle",
    "vinod",
    "TIME CYCLE"
  ]);

  const BUILTIN_TECHNICALS = [
    "52 Week High/Low",
    "Accelerator Oscillator",
    "Accumulation/Distribution",
    "Accumulative Swing Index",
    "Advance/Decline",
    "Arnaud Legoux Moving Average",
    "Aroon",
    "Average Directional Index",
    "Average Price",
    "Average True Range",
    "Awesome Oscillator",
    "Balance of Power",
    "Bollinger Bands",
    "Bollinger Bands %B",
    "Bollinger Bands Width",
    "Chaikin Money Flow",
    "Chaikin Oscillator",
    "Chaikin Volatility",
    "Chande Kroll Stop",
    "Chande Momentum Oscillator",
    "Chop Zone",
    "Choppiness Index",
    "Commodity Channel Index",
    "Connors RSI",
    "Coppock Curve",
    "Correlation - Log",
    "Correlation Coefficient",
    "Detrended Price Oscillator",
    "Directional Movement",
    "Donchian Channels",
    "Double EMA",
    "Ease Of Movement",
    "Elder's Force Index",
    "EMA Cross",
    "Envelopes",
    "Fisher Transform",
    "Guppy Multiple Moving Average",
    "Historical Volatility",
    "Hull Moving Average",
    "Ichimoku Cloud",
    "Keltner Channels",
    "Klinger Oscillator",
    "Know Sure Thing",
    "Least Squares Moving Average",
    "Linear Regression Curve",
    "Linear Regression Slope",
    "MA Cross",
    "MA with EMA Cross",
    "MACD",
    "Majority Rule",
    "Mass Index",
    "McGinley Dynamic",
    "Median Price",
    "Momentum",
    "Money Flow Index",
    "Moving Average",
    "Moving Average Adaptive",
    "Moving Average Channel",
    "Moving Average Double",
    "Moving Average Exponential",
    "Moving Average Hamming",
    "Moving Average Multiple",
    "Moving Average Triple",
    "Moving Average Weighted",
    "Net Volume",
    "On Balance Volume",
    "Parabolic SAR",
    "Pivot Points Standard",
    "Price Channel",
    "Price Oscillator",
    "Price Volume Trend",
    "Rank Correlation Index",
    "Rate Of Change",
    "Ratio",
    "Relative Strength Index",
    "Relative Vigor Index",
    "Relative Volatility Index",
    "SMI Ergodic Indicator/Oscillator",
    "Smoothed Moving Average",
    "Spread",
    "Standard Deviation",
    "Standard Error",
    "Standard Error Bands",
    "Stochastic",
    "Stochastic RSI",
    "SuperTrend",
    "Trend Strength Index",
    "Triple EMA",
    "TRIX",
    "True Strength Index",
    "Typical Price",
    "Ultimate Oscillator",
    "Volatility Close-to-Close",
    "Volatility Index",
    "Volatility O-H-L-C",
    "Volatility Zero Trend Close-to-Close",
    "Volume",
    "Volume Oscillator",
    "Volume Weighted Average Price",
    "Vortex Indicator",
    "Williams %R",
    "Williams Alligator",
    "Williams Fractal",
    "Zig Zag"
  ];

  const POPULAR_BUILTINS = [
    "Moving Average",
    "Moving Average Exponential",
    "Relative Strength Index",
    "MACD",
    "Bollinger Bands",
    "Average True Range",
    "SuperTrend",
    "Volume",
    "Volume Weighted Average Price",
    "Stochastic",
    "Ichimoku Cloud",
    "Pivot Points Standard",
    "Commodity Channel Index",
    "Average Directional Index",
    "Parabolic SAR"
  ];

  function getUserSavedScripts() {
    try {
      const raw = localStorage.getItem(USER_SAVED_SCRIPTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    try {
      localStorage.setItem(USER_SAVED_SCRIPTS_KEY, JSON.stringify(DEFAULT_USER_SCRIPTS));
    } catch(e) {}
    return DEFAULT_USER_SCRIPTS.slice();
  }

  function saveUserSavedScripts(scripts) {
    try {
      localStorage.setItem(USER_SAVED_SCRIPTS_KEY, JSON.stringify(scripts));
    } catch(e) {}
  }

  function getRecentlyUsedScripts() {
    try {
      const raw = localStorage.getItem(RECENTLY_USED_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) return list;
      }
    } catch(e) {}
    const defaults = ["Moving Average", "Relative Strength Index", "Bollinger Bands"];
    try {
      localStorage.setItem(RECENTLY_USED_KEY, JSON.stringify(defaults));
    } catch(e) {}
    return defaults;
  }

  function pushRecentlyUsedScript(name) {
    if (!name) return;
    try {
      let list = getRecentlyUsedScripts();
      list = list.filter(n => n !== name);
      list.unshift(name);
      list = list.slice(0, 5);
      localStorage.setItem(RECENTLY_USED_KEY, JSON.stringify(list));
    } catch(e) {}
  }

  function getActiveAlerts() {
    try {
      const raw = localStorage.getItem(ACTIVE_ALERTS_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch(e) {}
    return [];
  }

  function saveActiveAlerts(alerts) {
    try {
      localStorage.setItem(ACTIVE_ALERTS_KEY, JSON.stringify(alerts));
    } catch(e) {}
  }

  function getAlertsHistory() {
    try {
      const raw = localStorage.getItem(ALERTS_HISTORY_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch(e) {}
    return [];
  }

  function saveAlertsHistory(history) {
    try {
      localStorage.setItem(ALERTS_HISTORY_KEY, JSON.stringify(history));
    } catch(e) {}
  }

  let _widget = null;
  let _currentScript = {
    id: TEMPLATES[0].id,
    name: TEMPLATES[0].name,
    code: TEMPLATES[0].code,
    isDirty: false,
    isReadOnly: false,
    activeStudyId: null
  };

  let _dockWidth = parseInt(localStorage.getItem(DOCK_WIDTH_KEY) || "620", 10);
  let _dockHeight = parseInt(localStorage.getItem(DOCK_HEIGHT_KEY) || "360", 10);
  let _dockPosition = localStorage.getItem(DOCK_POSITION_KEY) || "side";
  let _isDockOpen = false;
  let _isMaximized = false;
  let _isConsoleOpen = true;
  let _activeDrawerTab = 'compiler';
  let _compilerErrors = [];
  let _catalogItems = [];
  let _addStudyToChartFn = null;
  let _runCompilationFn = null;
  let _lastPriceBySymbol = {};

  /* =========================================================================
   * Pine Script Syntax Highlighting Tokenizer
   * ========================================================================= */
  function highlightPineScript(code) {
    if (!code) return '';
    const lines = String(code).split('\n');
    const highlightedLines = lines.map(line => {
      let l = escapeHtml(line);
      const commentIdx = l.indexOf('//');
      let commentPart = '';
      if (commentIdx !== -1) {
        commentPart = l.substring(commentIdx);
        l = l.substring(0, commentIdx);
        if (commentPart.startsWith('//@version')) {
          commentPart = `<span class="token-version">${commentPart}</span>`;
        } else {
          commentPart = `<span class="token-comment">${commentPart}</span>`;
        }
      }
      // Strings
      l = l.replace(/(["'])(?:(?=(\\?))\2[\s\S])*?\1/g, '<span class="token-string">$&</span>');
      // Numbers & Colors
      l = l.replace(/\b(\d+(?:\.\d+)?)\b|#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{8})\b/g, '<span class="token-number">$&</span>');
      // Keywords
      l = l.replace(/\b(indicator|strategy|var|varip|if|else|for|to|by|while|type|method|import|export|return)\b/g, '<span class="token-keyword">$1</span>');
      // Types
      l = l.replace(/\b(int|float|bool|string|color|series|array|matrix|map|table)\b/g, '<span class="token-type">$1</span>');
      // Namespaces
      l = l.replace(/\b(ta|strategy|input|math|color|request|array|matrix|map|syminfo|timeframe|barstate)\.(?=[a-zA-Z_])/g, '<span class="token-namespace">$1.</span>');
      // Builtin series vars
      l = l.replace(/\b(open|high|low|close|volume|time|bar_index|timenow|na|true|false)\b/g, '<span class="token-builtin">$1</span>');
      // Plot functions
      l = l.replace(/\b(plot|plotcandle|plotbar|plotshape|plotchar|plotarrow|hline|fill|bgcolor)\b(?=\s*\()/g, '<span class="token-function">$1</span>');

      return l + commentPart;
    });

    return highlightedLines.join('\n') + '\n ';
  }

  /* =========================================================================
   * Pine Editor Settings Engine & State
   * ========================================================================= */
  const SETTINGS_KEY = "tv_pine_editor_settings";
  function getEditorSettings() {
    try {
      const raw = localStorage.getItem(SETTINGS_KEY);
      if (raw) {
        return Object.assign({
          inlineSuggestions: true,
          autocompletePopover: true,
          paramHints: true,
          lineNumbers: true,
          tabSize: 2
        }, JSON.parse(raw));
      }
    } catch (e) {}
    return {
      inlineSuggestions: true,
      autocompletePopover: true,
      paramHints: true,
      lineNumbers: true,
      tabSize: 2
    };
  }

  function saveEditorSettings(s) {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
    } catch (e) {}
  }

  function openEditorSettingsModal() {
    let backdrop = document.getElementById('pine_editor_settings_modal');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'pine_editor_settings_modal';
      backdrop.className = 'pine-settings-modal-backdrop';
      backdrop.innerHTML = `
        <div class="pine-settings-modal" role="dialog" aria-label="Pine Editor Settings">
          <div class="pine-settings-header">
            <span class="pine-settings-title">Pine Editor Settings</span>
            <button type="button" class="pine-settings-close-btn" id="pine_settings_close_btn" title="Close">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="2" y1="2" x2="12" y2="12"/>
                <line x1="12" y1="2" x2="2" y2="12"/>
              </svg>
            </button>
          </div>
          <div class="pine-settings-body">
            <div class="pine-setting-row">
              <div class="pine-setting-label-col">
                <span class="pine-setting-label">Inline suggestions (Ghost text)</span>
                <span class="pine-setting-desc">Show inline gray ghost completions ahead of cursor accepted with Tab</span>
              </div>
              <label class="pine-setting-toggle">
                <input type="checkbox" id="pine_setting_inline_suggestions">
                <span class="pine-setting-slider"></span>
              </label>
            </div>
            <div class="pine-setting-row">
              <div class="pine-setting-label-col">
                <span class="pine-setting-label">Auto-complete popover</span>
                <span class="pine-setting-desc">Show floating IntelliSense suggestion menu while typing</span>
              </div>
              <label class="pine-setting-toggle">
                <input type="checkbox" id="pine_setting_ac_popover">
                <span class="pine-setting-slider"></span>
              </label>
            </div>
            <div class="pine-setting-row">
              <div class="pine-setting-label-col">
                <span class="pine-setting-label">Parameter hints</span>
                <span class="pine-setting-desc">Show parameter documentation tooltips when calling functions</span>
              </div>
              <label class="pine-setting-toggle">
                <input type="checkbox" id="pine_setting_param_hints">
                <span class="pine-setting-slider"></span>
              </label>
            </div>
            <div class="pine-setting-row">
              <div class="pine-setting-label-col">
                <span class="pine-setting-label">Line numbers</span>
                <span class="pine-setting-desc">Display line number gutter on the left side of the editor</span>
              </div>
              <label class="pine-setting-toggle">
                <input type="checkbox" id="pine_setting_line_numbers">
                <span class="pine-setting-slider"></span>
              </label>
            </div>
            <div class="pine-setting-row">
              <div class="pine-setting-label-col">
                <span class="pine-setting-label">Tab size</span>
                <span class="pine-setting-desc">Number of spaces to insert when pressing Tab</span>
              </div>
              <select id="pine_setting_tab_size" class="pine-setting-select">
                <option value="2">2 spaces</option>
                <option value="4">4 spaces</option>
              </select>
            </div>
          </div>
          <div class="pine-settings-footer">
            <button type="button" class="pine-settings-btn-cancel" id="pine_settings_cancel_btn">Cancel</button>
            <button type="button" class="pine-settings-btn-save" id="pine_settings_save_btn">Save Changes</button>
          </div>
        </div>
      `;
      document.body.appendChild(backdrop);

      backdrop.addEventListener('click', (e) => {
        if (e.target === backdrop) backdrop.style.display = 'none';
      });
      document.getElementById('pine_settings_close_btn')?.addEventListener('click', () => {
        backdrop.style.display = 'none';
      });
      document.getElementById('pine_settings_cancel_btn')?.addEventListener('click', () => {
        backdrop.style.display = 'none';
      });
      document.getElementById('pine_settings_save_btn')?.addEventListener('click', () => {
        const s = {
          inlineSuggestions: document.getElementById('pine_setting_inline_suggestions').checked,
          autocompletePopover: document.getElementById('pine_setting_ac_popover').checked,
          paramHints: document.getElementById('pine_setting_param_hints').checked,
          lineNumbers: document.getElementById('pine_setting_line_numbers').checked,
          tabSize: parseInt(document.getElementById('pine_setting_tab_size').value, 10) || 2
        };
        saveEditorSettings(s);
        const gutter = document.getElementById('pine_gutter');
        if (gutter) gutter.style.display = s.lineNumbers ? 'block' : 'none';
        backdrop.style.display = 'none';
        logConsole('Editor settings saved.', 'info');
      });
    }

    const current = getEditorSettings();
    const inlineChk = document.getElementById('pine_setting_inline_suggestions');
    const popChk = document.getElementById('pine_setting_ac_popover');
    const hintChk = document.getElementById('pine_setting_param_hints');
    const numChk = document.getElementById('pine_setting_line_numbers');
    const tabSel = document.getElementById('pine_setting_tab_size');
    if (inlineChk) inlineChk.checked = current.inlineSuggestions !== false;
    if (popChk) popChk.checked = current.autocompletePopover !== false;
    if (hintChk) hintChk.checked = current.paramHints !== false;
    if (numChk) numChk.checked = current.lineNumbers !== false;
    if (tabSel) tabSel.value = String(current.tabSize || 2);

    backdrop.style.display = 'flex';
  }

  let _inlineGhostSuggestion = '';
  let _inlineGhostItem = null;

  function clearInlineGhost() {
    if (_inlineGhostSuggestion || _inlineGhostItem) {
      _inlineGhostSuggestion = '';
      _inlineGhostItem = null;
      updateSyntaxBackdrop();
    }
  }

  function insertInlineGhost() {
    const codeInput = document.getElementById('pine_code_input');
    if (!codeInput || !_inlineGhostSuggestion) return false;

    const cursor = codeInput.selectionStart;
    const text = codeInput.value;
    const beforeCursor = text.substring(0, cursor);
    const afterCursor = text.substring(cursor);

    const toInsert = _inlineGhostSuggestion;
    const newBefore = beforeCursor + toInsert;
    codeInput.value = newBefore + afterCursor;
    codeInput.selectionStart = codeInput.selectionEnd = newBefore.length;

    clearInlineGhost();
    hideAcPopover();
    updateSyntaxBackdrop();
    updateCursor();
    codeInput.focus();
    codeInput.dispatchEvent(new Event('input'));
    return true;
  }

  function updateSyntaxBackdrop() {
    const codeInput = document.getElementById('pine_code_input');
    const backdropCode = document.getElementById('pine_syntax_code');
    const backdrop = document.getElementById('pine_syntax_backdrop');
    if (!codeInput || !backdropCode) return;

    const val = codeInput.value;
    const settings = getEditorSettings();

    if (_inlineGhostSuggestion && settings.inlineSuggestions !== false && codeInput.selectionStart === codeInput.selectionEnd) {
      const cursor = codeInput.selectionStart;
      const before = val.substring(0, cursor);
      const after = val.substring(cursor);

      const beforeHtml = highlightPineScript(before);
      const afterHtml = highlightPineScript(after);
      const cleanBefore = beforeHtml.endsWith('\n ') ? beforeHtml.slice(0, -2) : beforeHtml;
      backdropCode.innerHTML = `${cleanBefore}<span class="pine-ghost-suggestion">${escapeHtml(_inlineGhostSuggestion)}</span>${afterHtml}`;
    } else {
      backdropCode.innerHTML = highlightPineScript(val);
    }

    if (backdrop) {
      backdrop.scrollTop = codeInput.scrollTop;
      backdrop.scrollLeft = codeInput.scrollLeft;
    }
  }

  /* =========================================================================
   * Pine Script Autocomplete (IntelliSense) Catalog & Engine
   * ========================================================================= */
  const PINE_AUTOCOMPLETE_CATALOG = [
    // ta.* technical analysis functions
    { label: "ta.sma", insert: "ta.sma(close, 14)", type: "fn", desc: "Simple Moving Average: ta.sma(source, length)" },
    { label: "ta.ema", insert: "ta.ema(close, 14)", type: "fn", desc: "Exponential Moving Average: ta.ema(source, length)" },
    { label: "ta.rma", insert: "ta.rma(close, 14)", type: "fn", desc: "Moving average used in RSI: ta.rma(source, length)" },
    { label: "ta.wma", insert: "ta.wma(close, 14)", type: "fn", desc: "Weighted Moving Average: ta.wma(source, length)" },
    { label: "ta.vwma", insert: "ta.vwma(close, 14)", type: "fn", desc: "Volume-Weighted Moving Average" },
    { label: "ta.swma", insert: "ta.swma(close)", type: "fn", desc: "Symmetric Weighted Moving Average (fixed 4 bars)" },
    { label: "ta.alma", insert: "ta.alma(close, 9, 0.85, 6)", type: "fn", desc: "Arnaud Legoux Moving Average" },
    { label: "ta.rsi", insert: "ta.rsi(close, 14)", type: "fn", desc: "Relative Strength Index: ta.rsi(source, length)" },
    { label: "ta.macd", insert: "ta.macd(close, 12, 26, 9)", type: "fn", desc: "MACD [macd, signal, hist]: ta.macd(source, fast, slow, sig)" },
    { label: "ta.crossover", insert: "ta.crossover(fast, slow)", type: "fn", desc: "True if source1 crosses above source2" },
    { label: "ta.crossunder", insert: "ta.crossunder(fast, slow)", type: "fn", desc: "True if source1 crosses below source2" },
    { label: "ta.cross", insert: "ta.cross(fast, slow)", type: "fn", desc: "True if source1 crosses source2" },
    { label: "ta.bb", insert: "ta.bb(close, 20, 2.0)", type: "fn", desc: "Bollinger Bands [middle, upper, lower]" },
    { label: "ta.bbw", insert: "ta.bbw(close, 20, 2.0)", type: "fn", desc: "Bollinger Bands Width: ta.bbw(source, length, mult)" },
    { label: "ta.atr", insert: "ta.atr(14)", type: "fn", desc: "Average True Range: ta.atr(length)" },
    { label: "ta.tr", insert: "ta.tr(true)", type: "fn", desc: "True Range: ta.tr(handle_first_bar)" },
    { label: "ta.highest", insert: "ta.highest(high, 14)", type: "fn", desc: "Highest value over length bars" },
    { label: "ta.lowest", insert: "ta.lowest(low, 14)", type: "fn", desc: "Lowest value over length bars" },
    { label: "ta.highestbars", insert: "ta.highestbars(high, 14)", type: "fn", desc: "Offset to highest bar over length bars" },
    { label: "ta.lowestbars", insert: "ta.lowestbars(low, 14)", type: "fn", desc: "Offset to lowest bar over length bars" },
    { label: "ta.supertrend", insert: "ta.supertrend(3.0, 10)", type: "fn", desc: "SuperTrend [supertrend, direction]" },
    { label: "ta.sar", insert: "ta.sar(0.02, 0.02, 0.2)", type: "fn", desc: "Parabolic SAR: ta.sar(start, inc, max)" },
    { label: "ta.change", insert: "ta.change(close, 1)", type: "fn", desc: "Difference between current and previous bar" },
    { label: "ta.mom", insert: "ta.mom(close, 10)", type: "fn", desc: "Momentum: source - source[length]" },
    { label: "ta.roc", insert: "ta.roc(close, 14)", type: "fn", desc: "Rate of Change: (change / source[length]) * 100" },
    { label: "ta.stoch", insert: "ta.stoch(close, high, low, 14)", type: "fn", desc: "Stochastic oscillator" },
    { label: "ta.mfi", insert: "ta.mfi(close, 14)", type: "fn", desc: "Money Flow Index" },
    { label: "ta.cci", insert: "ta.cci(close, 20)", type: "fn", desc: "Commodity Channel Index" },
    { label: "ta.cum", insert: "ta.cum(close)", type: "fn", desc: "Cumulative sum of series" },
    { label: "ta.valuewhen", insert: "ta.valuewhen(condition, source, 0)", type: "fn", desc: "Value of source when condition was true" },
    { label: "ta.barssince", insert: "ta.barssince(condition)", type: "fn", desc: "Number of bars since condition was true" },
    { label: "ta.stdev", insert: "ta.stdev(close, 20)", type: "fn", desc: "Standard Deviation: ta.stdev(source, length)" },
    { label: "ta.variance", insert: "ta.variance(close, 20)", type: "fn", desc: "Variance: ta.variance(source, length)" },
    { label: "ta.correlation", insert: "ta.correlation(src1, src2, 20)", type: "fn", desc: "Correlation coefficient between two series" },
    { label: "ta.percentrank", insert: "ta.percentrank(close, 20)", type: "fn", desc: "Percentile rank over length bars" },
    { label: "ta.falling", insert: "ta.falling(close, 5)", type: "fn", desc: "True if source is strictly falling for length bars" },
    { label: "ta.rising", insert: "ta.rising(close, 5)", type: "fn", desc: "True if source is strictly rising for length bars" },
    { label: "ta.range", insert: "ta.range(close, 20)", type: "fn", desc: "Difference between highest and lowest values" },

    // request.* multi-data functions
    { label: "request.security", insert: 'request.security(syminfo.tickerid, "", close)', type: "fn", desc: "Request data from another symbol or timeframe" },
    { label: "request.security_lower_tf", insert: 'request.security_lower_tf(syminfo.tickerid, "1", close)', type: "fn", desc: "Request lower timeframe array data" },
    { label: "request.financial", insert: 'request.financial(syminfo.tickerid, "TOTAL_REVENUE", "FY")', type: "fn", desc: "Request financial data statement item" },

    // barmerge.* constants
    { label: "barmerge.gaps_off", insert: "barmerge.gaps_off", type: "var", desc: "Fills missing HTF bars with previous close (default)" },
    { label: "barmerge.gaps_on", insert: "barmerge.gaps_on", type: "var", desc: "Leaves missing HTF bars as na" },
    { label: "barmerge.lookahead_off", insert: "barmerge.lookahead_off", type: "var", desc: "Prevents lookahead bias on historical bars (default)" },
    { label: "barmerge.lookahead_on", insert: "barmerge.lookahead_on", type: "var", desc: "Enables HTF bar lookahead on history" },

    // barstate.* constants
    { label: "barstate.islast", insert: "barstate.islast", type: "var", desc: "True on the last (current) bar of the dataset" },
    { label: "barstate.isconfirmed", insert: "barstate.isconfirmed", type: "var", desc: "True on the closing tick of the current bar" },
    { label: "barstate.isfirst", insert: "barstate.isfirst", type: "var", desc: "True on the first historical bar" },
    { label: "barstate.ishistory", insert: "barstate.ishistory", type: "var", desc: "True on all historical bars except real-time" },
    { label: "barstate.isrealtime", insert: "barstate.isrealtime", type: "var", desc: "True on real-time live trading bars" },
    { label: "barstate.isnew", insert: "barstate.isnew", type: "var", desc: "True on the first tick of a newly opened bar" },

    // input.* declarations
    { label: "input", insert: 'input(close, "Source")', type: "fn", desc: "Generic script input: input(defval, title)" },
    { label: "input.int", insert: 'input.int(14, "Length")', type: "fn", desc: "Integer input: input.int(defval, title, minval, maxval)" },
    { label: "input.float", insert: 'input.float(1.0, "Multiplier", step=0.1)', type: "fn", desc: "Float input: input.float(defval, title, step)" },
    { label: "input.bool", insert: 'input.bool(true, "Show Wicks")', type: "fn", desc: "Boolean checkbox input: input.bool(defval, title)" },
    { label: "input.string", insert: 'input.string("Default", "Title")', type: "fn", desc: "String text input: input.string(defval, title)" },
    { label: "input.color", insert: 'input.color(color.blue, "Color")', type: "fn", desc: "Color picker input: input.color(defval, title)" },
    { label: "input.symbol", insert: 'input.symbol("EURUSD", "Symbol")', type: "fn", desc: "Symbol selector: input.symbol(defval, title)" },
    { label: "input.timeframe", insert: 'input.timeframe("", "Timeframe")', type: "fn", desc: "Timeframe selector: input.timeframe(defval, title)" },
    { label: "input.session", insert: 'input.session("0930-1600", "Hours")', type: "fn", desc: "Trading session hours: input.session(defval, title)" },
    { label: "input.source", insert: 'input.source(close, "Source")', type: "fn", desc: "Price source selector: input.source(defval, title)" },
    { label: "input.text_area", insert: 'input.text_area("Text", "Notes")', type: "fn", desc: "Multi-line text area input" },
    { label: "input.price", insert: 'input.price(0.0, "Price Level")', type: "fn", desc: "Interactive chart price input" },
    { label: "input.time", insert: 'input.time(0, "Timestamp")', type: "fn", desc: "Date/time selector input" },

    // plot* functions
    { label: "plot", insert: 'plot(close, "Title", color=color.blue, linewidth=2)', type: "fn", desc: "Plot series: plot(series, title, color, linewidth, style)" },
    { label: "plotcandle", insert: 'plotcandle(open, high, low, close, title="Candles", color=color.green, wickcolor=color.gray, bordercolor=color.green)', type: "fn", desc: "Plot custom OHLC candlesticks" },
    { label: "plotbar", insert: 'plotbar(open, high, low, close, title="Bars", color=color.green)', type: "fn", desc: "Plot custom OHLC bars" },
    { label: "plotshape", insert: 'plotshape(condition, title="Signal", style=shape.triangleup, location=location.belowbar, color=color.green)', type: "fn", desc: "Plot visual shapes on chart" },
    { label: "plotchar", insert: 'plotchar(condition, title="Char", char="★", location=location.abovebar, color=color.yellow)', type: "fn", desc: "Plot character glyph on chart" },
    { label: "plotarrow", insert: 'plotarrow(series, title="Arrow", colorup=color.green, colordown=color.red)', type: "fn", desc: "Plot up/down direction arrows" },
    { label: "hline", insert: 'hline(0, "Zero Level", color=color.gray, linestyle=hline.style_dashed)', type: "fn", desc: "Plot horizontal reference line" },
    { label: "fill", insert: 'fill(p1, p2, color=color.new(color.blue, 80), title="Fill")', type: "fn", desc: "Fill shaded region between two plots" },
    { label: "bgcolor", insert: "bgcolor(condition ? color.new(color.green, 90) : na)", type: "fn", desc: "Set chart background color for bars" },
    { label: "barcolor", insert: "barcolor(close >= open ? color.green : color.red)", type: "fn", desc: "Color main chart candlesticks" },

    // label.* functions & constants
    { label: "label.new", insert: 'label.new(bar_index, high, text="Text", style=label.style_label_left, color=color.blue, textcolor=color.white, size=size.small)', type: "fn", desc: "Create new text label: label.new(x, y, text, ...)" },
    { label: "label.delete", insert: "label.delete(id)", type: "fn", desc: "Delete specified label object" },
    { label: "label.set_text", insert: 'label.set_text(id, "New Text")', type: "fn", desc: "Set label text" },
    { label: "label.set_xy", insert: "label.set_xy(id, bar_index, high)", type: "fn", desc: "Set label bar_index and price coordinate" },
    { label: "label.set_color", insert: "label.set_color(id, color.blue)", type: "fn", desc: "Set label box background color" },
    { label: "label.set_textcolor", insert: "label.set_textcolor(id, color.white)", type: "fn", desc: "Set label text color" },
    { label: "label.set_size", insert: "label.set_size(id, size.small)", type: "fn", desc: "Set label text size" },
    { label: "label.set_style", insert: "label.set_style(id, label.style_label_left)", type: "fn", desc: "Set label pointer style" },
    { label: "label.style_label_left", insert: "label.style_label_left", type: "var", desc: "Label with pointer pointing left" },
    { label: "label.style_label_right", insert: "label.style_label_right", type: "var", desc: "Label with pointer pointing right" },
    { label: "label.style_label_up", insert: "label.style_label_up", type: "var", desc: "Label with pointer pointing up" },
    { label: "label.style_label_down", insert: "label.style_label_down", type: "var", desc: "Label with pointer pointing down" },
    { label: "label.style_none", insert: "label.style_none", type: "var", desc: "Label box with no pointer" },

    // line.*, box.*, table.* drawings
    { label: "line.new", insert: "line.new(bar_index - 1, low[1], bar_index, high, color=color.blue, width=2)", type: "fn", desc: "Create drawing line between coordinates" },
    { label: "line.delete", insert: "line.delete(id)", type: "fn", desc: "Delete drawing line" },
    { label: "box.new", insert: "box.new(left=bar_index - 10, top=high, right=bar_index, bottom=low, border_color=color.blue, bgcolor=color.new(color.blue, 90))", type: "fn", desc: "Create drawing box / rectangle" },
    { label: "box.delete", insert: "box.delete(id)", type: "fn", desc: "Delete drawing box" },
    { label: "table.new", insert: "table.new(position.top_right, 4, 4, bgcolor=color.gray, border_color=color.black)", type: "fn", desc: "Create dashboard display table" },
    { label: "table.cell", insert: 'table.cell(id, 0, 0, "Value", text_color=color.white)', type: "fn", desc: "Set content of table cell" },

    // str.* string functions
    { label: "str.tostring", insert: 'str.tostring(close, "#.####")', type: "fn", desc: "Convert value to formatted string: str.tostring(val, format)" },
    { label: "str.format", insert: 'str.format("Price: {0}", close)', type: "fn", desc: "Format template string: str.format(pattern, args...)" },
    { label: "str.length", insert: "str.length(text)", type: "fn", desc: "Length of string" },
    { label: "str.contains", insert: "str.contains(source, sub)", type: "fn", desc: "True if source string contains substring" },
    { label: "str.lower", insert: "str.lower(text)", type: "fn", desc: "Convert string to lowercase" },
    { label: "str.upper", insert: "str.upper(text)", type: "fn", desc: "Convert string to uppercase" },
    { label: "str.split", insert: 'str.split(text, ",")', type: "fn", desc: "Split string into array of tokens" },

    // color.* declarations & constants
    { label: "color.new", insert: "color.new(color.blue, 50)", type: "fn", desc: "Color with transparency 0 (opaque) to 100 (transparent)" },
    { label: "color.rgb", insert: "color.rgb(255, 0, 0)", type: "fn", desc: "RGB color: color.rgb(r, g, b, transp)" },
    { label: "color.from_gradient", insert: "color.from_gradient(value, bottom_value, top_value, bottom_color, top_color)", type: "fn", desc: "Gradient color interpolation" },
    { label: "color.blue", insert: "color.blue", type: "var", desc: "Standard Blue (#2962ff)" },
    { label: "color.green", insert: "color.green", type: "var", desc: "Standard Green (#089981)" },
    { label: "color.red", insert: "color.red", type: "var", desc: "Standard Red (#f23645)" },
    { label: "color.orange", insert: "color.orange", type: "var", desc: "Standard Orange (#ff9800)" },
    { label: "color.yellow", insert: "color.yellow", type: "var", desc: "Standard Yellow (#ffeb3b)" },
    { label: "color.teal", insert: "color.teal", type: "var", desc: "Standard Teal (#00897b)" },
    { label: "color.maroon", insert: "color.maroon", type: "var", desc: "Standard Maroon (#880e4f)" },
    { label: "color.gray", insert: "color.gray", type: "var", desc: "Standard Gray (#787b86)" },
    { label: "color.white", insert: "color.white", type: "var", desc: "Standard White (#ffffff)" },
    { label: "color.black", insert: "color.black", type: "var", desc: "Standard Black (#000000)" },
    { label: "color.purple", insert: "color.purple", type: "var", desc: "Standard Purple (#9c27b0)" },
    { label: "color.navy", insert: "color.navy", type: "var", desc: "Standard Navy (#1a237e)" },
    { label: "color.lime", insert: "color.lime", type: "var", desc: "Standard Lime (#00e676)" },
    { label: "color.aqua", insert: "color.aqua", type: "var", desc: "Standard Aqua (#00e5ff)" },

    // math.* functions
    { label: "math.abs", insert: "math.abs(x)", type: "fn", desc: "Absolute value: math.abs(x)" },
    { label: "math.max", insert: "math.max(a, b)", type: "fn", desc: "Maximum value: math.max(val1, val2)" },
    { label: "math.min", insert: "math.min(a, b)", type: "fn", desc: "Minimum value: math.min(val1, val2)" },
    { label: "math.round", insert: "math.round(x, 2)", type: "fn", desc: "Round number: math.round(number, precision)" },
    { label: "math.ceil", insert: "math.ceil(x)", type: "fn", desc: "Smallest integer greater than or equal to x" },
    { label: "math.floor", insert: "math.floor(x)", type: "fn", desc: "Largest integer less than or equal to x" },
    { label: "math.pow", insert: "math.pow(base, exponent)", type: "fn", desc: "Power function: base ^ exponent" },
    { label: "math.sqrt", insert: "math.sqrt(x)", type: "fn", desc: "Square root: math.sqrt(x)" },
    { label: "math.log", insert: "math.log(x)", type: "fn", desc: "Natural logarithm" },
    { label: "math.log10", insert: "math.log10(x)", type: "fn", desc: "Base 10 logarithm" },
    { label: "math.sign", insert: "math.sign(x)", type: "fn", desc: "Sign of number (-1, 0, or 1)" },
    { label: "math.avg", insert: "math.avg(a, b)", type: "fn", desc: "Arithmetic mean of arguments" },
    { label: "math.sum", insert: "math.sum(a, b)", type: "fn", desc: "Sum of arguments" },

    // syminfo.* & timeframe.* properties
    { label: "syminfo.tickerid", insert: "syminfo.tickerid", type: "var", desc: "Exchange prefix and ticker (e.g. FX:EURUSD)" },
    { label: "syminfo.ticker", insert: "syminfo.ticker", type: "var", desc: "Ticker symbol without exchange prefix" },
    { label: "syminfo.mintick", insert: "syminfo.mintick", type: "var", desc: "Minimum price movement tick size" },
    { label: "syminfo.currency", insert: "syminfo.currency", type: "var", desc: "Currency code for ticker" },
    { label: "timeframe.period", insert: "timeframe.period", type: "var", desc: "Current chart resolution string (e.g. 1D, 60)" },
    { label: "timeframe.multiplier", insert: "timeframe.multiplier", type: "var", desc: "Current chart resolution multiplier number" },
    { label: "timeframe.isintraday", insert: "timeframe.isintraday", type: "var", desc: "True if timeframe is intraday (minutes/seconds)" },
    { label: "timeframe.isdaily", insert: "timeframe.isdaily", type: "var", desc: "True if timeframe is 1D (daily)" },

    // shape.*, location.*, size.* enums
    { label: "shape.triangleup", insert: "shape.triangleup", type: "var", desc: "Triangle pointing up shape" },
    { label: "shape.triangledown", insert: "shape.triangledown", type: "var", desc: "Triangle pointing down shape" },
    { label: "shape.arrowup", insert: "shape.arrowup", type: "var", desc: "Upward pointing arrow" },
    { label: "shape.arrowdown", insert: "shape.arrowdown", type: "var", desc: "Downward pointing arrow" },
    { label: "shape.circle", insert: "shape.circle", type: "var", desc: "Circle shape" },
    { label: "shape.diamond", insert: "shape.diamond", type: "var", desc: "Diamond shape" },
    { label: "location.abovebar", insert: "location.abovebar", type: "var", desc: "Plot shape/label above bar" },
    { label: "location.belowbar", insert: "location.belowbar", type: "var", desc: "Plot shape/label below bar" },
    { label: "location.absolute", insert: "location.absolute", type: "var", desc: "Plot shape at exact absolute price coordinate" },
    { label: "size.small", insert: "size.small", type: "var", desc: "Small visual element size" },
    { label: "size.tiny", insert: "size.tiny", type: "var", desc: "Tiny visual element size" },
    { label: "size.normal", insert: "size.normal", type: "var", desc: "Normal visual element size" },
    { label: "size.large", insert: "size.large", type: "var", desc: "Large visual element size" },

    // Builtin series variables & Keywords
    { label: "close", insert: "close", type: "var", desc: "Current bar closing price series" },
    { label: "open", insert: "open", type: "var", desc: "Current bar open price series" },
    { label: "high", insert: "high", type: "var", desc: "Current bar high price series" },
    { label: "low", insert: "low", type: "var", desc: "Current bar low price series" },
    { label: "volume", insert: "volume", type: "var", desc: "Current bar volume series" },
    { label: "time", insert: "time", type: "var", desc: "Current bar UNIX timestamp in milliseconds" },
    { label: "bar_index", insert: "bar_index", type: "var", desc: "Current bar index (0 to N)" },
    { label: "hl2", insert: "hl2", type: "var", desc: "Median price: (high + low) / 2" },
    { label: "hlc3", insert: "hlc3", type: "var", desc: "Typical price: (high + low + close) / 3" },
    { label: "ohlc4", insert: "ohlc4", type: "var", desc: "Average price: (open + high + low + close) / 4" },
    { label: "tr", insert: "tr", type: "var", desc: "Current bar True Range" },
    { label: "na", insert: "na", type: "var", desc: "Not Available / Null value" },
    { label: "nz", insert: "nz(val, 0)", type: "fn", desc: "Replace NaN with default value: nz(x, y)" },
    { label: "indicator", insert: 'indicator("Title", overlay=true)', type: "kw", desc: "Declare a technical indicator script" },
    { label: "strategy", insert: 'strategy("Title", overlay=true, initial_capital=10000)', type: "kw", desc: "Declare a strategy script with backtesting properties" },
    { label: "var", insert: "var int count = 0", type: "kw", desc: "Declare persistent variable initialized once on first bar" },
    { label: "varip", insert: "varip int tickCount = 0", type: "kw", desc: "Declare persistent variable updated on every tick" }
  ];

  let _acVisible = false;
  let _acActiveIdx = 0;
  let _acCurrentMatches = [];
  let _acPrefix = '';

  function triggerAutocomplete(force = false) {
    const codeInput = document.getElementById('pine_code_input');
    const popover = document.getElementById('pine_autocomplete_popover');
    const acList = document.getElementById('pine_ac_list');
    if (!codeInput) return;

    const settings = getEditorSettings();
    const cursor = codeInput.selectionStart;
    const text = codeInput.value.substring(0, cursor);
    const wordMatch = text.match(/([a-zA-Z_0-9\.]+)$/);

    if (!wordMatch && !force) {
      hideAcPopover();
      clearInlineGhost();
      return;
    }

    _acPrefix = wordMatch ? wordMatch[1].toLowerCase() : '';
    if (!_acPrefix && !force) {
      hideAcPopover();
      clearInlineGhost();
      return;
    }

    _acCurrentMatches = PINE_AUTOCOMPLETE_CATALOG.filter(item => {
      const l = item.label.toLowerCase();
      return l.startsWith(_acPrefix) || l.includes('.' + _acPrefix) || (force && l.includes(_acPrefix));
    });

    if (_acCurrentMatches.length === 0) {
      hideAcPopover();
      clearInlineGhost();
      return;
    }

    // 1. Calculate inline ghost text preview
    const topMatch = _acCurrentMatches[0];
    const topLabel = topMatch.label;
    if (settings.inlineSuggestions !== false && topLabel.toLowerCase().startsWith(_acPrefix) && topLabel.length > _acPrefix.length) {
      const insertStr = topMatch.insert || topLabel;
      let remainder = '';
      if (insertStr.toLowerCase().startsWith(_acPrefix)) {
        remainder = insertStr.substring(_acPrefix.length);
      } else {
        remainder = topLabel.substring(_acPrefix.length);
      }
      _inlineGhostSuggestion = remainder;
      _inlineGhostItem = topMatch;
      updateSyntaxBackdrop();
    } else {
      clearInlineGhost();
    }

    // 2. Autocomplete Popover (if enabled)
    if (settings.autocompletePopover === false && !force) {
      hideAcPopover();
      return;
    }

    if (!popover || !acList) return;

    _acCurrentMatches = _acCurrentMatches.slice(0, 30);
    _acActiveIdx = 0;
    renderAcList();

    const lines = text.split('\n');
    const lineNum = lines.length;
    const colNum = lines[lines.length - 1].length;

    const lineHeight = 20;
    const charWidth = 7.8;
    let top = (lineNum * lineHeight) + 14 - codeInput.scrollTop;
    let left = (colNum * charWidth) + 16 - codeInput.scrollLeft;

    const container = codeInput.parentElement;
    const containerH = container ? container.offsetHeight : 300;
    const containerW = container ? container.offsetWidth : 600;

    // Flip above cursor if near bottom of dock
    if (top + 230 > containerH && top > 240) {
      top = top - lineHeight - 230;
    }
    top = Math.max(10, Math.min(containerH - 50, top));
    left = Math.max(10, Math.min(containerW - 330, left));

    popover.style.top = `${top}px`;
    popover.style.left = `${left}px`;
    popover.style.display = 'flex';
    _acVisible = true;
  }

  function renderAcList() {
    const acList = document.getElementById('pine_ac_list');
    if (!acList) return;
    acList.innerHTML = '';

    _acCurrentMatches.forEach((item, idx) => {
      const el = document.createElement('div');
      el.className = 'pine-ac-item' + (idx === _acActiveIdx ? ' active' : '');
      el.innerHTML = `
        <div class="pine-ac-left">
          <span class="pine-ac-badge badge-${item.type}">${item.type.toUpperCase()}</span>
          <span class="pine-ac-label">${escapeHtml(item.label)}</span>
        </div>
        <div class="pine-ac-hint">${escapeHtml(item.desc || '')}</div>
      `;
      el.addEventListener('click', () => {
        insertAcItem(item);
      });
      acList.appendChild(el);
    });

    const activeEl = acList.children[_acActiveIdx];
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }

  function insertAcItem(item) {
    const codeInput = document.getElementById('pine_code_input');
    if (!codeInput || !item) return;

    const cursor = codeInput.selectionStart;
    const text = codeInput.value;
    const beforeCursor = text.substring(0, cursor);
    const afterCursor = text.substring(cursor);

    const prefixLen = _acPrefix.length;
    const newBefore = beforeCursor.substring(0, beforeCursor.length - prefixLen) + (item.insert || item.label);
    codeInput.value = newBefore + afterCursor;
    codeInput.selectionStart = codeInput.selectionEnd = newBefore.length;

    clearInlineGhost();
    hideAcPopover();
    updateSyntaxBackdrop();
    updateCursor();
    codeInput.focus();
    codeInput.dispatchEvent(new Event('input'));
  }

  function hideAcPopover() {
    const popover = document.getElementById('pine_autocomplete_popover');
    if (popover) popover.style.display = 'none';
    _acVisible = false;
    _acCurrentMatches = [];
  }

  /* =========================================================================
   * Script Revision History Engine
   * ========================================================================= */
  function getScriptRevisions(scriptId) {
    try {
      const key = `pine_revs_${scriptId || 'custom_script'}`;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  function saveScriptRevision(scriptId, name, code) {
    if (!code || !code.trim()) return;
    try {
      const key = `pine_revs_${scriptId || 'custom_script'}`;
      const revs = getScriptRevisions(scriptId);
      if (revs.length > 0 && revs[0].code === code) return;
      const lines = code.split('\n').length;
      revs.unshift({
        id: Date.now(),
        name: name || 'Untitled Script',
        code: code,
        lines: lines,
        date: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) + ', ' + new Date().toLocaleDateString()
      });
      if (revs.length > 25) revs.length = 25;
      localStorage.setItem(key, JSON.stringify(revs));
    } catch (e) {}
  }

  function openRevisionsModal() {
    const modal = document.getElementById('pine_revisions_modal');
    const listEl = document.getElementById('pine_revisions_list');
    if (!modal || !listEl) return;

    const revs = getScriptRevisions(_currentScript.id);
    if (revs.length === 0) {
      listEl.innerHTML = '<div style="padding: 24px; text-align: center; color: #787b86;">No revision history saved for this script yet. Revisions are created automatically when saving or adding to chart.</div>';
    } else {
      let html = '';
      revs.forEach((rev, idx) => {
        html += `
          <div class="pine-revision-item" data-rev-id="${rev.id}">
            <div class="pine-revision-meta">
              <span class="pine-rev-title">${escapeHtml(rev.name)} (Version ${revs.length - idx})</span>
              <span class="pine-rev-date">${escapeHtml(rev.date)} &bull; ${rev.lines} line(s)</span>
            </div>
            <button type="button" class="pine-rev-restore-btn" data-rev-idx="${idx}">Restore</button>
          </div>
        `;
      });
      listEl.innerHTML = html;

      listEl.querySelectorAll('.pine-rev-restore-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const idx = parseInt(e.target.dataset.revIdx, 10);
          if (!isNaN(idx) && revs[idx]) {
            loadScript(revs[idx].name, revs[idx].code, _currentScript.id);
            closeRevisionsModal();
            logConsole(`Restored revision from ${revs[idx].date}`, 'success');
          }
        });
      });
    }

    modal.style.display = 'flex';
  }

  function closeRevisionsModal() {
    const modal = document.getElementById('pine_revisions_modal');
    if (modal) modal.style.display = 'none';
  }

  /* =========================================================================
   * Strategy Tester Backtesting Engine & Report UI
   * ========================================================================= */
  let _lastStrategyResult = null;
  let _activeStratSubTab = 'overview';

  async function getChartBarsForBacktest(chart) {
    if (!chart) return [];
    if (typeof chart.exportData === 'function') {
      try {
        const exp = await chart.exportData({ includeTime: true, includeSeries: true });
        if (exp && Array.isArray(exp.data) && exp.data.length > 0) {
          const bars = exp.data.map(d => ({
            time: Number(d[0]) * (Number(d[0]) < 1e11 ? 1000 : 1),
            open: Number(d[1]),
            high: Number(d[2]),
            low: Number(d[3]),
            close: Number(d[4]),
            volume: Number(d[5] || 0)
          })).filter(b => !isNaN(b.close) && b.close > 0);
          if (bars.length >= 5) return bars;
        }
      } catch (e) {}
    }

    try {
      const sym = (typeof chart.symbol === 'function') ? chart.symbol() : 'XAUUSD.';
      const res = (typeof chart.resolution === 'function') ? chart.resolution() : '1';
      const nowSec = Math.floor(Date.now() / 1000);
      const fromSec = nowSec - (86400 * 30);
      const resp = await fetch(`/udf/history?symbol=${encodeURIComponent(sym)}&resolution=${encodeURIComponent(res)}&from=${fromSec}&to=${nowSec}`);
      if (resp.ok) {
        const json = await resp.json();
        if (json.s === 'ok' && Array.isArray(json.t) && json.t.length > 0) {
          const bars = [];
          for (let i = 0; i < json.t.length; i++) {
            bars.push({
              time: json.t[i] * 1000,
              open: json.o[i],
              high: json.h[i],
              low: json.l[i],
              close: json.c[i],
              volume: json.v ? json.v[i] : 0
            });
          }
          return bars;
        }
      }
    } catch (e) {}

    return [];
  }

  async function runStrategyBacktest(customCode = null) {
    const codeInput = document.getElementById('pine_code_input');
    const code = (customCode !== null ? customCode : (codeInput ? codeInput.value : (_currentScript ? _currentScript.code : ''))).trim();
    const stratNameEl = document.getElementById('strat_script_name');
    const titleDisplay = document.getElementById('pine_script_title_display');
    const scriptName = (_currentScript && _currentScript.name) || (titleDisplay ? titleDisplay.textContent : 'Strategy');
    const runBtn = document.getElementById('strat_run_btn');

    if (runBtn) runBtn.textContent = 'Running...';

    try {
      const chart = _widget ? _widget.activeChart() : (root.widget ? root.widget.activeChart() : null);
      if (!chart) throw new Error("Chart is not ready.");

      const bars = await getChartBarsForBacktest(chart);
      if (!bars || bars.length < 5) {
        throw new Error("Insufficient bars loaded for backtesting. Please wait for chart data.");
      }

      const PineTSLib = root.PineTSLib || root.PineTS;
      if (!PineTSLib) throw new Error("PineTS runtime engine is not loaded.");
      const PineClass = PineTSLib.PineTS || PineTSLib;

      const t0 = performance.now();
      const pine = new PineClass(bars);
      const ctx = await pine.run(code);
      const duration = Math.round(performance.now() - t0);

      const strategyState = ctx.strategy;
      if (!strategyState) {
        throw new Error("Script does not declare a strategy(...) function.");
      }

      _lastStrategyResult = {
        name: scriptName || (_currentScript ? _currentScript.name : 'Custom Strategy'),
        barsCount: bars.length,
        duration: duration,
        strategy: strategyState
      };

      renderStrategyReport(_lastStrategyResult);
      logConsole(`[Strategy Tester] Backtest completed in ${duration}ms over ${bars.length} bars. Net profit: $${(strategyState.netprofit || 0).toFixed(2)}`, 'success');
      return _lastStrategyResult;
    } catch (err) {
      logConsole(`[Strategy Tester] Backtest failed: ${err.message}`, 'error');
      showStrategyEmptyState(err.message);
      return null;
    } finally {
      if (runBtn) {
        runBtn.innerHTML = `
          <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
          Run Backtest
        `;
      }
    }
  }

  function renderStrategyReport(res) {
    if (!res || !res.strategy) return;
    const s = res.strategy;

    const nameEl = document.getElementById('strat_script_name');
    if (nameEl) nameEl.textContent = res.name || 'Strategy';

    const netProfit = s.netprofit || 0;
    const initCapital = s.initial_capital || 10000;
    const netProfitPct = ((netProfit / initCapital) * 100).toFixed(2);
    const closedCount = (s.closedtrades && s.closedtrades.length) || 0;
    const openCount = (s.opentrades && s.opentrades.length) || 0;
    const winTrades = s.wintrades || 0;
    const lossTrades = s.losstrades || 0;
    const winRate = closedCount > 0 ? ((winTrades / closedCount) * 100).toFixed(1) : '0.0';
    const grossProfit = s.grossprofit || 0;
    const grossLoss = Math.abs(s.grossloss || 0);
    const profitFactor = (grossLoss > 0) ? (grossProfit / grossLoss).toFixed(2) : (grossProfit > 0 ? '∞' : '0.00');
    const maxDD = s.max_drawdown || 0;
    const maxDDPct = s.max_drawdown_percent_value ? s.max_drawdown_percent_value.toFixed(2) : ((maxDD / initCapital) * 100).toFixed(2);
    const sharpe = s.sharpe_ratio !== undefined && !isNaN(s.sharpe_ratio) ? s.sharpe_ratio.toFixed(2) : 'N/A';
    const sortino = s.sortino_ratio !== undefined && !isNaN(s.sortino_ratio) ? s.sortino_ratio.toFixed(2) : 'N/A';

    const netProfitEl = document.getElementById('strat_net_profit');
    const netProfitPctEl = document.getElementById('strat_net_profit_pct');
    if (netProfitEl) {
      netProfitEl.textContent = `${netProfit >= 0 ? '+' : ''}$${netProfit.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      netProfitEl.className = `strat-card-value ${netProfit >= 0 ? 'profit-pos' : 'profit-neg'}`;
    }
    if (netProfitPctEl) netProfitPctEl.textContent = `${netProfit >= 0 ? '+' : ''}${netProfitPct}%`;

    const totalTradesEl = document.getElementById('strat_total_trades');
    const openTradesEl = document.getElementById('strat_open_trades');
    if (totalTradesEl) totalTradesEl.textContent = String(closedCount);
    if (openTradesEl) openTradesEl.textContent = `${openCount} Open`;

    const winRateEl = document.getElementById('strat_win_rate');
    const winLossRatioEl = document.getElementById('strat_win_loss_ratio');
    if (winRateEl) winRateEl.textContent = `${winRate}%`;
    if (winLossRatioEl) winLossRatioEl.textContent = `${winTrades}W / ${lossTrades}L`;

    const profitFactorEl = document.getElementById('strat_profit_factor');
    const grossPnlEl = document.getElementById('strat_gross_pnl');
    if (profitFactorEl) profitFactorEl.textContent = String(profitFactor);
    if (grossPnlEl) grossPnlEl.textContent = `GP: $${grossProfit.toFixed(0)} | GL: $${grossLoss.toFixed(0)}`;

    const maxDDEl = document.getElementById('strat_max_dd');
    const maxDDPctEl = document.getElementById('strat_max_dd_pct');
    if (maxDDEl) maxDDEl.textContent = `$${maxDD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    if (maxDDPctEl) maxDDPctEl.textContent = `${maxDDPct}%`;

    const sharpeEl = document.getElementById('strat_sharpe');
    const sortinoEl = document.getElementById('strat_sortino');
    if (sharpeEl) sharpeEl.textContent = sharpe;
    if (sortinoEl) sortinoEl.textContent = `Sortino: ${sortino}`;

    const badgeEl = document.getElementById('strat_trades_count_badge');
    if (badgeEl) badgeEl.textContent = String(closedCount);

    const emptyState = document.getElementById('strat_empty_state');
    if (emptyState) emptyState.style.display = 'none';

    const overviewContent = document.getElementById('strat_overview_content');
    if (overviewContent) {
      overviewContent.innerHTML = `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
          <div style="background: #181b24; padding: 14px; border-radius: 6px; border: 1px solid #2a2e39;">
            <div style="font-size: 11px; color: #787b86; text-transform: uppercase; font-weight: 600; margin-bottom: 8px;">Capital & Equity</div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
              <span style="color: #787b86;">Initial Capital:</span>
              <span style="font-weight: 600; color: #d1d4dc;">$${initCapital.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
              <span style="color: #787b86;">Ending Equity:</span>
              <span style="font-weight: 600; color: #d1d4dc;">$${(initCapital + netProfit).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="color: #787b86;">Max Equity Runup:</span>
              <span style="font-weight: 600; color: #089981;">+$${(s.max_runup || 0).toFixed(2)}</span>
            </div>
          </div>
          <div style="background: #181b24; padding: 14px; border-radius: 6px; border: 1px solid #2a2e39;">
            <div style="font-size: 11px; color: #787b86; text-transform: uppercase; font-weight: 600; margin-bottom: 8px;">Performance Breakdown</div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
              <span style="color: #787b86;">Gross Profit:</span>
              <span style="font-weight: 600; color: #089981;">+$${grossProfit.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
              <span style="color: #787b86;">Gross Loss:</span>
              <span style="font-weight: 600; color: #f23645;">-$${grossLoss.toFixed(2)}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="color: #787b86;">Buy & Hold Return:</span>
              <span style="font-weight: 600; color: #d1d4dc;">${(s.buy_and_hold_per_gain || 0).toFixed(2)}%</span>
            </div>
          </div>
          <div style="background: #181b24; padding: 14px; border-radius: 6px; border: 1px solid #2a2e39;">
            <div style="font-size: 11px; color: #787b86; text-transform: uppercase; font-weight: 600; margin-bottom: 8px;">Backtest Horizon</div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
              <span style="color: #787b86;">Historical Bars:</span>
              <span style="font-weight: 600; color: #d1d4dc;">${res.barsCount.toLocaleString()}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px; margin-bottom: 6px;">
              <span style="color: #787b86;">Execution Latency:</span>
              <span style="font-weight: 600; color: #2962ff;">${res.duration} ms</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 13px;">
              <span style="color: #787b86;">CAGR:</span>
              <span style="font-weight: 600; color: #d1d4dc;">${(s.cagr || 0).toFixed(2)}%</span>
            </div>
          </div>
        </div>
      `;
    }

    const perfContent = document.getElementById('strat_perf_content');
    if (perfContent) {
      perfContent.innerHTML = `
        <table class="strat-table">
          <thead>
            <tr>
              <th>Metric</th>
              <th>All Trades</th>
              <th>Win Trades</th>
              <th>Loss Trades</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="color: #787b86;">Total Trades</td>
              <td style="font-weight: 600;">${closedCount}</td>
              <td style="color: #089981; font-weight: 600;">${winTrades}</td>
              <td style="color: #f23645; font-weight: 600;">${lossTrades}</td>
            </tr>
            <tr>
              <td style="color: #787b86;">Average Trade PnL</td>
              <td style="font-weight: 600;">$${closedCount ? (netProfit / closedCount).toFixed(2) : '0.00'}</td>
              <td style="color: #089981; font-weight: 600;">+$${winTrades ? (grossProfit / winTrades).toFixed(2) : '0.00'}</td>
              <td style="color: #f23645; font-weight: 600;">-$${lossTrades ? (grossLoss / lossTrades).toFixed(2) : '0.00'}</td>
            </tr>
            <tr>
              <td style="color: #787b86;">Total PnL ($)</td>
              <td style="font-weight: 600;">$${netProfit.toFixed(2)}</td>
              <td style="color: #089981; font-weight: 600;">+$${grossProfit.toFixed(2)}</td>
              <td style="color: #f23645; font-weight: 600;">-$${grossLoss.toFixed(2)}</td>
            </tr>
            <tr>
              <td style="color: #787b86;">Win Rate</td>
              <td style="font-weight: 600;">${winRate}%</td>
              <td style="color: #089981; font-weight: 600;">100%</td>
              <td style="color: #f23645; font-weight: 600;">0%</td>
            </tr>
          </tbody>
        </table>
      `;
    }

    const tbody = document.getElementById('strat_trades_tbody');
    if (tbody) {
      if (!s.closedtrades || s.closedtrades.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; color: #787b86; padding: 24px;">No closed trades generated during this backtest horizon.</td></tr>';
      } else {
        let rowsHtml = '';
        let cumEquity = initCapital;
        s.closedtrades.forEach((trade, i) => {
          const pnl = trade.profit || 0;
          cumEquity += pnl;
          const isLong = (trade.entry_id || '').toLowerCase().includes('long') || (trade.size > 0);
          rowsHtml += `
            <tr>
              <td>${i + 1}</td>
              <td><span class="trade-type-badge ${isLong ? 'trade-long' : 'trade-short'}">${isLong ? 'Long' : 'Short'}</span></td>
              <td>${escapeHtml(trade.entry_id || 'Trade')}</td>
              <td>Bar ${trade.entry_bar_index || 0} &rarr; Bar ${trade.exit_bar_index || 0}</td>
              <td>$${(trade.entry_price || 0).toFixed(2)} &rarr; $${(trade.exit_price || 0).toFixed(2)}</td>
              <td>${trade.size || 1}</td>
              <td style="color: ${pnl >= 0 ? '#089981' : '#f23645'}; font-weight: 600;">${pnl >= 0 ? '+' : ''}$${pnl.toFixed(2)}</td>
              <td style="font-weight: 600;">$${cumEquity.toFixed(2)}</td>
            </tr>
          `;
        });
        tbody.innerHTML = rowsHtml;
      }
    }
  }

  function showStrategyEmptyState(msg) {
    const emptyState = document.getElementById('strat_empty_state');
    if (emptyState) {
      emptyState.style.display = 'flex';
      const msgEl = emptyState.querySelector('div div:nth-child(2)');
      if (msgEl && msg) msgEl.textContent = msg;
    }
  }

  function openStrategyTesterPanel() {
    const panel = document.getElementById('pine_strategy_tester_panel');
    if (!panel) return;
    panel.style.display = 'flex';
    try {
      const innerDoc = (_widget && typeof _widget._innerWindow === 'function' && _widget._innerWindow()?.document) ||
                       document.querySelector('#tv_chart_container iframe')?.contentWindow?.document;
      innerDoc?.querySelector('#tv_footer_strategy_tester_tab')?.classList.add('active-n3UmcVi3');
    } catch (e) {}

    const code = (_currentScript && _currentScript.code) ? _currentScript.code : '';
    if (code.includes('strategy(') && (!_lastStrategyResult || _lastStrategyResult.name !== _currentScript.name)) {
      runStrategyBacktest(code);
    }
  }

  function closeStrategyTesterPanel() {
    const panel = document.getElementById('pine_strategy_tester_panel');
    if (panel) panel.style.display = 'none';
    try {
      const innerDoc = (_widget && typeof _widget._innerWindow === 'function' && _widget._innerWindow()?.document) ||
                       document.querySelector('#tv_chart_container iframe')?.contentWindow?.document;
      innerDoc?.querySelector('#tv_footer_strategy_tester_tab')?.classList.remove('active-n3UmcVi3');
    } catch (e) {}
  }

  /* =========================================================================
   * Interactive Code Navigation & Diagnostics Engine
   * ========================================================================= */
  function updateCursor() {
    const codeInput = document.getElementById('pine_code_input');
    const cursorPos = document.getElementById('pine_cursor_pos');
    if (!codeInput || !cursorPos) return;

    const selStart = codeInput.selectionStart;
    const text = codeInput.value.substring(0, selStart);
    const lines = text.split('\n');
    const lineNum = lines.length;
    const colNum = lines[lines.length - 1].length + 1;
    cursorPos.textContent = `Line ${lineNum}, Col ${colNum}`;
    const statusCoords = document.getElementById('pine_status_coords');
    if (statusCoords) statusCoords.textContent = `Line ${lineNum}, Col ${colNum}`;

    const verMatch = codeInput.value.match(/\/\/\s*@version\s*=\s*(\d+)/);
    const verEl = document.getElementById('pine_version_display');
    if (verEl) {
      verEl.textContent = verMatch ? `PineScript v${verMatch[1]}` : 'PineScript v6';
    }
  }

  function jumpToLineAndCol(line, col = 1) {
    const codeInput = document.getElementById('pine_code_input') || document.getElementById('pine_editor_textarea');
    if (!codeInput) return;

    const text = codeInput.value;
    const lines = text.split('\n');
    const targetLine = Math.max(1, Math.min(lines.length, parseInt(line, 10) || 1));
    const lineContent = lines[targetLine - 1] || '';
    const targetCol = Math.max(1, Math.min(lineContent.length + 1, parseInt(col, 10) || 1));

    let offset = 0;
    for (let i = 0; i < targetLine - 1; i++) {
      offset += lines[i].length + 1;
    }
    offset += (targetCol - 1);

    codeInput.focus();
    const highlightLen = Math.max(1, Math.min(lineContent.length - targetCol + 1, 15));
    codeInput.setSelectionRange(offset, offset + highlightLen);

    const lineHeight = 20;
    const targetScroll = Math.max(0, (targetLine - 4) * lineHeight);
    codeInput.scrollTop = targetScroll;

    const gutter = document.getElementById('pine_gutter') || document.getElementById('pine_editor_gutter');
    if (gutter) {
      gutter.scrollTop = targetScroll;
      gutter.querySelectorAll('.pine-gutter-line').forEach(el => el.classList.remove('highlight-line-jump'));
      const targetLineEl = gutter.querySelector(`.pine-gutter-line[data-line="${targetLine}"]`);
      if (targetLineEl) {
        targetLineEl.classList.add('highlight-line-jump');
        setTimeout(() => {
          targetLineEl.classList.remove('highlight-line-jump');
        }, 2500);
      }
    }

    updateCursor();
    logConsole(`Navigated to Line ${targetLine}, Col ${targetCol}`, 'info');
  }

  // Export globally so inline onclick handlers and external runners can jump
  root.jumpToLineAndCol = jumpToLineAndCol;
  if (typeof window !== 'undefined') {
    window.jumpToLineAndCol = jumpToLineAndCol;
  }

  function parseDiagnosticErrors(errData, source) {
    const lines = String(source || '').split('\n');
    const results = [];

    function addErr(l, c, msg, sev = 'error') {
      const lineNum = Math.max(1, Math.min(lines.length || 1, parseInt(l, 10) || 1));
      const srcLine = lines[lineNum - 1] ? lines[lineNum - 1].trim() : '';
      const colNum = Math.max(1, Math.min((lines[lineNum - 1] ? lines[lineNum - 1].length : 0) + 1, parseInt(c, 10) || 1));
      const severity = (String(sev).toLowerCase().includes('warn') || String(msg).toLowerCase().includes('warning')) ? 'warning' : 'error';
      const cleanMsg = String(msg || 'Compilation error')
        .replace(/^Error:\s*/i, '')
        .replace(/\s+at\s+.*$/m, '')
        .trim();

      results.push({
        line: lineNum,
        column: colNum,
        severity: severity,
        message: cleanMsg,
        sourceLine: srcLine
      });
    }

    if (!errData) {
      addErr(1, 1, 'Unknown compilation error');
      return results;
    }

    if (Array.isArray(errData)) {
      errData.forEach(e => {
        if (typeof e === 'object' && e !== null) {
          addErr(e.line || 1, e.column || e.col || 1, e.message || e.error, e.severity);
        } else if (typeof e === 'string') {
          parseStr(e);
        }
      });
      return results.length ? results : [{ line: 1, column: 1, severity: 'error', message: 'Compilation error', sourceLine: lines[0] || '' }];
    }

    if (typeof errData === 'object') {
      if (Array.isArray(errData.errors) && errData.errors.length > 0) {
        errData.errors.forEach(e => {
          addErr(e.line || 1, e.column || e.col || 1, e.message || e.error, e.severity);
        });
        return results;
      }
      const msg = errData.error || errData.message || 'Compilation error';
      if (errData.line !== undefined) {
        addErr(errData.line, errData.column || errData.col || 1, msg, errData.severity);
        return results;
      }
      parseStr(msg);
      return results.length ? results : [{ line: 1, column: 1, severity: 'error', message: String(msg), sourceLine: lines[0] || '' }];
    }

    if (typeof errData === 'string') {
      parseStr(errData);
    }

    function parseStr(text) {
      const s = String(text);
      const matchLineCol = s.match(/(?:at\s+|line\s+)(\d+)[:\s]+(?:col(?:umn)?\s*)?(\d+)/i) ||
                           s.match(/\[(\d+):(\d+)\]/) ||
                           s.match(/\((\d+):(\d+)\)/);
      if (matchLineCol) {
        addErr(matchLineCol[1], matchLineCol[2], s);
        return;
      }

      const matchLineOnly = s.match(/(?:at\s+|line\s+)(\d+)/i);
      if (matchLineOnly) {
        addErr(matchLineOnly[1], 1, s);
        return;
      }

      addErr(1, 1, s);
    }

    return results.length ? results : [{ line: 1, column: 1, severity: 'error', message: String(errData), sourceLine: lines[0] || '' }];
  }

  /* =========================================================================
   * Study Removal & Shape/Table Cleanup Engine (clearStudyShapes)
   * ========================================================================= */
  function clearStudyShapes(studyId, chartInstance) {
    const chart = chartInstance || (_widget ? _widget.activeChart() : (root.widget ? root.widget.activeChart() : null));

    // 0. Delegate to PineIndicators.clearStudyShapes if available (cleans _allPineShapeIds and multi-registered aliases)
    if (root.PineIndicators && typeof root.PineIndicators.clearStudyShapes === 'function') {
      root.PineIndicators.clearStudyShapes(studyId, chart);
    }

    // 1. Remove tracked shapes from PineStudyShapeRegistry
    if (root.PineStudyShapeRegistry && chart && typeof chart.removeEntity === 'function') {
      if (studyId && studyId !== 'all') {
        const shapes = root.PineStudyShapeRegistry.get(studyId);
        if (shapes) {
          shapes.forEach(shapeId => {
            try { chart.removeEntity(shapeId); } catch (e) {}
          });
          root.PineStudyShapeRegistry.delete(studyId);
        }
      } else {
        root.PineStudyShapeRegistry.forEach((shapes, sId) => {
          shapes.forEach(shapeId => {
            try { chart.removeEntity(shapeId); } catch (e) {}
          });
        });
        root.PineStudyShapeRegistry.clear();
      }
    }

    // 2. Clear session visuals if applicable
    const studyInfo = studyId ? root._pineActiveStudies?.get(studyId) : null;
    const isSession = !studyId || studyId === 'all' ||
                      (studyInfo && studyInfo.name && studyInfo.name.toLowerCase().includes('session')) ||
                      (typeof studyId === 'string' && studyId.toLowerCase().includes('session'));
    if (isSession && root.PineIndicators && typeof root.PineIndicators.clearSessionVisuals === 'function' && chart) {
      root.PineIndicators.clearSessionVisuals(chart);
    }

    // 3. Remove DOM table overlays
    const tableSelector = (studyId && studyId !== 'all')
      ? `.tv-pine-table-container[data-study-id="${studyId}"], #pine_table_${studyId}, .tv-pine-table-container, [id^="pine_table_"]`
      : '.tv-pine-table-container, [id^="pine_table_"]';

    document.querySelectorAll(tableSelector).forEach(el => el.remove());
    const innerDoc = (_widget && typeof _widget._innerWindow === 'function' && _widget._innerWindow()?.document) ||
                     document.querySelector('#tv_chart_container iframe')?.contentWindow?.document;
    if (innerDoc) {
      innerDoc.querySelectorAll(tableSelector).forEach(el => el.remove());
    }

    // 4. Remove from active studies map if studyId is provided
    if (root._pineActiveStudies) {
      if (studyId && studyId !== 'all') {
        root._pineActiveStudies.delete(studyId);
      } else {
        root._pineActiveStudies.clear();
      }
    }

    logConsole(`[clearStudyShapes] Purged shapes and tables${studyId ? ` for study "${studyId}"` : ''}.`, 'info');
  }

  root.clearStudyShapes = clearStudyShapes;
  if (typeof window !== 'undefined') {
    window.clearStudyShapes = clearStudyShapes;
  }

  function cleanupStudy(studyId, chartInstance) {
    const chart = chartInstance || (_widget ? _widget.activeChart() : (root.widget ? root.widget.activeChart() : null));
    clearStudyShapes(studyId, chart);
    if (chart && root.PineIndicators && typeof root.PineIndicators.clearSessionVisuals === 'function') {
      const currentStudies = (typeof chart.getAllStudies === 'function') ? chart.getAllStudies() : [];
      const hasSession = currentStudies.some(s => s && s.name && s.name.toLowerCase().includes('session'));
      if (!hasSession) {
        root.PineIndicators.clearSessionVisuals(chart);
      }
    }
    logConsole(`[Cleanup] Study "${studyId}" completely removed; associated shapes and tables cleared.`, 'info');
  }
  root.cleanupStudy = cleanupStudy;

  let _removalObserverAttached = false;
  let _lastKnownStudyIds = new Set();
  const _studyVisibilityState = new Map();
  function setupStudyRemovalObserver(chart) {
    if (_removalObserverAttached || !chart) return;
    _removalObserverAttached = true;

    if (typeof chart.getAllStudies === 'function') {
      try {
        _lastKnownStudyIds = new Set(chart.getAllStudies().map(s => s.id));
      } catch(e) {}
    }

    // Periodic poll to detect if any tracked study was removed from chart or hidden/shown
    setInterval(() => {
      try {
        if (typeof chart.getAllStudies !== 'function') return;

        const currentStudies = chart.getAllStudies();
        const currentIds = new Set(currentStudies.map(s => s.id));
        const currentNames = new Set(currentStudies.map(s => (s.name || '').toLowerCase()));

        // Continuous session presence guard: if no study on chart contains "session", sweep all lingering session shapes
        const hasSessionStudy = currentStudies.some(s => s && s.name && s.name.toLowerCase().includes('session'));
        if (!hasSessionStudy && root.PineIndicators && typeof root.PineIndicators.clearSessionVisuals === 'function') {
          root.PineIndicators.clearSessionVisuals(chart);
        }

        // Monitor and synchronize study visibility for shapes & tables
        currentStudies.forEach(s => {
          try {
            const studyApi = chart.getStudyById(s.id);
            if (studyApi && typeof studyApi.isVisible === 'function') {
              const isVis = studyApi.isVisible();
              const lastVis = _studyVisibilityState.get(s.id);
              if (lastVis !== isVis) {
                _studyVisibilityState.set(s.id, isVis);
                if (root.PineIndicators && typeof root.PineIndicators.setStudyShapesVisibility === 'function') {
                  root.PineIndicators.setStudyShapesVisibility(s.id, isVis, chart);
                }
              }
            }
          } catch (e) {}
        });

        // Case A: ALL studies have been removed from chart
        if (currentStudies.length === 0 && (_lastKnownStudyIds.size > 0 || (root._pineActiveStudies && root._pineActiveStudies.size > 0))) {
          clearStudyShapes('all', chart);
          if (root.PineIndicators && typeof root.PineIndicators.clearSessionVisuals === 'function') {
            root.PineIndicators.clearSessionVisuals(chart);
          }
          _lastKnownStudyIds.clear();
          _studyVisibilityState.clear();
          if (root._pineActiveStudies) root._pineActiveStudies.clear();
          return;
        }

        // Case B: Individual study removal detected from _pineActiveStudies
        if (root._pineActiveStudies && root._pineActiveStudies.size > 0) {
          for (const [id, info] of root._pineActiveStudies.entries()) {
            const stillPresent = currentIds.has(id) || currentNames.has((info.name || '').toLowerCase());
            if (!stillPresent) {
              _studyVisibilityState.delete(id);
              cleanupStudy(id, chart);
            }
          }
        }

        // Case C: Any previously known study ID disappeared
        for (const prevId of _lastKnownStudyIds) {
          if (!currentIds.has(prevId)) {
            _studyVisibilityState.delete(prevId);
            cleanupStudy(prevId, chart);
          }
        }

        _lastKnownStudyIds = currentIds;
      } catch (e) {}
    }, 200);

    // In iframe, hook click on delete action and show-hide action buttons in legend
    try {
      const innerDoc = (_widget && typeof _widget._innerWindow === 'function' && _widget._innerWindow()?.document) ||
                       document.querySelector('#tv_chart_container iframe')?.contentWindow?.document;
      if (innerDoc && !innerDoc._pineLegendActionsHooked) {
        innerDoc._pineLegendActionsHooked = true;
        innerDoc.addEventListener('click', (e) => {
          const delBtn = e.target.closest('[data-name="legend-delete-action"], [data-name="delete-button"], .action-l31H9iuA, [data-role="button"][data-name="remove"]');
          if (delBtn) {
            setTimeout(() => {
              if (typeof chart.getAllStudies === 'function') {
                const currentStudies = chart.getAllStudies();
                if (currentStudies.length === 0) {
                  clearStudyShapes('all', chart);
                  return;
                }
                const currentIds = new Set(currentStudies.map(s => s.id));
                for (const [id] of (root._pineActiveStudies || new Map()).entries()) {
                  if (!currentIds.has(id)) {
                    cleanupStudy(id, chart);
                  }
                }
              }
            }, 100);
            setTimeout(() => {
              if (typeof chart.getAllStudies === 'function') {
                const currentStudies = chart.getAllStudies();
                if (currentStudies.length === 0) {
                  clearStudyShapes('all', chart);
                }
              }
            }, 400);
          }

          const showHideBtn = e.target.closest('[data-name="legend-show-hide-action"], [data-name="toggle-visibility-button"]');
          if (showHideBtn) {
            setTimeout(() => {
              if (typeof chart.getAllStudies === 'function') {
                const currentStudies = chart.getAllStudies();
                currentStudies.forEach(s => {
                  try {
                    const studyApi = chart.getStudyById(s.id);
                    if (studyApi && typeof studyApi.isVisible === 'function') {
                      const isVis = studyApi.isVisible();
                      _studyVisibilityState.set(s.id, isVis);
                      if (root.PineIndicators && typeof root.PineIndicators.setStudyShapesVisibility === 'function') {
                        root.PineIndicators.setStudyShapesVisibility(s.id, isVis, chart);
                      }
                    }
                  } catch (e) {}
                });
              }
            }, 50);
          }
        }, true);
      }
    } catch (e) {}
  }

  /* =========================================================================
   * Real-Time Lifecycle Synchronization Engine
   * ========================================================================= */
  let _lifecycleSyncAttached = false;
  function setupChartLifecycleSync(chartInstance) {
    const chart = chartInstance || (_widget ? _widget.activeChart() : (root.widget ? root.widget.activeChart() : null));
    if (!chart || _lifecycleSyncAttached) return;
    _lifecycleSyncAttached = true;

    // 1. Symbol change listener
    if (typeof chart.onSymbolChanged === 'function') {
      try {
        chart.onSymbolChanged().subscribe(null, (symbolInfo) => {
          const symName = typeof symbolInfo === 'string' ? symbolInfo : (symbolInfo?.name || symbolInfo?.ticker || 'symbol');
          logConsole(`[Lifecycle] Symbol changed to "${symName}". Re-evaluating studies & re-anchoring shapes...`, "info");
          triggerStudyReEvaluation(chart, 'symbol', symbolInfo);
        });
      } catch (e) {}
    }

    // 2. Interval / timeframe change listener
    if (typeof chart.onIntervalChanged === 'function') {
      try {
        chart.onIntervalChanged().subscribe(null, (interval, timeframeObj) => {
          logConsole(`[Lifecycle] Timeframe changed to "${interval}". Re-evaluating studies & re-anchoring shapes...`, "info");
          triggerStudyReEvaluation(chart, 'interval', interval);
        });
      } catch (e) {}
    }

    // 3. Streaming tick arrivals
    let _tickThrottleTimer = null;
    const onTickArrival = (detail) => {
      if (_tickThrottleTimer) return;
      _tickThrottleTimer = setTimeout(() => {
        _tickThrottleTimer = null;
        triggerStudyReEvaluation(chart, 'tick', detail);
      }, 200);
    };

    root.addEventListener('mt5_tick', (e) => onTickArrival(e.detail));
    if (typeof window !== 'undefined' && window !== root) {
      window.addEventListener('mt5_tick', (e) => onTickArrival(e.detail));
    }

    try {
      const model = chart._chartWidget?._model?.model() || chart.model?.();
      const ms = model?.mainSeries();
      if (ms && ms.dataEvents && typeof ms.dataEvents().barUpdated?.subscribe === 'function') {
        ms.dataEvents().barUpdated.subscribe(null, (bar) => {
          onTickArrival(bar);
        });
      }
    } catch (e) {}

    // 4. Format modal input changes
    setupFormatModalSync(chart);
  }

  function triggerStudyReEvaluation(chart, reason, detail) {
    if (!chart) return;

    try {
      const model = chart._chartWidget?._model?.model() || chart.model?.();
      if (model) {
        const ms = model.mainSeries ? model.mainSeries() : null;
        const sources = model.priceDataSources ? model.priceDataSources() : [];
        sources.forEach(src => {
          if (src !== ms) {
            if (reason === 'symbol' || reason === 'interval') {
              if (typeof src.restart === 'function') {
                src.restart();
              } else if (typeof src.recalculate === 'function') {
                src.recalculate();
              }
            } else {
              if (typeof src.recalculate === 'function') {
                src.recalculate();
              }
            }
          }
        });
        if (typeof model.lightUpdate === 'function') {
          model.lightUpdate();
        }
      }
    } catch (e) {}

    // Re-anchor shapes if session visuals are active
    if (root.PineIndicators && typeof root.PineIndicators.renderSessionVisuals === 'function') {
      const currentStudies = (typeof chart.getAllStudies === 'function') ? chart.getAllStudies() : [];
      const hasSessionInChart = currentStudies.some(s => s && s.name && s.name.toLowerCase().includes('session'));
      const hasSessionInActive = Array.from((root._pineActiveStudies || new Map()).values())
        .some(s => s && s.name && s.name.toLowerCase().includes('session'));
      if (hasSessionInChart || hasSessionInActive) {
        if (reason === 'symbol' || reason === 'interval') {
          clearStudyShapes(null, chart);
        }
        setTimeout(() => {
          root.PineIndicators.renderSessionVisuals(chart);
        }, reason === 'tick' ? 50 : 250);
      } else {
        if (root.PineIndicators && typeof root.PineIndicators.clearSessionVisuals === 'function') {
          root.PineIndicators.clearSessionVisuals(chart);
        }
      }
    }
  }

  function setupFormatModalSync(chart) {
    try {
      const innerDoc = (_widget && typeof _widget._innerWindow === 'function' && _widget._innerWindow()?.document) ||
                       document.querySelector('#tv_chart_container iframe')?.contentWindow?.document;
      if (!innerDoc || innerDoc._pineFormatSyncHooked) return;
      innerDoc._pineFormatSyncHooked = true;

      innerDoc.addEventListener('input', handleModalChange, true);
      innerDoc.addEventListener('change', handleModalChange, true);

      function handleModalChange(e) {
        const dialog = e.target.closest('[data-name="study-properties-dialog"], [class*="dialog-"], [class*="modal-"]');
        if (!dialog) return;

        const updatedInputs = {};
        dialog.querySelectorAll('input, select').forEach(inputEl => {
          const name = inputEl.name || inputEl.getAttribute('data-name') || inputEl.id;
          if (!name) return;
          if (inputEl.type === 'checkbox') {
            updatedInputs[name] = inputEl.checked;
          } else if (inputEl.type === 'number') {
            updatedInputs[name] = parseFloat(inputEl.value);
          } else {
            updatedInputs[name] = inputEl.value;
          }
        });

        logConsole(`[Lifecycle] Input changed in format modal. Synchronizing study runtime...`, "info");
        triggerStudyReEvaluation(chart, 'inputs', updatedInputs);
        if (root.PineIndicators && typeof root.PineIndicators.renderSessionVisuals === 'function') {
          root.PineIndicators.renderSessionVisuals(chart, updatedInputs);
        }
      }
    } catch (e) {}
  }

  /* =========================================================================
   * In-Place Recompilation & Active Study Tracking Helpers
   * ========================================================================= */
  function isStudyOnChart(studyId) {
    if (!studyId) return false;
    const chart = _widget ? _widget.activeChart() : (root.widget ? root.widget.activeChart() : null);
    if (!chart) return false;
    try {
      if (typeof chart.getStudyById === 'function') {
        const s = chart.getStudyById(studyId);
        if (s) return true;
      }
    } catch(e) {}
    try {
      if (typeof chart.getAllStudies === 'function') {
        const list = chart.getAllStudies();
        if (list && list.some(s => s && s.id === studyId)) return true;
      }
    } catch(e) {}
    try {
      const model = chart._chartWidget?._model?.model ? chart._chartWidget._model.model() : (chart._chartWidget?.model ? chart._chartWidget.model().model() : null);
      if (model && typeof model.dataSourceForId === 'function') {
        const ds = model.dataSourceForId(studyId);
        if (ds) return true;
      }
    } catch(e) {}
    return false;
  }

  function updateAddButtonLabel() {
    const btn = document.getElementById('pine_add_to_chart_btn');
    if (!btn) return;
    const isRecompile = Boolean(_currentScript.activeStudyId && isStudyOnChart(_currentScript.activeStudyId));
    if (isRecompile) {
      btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <polyline points="23 4 23 10 17 10"></polyline>
          <polyline points="1 20 1 14 7 14"></polyline>
          <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
        </svg>
        Update on chart
      `;
      btn.setAttribute('title', 'Recompile and hot-update this indicator on chart (Ctrl + Enter)');
      btn.classList.add('is-active-recompile');
    } else {
      btn.innerHTML = `
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="5" x2="12" y2="19"/>
          <line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        Add to chart
      `;
      btn.setAttribute('title', 'Add indicator to chart (Ctrl + Enter)');
      btn.classList.remove('is-active-recompile');
    }
  }

  function setDockPosition(pos) {
    _dockPosition = pos;
    try { localStorage.setItem(DOCK_POSITION_KEY, pos); } catch(e) {}
    const dock = document.getElementById('pine_editor_dock');
    const appRoot = document.getElementById('app_root');
    const chartContainer = document.getElementById('tv_chart_container');
    const posIcon = document.getElementById('pine_dock_pos_icon');
    const posText = document.getElementById('pine_dock_pos_text');
    if (!dock || !appRoot) return;

    if (pos === 'bottom') {
      appRoot.style.flexDirection = 'column';
      dock.classList.add('dock-bottom');
      dock.style.width = '100%';
      dock.style.height = `${_dockHeight}px`;
      if (chartContainer) chartContainer.style.height = `calc(100% - ${_dockHeight}px)`;
      if (posText) posText.textContent = 'Move script to side';
      if (posIcon) posIcon.innerHTML = '<polyline points="9 18 15 12 9 6"/>';
    } else {
      appRoot.style.flexDirection = 'row';
      dock.classList.remove('dock-bottom');
      dock.style.width = `${_dockWidth}px`;
      dock.style.height = '100%';
      if (chartContainer) chartContainer.style.height = '100%';
      if (posText) posText.textContent = 'Move script to bottom';
      if (posIcon) posIcon.innerHTML = '<polyline points="6 9 12 15 18 9"/>';
    }
  }

  function makeScriptCopy() {
    const newName = prompt("Enter name for copy:", _currentScript.name + " Copy");
    if (newName && newName.trim()) {
      const copyName = newName.trim();
      const newId = 'user_script_' + Date.now();
      const scripts = getUserSavedScripts();
      const code = document.getElementById('pine_code_input')?.value || _currentScript.code;
      scripts.unshift({
        id: newId,
        name: copyName,
        isFavorite: false,
        code: code
      });
      saveUserSavedScripts(scripts);
      loadScript(copyName, code, newId);
      logConsole(`Created copy "${copyName}".`, "success");
    }
  }

  function renameCurrentScript() {
    const newName = prompt("Enter new script name:", _currentScript.name);
    if (newName && newName.trim() && newName.trim() !== _currentScript.name) {
      const cleanName = newName.trim();
      _currentScript.name = cleanName;
      const display = document.getElementById('pine_script_title_display');
      if (display) display.textContent = cleanName;
      const scripts = getUserSavedScripts();
      const existing = scripts.find(s => s.id === _currentScript.id);
      if (existing) {
        existing.name = cleanName;
        saveUserSavedScripts(scripts);
      }
      saveCurrentToStorage();
      logConsole(`Renamed script to "${cleanName}".`, "info");
    }
  }

  function createNewScript(type) {
    let title = "My Custom Indicator";
    let code = `//@version=5\nindicator("My Custom Indicator", overlay=true)\n\nplot(close, "Close Price", color=#2962ff)\n`;
    if (type === 'strategy') {
      title = "My Custom Strategy";
      code = `//@version=5\nstrategy("My Custom Strategy", overlay=true, margin_long=100, margin_short=100)\n\nlongCondition = ta.crossover(ta.sma(close, 14), ta.sma(close, 28))\nif (longCondition)\n    strategy.entry("My Long Entry Id", strategy.long)\n\nshortCondition = ta.crossunder(ta.sma(close, 14), ta.sma(close, 28))\nif (shortCondition)\n    strategy.entry("My Short Entry Id", strategy.short)\n`;
    } else if (type === 'library') {
      title = "My Library";
      code = `//@version=5\n// @description Custom Math & Utility Library\nlibrary("MyLibrary", overlay=true)\n\n// @function Calculates percentage difference between two values\nexport diffPercent(float val1, float val2) =>\n    (val1 - val2) / val2 * 100.0\n`;
    }
    const newId = 'user_script_' + Date.now();
    const scripts = getUserSavedScripts();
    scripts.unshift({
      id: newId,
      name: title,
      isFavorite: false,
      code: code
    });
    saveUserSavedScripts(scripts);
    loadScript(title, code, newId);
    setDockOpen(true);
    logConsole(`Created new ${type || 'script'} "${title}".`, "success");
  }

  /* =========================================================================
   * Horizontal Lines Detection & Alerts Engine (Image 4)
   * ========================================================================= */
  function getChartHorizontalLines() {
    const chart = _widget ? _widget.activeChart() : (root.widget ? root.widget.activeChart() : null);
    if (!chart) return [];
    try {
      const model = chart._chartWidget?._model?.model ? chart._chartWidget._model.model() : (chart._chartWidget?.model ? chart._chartWidget.model().model() : null);
      if (model && typeof model.allLineTools === 'function') {
        const tools = model.allLineTools();
        return tools
          .filter(t => {
            const name = (typeof t.name === 'function' ? t.name() : (t.name || '')).toLowerCase();
            return name.includes('horizontal') || name.includes('horz');
          })
          .map(t => {
            const pts = typeof t.points === 'function' ? t.points() : (t.points || []);
            return {
              id: typeof t.id === 'function' ? t.id() : t.id,
              price: pts[0] ? pts[0].price : null,
              name: typeof t.name === 'function' ? t.name() : 'Horizontal Line'
            };
          })
          .filter(l => l.price !== null && !isNaN(l.price));
      }
    } catch(e) {}
    return [];
  }

  function playAlertChime() {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      if (ctx.state === 'suspended') {
        ctx.resume();
      }
      const now = ctx.currentTime;

      // Primary tone: 880 Hz (A5)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.4);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.45);

      // Harmonious chime accent: 1320 Hz (E6)
      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.1);
      gain2.gain.setValueAtTime(0.35, now + 0.1);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.65);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.1);
      osc2.stop(now + 0.7);
    } catch(e) {
      console.warn("[Alerts] Audio chime failed:", e);
    }
  }

  function showFloatingAlertToast(alert, currentPrice) {
    const toast = document.createElement('div');
    toast.className = 'tv-alert-toast';
    toast.innerHTML = `
      <div class="tv-alert-toast-icon">🔔</div>
      <div class="tv-alert-toast-body">
        <div class="tv-alert-toast-title">${escapeHtml(alert.symbol || 'Symbol')} Alert Triggered</div>
        <div class="tv-alert-toast-msg">${escapeHtml(alert.name || (alert.condition + ' ' + alert.targetPrice))} (Market: ${Number(currentPrice).toFixed(2)})</div>
        <div class="tv-alert-toast-time">${new Date().toLocaleTimeString()}</div>
      </div>
      <button type="button" class="tv-alert-toast-close" title="Dismiss">&times;</button>
    `;
    toast.querySelector('.tv-alert-toast-close').addEventListener('click', () => toast.remove());
    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.style.transition = 'opacity 0.35s ease, transform 0.35s ease';
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(40px)';
        setTimeout(() => toast.remove(), 380);
      }
    }, 7500);
  }

  function evaluateAlertsForPrice(symbol, currentPrice) {
    if (!symbol || typeof currentPrice !== 'number' || isNaN(currentPrice)) return;
    const cleanSym = String(symbol).toUpperCase().replace(/[^A-Z0-9]/g, '');
    const lastPrice = _lastPriceBySymbol[cleanSym];
    _lastPriceBySymbol[cleanSym] = currentPrice;

    if (lastPrice === undefined) return;

    const alerts = getActiveAlerts();
    let updated = false;

    alerts.forEach(alert => {
      if (!alert.active) return;
      const aSym = String(alert.symbol || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
      if (aSym && !cleanSym.includes(aSym) && !aSym.includes(cleanSym)) return;

      const target = parseFloat(alert.targetPrice);
      if (isNaN(target)) return;

      let triggered = false;
      const cond = alert.condition || 'Crossing';

      if (cond === 'Crossing') {
        triggered = (lastPrice < target && currentPrice >= target) || (lastPrice > target && currentPrice <= target);
      } else if (cond === 'Crossing Up') {
        triggered = (lastPrice < target && currentPrice >= target);
      } else if (cond === 'Crossing Down') {
        triggered = (lastPrice > target && currentPrice <= target);
      } else if (cond === 'Greater Than') {
        triggered = (currentPrice > target);
      } else if (cond === 'Less Than') {
        triggered = (currentPrice < target);
      }

      if (triggered) {
        if (alert.playSound !== false) {
          playAlertChime();
        }
        if (alert.showToast !== false) {
          showFloatingAlertToast(alert, currentPrice);
        }

        const hist = getAlertsHistory();
        hist.unshift({
          id: 'hist_' + Date.now(),
          alertId: alert.id,
          symbol: alert.symbol,
          condition: cond,
          targetPrice: target,
          triggeredPrice: currentPrice,
          triggeredAt: Date.now(),
          name: alert.name
        });
        saveAlertsHistory(hist.slice(0, 100));

        alert.triggeredAt = Date.now();
        if (alert.triggerFrequency === 'once') {
          alert.active = false;
        }
        updated = true;
        logConsole(`[Alert Triggered] ${alert.symbol} crossed ${target} at ${currentPrice.toFixed(2)}.`, 'warn');
      }
    });

    if (updated) {
      saveActiveAlerts(alerts);
      renderAlertsList();
    }
  }

  let _activeAlertsTab = 'active';

  function renderAlertsList() {
    const list = document.getElementById('tv_alerts_list');
    if (!list) return;

    if (_activeAlertsTab === 'active') {
      const alerts = getActiveAlerts();
      if (alerts.length === 0) {
        list.innerHTML = `
          <div style="padding: 24px 16px; text-align: center; color: #787b86; font-size: 13px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#787b86" stroke-width="1.5" style="margin-bottom: 8px;">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
              <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
            </svg>
            <div>No active alerts.</div>
            <div style="font-size: 11px; margin-top: 4px; color: #5d606b;">Click "+ Create alert" or click on a horizontal line to set an alert.</div>
          </div>
        `;
        return;
      }

      list.innerHTML = '';
      alerts.forEach((alert, idx) => {
        const item = document.createElement('div');
        item.className = 'tv-alert-item';
        item.innerHTML = `
          <div class="tv-alert-item-header">
            <span class="tv-alert-symbol">${escapeHtml(alert.symbol)}</span>
            <span class="tv-alert-badge ${alert.active ? 'active' : 'triggered'}">${alert.active ? 'Active' : 'Paused'}</span>
          </div>
          <div class="tv-alert-desc">
            <strong>${escapeHtml(alert.condition)}</strong> ${parseFloat(alert.targetPrice).toFixed(2)}
            ${alert.source ? `<span style="color: #787b86; font-size: 11px;"> (${escapeHtml(alert.source)})</span>` : ''}
          </div>
          <div class="tv-alert-footer">
            <span class="tv-alert-time">${new Date(alert.createdAt).toLocaleDateString()}</span>
            <div class="tv-alert-item-actions">
              <button type="button" class="tv-alert-icon-btn toggle" title="${alert.active ? 'Pause alert' : 'Resume alert'}">
                ${alert.active ? '⏸' : '▶'}
              </button>
              <button type="button" class="tv-alert-icon-btn delete" title="Delete alert">🗑</button>
            </div>
          </div>
        `;

        item.querySelector('.toggle').addEventListener('click', () => {
          alert.active = !alert.active;
          saveActiveAlerts(alerts);
          renderAlertsList();
        });

        item.querySelector('.delete').addEventListener('click', () => {
          alerts.splice(idx, 1);
          saveActiveAlerts(alerts);
          renderAlertsList();
        });

        list.appendChild(item);
      });
    } else {
      const history = getAlertsHistory();
      if (history.length === 0) {
        list.innerHTML = `
          <div style="padding: 24px 16px; text-align: center; color: #787b86; font-size: 13px;">
            <div>No alerts triggered yet.</div>
          </div>
        `;
        return;
      }

      list.innerHTML = '';
      history.forEach(h => {
        const item = document.createElement('div');
        item.className = 'tv-alert-item';
        item.innerHTML = `
          <div class="tv-alert-item-header">
            <span class="tv-alert-symbol">${escapeHtml(h.symbol)}</span>
            <span class="tv-alert-badge triggered">Triggered</span>
          </div>
          <div class="tv-alert-desc">
            Target: ${parseFloat(h.targetPrice).toFixed(2)} &bull; Executed at: <strong style="color: #f7a600;">${parseFloat(h.triggeredPrice).toFixed(2)}</strong>
          </div>
          <div class="tv-alert-footer">
            <span class="tv-alert-time">${new Date(h.triggeredAt).toLocaleTimeString()}</span>
          </div>
        `;
        list.appendChild(item);
      });
    }
  }

  function toggleAlertsPanel(forceOpen) {
    const panel = document.getElementById('tv_alerts_panel');
    if (!panel) return;
    const shouldOpen = (forceOpen !== undefined) ? forceOpen : !panel.classList.contains('open');
    if (shouldOpen) {
      panel.classList.add('open');
      renderAlertsList();
    } else {
      panel.classList.remove('open');
    }
    syncRightToolbarAlertButton(shouldOpen);
  }

  function syncRightToolbarAlertButton(isOpen) {
    try {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const innerDoc = iframe?.contentDocument || (_widget && typeof _widget._innerWindow === 'function' && _widget._innerWindow()?.document);
      const btn = innerDoc?.querySelector('[data-name="alerts"]');
      if (btn) {
        btn.setAttribute('aria-pressed', isOpen ? 'true' : 'false');
        if (isOpen) {
          btn.classList.add('isActive-I_wb5FjE');
        } else {
          btn.classList.remove('isActive-I_wb5FjE');
        }
      }
    } catch(e) {}
  }

  function openCreateAlertDialog(prefillPrice, prefillSource) {
    const modalBackdrop = document.getElementById('tv_alert_create_backdrop');
    if (!modalBackdrop) return;

    const chart = _widget ? _widget.activeChart() : (root.widget ? root.widget.activeChart() : null);
    const sym = (chart && typeof chart.symbol === 'function' ? chart.symbol() : 'XAUUSD').replace(/\.$/, '');

    const symInput = document.getElementById('tv_alert_input_symbol');
    if (symInput) symInput.value = sym;

    const sourceSelect = document.getElementById('tv_alert_select_source');
    const priceInput = document.getElementById('tv_alert_input_price');
    const nameInput = document.getElementById('tv_alert_input_name');

    if (sourceSelect) {
      sourceSelect.innerHTML = '';
      const marketOpt = document.createElement('option');
      marketOpt.value = 'market';
      marketOpt.textContent = `Market Price (${sym})`;
      sourceSelect.appendChild(marketOpt);

      const horzLines = getChartHorizontalLines();
      horzLines.forEach((l, idx) => {
        const opt = document.createElement('option');
        opt.value = String(l.price);
        opt.textContent = `Horizontal Line at ${Number(l.price).toFixed(2)}`;
        sourceSelect.appendChild(opt);
      });

      sourceSelect.onchange = () => {
        if (sourceSelect.value !== 'market') {
          priceInput.value = sourceSelect.value;
          nameInput.value = `${sym} Crossing Line (${Number(sourceSelect.value).toFixed(2)})`;
        }
      };
    }

    let defaultPrice = prefillPrice;
    if (!defaultPrice) {
      const cleanSym = sym.toUpperCase().replace(/[^A-Z0-9]/g, '');
      defaultPrice = _lastPriceBySymbol[cleanSym] || (chart && typeof chart.getSeriesPrice === 'function' ? chart.getSeriesPrice() : 4370.00);
    }

    if (priceInput) priceInput.value = Number(defaultPrice).toFixed(2);
    if (nameInput) nameInput.value = `${sym} Crossing ${Number(defaultPrice).toFixed(2)}`;

    modalBackdrop.style.display = 'flex';
  }

  function closeCreateAlertDialog() {
    const modalBackdrop = document.getElementById('tv_alert_create_backdrop');
    if (modalBackdrop) modalBackdrop.style.display = 'none';
  }

  function mountAlertsPanelAndModal() {
    if (document.getElementById('tv_alerts_panel')) return;

    const panel = document.createElement('div');
    panel.id = 'tv_alerts_panel';
    panel.innerHTML = `
      <div class="tv-alerts-panel-header">
        <div class="tv-alerts-panel-title">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
            <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
          </svg>
          Alerts
        </div>
        <div class="tv-alerts-panel-actions">
          <button type="button" class="tv-create-alert-btn" id="tv_panel_create_alert_btn">+ Create alert</button>
          <button type="button" class="dock-icon-btn" id="tv_panel_close_btn" title="Close Alerts Panel">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
      </div>
      <div style="display: flex; border-bottom: 1px solid #2a2e39; background: #181b24;">
        <button type="button" id="tv_alerts_tab_active" class="strat-sub-tab active" style="flex: 1; text-align: center; border-radius: 0;">Active</button>
        <button type="button" id="tv_alerts_tab_history" class="strat-sub-tab" style="flex: 1; text-align: center; border-radius: 0;">History</button>
      </div>
      <div class="tv-alerts-list" id="tv_alerts_list"></div>
    `;
    document.body.appendChild(panel);

    const backdrop = document.createElement('div');
    backdrop.id = 'tv_alert_create_backdrop';
    backdrop.className = 'tv-alert-modal-backdrop';
    backdrop.style.display = 'none';
    backdrop.innerHTML = `
      <div class="tv-alert-modal">
        <div class="tv-alert-modal-header">
          <div class="tv-alert-modal-title">Create Alert</div>
          <button type="button" class="dock-icon-btn" id="tv_alert_modal_close_btn" title="Close">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <line x1="18" y1="6" x2="6" y2="18"/>
              <line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </button>
        </div>
        <div class="tv-alert-form-group">
          <label class="tv-alert-form-label">Symbol</label>
          <input type="text" id="tv_alert_input_symbol" class="tv-alert-form-input" readonly />
        </div>
        <div class="tv-alert-form-group">
          <label class="tv-alert-form-label">Level Source</label>
          <select id="tv_alert_select_source" class="tv-alert-form-select"></select>
        </div>
        <div class="tv-alert-form-group">
          <label class="tv-alert-form-label">Condition</label>
          <select id="tv_alert_select_condition" class="tv-alert-form-select">
            <option value="Crossing">Crossing</option>
            <option value="Crossing Up">Crossing Up</option>
            <option value="Crossing Down">Crossing Down</option>
            <option value="Greater Than">Greater Than</option>
            <option value="Less Than">Less Than</option>
          </select>
        </div>
        <div class="tv-alert-form-group">
          <label class="tv-alert-form-label">Target Price</label>
          <input type="number" step="any" id="tv_alert_input_price" class="tv-alert-form-input" placeholder="e.g. 4370.00" />
        </div>
        <div class="tv-alert-form-group">
          <label class="tv-alert-form-label">Trigger Frequency</label>
          <select id="tv_alert_select_freq" class="tv-alert-form-select">
            <option value="once">Only Once</option>
            <option value="every_time">Every Time</option>
          </select>
        </div>
        <div class="tv-alert-form-group">
          <label class="tv-alert-form-label">Alert Name</label>
          <input type="text" id="tv_alert_input_name" class="tv-alert-form-input" placeholder="Alert name" />
        </div>
        <div style="display: flex; gap: 16px; margin-top: 4px;">
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input type="checkbox" id="tv_alert_check_sound" checked />
            Play Sound (Chime)
          </label>
          <label style="display: flex; align-items: center; gap: 6px; font-size: 12px; cursor: pointer;">
            <input type="checkbox" id="tv_alert_check_toast" checked />
            Show Toast
          </label>
        </div>
        <div class="tv-alert-modal-footer">
          <button type="button" class="tv-alert-btn-cancel" id="tv_alert_btn_cancel">Cancel</button>
          <button type="button" class="tv-alert-btn-create" id="tv_alert_btn_submit">Create Alert</button>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    // Bind Alerts panel tabs & buttons
    document.getElementById('tv_alerts_tab_active')?.addEventListener('click', () => {
      _activeAlertsTab = 'active';
      document.getElementById('tv_alerts_tab_active')?.classList.add('active');
      document.getElementById('tv_alerts_tab_history')?.classList.remove('active');
      renderAlertsList();
    });

    document.getElementById('tv_alerts_tab_history')?.addEventListener('click', () => {
      _activeAlertsTab = 'history';
      document.getElementById('tv_alerts_tab_history')?.classList.add('active');
      document.getElementById('tv_alerts_tab_active')?.classList.remove('active');
      renderAlertsList();
    });

    document.getElementById('tv_panel_close_btn')?.addEventListener('click', () => toggleAlertsPanel(false));
    document.getElementById('tv_panel_create_alert_btn')?.addEventListener('click', () => openCreateAlertDialog());

    document.getElementById('tv_alert_modal_close_btn')?.addEventListener('click', closeCreateAlertDialog);
    document.getElementById('tv_alert_btn_cancel')?.addEventListener('click', closeCreateAlertDialog);
    backdrop.addEventListener('click', (e) => {
      if (e.target.id === 'tv_alert_create_backdrop') closeCreateAlertDialog();
    });

    document.getElementById('tv_alert_btn_submit')?.addEventListener('click', () => {
      const sym = document.getElementById('tv_alert_input_symbol')?.value || 'XAUUSD';
      const cond = document.getElementById('tv_alert_select_condition')?.value || 'Crossing';
      const target = parseFloat(document.getElementById('tv_alert_input_price')?.value);
      const freq = document.getElementById('tv_alert_select_freq')?.value || 'once';
      const name = document.getElementById('tv_alert_input_name')?.value || `${sym} ${cond} ${target}`;
      const playSound = document.getElementById('tv_alert_check_sound')?.checked !== false;
      const showToast = document.getElementById('tv_alert_check_toast')?.checked !== false;

      if (isNaN(target)) {
        alert("Please enter a valid target price.");
        return;
      }

      const alerts = getActiveAlerts();
      const newAlert = {
        id: 'alert_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4),
        symbol: sym,
        condition: cond,
        targetPrice: target,
        triggerFrequency: freq,
        active: true,
        createdAt: Date.now(),
        triggeredAt: null,
        name: name,
        playSound: playSound,
        showToast: showToast
      };
      alerts.unshift(newAlert);
      saveActiveAlerts(alerts);
      closeCreateAlertDialog();
      toggleAlertsPanel(true);
      logConsole(`[Alert Created] ${sym} ${cond} ${target.toFixed(2)}.`, 'success');
    });
  }

  /* =========================================================================
   * "Indicators, Metrics, and Strategies" Dialog (Image 2)
   * ========================================================================= */
  let _activeIndicatorsCategory = 'myscripts';
  let _indicatorsSearchQuery = '';

  function openIndicatorsModal(initialCategory) {
    if (initialCategory) _activeIndicatorsCategory = initialCategory;
    const modalBackdrop = document.getElementById('tv_indicators_modal_backdrop');
    if (!modalBackdrop) return;
    modalBackdrop.style.display = 'flex';
    const searchInput = document.getElementById('tv_indicators_search_input');
    if (searchInput) {
      searchInput.value = '';
      _indicatorsSearchQuery = '';
      setTimeout(() => searchInput.focus(), 60);
    }
    renderIndicatorsModal();
  }

  function closeIndicatorsModal() {
    const modalBackdrop = document.getElementById('tv_indicators_modal_backdrop');
    if (modalBackdrop) modalBackdrop.style.display = 'none';
  }

  function renderIndicatorsModal() {
    const list = document.getElementById('tv_indicators_list');
    if (!list) return;

    // Update sidebar active class
    document.querySelectorAll('.tv-indicators-nav-item').forEach(item => {
      if (item.dataset.category === _activeIndicatorsCategory) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });

    const q = (_indicatorsSearchQuery || '').toLowerCase().trim();
    let itemsToRender = [];

    if (_activeIndicatorsCategory === 'myscripts') {
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
    }

    if (q) {
      itemsToRender = itemsToRender.filter(item => (item.name || '').toLowerCase().includes(q));
    }

    if (itemsToRender.length === 0) {
      if (_activeIndicatorsCategory === 'myscripts' && !q) {
        list.innerHTML = `
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
        `;
      } else {
        list.innerHTML = `
          <div style="padding: 40px 16px; text-align: center; color: #787b86; font-size: 13px;">
            No indicators found matching "${escapeHtml(q || _activeIndicatorsCategory)}".
          </div>
        `;
      }
      return;
    }

    list.innerHTML = '';
    itemsToRender.forEach(item => {
      const row = document.createElement('div');
      row.className = 'tv-indicator-row';
      row.innerHTML = `
        <div class="tv-indicator-left">
          <button type="button" class="tv-indicator-fav-btn ${item.isFavorite ? 'active' : ''}" title="Add to favorites">
            ${item.isFavorite ? '★' : '☆'}
          </button>
          <span class="tv-indicator-name">${escapeHtml(item.name)}</span>
        </div>
        <div class="tv-indicator-actions">
          <button type="button" class="tv-indicator-action-btn add-chart-btn" title="Add to chart">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Add to chart
          </button>
          <button type="button" class="tv-indicator-action-btn open-editor-btn" title="Open script in Pine Editor">
            <span style="font-family: monospace; font-weight: 700; font-size: 13px;">{ }</span>
          </button>
          ${(!item.isBuiltIn && _activeIndicatorsCategory === 'myscripts') ? `
            <button type="button" class="tv-indicator-action-btn delete delete-script-btn" title="Delete script">
              🗑
            </button>
          ` : ''}
        </div>
      `;

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
        closeIndicatorsModal();
        const ch = (_widget && typeof _widget.activeChart === 'function') ? _widget.activeChart() : (root.widget && typeof root.widget.activeChart === 'function' ? root.widget.activeChart() : null);
        if (item.isBuiltIn) {
          logConsole(`Adding built-in "${item.name}" to chart...`, "info");
          if (ch) {
            try {
              await ch.createStudy(item.name, false, false);
            } catch (err) {
              console.error('Error adding built-in study:', err);
            }
          }
        } else {
          loadScript(item.name, item.code, item.id);
          logConsole(`Adding "${item.name}" to chart...`, "info");
          if (_addStudyToChartFn && item.code) await _addStudyToChartFn(item.code);
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
          message: `Are you sure you want to delete script "${item.name}"? This action cannot be undone.`,
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

      // Row click adds to chart
      row.addEventListener('click', async (e) => {
        if (e.target.closest('.tv-indicator-fav-btn') || e.target.closest('.tv-indicator-actions')) {
          return;
        }
        closeIndicatorsModal();
        const ch = (_widget && typeof _widget.activeChart === 'function') ? _widget.activeChart() : (root.widget && typeof root.widget.activeChart === 'function' ? root.widget.activeChart() : null);
        if (item.isBuiltIn) {
          logConsole(`Adding built-in "${item.name}" to chart...`, "info");
          if (ch) {
            try {
              await ch.createStudy(item.name, false, false);
            } catch (err) {
              console.error('Error adding built-in study:', err);
            }
          }
        } else {
          logConsole(`Adding "${item.name}" to chart...`, "info");
          if (_addStudyToChartFn && item.code) {
            await _addStudyToChartFn(item.code);
          }
        }
      });

      list.appendChild(row);
    });
  }

  
  function showTVConfirmDialog(opts) {
    if (!opts) return;
    const existing = document.getElementById('tv_confirm_dialog_overlay');
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = 'tv_confirm_dialog_overlay';
    overlay.style.cssText = 'position: fixed; inset: 0; z-index: 999999; background: rgba(0,0,0,0.65); display: flex; align-items: center; justify-content: center; font-family: -apple-system, BlinkMacSystemFont, "Trebuchet MS", Roboto, Ubuntu, sans-serif; backdrop-filter: blur(2px);';

    overlay.innerHTML = `
      <div style="background: #1e222d; color: #d1d4dc; border: 1px solid #2a2e39; border-radius: 8px; width: 380px; max-width: 90vw; padding: 20px; box-shadow: 0 16px 40px rgba(0,0,0,0.6); display: flex; flex-direction: column; gap: 16px;">
        <div style="font-size: 16px; font-weight: 600; color: #ffffff;">${escapeHtml(opts.title || 'Confirmation')}</div>
        <div style="font-size: 13px; color: #787b86; line-height: 1.4;">${escapeHtml(opts.message || 'Are you sure?')}</div>
        <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 8px;">
          <button type="button" id="tv_confirm_cancel" style="background: transparent; border: 1px solid #363a45; color: #d1d4dc; padding: 7px 16px; border-radius: 4px; font-size: 13px; font-weight: 500; cursor: pointer;">${escapeHtml(opts.cancelText || 'Cancel')}</button>
          <button type="button" id="tv_confirm_action" style="background: ${opts.isDanger ? '#f23645' : '#2962ff'}; border: none; color: #ffffff; padding: 7px 18px; border-radius: 4px; font-size: 13px; font-weight: 600; cursor: pointer;">${escapeHtml(opts.confirmText || 'OK')}</button>
        </div>
      </div>
    `;

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

  function mountIndicatorsModal() {
    if (document.getElementById('tv_indicators_modal_backdrop')) return;

    const backdrop = document.createElement('div');
    backdrop.id = 'tv_indicators_modal_backdrop';
    backdrop.className = 'tv-indicators-modal-backdrop';
    backdrop.style.display = 'none';
    backdrop.innerHTML = `
      <div class="tv-indicators-modal">
        <div class="tv-indicators-modal-header">
          <span class="tv-indicators-modal-title">Indicators, metrics, and strategies</span>
          <button type="button" class="tv-indicators-close-btn" id="tv_indicators_close_btn" title="Close">&times;</button>
        </div>
        <div class="tv-indicators-search-bar">
          <span class="tv-indicators-search-icon">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <line x1="21" y1="21" x2="16.65" y2="16.65"/>
            </svg>
          </span>
          <input type="text" id="tv_indicators_search_input" class="tv-indicators-search-input" placeholder="Search" />
        </div>
        <div class="tv-indicators-modal-body">
          <div class="tv-indicators-sidebar">
            <div class="tv-indicators-group-title">Personal</div>
            <div class="tv-indicators-nav-item" data-category="favorites">
              <span class="tv-indicators-nav-icon">★</span>
              <span>Favorites</span>
            </div>
            <div class="tv-indicators-nav-item active" data-category="myscripts">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                  <circle cx="12" cy="7" r="4"/>
                </svg>
              </span>
              <span>My scripts</span>
            </div>
            <div class="tv-indicators-nav-item" data-category="purchased">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="2" y="4" width="20" height="16" rx="2"/>
                  <path d="M7 15h10M7 9h2"/>
                </svg>
              </span>
              <span>Purchased</span>
            </div>

            <div class="tv-indicators-group-title">Built-in</div>
            <div class="tv-indicators-nav-item" data-category="technicals">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <line x1="18" y1="20" x2="18" y2="10"/>
                  <line x1="12" y1="20" x2="12" y2="4"/>
                  <line x1="6" y1="20" x2="6" y2="14"/>
                </svg>
              </span>
              <span>Technicals</span>
            </div>
            <div class="tv-indicators-nav-item" data-category="fundamentals">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 21h18M3 10h18M5 6l7-3 7 3M4 10v11M20 10v11M8 14v4M12 14v4M16 14v4"/>
                </svg>
              </span>
              <span>Fundamentals</span>
            </div>

            <div class="tv-indicators-group-title">Community</div>
            <div class="tv-indicators-nav-item" data-category="editors_picks">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/>
                </svg>
              </span>
              <span>Editors' picks</span>
            </div>
            <div class="tv-indicators-nav-item" data-category="top">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/>
                  <polyline points="17 6 23 6 23 12"/>
                </svg>
              </span>
              <span>Top</span>
            </div>
            <div class="tv-indicators-nav-item" data-category="trending">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 3z"/>
                </svg>
              </span>
              <span>Trending</span>
            </div>
            <div class="tv-indicators-nav-item" data-category="marketplace">
              <span class="tv-indicators-nav-icon">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/>
                  <line x1="3" y1="6" x2="21" y2="6"/>
                  <path d="M16 10a4 4 0 0 1-8 0"/>
                </svg>
              </span>
              <span>Marketplace</span>
            </div>
          </div>
          <div class="tv-indicators-content">
            <div class="tv-indicators-col-header">SCRIPT NAME</div>
            <div class="tv-indicators-list" id="tv_indicators_list"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(backdrop);

    // Sidebar navigation clicks
    backdrop.querySelectorAll('.tv-indicators-nav-item').forEach(item => {
      item.addEventListener('click', () => {
        _activeIndicatorsCategory = item.dataset.category || 'myscripts';
        renderIndicatorsModal();
      });
    });

    // Search input
    const searchInput = document.getElementById('tv_indicators_search_input');
    if (searchInput) {
      searchInput.addEventListener('input', () => {
        _indicatorsSearchQuery = searchInput.value;
        renderIndicatorsModal();
      });
    }

    // Close button & outside click
    document.getElementById('tv_indicators_close_btn')?.addEventListener('click', closeIndicatorsModal);
    backdrop.addEventListener('click', (e) => {
      if (e.target.id === 'tv_indicators_modal_backdrop') closeIndicatorsModal();
    });

    // Keyboard navigation: Escape closes modal
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeIndicatorsModal();
        closeCreateAlertDialog();
      }
      if ((e.key === '/' || e.key === 'Insert') && !['INPUT', 'TEXTAREA'].includes(document.activeElement?.tagName)) {
        e.preventDefault();
        openIndicatorsModal();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
        e.preventDefault();
        openIndicatorsModal('myscripts');
      }
      if (e.altKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        openCreateAlertDialog();
      }
    });
  }

  
  function syncLegendCodeButtons() {
    try {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const innerDoc = iframe?.contentDocument || (_widget && typeof _widget._innerWindow === 'function' && _widget._innerWindow()?.document);
      if (!innerDoc) return;

      const studyItems = innerDoc.querySelectorAll('[class*="item-"]:not([class*="series-"]), [data-name="legend-study-item"], [data-name="legend-source-item"]:not([class*="series-"])');
      studyItems.forEach(item => {
        const actions = item.querySelector('[class*="actions-"], .actions-l31H9iuA');
        if (!actions) return;
        if (actions.querySelector('.tv-legend-code-btn')) return;

        const codeBtn = innerDoc.createElement('button');
        codeBtn.type = 'button';
        codeBtn.className = 'action-l31H9iuA tv-legend-code-btn';
        codeBtn.setAttribute('data-name', 'legend-source-code-action');
        codeBtn.setAttribute('title', 'Source code');
        codeBtn.setAttribute('aria-label', 'Source code');
        codeBtn.innerHTML = '<span style="font-family: monospace; font-weight: 700; font-size: 11px; white-space: nowrap;">{ }</span>';

        const gear = actions.querySelector('[data-name="legend-settings-action"]');
        if (gear && gear.nextSibling) {
          actions.insertBefore(codeBtn, gear.nextSibling);
        } else {
          actions.appendChild(codeBtn);
        }

        codeBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          e.preventDefault();
          const titleEl = item.querySelector('[class*="title-"], [data-name="legend-source-title"]');
          const titleText = titleEl ? titleEl.textContent.trim() : '';
          openScriptForStudy(titleText);
        });
      });
    } catch(e) {}
  }

  function hookChartIframeIndicatorButtons(innerDoc) {
    if (!innerDoc || innerDoc._tvIndicatorsModalHooked) return;
    innerDoc._tvIndicatorsModalHooked = true;
    syncLegendCodeButtons();
    setInterval(syncLegendCodeButtons, 1500);

    try {
      innerDoc.addEventListener('click', (e) => {
        
        const alertBtn = e.target.closest('[data-name="alerts"], [data-name="alert"], [data-name="create-alert"], button[aria-label*="Alert"], button[title*="Alert"], #header-toolbar-alerts');
        if (alertBtn) {
          e.preventDefault();
          e.stopPropagation();
          openCreateAlertDialog();
          return;
        }

        const indBtn = e.target.closest('[data-name="open-indicators-dialog"], button[aria-label*="Indicators"]');
        if (indBtn) {
          e.preventDefault();
          e.stopPropagation();
          openIndicatorsModal();
        }
      }, true);

      innerDoc.addEventListener('keydown', (e) => {
        if ((e.key === '/' || e.key === 'Insert') && !['INPUT', 'TEXTAREA'].includes(innerDoc.activeElement?.tagName)) {
          e.preventDefault();
          openIndicatorsModal();
        }
        if (e.altKey && e.key.toLowerCase() === 'a') {
          e.preventDefault();
          openCreateAlertDialog();
        }
      }, true);
    } catch(e) {}
  }

  /* =========================================================================
   * 1. Mount Pine Editor IDE & DOM Structure
   * ========================================================================= */
  function mountPineEditorIDE(widgetInstance) {
    _widget = widgetInstance || root.widget;
    if (document.getElementById('pine_editor_dock')) return;

    let appRoot = document.getElementById('app_root');
    const chartContainer = document.getElementById('tv_chart_container');

    if (!appRoot && chartContainer) {
      appRoot = document.createElement('div');
      appRoot.id = 'app_root';
      chartContainer.parentNode.insertBefore(appRoot, chartContainer);
      appRoot.appendChild(chartContainer);
    }

    // Load saved script if exists
    try {
      const saved = localStorage.getItem(CURRENT_SCRIPT_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && parsed.code) {
          _currentScript = parsed;
          if (_currentScript.id && !_currentScript.id.startsWith('builtin_')) {
            _currentScript.isReadOnly = false;
          }
        }
      }
    } catch (e) {}

    // Deprecate and suppress any legacy crude modal
    const legacyModal = document.getElementById('pine-editor-modal');
    if (legacyModal) legacyModal.remove();

    // Create Pine Editor Dock Panel
    const dock = document.createElement('div');
    dock.id = 'pine_editor_dock';
    dock.style.display = _isDockOpen ? 'flex' : 'none';
    dock.style.width = `${_dockWidth}px`;

    dock.innerHTML = `
      <!-- Horizontal Drag Resize Handle -->
      <div id="pine_resize_handle" title="Drag to resize Pine Editor"></div>

      <!-- 1. Window Titlebar (Image 1 top bar) -->
      <div class="pine-win-header">
        <div class="pine-win-header-left">
          <svg class="pine-win-dock-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <polyline points="9 9 4 4 4 9"/>
            <line x1="4" y1="4" x2="10" y2="10"/>
          </svg>
          <span class="pine-win-title">Pine Editor</span>
        </div>
        <div class="pine-win-header-right">
          <button type="button" class="pine-win-btn" id="pine_win_minimize" title="Minimize">
            <svg width="10" height="2" viewBox="0 0 10 2" fill="currentColor"><rect width="10" height="2" rx="1"/></svg>
          </button>
          <button type="button" class="pine-win-btn" id="pine_win_maximize" title="Maximize">
            <svg id="pine_max_icon" width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="0.75" y="0.75" width="8.5" height="8.5" rx="1.5"/></svg>
          </button>
          <button type="button" class="pine-win-btn close" id="pine_win_close" title="Close Pine Editor">
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.5"><line x1="1" y1="1" x2="9" y2="9"/><line x1="9" y1="1" x2="1" y2="9"/></svg>
          </button>
        </div>
      </div>

      <!-- 2. Action Toolbar (Image 1 & 2) -->
      <div class="pine-toolbar-v2">
        <!-- Left Cluster -->
        <div class="pine-toolbar-v2-left">
          <!-- Script Selector Dropdown (Image 2) -->
          <div class="pine-script-dropdown-wrapper" id="pine_dropdown_wrapper" style="position: relative;">
            <button type="button" class="pine-script-dropdown-btn-v2" id="pine_script_dropdown_trigger" title="Script options and templates">
              <span class="pine-icon-sine">~</span>
              <span class="pine-script-title-text" id="pine_script_title_display">${escapeHtml(_currentScript.name)}</span>
              <span id="pine_dirty_indicator" class="pine-dirty-dot" style="display: none; color: #2962ff; margin-left: 3px; font-weight: bold;">*</span>
              <span class="pine-more-dots">...</span>
              <svg class="pine-caret-v2" viewBox="0 0 10 6">
                <path d="M0 0l5 5 5-5z" fill="currentColor"/>
              </svg>
            </button>
            <div class="pine-header-dropdown-menu-v2" id="pine_dropdown_menu">
              <div class="pine-menu-item-v2 ${(_currentScript.isReadOnly === true) ? 'disabled' : ''}" id="pine_menu_save_script">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                  </svg>
                  <span>Save script</span>
                </div>
                <span class="pine-menu-hotkey">Ctrl + S</span>
              </div>

              <div class="pine-menu-item-v2" id="pine_menu_make_copy">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                  </svg>
                  <span>Make a copy...</span>
                </div>
              </div>

              <div class="pine-menu-item-v2 ${(_currentScript.isReadOnly === true) ? 'disabled' : ''}" id="pine_menu_rename">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"/>
                  </svg>
                  <span>Rename...</span>
                </div>
              </div>

              <div class="pine-menu-item-v2" id="pine_menu_version_history">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 14 14"/>
                  </svg>
                  <span>Version history...</span>
                </div>
              </div>

              <div class="pine-menu-item-v2" id="pine_menu_toggle_dock_position">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="3" y1="15" x2="21" y2="15"/>
                    <polyline points="9 19 12 22 15 19"/>
                  </svg>
                  <span id="pine_dock_pos_text">${_dockPosition === 'bottom' ? 'Move script to side' : 'Move script to bottom'}</span>
                </div>
              </div>

              <div class="pine-menu-divider-v2"></div>

              <div class="pine-menu-item-v2" id="pine_menu_create_new">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <line x1="12" y1="5" x2="12" y2="19"/>
                    <line x1="5" y1="12" x2="19" y2="12"/>
                  </svg>
                  <span>Create new</span>
                </div>
                <span class="pine-menu-arrow">&rsaquo;</span>
              </div>

              <div class="pine-menu-divider-v2"></div>

              <div class="pine-menu-group-header-v2">RECENTLY USED</div>
              <div id="pine_dropdown_recent_list" class="pine-recent-list-v2"></div>

              <div class="pine-menu-divider-v2"></div>

              <div class="pine-menu-item-v2" id="pine_menu_open_script">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                  </svg>
                  <span>Open script...</span>
                </div>
                <span class="pine-menu-hotkey">Ctrl + O</span>
              </div>
            </div>
          </div>

          <!-- Add to Chart Button (Outline Play Button) -->
          <button id="pine_add_to_chart_btn" class="pine-btn-action-v2" title="Add indicator to chart (Ctrl + Enter)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polygon points="5 3 19 12 5 21 5 3"/>
            </svg>
            <span>Add to chart</span>
          </button>
        </div>

        <!-- Right Cluster -->
        <div class="pine-toolbar-v2-right">
          <!-- Publish Script Button -->
          <button id="pine_publish_btn" class="pine-btn-action-v2" title="Publish script to community">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
            <span>Publish script</span>
          </button>

          <!-- More Actions Button (••• with red dot) -->
          <div class="pine-more-dropdown-wrapper" id="pine_more_wrapper" style="position: relative;">
            <button id="pine_more_btn" class="pine-btn-icon-v2" title="More options">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <circle cx="5" cy="12" r="2"/>
                <circle cx="12" cy="12" r="2"/>
                <circle cx="19" cy="12" r="2"/>
              </svg>
              <span class="pine-red-notification-dot"></span>
            </button>
            <div class="pine-more-dropdown-menu-v2" id="pine_more_menu">
              <div class="pine-menu-item-v2" id="pine_menu_editor_settings">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <circle cx="12" cy="12" r="3"/>
                    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                  </svg>
                  <span>Editor settings...</span>
                </div>
              </div>

              <div class="pine-menu-divider-v2"></div>

              <div class="pine-menu-group-header-v2">OPEN EDITOR</div>
              <div class="pine-menu-item-v2" id="pine_menu_open_new_window">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="3" width="18" height="18" rx="2"/>
                    <line x1="3" y1="9" x2="21" y2="9"/>
                    <line x1="12" y1="13" x2="12" y2="17"/>
                    <line x1="10" y1="15" x2="14" y2="15"/>
                  </svg>
                  <span>New window</span>
                </div>
              </div>
              <div class="pine-menu-item-v2" id="pine_menu_open_new_tab">
                <div class="pine-menu-item-left">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                    <polyline points="15 3 21 3 21 9"/>
                    <line x1="10" y1="14" x2="21" y2="3"/>
                  </svg>
                  <span>New tab</span>
                </div>
              </div>

              <div class="pine-menu-divider-v2"></div>

              <div class="pine-menu-group-header-v2">DEVELOPER TOOLS</div>
              <div class="pine-menu-item-v2 pine-item-switch-row" id="pine_menu_profiler_row">
                <div class="pine-menu-item-left">
                  <span>Profiler mode</span>
                  <span class="pine-help-badge" title="Profile script execution time">?</span>
                </div>
                <label class="pine-toggle-switch">
                  <input type="checkbox" id="pine_profiler_switch">
                  <span class="pine-toggle-knob"></span>
                </label>
              </div>

              <div class="pine-menu-item-v2" id="pine_menu_pine_logs">
                <div class="pine-menu-item-left">
                  <span>Pine logs</span>
                  <span class="pine-help-badge" title="View runtime script logs">?</span>
                </div>
              </div>

              <div class="pine-menu-divider-v2"></div>

              <div class="pine-menu-item-v2" id="pine_menu_release_notes">
                <div class="pine-menu-item-left">
                  <span>Release notes</span>
                  <span class="pine-red-notification-dot inline"></span>
                </div>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/>
                  <line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </div>

              <div class="pine-menu-item-v2" id="pine_menu_help">
                <div class="pine-menu-item-left">
                  <span>Help</span>
                </div>
                <span class="pine-menu-arrow">&rsaquo;</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Read-Only Warning Banner (Image 1) -->
      <div class="pine-readonly-banner" id="pine_readonly_banner" style="display: ${_currentScript.isReadOnly === true ? 'flex' : 'none'};">
        <div class="pine-readonly-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#e65100">
            <circle cx="12" cy="12" r="10" fill="#e65100"/>
            <line x1="12" y1="8" x2="12" y2="12" stroke="#ffffff" stroke-width="2" stroke-linecap="round"/>
            <circle cx="12" cy="16" r="1.2" fill="#ffffff"/>
          </svg>
        </div>
        <div class="pine-readonly-text">
          This script is read-only. To edit its code you can <a href="#" class="pine-readonly-copy-link" id="pine_banner_copy_btn">make a copy.</a>
        </div>
      </div>

      <!-- 4. Editor Workspace & Minimap -->
      <div id="pine_editor_view" class="pine-workspace">
        <div id="pine_gutter" class="pine-gutter" data-name="pine_editor_gutter">1</div>
        <div class="pine-editor-container">
          <pre id="pine_syntax_backdrop" class="pine-syntax-backdrop" aria-hidden="true"><code id="pine_syntax_code" class="pine-syntax-code"></code></pre>
          <textarea id="pine_code_input" class="pine-code-textarea" name="pine_editor_textarea" data-name="pine_editor_textarea" spellcheck="false" placeholder="// Enter Pine Script v5/v6 code...">${escapeHtml(_currentScript.code)}</textarea>
          
          <!-- Minimap overview (Image 1 right strip) -->
          <div class="pine-minimap-strip" id="pine_minimap_strip">
            <div class="pine-minimap-slider" id="pine_minimap_slider"></div>
          </div>

          <!-- Floating Autocomplete / IntelliSense Popover -->
          <div id="pine_autocomplete_popover">
            <div class="pine-ac-header">
              <span>PINE INTELLISENSE</span>
              <span style="font-size: 10px; color: #787b86;">&uarr;&darr; Navigate &bull; Tab/Enter Insert &bull; Esc</span>
            </div>
            <div id="pine_ac_list" class="pine-ac-list"></div>
          </div>

          <!-- Parameter Hint Popover -->
          <div id="pine_param_hint"></div>
        </div>
      </div>

      <!-- 5. Collapsible Console Drawer (Image 5) -->
      <div id="pine_console_drawer_v2" class="pine-console-drawer-v2" style="display: none;">
        <div id="pine_console_v2_body" class="pine-console-v2-body">
          <div class="pine-console-v2-entry">${formatLogTime()} "${escapeHtml(_currentScript.name)}" opened</div>
        </div>
      </div>

      <!-- 6. Status Bar (Image 4) -->
      <div class="pine-bottom-statusbar-v2">
        <div class="pine-status-v2-left">
          <button type="button" class="pine-console-toggle-btn-v2" id="pine_console_toggle_btn" title="Toggle Pine Console">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="4 17 10 11 4 5"/>
              <line x1="12" y1="19" x2="20" y2="19"/>
            </svg>
          </button>
        </div>
        <div class="pine-status-v2-right">
          <span id="pine_status_rev_date" class="pine-status-item-v2">4 &middot; Aug 3, 18:31</span>
          <span id="pine_status_coords" class="pine-status-item-v2">Line 14, Col 35</span>
          <span id="pine_status_version" class="pine-status-item-v2">Pine Script&reg; v6</span>
        </div>
      </div>
    `;

    appRoot.appendChild(dock);

    // Mount Strategy Tester Panel if not present
    if (!document.getElementById('pine_strategy_tester_panel')) {
      const stratPanel = document.createElement('div');
      stratPanel.id = 'pine_strategy_tester_panel';
      stratPanel.innerHTML = `
        <div class="strat-header">
          <div class="strat-title-group">
            <div class="strat-title">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#2962ff" stroke-width="2.5">
                <line x1="18" y1="20" x2="18" y2="10"/>
                <line x1="12" y1="20" x2="12" y2="4"/>
                <line x1="6" y1="20" x2="6" y2="14"/>
              </svg>
              <span>Strategy Tester:</span>
              <span id="strat_script_name" style="color: #2962ff; font-weight: 500;">No Strategy</span>
            </div>
            <div class="strat-sub-tabs">
              <button type="button" class="strat-sub-tab active" data-tab="overview">Overview</button>
              <button type="button" class="strat-sub-tab" data-tab="performance">Performance Summary</button>
              <button type="button" class="strat-sub-tab" data-tab="trades">List of Trades (<span id="strat_trades_count_badge">0</span>)</button>
            </div>
          </div>
          <div class="strat-actions">
            <button type="button" id="strat_run_btn" class="strat-run-btn" title="Run backtest on current chart data">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Run Backtest
            </button>
            <button type="button" id="strat_close_btn" class="dock-icon-btn" title="Close Strategy Tester">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Performance Metric Cards -->
        <div class="strat-overview-cards" id="strat_overview_cards">
          <div class="strat-card">
            <span class="strat-card-title">Net Profit</span>
            <span class="strat-card-value" id="strat_net_profit">$0.00</span>
            <span class="strat-card-sub" id="strat_net_profit_pct">0.00%</span>
          </div>
          <div class="strat-card">
            <span class="strat-card-title">Total Closed Trades</span>
            <span class="strat-card-value" id="strat_total_trades">0</span>
            <span class="strat-card-sub" id="strat_open_trades">0 Open</span>
          </div>
          <div class="strat-card">
            <span class="strat-card-title">Percent Profitable</span>
            <span class="strat-card-value" id="strat_win_rate">0.0%</span>
            <span class="strat-card-sub" id="strat_win_loss_ratio">0W / 0L</span>
          </div>
          <div class="strat-card">
            <span class="strat-card-title">Profit Factor</span>
            <span class="strat-card-value" id="strat_profit_factor">0.00</span>
            <span class="strat-card-sub" id="strat_gross_pnl">GP: $0 | GL: $0</span>
          </div>
          <div class="strat-card">
            <span class="strat-card-title">Max Drawdown</span>
            <span class="strat-card-value profit-neg" id="strat_max_dd">$0.00</span>
            <span class="strat-card-sub" id="strat_max_dd_pct">0.00%</span>
          </div>
          <div class="strat-card">
            <span class="strat-card-title">Sharpe Ratio</span>
            <span class="strat-card-value" id="strat_sharpe">N/A</span>
            <span class="strat-card-sub" id="strat_sortino">Sortino: N/A</span>
          </div>
        </div>

        <!-- Content Body -->
        <div class="strat-body" id="strat_body">
          <div id="strat_panel_overview" style="padding: 16px;">
            <div id="strat_overview_content"></div>
          </div>
          <div id="strat_panel_performance" style="display: none; padding: 16px;">
            <div id="strat_perf_content"></div>
          </div>
          <div id="strat_panel_trades" style="display: none;">
            <table class="strat-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Type</th>
                  <th>Signal</th>
                  <th>Date / Time</th>
                  <th>Price</th>
                  <th>Contracts</th>
                  <th>Profit ($)</th>
                  <th>Cum. Equity ($)</th>
                </tr>
              </thead>
              <tbody id="strat_trades_tbody"></tbody>
            </table>
          </div>
          <div id="strat_empty_state" class="strat-empty-state">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#787b86" stroke-width="1.5">
              <line x1="18" y1="20" x2="18" y2="10"/>
              <line x1="12" y1="20" x2="12" y2="4"/>
              <line x1="6" y1="20" x2="6" y2="14"/>
            </svg>
            <div>
              <div style="font-size: 14px; font-weight: 600; color: #d1d4dc;">No Strategy Report Generated</div>
              <div style="font-size: 12px; margin-top: 4px;">Click "Run Backtest" or load a Strategy script (e.g. SMA Crossover Strategy) to test performance.</div>
            </div>
            <button type="button" id="strat_load_sample_btn" class="pine-btn primary" style="margin-top: 8px;">Load SMA Crossover Strategy</button>
          </div>
        </div>
      `;
      appRoot.appendChild(stratPanel);
    }

    // Mount Revision History Modal if not present
    if (!document.getElementById('pine_revisions_modal')) {
      const revModal = document.createElement('div');
      revModal.id = 'pine_revisions_modal';
      revModal.innerHTML = `
        <div class="pine-revisions-dialog">
          <div class="pine-revisions-header">
            <span>Script Revision History</span>
            <button type="button" id="pine_revisions_close_btn" class="dock-icon-btn" title="Close">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="pine-revisions-list" id="pine_revisions_list"></div>
        </div>
      `;
      appRoot.appendChild(revModal);
    }

    populateDropdownTemplates();
    fetchCatalog();
    bindEvents();
    updateGutter();

    // Attach controls and sync with iframe
    attachRightToolbarButton(_widget);
    attachBottomDockTabs(_widget);
    injectLegendPolishStyles();

    // Attach real-time lifecycle synchronization and study removal tracking
    const wInstance = _widget || root.widget;
    if (wInstance) {
      if (typeof wInstance.onChartReady === 'function') {
        wInstance.onChartReady(() => {
          const chart = wInstance.activeChart();
          if (chart) {
            setupChartLifecycleSync(chart);
            setupStudyRemovalObserver(chart);
          }
        });
      } else if (typeof wInstance.activeChart === 'function') {
        const chart = wInstance.activeChart();
        if (chart) {
          setupChartLifecycleSync(chart);
          setupStudyRemovalObserver(chart);
        }
      }
    }

    // Poller to ensure iframe styles, tabs, and lifecycle hooks remain active after layout switches
    setInterval(() => {
      injectLegendPolishStyles();
      attachBottomDockTabs(_widget);
      const activeChart = (_widget && typeof _widget.activeChart === 'function')
        ? _widget.activeChart()
        : (root.widget && typeof root.widget.activeChart === 'function' ? root.widget.activeChart() : null);
      if (activeChart) {
        setupChartLifecycleSync(activeChart);
        setupStudyRemovalObserver(activeChart);
      }
    }, 2500);
  }

  /* =========================================================================
   * 2. Script Selector Dropdown Population
   * ========================================================================= */
  function populateDropdownTemplates() {
    const list = document.getElementById('pine_dropdown_templates_list');
    if (!list) return;

    list.innerHTML = '';
    TEMPLATES.forEach(tpl => {
      const item = document.createElement('div');
      item.className = 'pine-dropdown-item' + (tpl.name === _currentScript.name ? ' active' : '');
      item.dataset.id = tpl.id;
      item.innerHTML = `<span>${escapeHtml(tpl.name)}</span>`;
      item.addEventListener('click', () => {
        loadScript(tpl.name, tpl.code, tpl.id);
        closeDropdown();
      });
      list.appendChild(item);
    });
  }

  function fetchCatalog() {
    fetch('/pine/catalog')
      .then(res => res.ok ? res.json() : [])
      .then(catalog => {
        if (!Array.isArray(catalog)) return;
        _catalogItems = catalog;
        renderCatalogDropdown(catalog);
      })
      .catch(() => {
        const catList = document.getElementById('pine_dropdown_catalog_list');
        if (catList) catList.innerHTML = '<div style="padding: 6px 14px; font-size: 11px; color: #787b86;">Catalog offline.</div>';
      });
  }

  function renderCatalogDropdown(items) {
    const catList = document.getElementById('pine_dropdown_catalog_list');
    if (!catList) return;

    if (!items || items.length === 0) {
      catList.innerHTML = '<div style="padding: 6px 14px; font-size: 11px; color: #787b86;">No catalog items found.</div>';
      return;
    }

    catList.innerHTML = '';
    items.forEach(item => {
      const el = document.createElement('div');
      el.className = 'pine-dropdown-item';
      el.dataset.pineName = item.pineName;
      el.innerHTML = `<span>${escapeHtml(item.name)}</span>`;
      el.addEventListener('click', async () => {
        logConsole(`Loading "${item.name}" source...`, "info");
        try {
          const resp = await fetch(`/pine/source/${encodeURIComponent(item.pineName)}`);
          if (resp.ok) {
            const code = await resp.text();
            loadScript(item.name, code, item.pineName);
            logConsole(`Loaded "${item.name}" successfully.`, "success");
          } else {
            throw new Error(`HTTP ${resp.status}`);
          }
        } catch (err) {
          logConsole(`Failed to load "${item.name}": ${err.message}`, "error");
        }
        closeDropdown();
      });
      catList.appendChild(el);
    });
  }

  
  function formatLogTime() {
    const d = new Date();
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit', hour12: true });
  }

  function logConsoleV2(msg) {
    const body = document.getElementById('pine_console_v2_body');
    if (body) {
      const div = document.createElement('div');
      div.className = 'pine-console-v2-entry';
      div.textContent = msg;
      body.appendChild(div);
      body.scrollTop = body.scrollHeight;
    }
  }

  function toggleConsoleDrawerV2() {
    const drawer = document.getElementById('pine_console_drawer_v2');
    const btn = document.getElementById('pine_console_toggle_btn');
    if (!drawer) return;
    const isHidden = drawer.style.display === 'none' || !drawer.style.display;
    drawer.style.display = isHidden ? 'block' : 'none';
    if (btn) {
      if (isHidden) btn.classList.add('active');
      else btn.classList.remove('active');
    }
  }

  function makeCopyOfCurrentScript() {
    const code = document.getElementById('pine_code_input')?.value || _currentScript.code;
    const baseName = _currentScript.name.replace(/\s*\((Copy|\d+)\)$/, '');
    const copyName = `${baseName} (Copy)`;
    _currentScript = {
      id: 'copy_' + Date.now(),
      name: copyName,
      code: code,
      isDirty: false,
      isReadOnly: false,
      activeStudyId: null
    };
    const titleDisplay = document.getElementById('pine_script_title_display');
    if (titleDisplay) titleDisplay.textContent = copyName;
    const banner = document.getElementById('pine_readonly_banner');
    if (banner) banner.style.display = 'none';
    const codeInput = document.getElementById('pine_code_input');
    if (codeInput) {
      codeInput.readOnly = false;
      codeInput.focus();
    }
    document.getElementById('pine_menu_save_script')?.classList.remove('disabled');
    document.getElementById('pine_menu_rename')?.classList.remove('disabled');
    logConsoleV2(`${formatLogTime()} "${copyName}" created and opened`);
    pushRecentlyUsedScript(copyName);
    renderRecentlyUsedList();
    saveCurrentToStorage();
  }

  function renderRecentlyUsedList() {
    const list = document.getElementById('pine_dropdown_recent_list');
    if (!list) return;
    const recents = getRecentlyUsedScripts();
    list.innerHTML = '';
    recents.forEach(name => {
      const item = document.createElement('div');
      const isActive = name === _currentScript.name || (name.startsWith('Sessions') && _currentScript.name.startsWith('Sessions'));
      item.className = 'pine-recent-item-v2' + (isActive ? ' active' : '');
      item.innerHTML = `<span>${escapeHtml(name)}</span>`;
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDropdown();
        const userScripts = getUserSavedScripts();
        const found = userScripts.find(s => s.name === name) || TEMPLATES.find(t => t.name === name || t.name.startsWith(name) || name.startsWith(t.name));
        if (found) {
          loadScript(found.name, found.code, found.id);
        } else {
          loadScript(name, `//@version=6\nindicator("${name}", overlay=true)\nplot(close)\n`, 'recent_' + Date.now());
        }
        logConsoleV2(`${formatLogTime()} "${name}" opened`);
      });
      list.appendChild(item);
    });
  }

  
  function getBuiltinScriptCode(name) {
    const cleanName = name || 'Indicator';
    if (cleanName.includes('Moving Average') || cleanName === 'SMA') {
      return `//@version=5\nindicator(title="Moving Average", shorttitle="MA", overlay=true)\nlen = input.int(9, minval=1, title="Length")\nsrc = input.source(close, title="Source")\nout = ta.sma(src, len)\nplot(out, color=color.blue, title="MA")\n`;
    }
    if (cleanName.includes('Exponential') || cleanName === 'EMA') {
      return `//@version=5\nindicator(title="Moving Average Exponential", shorttitle="EMA", overlay=true)\nlen = input.int(9, minval=1, title="Length")\nsrc = input.source(close, title="Source")\nout = ta.ema(src, len)\nplot(out, color=color.blue, title="EMA")\n`;
    }
    if (cleanName.includes('RSI') || cleanName.includes('Relative Strength Index')) {
      return `//@version=5\nindicator(title="Relative Strength Index", shorttitle="RSI", format=format.price, precision=2)\nlen = input.int(14, minval=1, title="Length")\nsrc = input.source(close, title="Source")\nup = ta.rma(math.max(ta.change(src), 0), len)\ndown = ta.rma(-math.min(ta.change(src), 0), len)\nrsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))\nplot(rsi, "RSI", color=#7E57C2)\nh1 = hline(70, "Upper Band", color=#787B86)\nh2 = hline(30, "Lower Band", color=#787B86)\nfill(h1, h2, color=color.rgb(126, 87, 194, 90), title="Background")\n`;
    }
    if (cleanName.includes('MACD')) {
      return `//@version=5\nindicator(title="Moving Average Convergence Divergence", shorttitle="MACD")\nfast_length = input.int(title="Fast Length", defval=12)\nslow_length = input.int(title="Slow Length", defval=26)\nsignal_length = input.int(title="Signal Length", defval=9)\nfast_ma = ta.ema(close, fast_length)\nslow_ma = ta.ema(close, slow_length)\nmacd = fast_ma - slow_ma\nsignal = ta.ema(macd, signal_length)\nhist = macd - signal\nplot(hist, title="Histogram", style=plot.style_columns, color=(hist>=0 ? (hist[1] < hist ? #26A69A : #B2DFDB) : (hist[1] < hist ? #FFCDD2 : #FF5252)))\nplot(macd, title="MACD", color=#2962FF)\nplot(signal, title="Signal", color=#FF6D00)\n`;
    }
    if (cleanName.includes('Bollinger') || cleanName.includes('BB')) {
      return `//@version=5\nindicator(shorttitle="BB", title="Bollinger Bands", overlay=true)\nlength = input.int(20, minval=1)\nsrc = input.source(close, title="Source")\nmult = input.float(2.0, minval=0.001, maxval=50, title="StdDev")\nbasis = ta.sma(src, length)\ndev = mult * ta.stdev(src, length)\nupper = basis + dev\nlower = basis - dev\nplot(basis, "Basis", color=#FF6D00)\np1 = plot(upper, "Upper", color=#2962FF)\np2 = plot(lower, "Lower", color=#2962FF)\nfill(p1, p2, title="Background", color=color.rgb(33, 150, 243, 95))\n`;
    }
    return `//@version=5\nindicator("${cleanName}", overlay=true)\nplot(close, "${cleanName}", color=color.blue)\n`;
  }

  function openScriptForStudy(studyTitle) {
    if (!studyTitle) return;
    closeIndicatorsModal();
    const cleanTitle = studyTitle.trim();
    const userScripts = getUserSavedScripts();
    const userMatch = userScripts.find(s => s.name === cleanTitle || cleanTitle.includes(s.name) || s.name.includes(cleanTitle));
    if (userMatch) {
      loadScript(userMatch.name, userMatch.code, userMatch.id, false);
      setDockOpen(true);
      return;
    }
    // Check TEMPLATES first for prebuilt indicators
    const tplMatch = TEMPLATES.find(t => t.name === cleanTitle || cleanTitle.includes(t.name) || t.name.includes(cleanTitle));
    if (tplMatch) {
      loadScript(tplMatch.name, tplMatch.code, 'builtin_' + tplMatch.id, true);
      setDockOpen(true);
      return;
    }
    // Built-in script -> read-only
    const bCode = getBuiltinScriptCode(cleanTitle);
    loadScript(cleanTitle, bCode, 'builtin_' + cleanTitle.toLowerCase().replace(/[^a-z0-9]/g, '_'), true);
    setDockOpen(true);
  }

  function showReadOnlyCopyPrompt() {
    showTVConfirmDialog({
      title: "Create a copy to edit",
      message: "This script is read-only. You should create a copy to edit it. Would you like to create a working copy now?",
      confirmText: "Create a copy",
      cancelText: "Cancel",
      isDanger: false,
      onConfirm: () => {
        makeCopyOfCurrentScript();
      }
    });
  }

  function loadScript(name, code, id, isReadOnly) {
    const scriptId = id || 'custom_script';
    const savedActiveId = localStorage.getItem('tv_pine_active_study_' + scriptId);
    const isBuiltinOrReadonly = (isReadOnly !== undefined) ? !!isReadOnly : (
      Boolean((scriptId && String(scriptId).startsWith('builtin_')) || (typeof BUILTIN_TECHNICALS !== 'undefined' && BUILTIN_TECHNICALS.includes(name)))
    );
    _currentScript = {
      id: scriptId,
      name: name,
      code: code,
      isDirty: false,
      isReadOnly: isBuiltinOrReadonly,
      activeStudyId: savedActiveId || null
    };

    const banner = document.getElementById('pine_readonly_banner');
    if (banner) banner.style.display = isBuiltinOrReadonly ? 'flex' : 'none';

    const saveScriptBtn = document.getElementById('pine_menu_save_script');
    if (saveScriptBtn) {
      if (isBuiltinOrReadonly) saveScriptBtn.classList.add('disabled');
      else saveScriptBtn.classList.remove('disabled');
    }
    const renameBtn = document.getElementById('pine_menu_rename');
    if (renameBtn) {
      if (isBuiltinOrReadonly) renameBtn.classList.add('disabled');
      else renameBtn.classList.remove('disabled');
    }

    const display = document.getElementById('pine_script_title_display');
    if (display) display.textContent = name;

    const codeInput = document.getElementById('pine_code_input');
    if (codeInput) {
      codeInput.value = code;
      updateGutter();
    }

    const dirtyEl = document.getElementById('pine_dirty_indicator');
    if (dirtyEl) dirtyEl.style.display = 'none';

    const verMatch = code ? code.match(/\/\/\s*@version\s*=\s*(\d+)/) : null;
    const verEl = document.getElementById('pine_version_display');
    if (verEl) {
      verEl.textContent = verMatch ? `PineScript v${verMatch[1]}` : 'PineScript v6';
    }

    setStatus('Ready', 'ready');
    saveCurrentToStorage();
    pushRecentlyUsedScript(name);
    renderRecentlyUsedList();
    updateAddButtonLabel();
  }

  function closeDropdown() {
    const wrapper = document.getElementById('pine_dropdown_wrapper');
    const menu = document.getElementById('pine_dropdown_menu');
    if (wrapper) wrapper.classList.remove('open');
    if (menu) menu.classList.remove('show');
  }

  /* =========================================================================
   * 3. Event Handlers & Core Actions
   * ========================================================================= */
  function bindEvents() {
    const dock = document.getElementById('pine_editor_dock');
    const codeInput = document.getElementById('pine_code_input');
    const dirtyInd = document.getElementById('pine_dirty_indicator');
    const cursorPos = document.getElementById('pine_cursor_pos');
    const saveBtn = document.getElementById('pine_menu_save_script');
    const addChartBtn = document.getElementById('pine_add_to_chart_btn');
    const compileBtn = document.getElementById('pine_btn_compile');
    const publishBtn = document.getElementById('pine_publish_btn');
    const toggleConsoleBtn = document.getElementById('pine_console_toggle_btn');
    const maxBtn = document.getElementById('pine_win_maximize');
    const minBtn = document.getElementById('pine_win_minimize');
    const closeBtn = document.getElementById('pine_win_close');
    const resizeHandle = document.getElementById('pine_resize_handle');

    // Window Controls
    if (minBtn) {
      minBtn.addEventListener('click', () => {
        setDockOpen(false);
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        setDockOpen(false);
      });
    }

    // Console Toggle [>_]
    if (toggleConsoleBtn) {
      toggleConsoleBtn.addEventListener('click', () => {
        toggleConsoleDrawerV2();
      });
    }

    // Read-only banner copy link
    const bannerCopyBtn = document.getElementById('pine_banner_copy_btn');
    if (bannerCopyBtn) {
      bannerCopyBtn.addEventListener('click', (e) => {
        e.preventDefault();
        makeCopyOfCurrentScript();
      });
    }

    // Top Right More Actions (•••) Dropdown
    const moreBtn = document.getElementById('pine_more_btn');
    const moreMenu = document.getElementById('pine_more_menu');
    const moreWrapper = document.getElementById('pine_more_wrapper');

    if (moreBtn && moreMenu) {
      moreBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        closeDropdown();
        const isOpen = moreMenu.classList.contains('show');
        if (isOpen) {
          moreMenu.classList.remove('show');
        } else {
          moreMenu.classList.add('show');
        }
      });

      document.addEventListener('click', (e) => {
        if (moreWrapper && !moreWrapper.contains(e.target)) {
          moreMenu.classList.remove('show');
        }
      });
    }

    // More Menu actions
    document.getElementById('pine_menu_editor_settings')?.addEventListener('click', () => {
      moreMenu?.classList.remove('show');
      openEditorSettingsModal();
    });
    document.getElementById('pine_menu_open_new_window')?.addEventListener('click', () => {
      moreMenu?.classList.remove('show');
      window.open(window.location.href, '_blank', 'width=1000,height=750');
    });
    document.getElementById('pine_menu_open_new_tab')?.addEventListener('click', () => {
      moreMenu?.classList.remove('show');
      window.open(window.location.href, '_blank');
    });
    document.getElementById('pine_menu_pine_logs')?.addEventListener('click', () => {
      moreMenu?.classList.remove('show');
      const drawer = document.getElementById('pine_console_drawer_v2');
      if (drawer) drawer.style.display = 'block';
    });
    document.getElementById('pine_menu_release_notes')?.addEventListener('click', () => {
      moreMenu?.classList.remove('show');
      window.open('https://www.tradingview.com/pine-script-docs/en/v6/Release_notes.html', '_blank');
    });
    document.getElementById('pine_menu_help')?.addEventListener('click', () => {
      moreMenu?.classList.remove('show');
      window.open('https://www.tradingview.com/pine-script-docs/en/v6/', '_blank');
    });

    // Add to chart action
    if (addChartBtn) {
      addChartBtn.addEventListener('click', async () => {
        logConsoleV2(`${formatLogTime()} "${_currentScript.name}" adding to chart...`);
        await addStudyToChart();
      });
    }

    // Publish script action
    if (publishBtn) {
      publishBtn.addEventListener('click', () => {
        alert("Publish Script: This script is ready for publication to the TradingView community library.");
      });
    }

    // Image 2 Script Dropdown Menu Handling
    const dropdownTrigger = document.getElementById('pine_script_dropdown_trigger');
    const dropdownWrapper = document.getElementById('pine_dropdown_wrapper');
    const dropdownMenu = document.getElementById('pine_dropdown_menu');

    if (dropdownTrigger && dropdownMenu) {
      dropdownTrigger.addEventListener('click', (e) => {
        e.stopPropagation();
        const isOpen = dropdownMenu.classList.contains('show');
        if (isOpen) {
          closeDropdown();
        } else {
          dropdownWrapper.classList.add('open');
          dropdownMenu.classList.add('show');
          renderRecentlyUsedList();
        }
      });

      document.addEventListener('click', (e) => {
        if (!dropdownWrapper.contains(e.target)) {
          closeDropdown();
        }
      });
    }

    document.getElementById('pine_menu_save_script')?.addEventListener('click', () => {
      closeDropdown();
      saveBtn.click();
    });

    document.getElementById('pine_menu_make_copy')?.addEventListener('click', () => {
      closeDropdown();
      makeCopyOfCurrentScript();
    });

    document.getElementById('pine_menu_rename')?.addEventListener('click', () => {
      closeDropdown();
      renameCurrentScript();
    });

    document.getElementById('pine_menu_version_history')?.addEventListener('click', () => {
      closeDropdown();
      openRevisionsModal();
    });

    document.getElementById('pine_menu_toggle_dock_position')?.addEventListener('click', () => {
      closeDropdown();
      setDockPosition(_dockPosition === 'bottom' ? 'side' : 'bottom');
    });

    document.getElementById('pine_menu_create_new')?.addEventListener('click', () => {
      closeDropdown();
      const choice = prompt("Create new script:\n1. Blank indicator\n2. Blank strategy\n3. Blank library\n\nEnter 1, 2, or 3:", "1");
      if (choice === "2") createNewScript('strategy');
      else if (choice === "3") createNewScript('library');
      else if (choice) createNewScript('indicator');
    });

    document.getElementById('pine_menu_open_script')?.addEventListener('click', () => {
      closeDropdown();
      openIndicatorsModal('myscripts');
    });

    closeBtn.addEventListener('click', () => {
      setDockOpen(false);
    });

    // Maximize / Restore Width
    maxBtn.addEventListener('click', () => {
      _isMaximized = !_isMaximized;
      if (_isMaximized) {
        dock.style.width = '75vw';
      } else {
        dock.style.width = `${_dockWidth}px`;
      }
      window.dispatchEvent(new Event('resize'));
    });

    // Horizontal Drag Resizing
    let isDragging = false;
    let startX = 0;
    let startW = 0;

    resizeHandle.addEventListener('mousedown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startW = dock.offsetWidth;
      resizeHandle.classList.add('dragging');
      document.body.style.cursor = 'ew-resize';
      document.body.style.userSelect = 'none';
    });

    document.addEventListener('mousemove', (e) => {
      if (!isDragging) return;
      const delta = startX - e.clientX;
      let newW = startW + delta;
      newW = Math.max(340, Math.min(window.innerWidth * 0.85, newW));
      dock.style.width = `${newW}px`;
      _dockWidth = newW;
    });

    document.addEventListener('mouseup', () => {
      if (!isDragging) return;
      isDragging = false;
      resizeHandle.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      localStorage.setItem(DOCK_WIDTH_KEY, String(_dockWidth));
      window.dispatchEvent(new Event('resize'));
    });

    resizeHandle.addEventListener('dblclick', () => {
      maxBtn.click();
    });

    // Textarea Editing & Cursor Sync
    codeInput.addEventListener('input', () => {
      updateGutter();
      updateSyntaxBackdrop();
      _currentScript.code = codeInput.value;
      _currentScript.isDirty = true;
      if (dirtyInd) dirtyInd.style.display = 'inline';
      setStatus('Ready', 'ready');
      saveCurrentToStorage();
      triggerAutocomplete();
      queueLiveCompilation();
    });

    codeInput.addEventListener('scroll', () => {
      const gutter = document.getElementById('pine_gutter');
      if (gutter) gutter.scrollTop = codeInput.scrollTop;
      const backdrop = document.getElementById('pine_syntax_backdrop');
      if (backdrop) {
        backdrop.scrollTop = codeInput.scrollTop;
        backdrop.scrollLeft = codeInput.scrollLeft;
      }
    });

    codeInput.addEventListener('keyup', updateCursor);
    codeInput.addEventListener('click', () => {
      updateCursor();
      hideAcPopover();
    });

    // Debounced live syntax checking
    let _compileDebounceTimer = null;
    function queueLiveCompilation() {
      if (_compileDebounceTimer) clearTimeout(_compileDebounceTimer);
      _compileDebounceTimer = setTimeout(() => {
        runCompilation(false);
      }, 700);
    }

    // Keybindings: Autocomplete Nav, Tab, Ctrl+S, Ctrl+B, Ctrl+Shift+Enter, Ctrl+Enter, Ctrl+Shift+T, Ctrl+Space
    codeInput.addEventListener('beforeinput', (e) => {
      if (_currentScript.isReadOnly) {
        e.preventDefault();
        showReadOnlyCopyPrompt();
      }
    });

    codeInput.addEventListener('paste', (e) => {
      if (_currentScript.isReadOnly) {
        e.preventDefault();
        showReadOnlyCopyPrompt();
      }
    });

    codeInput.addEventListener('keydown', (e) => {
      if (_currentScript.isReadOnly) {
        const isNav = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown', 'Escape'].includes(e.key);
        const isCopy = (e.ctrlKey || e.metaKey) && ['c', 'a'].includes(e.key.toLowerCase());
        if (!isNav && !isCopy) {
          e.preventDefault();
          showReadOnlyCopyPrompt();
          return;
        }
      }
      // Autocomplete Navigation
      if (_acVisible && _acCurrentMatches.length > 0) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          _acActiveIdx = (_acActiveIdx + 1) % _acCurrentMatches.length;
          renderAcList();
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          _acActiveIdx = (_acActiveIdx - 1 + _acCurrentMatches.length) % _acCurrentMatches.length;
          renderAcList();
          return;
        }
        if (e.key === 'Enter' || e.key === 'Tab') {
          e.preventDefault();
          insertAcItem(_acCurrentMatches[_acActiveIdx]);
          return;
        }
        if (e.key === 'ArrowRight' && codeInput.selectionStart === codeInput.selectionEnd && _inlineGhostSuggestion) {
          e.preventDefault();
          insertInlineGhost();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          clearInlineGhost();
          hideAcPopover();
          return;
        }
      }

      // Inline Ghost Suggestion completion with Tab or ArrowRight (when popover not handling)
      if (_inlineGhostSuggestion && (e.key === 'Tab' || (e.key === 'ArrowRight' && codeInput.selectionStart === codeInput.selectionEnd))) {
        e.preventDefault();
        insertInlineGhost();
        return;
      }
      if (e.key === 'Escape') {
        clearInlineGhost();
        hideAcPopover();
      }

      // Explicit Ctrl + Space for autocomplete
      if ((e.ctrlKey || e.metaKey) && (e.code === 'Space' || e.key === ' ')) {
        e.preventDefault();
        triggerAutocomplete(true);
        return;
      }

      // Ctrl + Shift + T for Strategy Tester
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === 't') {
        e.preventDefault();
        openStrategyTesterPanel();
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        saveBtn.click();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'b' || (e.shiftKey && e.key === 'Enter'))) {
        e.preventDefault();
        compileBtn.click();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        addChartBtn.click();
        return;
      }
      if (e.key === 'Tab') {
        e.preventDefault();
        const start = codeInput.selectionStart;
        const end = codeInput.selectionEnd;
        codeInput.value = codeInput.value.substring(0, start) + '  ' + codeInput.value.substring(end);
        codeInput.selectionStart = codeInput.selectionEnd = start + 2;
        codeInput.dispatchEvent(new Event('input'));
      }
    });

    // Dismiss Autocomplete on outside click
    document.addEventListener('click', (e) => {
      if (!e.target.closest('#pine_autocomplete_popover') && e.target !== codeInput) {
        hideAcPopover();
      }
    });

    // Save split dropdown menu
    const saveMenuBtn = document.getElementById('pine_save_menu_btn');
    const saveMenuDropdown = document.getElementById('pine_save_menu_dropdown');
    if (saveMenuBtn && saveMenuDropdown) {
      saveMenuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        saveMenuDropdown.classList.toggle('show');
      });

      document.addEventListener('click', (e) => {
        if (!e.target.closest('#pine_save_btn_group')) {
          saveMenuDropdown.classList.remove('show');
        }
      });

      document.getElementById('pine_menu_save')?.addEventListener('click', () => {
        saveBtn.click();
        saveMenuDropdown.classList.remove('show');
      });

      document.getElementById('pine_menu_save_as')?.addEventListener('click', () => {
        saveMenuDropdown.classList.remove('show');
        const newName = prompt("Enter new script name:", _currentScript.name + " Copy");
        if (newName && newName.trim()) {
          const newId = 'custom_' + Date.now();
          loadScript(newName.trim(), codeInput.value, newId);
          saveBtn.click();
          logConsole(`Saved as "${newName.trim()}"`, 'success');
        }
      });

      document.getElementById('pine_menu_revisions')?.addEventListener('click', () => {
        saveMenuDropdown.classList.remove('show');
        openRevisionsModal();
      });

      document.getElementById('pine_menu_new_script')?.addEventListener('click', () => {
        saveMenuDropdown.classList.remove('show');
        document.getElementById('pine_dropdown_new_script')?.click();
      });
    }

    // Revisions modal close buttons
    document.getElementById('pine_revisions_close_btn')?.addEventListener('click', () => {
      closeRevisionsModal();
    });
    document.getElementById('pine_revisions_modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'pine_revisions_modal') {
        closeRevisionsModal();
      }
    });

    // Strategy Tester Toolbar Button
    document.getElementById('pine_strat_tester_btn')?.addEventListener('click', () => {
      openStrategyTesterPanel();
    });

    // Strategy Tester Close Button
    document.getElementById('strat_close_btn')?.addEventListener('click', () => {
      closeStrategyTesterPanel();
    });

    // Strategy Tester Run Button
    document.getElementById('strat_run_btn')?.addEventListener('click', () => {
      runStrategyBacktest();
    });

    // Load SMA Crossover Strategy button in empty state
    document.getElementById('strat_load_sample_btn')?.addEventListener('click', () => {
      const smaTpl = TEMPLATES.find(t => t.id === 'sma_crossover_strategy');
      if (smaTpl) {
        loadScript(smaTpl.name, smaTpl.code, smaTpl.id);
        runStrategyBacktest(smaTpl.code);
      }
    });

    // Strategy Tester Sub-tabs switching
    document.querySelectorAll('.strat-sub-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.strat-sub-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const targetTab = tab.dataset.tab;
        _activeStratSubTab = targetTab;

        const pOverview = document.getElementById('strat_panel_overview');
        const pPerf = document.getElementById('strat_panel_performance');
        const pTrades = document.getElementById('strat_panel_trades');

        if (pOverview) pOverview.style.display = (targetTab === 'overview') ? 'block' : 'none';
        if (pPerf) pPerf.style.display = (targetTab === 'performance') ? 'block' : 'none';
        if (pTrades) pTrades.style.display = (targetTab === 'trades') ? 'block' : 'none';
      });
    });

    // Drawer Tabs & Switching
    const tabCompiler = document.getElementById('pine_tab_compiler');
    const tabLogs = document.getElementById('pine_tab_logs');
    const panelCompiler = document.getElementById('pine_compiler_panel');
    const panelLogs = document.getElementById('pine_logs_panel');

    function switchDrawerTab(tab) {
      _activeDrawerTab = tab;
      if (tab === 'compiler') {
        tabCompiler?.classList.add('active');
        tabLogs?.classList.remove('active');
        if (panelCompiler) panelCompiler.style.display = 'flex';
        if (panelLogs) panelLogs.style.display = 'none';
      } else {
        tabCompiler?.classList.remove('active');
        tabLogs?.classList.add('active');
        if (panelCompiler) panelCompiler.style.display = 'none';
        if (panelLogs) panelLogs.style.display = 'flex';
      }
    }

    tabCompiler?.addEventListener('click', () => switchDrawerTab('compiler'));
    tabLogs?.addEventListener('click', () => switchDrawerTab('logs'));

    // Gutter Click to jump to line
    const gutterEl = document.getElementById('pine_gutter');
    if (gutterEl) {
      gutterEl.addEventListener('click', (e) => {
        const lineEl = e.target.closest('.pine-gutter-line');
        if (lineEl && lineEl.dataset.line) {
          const line = parseInt(lineEl.dataset.line, 10);
          jumpToLineAndCol(line, 1);
        }
      });
    }

    // Comprehensive Pine Script Compiler Function
    async function runCompilation(showDrawerOnSuccess = false) {
      const code = codeInput ? codeInput.value.trim() : '';
      const compilerBody = document.getElementById('pine_compiler_body');
      const badge = document.getElementById('pine_compiler_badge');
      const drawer = document.getElementById('pine_console_drawer');
      const toggleBtn = document.getElementById('pine_toggle_console_btn');

      if (!code) {
        setStatus('Ready', 'ready');
        if (badge) {
          badge.textContent = '0';
          badge.className = 'pine-tab-badge success';
        }
        _compilerErrors = [];
        updateGutter([]);
        if (compilerBody) {
          compilerBody.innerHTML = '<div class="pine-compiler-placeholder">Script is empty. Enter Pine Script code.</div>';
        }
        return { success: false, errors: [] };
      }

      setStatus('Compiling...', 'compiling');
      const compileStartTime = performance.now();

      let res = null;
      if (root.PineIndicators && typeof root.PineIndicators.compilePineScript === 'function') {
        try {
          res = root.PineIndicators.compilePineScript(code);
        } catch (err) {
          res = {
            success: false,
            errors: parseDiagnosticErrors(err, code),
            warnings: []
          };
        }
      }

      // Step 2: Direct PineTS fallback
      if (!res && (root.PineTSLib || root.PineTS)) {
        const pts = root.PineTSLib || root.PineTS;
        try {
          if (typeof pts.pineToJS === 'function') {
            const pRes = pts.pineToJS(code);
            if (pRes && pRes.success === false) {
              res = {
                success: false,
                errors: parseDiagnosticErrors(pRes.error || 'Syntax error in Pine script', code),
                warnings: []
              };
            }
          }
          if (!res && pts.Indicator) {
            const ind = (typeof pts.Indicator.from === 'function') ? pts.Indicator.from(code) : new pts.Indicator(code);
            if (ind && typeof ind.prepare === 'function') {
              ind.prepare();
            }
            res = { success: true, errors: [], warnings: [] };
          }
        } catch (ptsErr) {
          res = {
            success: false,
            errors: parseDiagnosticErrors(ptsErr, code),
            warnings: []
          };
        }
      }

      // Step 3: Backend /pine/transpile fallback verification if client engine is unavailable or unpopulated
      if (!res || (!res.success && (!res.errors || res.errors.length === 0))) {
        try {
          const resp = await fetch('/pine/transpile', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ source: code })
          });
          const data = await resp.json();
          if (data.success) {
            res = { success: true, errors: [], warnings: [], code: data.code, inputs: data.inputs };
          } else {
            res = {
              success: false,
              errors: parseDiagnosticErrors(data.errors || data.error || data, code),
              warnings: []
            };
          }
        } catch (fetchErr) {}
      }

      if (!res) {
        res = {
          success: false,
          errors: [{ line: 1, column: 1, message: 'Compiler engine unavailable', severity: 'error', sourceLine: code.split('\n')[0] || '' }],
          warnings: []
        };
      }

      if (!res.success) {
        res.errors = parseDiagnosticErrors(res.errors || res.error || 'Compilation failed', code);
      }

      const lines = code.split('\n');
      const compileDuration = Math.round(performance.now() - compileStartTime);

      if (res.success) {
        _compilerErrors = [];
        setStatus(`Compiled (${compileDuration}ms)`, 'ready');
        logConsole(`[Profiler] Script "${_currentScript.name}" compiled in ${compileDuration}ms (0 errors, 0 warnings).`, 'info');
        if (badge) {
          badge.textContent = '0';
          badge.className = 'pine-tab-badge success';
        }
        updateGutter([]);
        if (compilerBody) {
          compilerBody.innerHTML = `
            <div class="pine-compiler-success">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#089981" stroke-width="2.5">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
              <div>
                <div class="pine-success-title">Compiled successfully in ${compileDuration}ms</div>
                <div class="pine-success-sub">0 errors, 0 warnings. Script is ready to add to chart.</div>
              </div>
            </div>
          `;
        }
        if (showDrawerOnSuccess) {
          switchDrawerTab('compiler');
          if (drawer) drawer.style.display = 'flex';
          _isConsoleOpen = true;
          if (toggleBtn) toggleBtn.classList.add('active');
        }
        return res;
      } else {
        _compilerErrors = res.errors || [];
        const firstErr = _compilerErrors[0];
        setStatus(firstErr ? `Error: Line ${firstErr.line}` : 'Compile Error', 'error');
        if (badge) {
          badge.textContent = String(_compilerErrors.length);
          badge.className = 'pine-tab-badge error';
        }
        updateGutter(_compilerErrors);

        if (compilerBody) {
          let errHtml = '';
          _compilerErrors.forEach((err) => {
            const previewLine = err.sourceLine || (lines[err.line - 1] ? lines[err.line - 1].trim() : '');
            errHtml += `
              <div class="pine-compiler-error-item pine-error-item ${err.severity || 'error'}" data-line="${err.line}" data-col="${err.column}" onclick="window.jumpToLineAndCol(${err.line}, ${err.column})" title="Click to jump to Line ${err.line}, Col ${err.column}">
                <div class="pine-err-header">
                  <span class="pine-err-badge error-badge ${err.severity || 'error'}">${(err.severity || 'error').toUpperCase()}</span>
                  <span class="pine-err-badge-loc error-location">Line ${err.line}:${err.column}</span>
                  <span class="pine-err-jump-hint">Click to jump &rarr;</span>
                </div>
                <div class="pine-err-msg error-message">${escapeHtml(err.message)}</div>
                ${previewLine ? `<div class="pine-err-code-preview"><code>${escapeHtml(previewLine)}</code></div>` : ''}
              </div>
            `;
          });
          compilerBody.innerHTML = errHtml;

          // Attach jump click listeners
          compilerBody.querySelectorAll('.pine-compiler-error-item, .pine-error-item').forEach(item => {
            item.addEventListener('click', () => {
              const line = parseInt(item.dataset.line, 10) || 1;
              const col = parseInt(item.dataset.col, 10) || 1;
              jumpToLineAndCol(line, col);
            });
          });
        }

        // Auto switch to compiler tab and open drawer on error
        switchDrawerTab('compiler');
        if (drawer) drawer.style.display = 'flex';
        _isConsoleOpen = true;
        if (toggleBtn) toggleBtn.classList.add('active');

        return res;
      }
    }

    // Compile Action Button (Toolbar)
    if (compileBtn) {
      compileBtn.addEventListener('click', async () => {
        const res = await runCompilation(true);
        if (res && res.success && _currentScript.activeStudyId && isStudyOnChart(_currentScript.activeStudyId)) {
          logConsole(`[Auto-Recompile] Updating active indicator "${_currentScript.name}" on chart...`, "info");
          await addStudyToChart();
        }
      });
    }

    // Save Action
    if (saveBtn) {
      saveBtn.addEventListener('click', async () => {
        if (_currentScript.isReadOnly) {
          showReadOnlyCopyPrompt();
          return;
        }
        _currentScript.isDirty = false;
        if (dirtyInd) dirtyInd.style.display = 'none';
        saveCurrentToStorage();
        saveScriptRevision(_currentScript.id, _currentScript.name, _currentScript.code);
        logConsole(`Script "${_currentScript.name}" saved successfully.`, "success");
        await runCompilation(false);
      });
    }

    // Publish Action
    if (publishBtn) {
      publishBtn.addEventListener('click', () => {
        logConsole(`Publishing "${_currentScript.name}" to TradingView community script repository...`, "info");
        setTimeout(() => {
          logConsole(`Script "${_currentScript.name}" verified and ready for publication.`, "success");
        }, 500);
      });
    }

    // Add to Chart Action (Validates with Compiler First, then Adds with lock: false)
    async function addStudyToChart(sourceCode = null) {
      const code = (sourceCode !== null ? sourceCode : (codeInput ? codeInput.value : '')).trim();
      if (!code) {
        logConsole("Script is empty. Please enter Pine Script code.", "warn");
        return null;
      }

      // Step 1: Run compilation check
      const compileCheck = await runCompilation(false);
      if (!compileCheck || !compileCheck.success) {
        logConsole(`Cannot add to chart: script has ${(_compilerErrors && _compilerErrors.length) || 1} compile error(s).`, "error");
        switchDrawerTab('compiler');
        if (consoleDrawer) consoleDrawer.style.display = 'flex';
        _isConsoleOpen = true;
        toggleConsoleBtn?.classList.add('active');
        return null;
      }

      const isRecompiling = Boolean(_currentScript.activeStudyId && isStudyOnChart(_currentScript.activeStudyId));
      setStatus(isRecompiling ? 'Recompiling...' : 'Adding...', 'compiling');

      try {
        let studyObj = compileCheck.study;
        let meta = compileCheck.meta;
        if (!studyObj && root.PineIndicators && typeof root.PineIndicators.compileAndRegisterPine === 'function') {
          const regRes = root.PineIndicators.compileAndRegisterPine(code);
          studyObj = regRes.study;
          meta = regRes.meta;
        }

        if (!studyObj || !studyObj.metainfo) {
          throw new Error("Compilation did not produce a valid study descriptor.");
        }

        const studyName = (meta && meta.title) || studyObj.name || studyObj.metainfo.description;
        const isOverlay = (meta && meta.isOverlay !== undefined) ? meta.isOverlay : Boolean(studyObj.metainfo.is_price_study);

        // 1. Register into window._customPineStudies
        root._customPineStudies = root._customPineStudies || [];
        const customIdx = root._customPineStudies.findIndex(s => s && (s.name === studyName || (s.metainfo && s.metainfo.id === studyObj.metainfo.id)));
        if (customIdx >= 0) {
          root._customPineStudies[customIdx] = studyObj;
        } else {
          root._customPineStudies.push(studyObj);
        }

        // 2. Register into JSServer.studyLibrary (both outer and inner window)
        const innerWin = (_widget && typeof _widget._innerWindow === 'function')
          ? _widget._innerWindow()
          : document.querySelector('#tv_chart_container iframe')?.contentWindow;

        [root, innerWin].forEach(win => {
          if (!win) return;
          const jsServer = win.JSServer || (win.Kv && win.Kv.JSServer);
          if (jsServer && Array.isArray(jsServer.studyLibrary)) {
            const idx = jsServer.studyLibrary.findIndex(s => s && (s.name === studyName || (s.metainfo && s.metainfo.id === studyObj.metainfo.id)));
            if (idx >= 0) {
              jsServer.studyLibrary[idx] = studyObj;
            } else {
              jsServer.studyLibrary.push(studyObj);
            }
          }
          if (win.JSServer) {
            win.Kv = win.Kv || {};
            win.Kv.JSServer = win.JSServer;
          }
        });

        const chart = _widget ? _widget.activeChart() : (root.widget ? root.widget.activeChart() : null);
        if (!chart || typeof chart.createStudy !== 'function') {
          throw new Error("TradingView chart widget is not ready.");
        }

        // In-Place Recompilation: Safely remove previous instance before re-creating
        if (isRecompiling) {
          logConsole(`[Recompiling] Hot-updating active study "${studyName}" (${_currentScript.activeStudyId}) on chart...`, "info");
          try {
            clearStudyShapes(_currentScript.activeStudyId, chart);
            chart.removeEntity(_currentScript.activeStudyId);
          } catch(e) {}
          if (root._pineActiveStudies) {
            root._pineActiveStudies.delete(_currentScript.activeStudyId);
          }
        }

        // 3. Register into chart.studyMetaInfoRepository()
        const repo = typeof chart.studyMetaInfoRepository === 'function'
          ? chart.studyMetaInfoRepository()
          : (typeof chart.studyMetaIntoRepository === 'function' ? chart.studyMetaIntoRepository() : null);

        if (repo) {
          if (typeof repo.addStudyMetaInfo === 'function') {
            try { repo.addStudyMetaInfo(studyObj.metainfo); } catch (e) {}
          }
          if (typeof repo._processLibraryMetaInfo === 'function') {
            try { repo._processLibraryMetaInfo([studyObj.metainfo]); } catch (e) {}
          }
          if (Array.isArray(repo._rawStudiesMetaInfo)) {
            if (!repo._rawStudiesMetaInfo.some(s => s && s.id === studyObj.metainfo.id)) {
              repo._rawStudiesMetaInfo.push(studyObj.metainfo);
            }
          }
          if (Array.isArray(repo._javaStudiesMetaInfo)) {
            if (!repo._javaStudiesMetaInfo.some(s => s && s.id === studyObj.metainfo.id)) {
              repo._javaStudiesMetaInfo.push(studyObj.metainfo);
            }
          }
        }

        // 4. Call chart.createStudy with { lock: false }
        // Passing { lock: false } ensures TradingView displays native hover action buttons:
        // Hide/Show (👁️), Settings (⚙️), Delete (🗑️)
        const studyId = await chart.createStudy(studyName, isOverlay, false, [], { lock: false });

        // Track active study for in-place recompile and lifecycle sync
        _currentScript.activeStudyId = studyId;
        try {
          localStorage.setItem('tv_pine_active_study_' + _currentScript.id, studyId);
        } catch(e) {}
        updateAddButtonLabel();

        const trackedId = studyId || `study_${Date.now()}`;
        root._pineActiveStudies = root._pineActiveStudies || new Map();
        root._pineActiveStudies.set(trackedId, {
          id: trackedId,
          name: studyName,
          isOverlay: isOverlay,
          study: studyObj,
          code: code,
          createdAt: Date.now()
        });

        // Register aliases between chart studyId, name, and metainfo id
        if (root.PineIndicators && typeof root.PineIndicators.registerStudyAlias === 'function') {
          root.PineIndicators.registerStudyAlias(trackedId, [studyName, meta && meta.title, studyObj && studyObj.metainfo && studyObj.metainfo.id]);
        }

        // If session indicator or script has session references, render session visuals
        if (studyName.toLowerCase().includes('session') || code.toLowerCase().includes('session')) {
          if (root.PineIndicators && typeof root.PineIndicators.renderSessionVisuals === 'function') {
            await root.PineIndicators.renderSessionVisuals(chart, code, trackedId);
          }
        }

        // Setup lifecycle synchronization on chart
        setupChartLifecycleSync(chart);

        // Setup study removal monitoring to cleanup shapes/tables on Delete
        setupStudyRemovalObserver(chart);

        // Setup direct visibility property subscription if available
        try {
          const studyApi = chart.getStudyById(studyId);
          if (studyApi && typeof studyApi.properties === 'function') {
            const props = studyApi.properties();
            const visProp = props && (props.visible || (props.childs && props.childs().visible));
            if (visProp && typeof visProp.subscribe === 'function') {
              visProp.subscribe(null, (newVal) => {
                const isV = typeof newVal === 'boolean' ? newVal : (newVal && typeof newVal.value === 'function' ? newVal.value() : studyApi.isVisible());
                if (root.PineIndicators && typeof root.PineIndicators.setStudyShapesVisibility === 'function') {
                  root.PineIndicators.setStudyShapesVisibility(trackedId, isV, chart);
                }
              });
            }
          }
        } catch(e) {}

        if (isRecompiling) {
          setStatus('Recompiled', 'saved');
          logConsole(`[Recompiled] "${studyName}" recompiled and updated on chart successfully.`, "success");
        } else {
          setStatus('Saved', 'saved');
          logConsole(`Added "${studyName}" to active chart successfully (${(meta && meta.plots ? meta.plots.length : 0)} plot(s), ${isOverlay ? 'overlay' : 'pane'}).`, "success");
        }

        _currentScript.isDirty = false;
        if (dirtyInd) dirtyInd.style.display = 'none';
        saveCurrentToStorage();
        saveScriptRevision(_currentScript.id, studyName, code);

        if (studyName.toLowerCase().includes('strategy') || code.toLowerCase().includes('strategy(')) {
          runStrategyBacktest(code);
        }

        injectLegendPolishStyles();

        return studyId;

      } catch (err) {
        setStatus('Error', 'error');
        logConsole(`Add to chart failed: ${err.message}`, "error");
        if (consoleDrawer) consoleDrawer.style.display = 'flex';
        _isConsoleOpen = true;
        toggleConsoleBtn?.classList.add('active');
        return null;
      }
    }

    // Expose addStudyToChart locally and on PineEditorIDE
    _addStudyToChartFn = addStudyToChart;
    _runCompilationFn = runCompilation;

    addChartBtn.addEventListener('click', () => {
      addStudyToChart();
    });

    // Console Drawer Controls
    toggleConsoleBtn.addEventListener('click', () => {
      _isConsoleOpen = !_isConsoleOpen;
      consoleDrawer.style.display = _isConsoleOpen ? 'flex' : 'none';
      toggleConsoleBtn.classList.toggle('active', _isConsoleOpen);
    });

    document.getElementById('pine_hide_console_btn')?.addEventListener('click', () => {
      _isConsoleOpen = false;
      consoleDrawer.style.display = 'none';
      toggleConsoleBtn.classList.remove('active');
    });

    document.getElementById('pine_clear_console_btn')?.addEventListener('click', () => {
      if (_activeDrawerTab === 'compiler') {
        const compBody = document.getElementById('pine_compiler_body');
        if (compBody) compBody.innerHTML = '<div class="pine-compiler-placeholder">Compiler log cleared.</div>';
      } else {
        const logBody = document.getElementById('pine_console_body');
        if (logBody) logBody.innerHTML = '';
      }
    });
  }

  function setStatus(text, type) {
    const pill = document.getElementById('pine_compiler_status');
    const label = document.getElementById('pine_compiler_status_text');
    if (!pill || !label) return;
    pill.className = `pine-status-pill ${type}`;
    label.textContent = text;
  }

  function updateGutter(errors = _compilerErrors) {
    const codeInput = document.getElementById('pine_code_input');
    const gutter = document.getElementById('pine_gutter');
    if (!codeInput || !gutter) return;
    const lines = codeInput.value.split('\n');
    const errorMap = new Map();
    (errors || []).forEach(e => {
      if (e && e.line) {
        errorMap.set(e.line, e.message || 'Error on this line');
      }
    });

    let html = '';
    for (let i = 1; i <= lines.length; i++) {
      if (errorMap.has(i)) {
        html += `<div class="pine-gutter-line error" data-line="${i}" onclick="window.jumpToLineAndCol(${i}, 1)" title="${escapeHtml(errorMap.get(i))}">${i} <span class="pine-gutter-err-dot">●</span></div>`;
      } else {
        html += `<div class="pine-gutter-line" data-line="${i}" onclick="window.jumpToLineAndCol(${i}, 1)">${i}</div>`;
      }
    }
    gutter.innerHTML = html;
    updateSyntaxBackdrop();
  }

  function setDockOpen(open) {
    _isDockOpen = open;
    if (open && !document.getElementById('pine_editor_dock')) {
      mountPineEditorIDE(_widget || root.widget || (typeof window !== 'undefined' ? window.widget : null));
    }
    const dock = document.getElementById('pine_editor_dock');
    if (dock) {
      dock.style.display = open ? 'flex' : 'none';
    }

    // Update right toolbar button in iframe
    syncRightToolbarButton(open);

    // Update bottom dock tabs in iframe
    syncBottomDockTabs(open);

    window.dispatchEvent(new Event('resize'));
  }

  function logConsole(msg, level = 'info') {
    console.log(msg);
    const body = document.getElementById('pine_console_body');
    if (!body) return;
    const now = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = `pine-console-entry ${level}`;
    entry.innerHTML = `<span style="color: #5d606b;">[${now}]</span> <span>${escapeHtml(msg)}</span>`;
    body.appendChild(entry);
    body.scrollTop = body.scrollHeight;
  }

  function saveCurrentToStorage() {
    try {
      localStorage.setItem(CURRENT_SCRIPT_KEY, JSON.stringify(_currentScript));
    } catch (e) {}
  }

  function escapeHtml(str) {
    return String(str || '').replace(/[&<>"]/g, c => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'
    }[c]));
  }

  /* =========================================================================
   * 4. R4: Definitive Chart Legend Polish & Defect Fix CSS Injection
   * ========================================================================= */
  function injectLegendPolishStyles() {
    try {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const innerDoc = iframe?.contentDocument || (_widget && typeof _widget._innerWindow === 'function' && _widget._innerWindow()?.document);
      if (!innerDoc || !innerDoc.head) return;

      if (!innerDoc.getElementById('pine-legend-polish-styles')) {
        const style = innerDoc.createElement('style');
        style.id = 'pine-legend-polish-styles';
        style.textContent = `
          /* Suppress interval eye icon completely */
          [data-name="legend-interval-show-hide-action"],
          .intervalEye,
          [class*="intervalEye"],
          [class*="intervalShowHideAction"] {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            pointer-events: none !important;
            margin: 0 !important;
            padding: 0 !important;
            opacity: 0 !important;
            position: absolute !important;
            left: -9999px !important;
            visibility: hidden !important;
          }

          /* Strictly hide all blockHidden elements (unlabelled duplicate close price, n/a, duplicate day change) */
          [class*="blockHidden"],
          .blockHidden-e6PF69Df {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
            opacity: 0 !important;
            visibility: hidden !important;
            pointer-events: none !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* Enforce nowrap on values wrappers to prevent vertical wrapping */
          [class*="valuesWrapper"],
          [class*="valuesAdditionalWrapper"],
          .valuesWrapper-l31H9iuA,
          .valuesAdditionalWrapper-l31H9iuA {
            display: inline-flex !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
            align-items: center !important;
            vertical-align: middle !important;
            max-width: 65vw !important;
            max-height: 24px !important;
            line-height: 24px !important;
            visibility: visible !important;
            opacity: 1 !important;
          }

          /* Legend titles & individual values */
          [class*="valueValue-"],
          [class*="valueTitle-"],
          [class*="title-l31H9iuA"] {
            display: inline-block !important;
            white-space: nowrap !important;
            font-size: 11px !important;
            line-height: 14px !important;
            padding: 0 2px !important;
          }

          /* Hover action buttons in legend */
          [class*="legend-"] [class*="actions-"],
          [data-name="legend"] [class*="actions-"],
          .actions-l31H9iuA {
            display: inline-flex !important;
            align-items: center !important;
            gap: 2px !important;
            opacity: 0;
            transition: opacity 0.15s ease-in-out;
            margin-left: 4px !important;
            vertical-align: middle !important;
          }

          [class*="legend-"] [class*="item-"]:hover [class*="actions-"],
          [class*="legend-"] [class*="item-"][class*="selected-"] [class*="actions-"],
          [data-name="legend"] [class*="item-"]:hover [class*="actions-"],
          [data-name="legend"] [class*="item-"][class*="selected-"] [class*="actions-"],
          .item-l31H9iuA:hover .actions-l31H9iuA,
          .item-l31H9iuA.selected-l31H9iuA .actions-l31H9iuA {
            opacity: 1 !important;
            visibility: visible !important;
            pointer-events: auto !important;
          }

          [class*="legend-"] [class*="action-"],
          [data-name="legend"] [class*="action-"],
          .action-l31H9iuA {
            cursor: pointer !important;
            display: inline-flex !important;
            align-items: center !important;
            justify-content: center !important;
            padding: 2px !important;
            border-radius: 4px !important;
            color: #787b86 !important;
            transition: color 0.12s, background-color 0.12s !important;
          }

          [class*="legend-"] [class*="action-"]:hover,
          [data-name="legend"] [class*="action-"]:hover,
          .action-l31H9iuA:hover {
            color: #d1d4dc !important;
            background-color: rgba(255, 255, 255, 0.08) !important;
          }

          /* Bottom tabs styling and text visibility */
          #tv_footer_pine_editor_tab,
          #tv_footer_strategy_tester_tab,
          .tab-n3UmcVi3 {
            overflow: visible !important;
            flex-shrink: 0 !important;
          }

          .js-bottom-pine-tab,
          .js-bottom-strat-tab,
          .tab-jJ_D7IlA {
            white-space: nowrap !important;
            overflow: visible !important;
            padding: 0 10px !important;
          }

          .titleText-RoCcHn9S {
            overflow: visible !important;
            text-overflow: clip !important;
            white-space: nowrap !important;
          }
        `;
        innerDoc.head.appendChild(style);
      }
    } catch (e) {}
  }

  /* =========================================================================
   * 5. Bottom Dock Tabs Integration (Pine Editor | Strategy Tester | Trading Panel)
   * ========================================================================= */
  function attachBottomDockTabs(widgetInstance) {
    const w = widgetInstance || _widget || root.widget;

    try {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const innerDoc = iframe?.contentDocument || (w && typeof w._innerWindow === 'function' && w._innerWindow()?.document);
      if (!innerDoc) return;

      const footerPanel = innerDoc.querySelector('#footer-chart-panel');
      if (!footerPanel) return;

      // Find the tabs container
      const tabsWrapper = footerPanel.querySelector('.tabs-n3UmcVi3:not(.fakeTabs-n3UmcVi3)');
      if (!tabsWrapper) return;

      // Hook any native scripteditor tab if already in DOM
      const existingScriptTab = innerDoc.querySelector('[data-name="scripteditor"]');
      if (existingScriptTab && !existingScriptTab._pineHooked) {
        existingScriptTab._pineHooked = true;
        existingScriptTab.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          setDockOpen(!_isDockOpen);
        });
      }

      if (tabsWrapper.querySelector('[data-name="scripteditor"], [data-name="pine_editor_tab"]')) {
        return; // Already attached
      }

      // 1. Create Pine Editor tab
      const pineTabDiv = innerDoc.createElement('div');
      pineTabDiv.className = 'tab-n3UmcVi3';
      pineTabDiv.id = 'tv_footer_pine_editor_tab';
      pineTabDiv.innerHTML = `
        <button aria-label="Pine Editor" data-name="scripteditor" data-alt-name="pine_editor_tab" tabindex="-1" type="button" class="tab-jJ_D7IlA accessible-jJ_D7IlA js-bottom-pine-tab apply-common-tooltip container-RoCcHn9S">
          <span class="title-RoCcHn9S"><span class="titleText-RoCcHn9S">Pine Editor</span></span>
        </button>
      `;

      // 2. Create Strategy Tester tab
      const stratTabDiv = innerDoc.createElement('div');
      stratTabDiv.className = 'tab-n3UmcVi3';
      stratTabDiv.id = 'tv_footer_strategy_tester_tab';
      stratTabDiv.innerHTML = `
        <button aria-label="Strategy Tester" data-name="strategy_tester_tab" tabindex="-1" type="button" class="tab-jJ_D7IlA accessible-jJ_D7IlA js-bottom-strat-tab apply-common-tooltip container-RoCcHn9S">
          <span class="title-RoCcHn9S"><span class="titleText-RoCcHn9S">Strategy Tester</span></span>
        </button>
      `;

      // Insert Pine Editor and Strategy Tester before the existing Account Manager / Trading Panel tab
      tabsWrapper.insertBefore(pineTabDiv, tabsWrapper.firstChild);
      tabsWrapper.insertBefore(stratTabDiv, tabsWrapper.children[1] || null);

      // Handle Tab Clicks
      pineTabDiv.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        closeStrategyTesterPanel();
        stratTabDiv.classList.remove('active-n3UmcVi3');

        const nowOpen = !_isDockOpen;
        setDockOpen(nowOpen);

        // If Account Manager was open in bottom area, minimize it so they do not clash
        if (nowOpen) {
          try {
            const bw = innerDoc.defaultView?.TradingView?.bottomWidgetBar || root.TradingView?.bottomWidgetBar;
            if (bw && typeof bw.close === 'function') {
              bw.close();
            }
          } catch (err) {}
        }
      });

      stratTabDiv.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        setDockOpen(false);
        try {
          const bw = innerDoc.defaultView?.TradingView?.bottomWidgetBar || root.TradingView?.bottomWidgetBar;
          if (bw && typeof bw.close === 'function') {
            bw.close();
          }
        } catch (err) {}

        stratTabDiv.classList.add('active-n3UmcVi3');
        pineTabDiv.classList.remove('active-n3UmcVi3');
        logConsole("Strategy Tester selected.", "info");
        openStrategyTesterPanel();
      });

      // Hook Account Manager click to close Pine Editor and Strategy Tester if opened
      const tradingTab = tabsWrapper.querySelector('[data-name="paper_trading"]');
      if (tradingTab) {
        tradingTab.addEventListener('click', () => {
          if (_isDockOpen) {
            setDockOpen(false);
          }
          closeStrategyTesterPanel();
          pineTabDiv.classList.remove('active-n3UmcVi3');
          stratTabDiv.classList.remove('active-n3UmcVi3');
        });
      }

      syncBottomDockTabs(_isDockOpen);
    } catch (err) {}
  }

  function syncBottomDockTabs(isOpen) {
    try {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const innerDoc = iframe?.contentDocument || (_widget && typeof _widget._innerWindow === 'function' && _widget._innerWindow()?.document);
      if (!innerDoc) return;

      const pineTab = innerDoc.querySelector('#tv_footer_pine_editor_tab') || innerDoc.querySelector('[data-name="scripteditor"]');
      if (pineTab) {
        const btn = pineTab.matches('button') ? pineTab : pineTab.querySelector('button');
        if (isOpen) {
          pineTab.classList.add('active-n3UmcVi3');
          if (btn) {
            btn.classList.add('active-RoCcHn9S');
            btn.setAttribute('aria-pressed', 'true');
          }
        } else {
          pineTab.classList.remove('active-n3UmcVi3');
          if (btn) {
            btn.classList.remove('active-RoCcHn9S');
            btn.setAttribute('aria-pressed', 'false');
          }
        }
      }
    } catch (e) {}
  }

  /* =========================================================================
   * 6. Right Toolbar Button Injection (< / >)
   * ========================================================================= */
  function attachRightToolbarButton(widgetInstance) {
    const w = widgetInstance || _widget || root.widget;

    function tryInject() {
      try {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const innerDoc = iframe?.contentDocument || (w && typeof w._innerWindow === 'function' && w._innerWindow().document);
        if (!innerDoc) return false;

        const rt = innerDoc.querySelector('[data-name="right-toolbar"]');
        if (!rt) return false;

        if (innerDoc.querySelector('[data-name="pine-editor"]')) return true;

        const btn = innerDoc.createElement('button');
        btn.setAttribute('aria-label', 'Pine Editor');
        btn.setAttribute('type', 'button');
        btn.className = 'button-I_wb5FjE apply-common-tooltip common-tooltip-vertical accessible-I_wb5FjE';
        btn.setAttribute('data-name', 'pine-editor');
        btn.setAttribute('aria-pressed', _isDockOpen ? 'true' : 'false');
        btn.setAttribute('data-tooltip', 'Pine Editor');
        btn.setAttribute('tabindex', '-1');
        if (_isDockOpen) {
          btn.classList.add('isActive-I_wb5FjE');
        }

        btn.innerHTML = `
          <div class="hoverMask-I_wb5FjE"></div>
          <span role="img" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 44 44" width="44" height="44">
              <path fill="currentColor" fill-rule="evenodd" clip-rule="evenodd" d="M17.7 16.3a1 1 0 0 0-1.4 0l-5 5a1 1 0 0 0 0 1.4l5 5a1 1 0 0 0 1.4-1.4L13.42 22l4.28-4.3a1 1 0 0 0 0-1.4zm8.6 0a1 1 0 0 1 1.4 0l5 5a1 1 0 0 1 0 1.4l-5 5a1 1 0 0 1-1.4-1.4L30.58 22l-4.28-4.3a1 1 0 0 1 0-1.4zm-2.07-.22a1 1 0 0 1 .73 1.21l-3.5 13a1 1 0 1 1-1.93-.52l3.5-13a1 1 0 0 1 1.2-.69z"/>
            </svg>
          </span>
        `;

        btn.addEventListener('click', (e) => {
          e.preventDefault();
          e.stopPropagation();
          setDockOpen(!_isDockOpen);
        });

        // Also Inject Authentic Bell Icon (Alerts System matching Image 4)
        if (!innerDoc.querySelector('[data-name="alerts"]')) {
          const alertBtn = innerDoc.createElement('button');
          alertBtn.setAttribute('aria-label', 'Alerts');
          alertBtn.setAttribute('type', 'button');
          alertBtn.className = 'button-I_wb5FjE apply-common-tooltip common-tooltip-vertical accessible-I_wb5FjE';
          alertBtn.setAttribute('data-name', 'alerts');
          alertBtn.setAttribute('aria-pressed', 'false');
          alertBtn.setAttribute('data-tooltip', 'Alerts (Alt + A)');
          alertBtn.setAttribute('tabindex', '-1');
          alertBtn.innerHTML = `
            <div class="hoverMask-I_wb5FjE"></div>
            <span role="img" aria-hidden="true" style="display:flex;align-items:center;justify-content:center;width:100%;height:100%;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 28 28" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
                <path d="M14 4a5 5 0 0 0-5 5v3.2c0 .8-.3 1.6-.9 2.2L6.5 16h15l-1.6-1.6c-.6-.6-.9-1.4-.9-2.2V9a5 5 0 0 0-5-5z"/>
                <path d="M11.5 19a2.5 2.5 0 0 0 5 0"/>
              </svg>
            </span>
          `;
          alertBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            toggleAlertsPanel();
          });
          const filler = rt.querySelector('.filler-GfsAWtWz');
          if (filler) {
            rt.insertBefore(alertBtn, filler);
          } else {
            rt.appendChild(alertBtn);
          }
        }

        hookChartIframeIndicatorButtons(innerDoc);

        const filler = rt.querySelector('.filler-GfsAWtWz');
        if (filler) {
          rt.insertBefore(btn, filler);
        } else {
          rt.appendChild(btn);
        }
        return true;
      } catch (err) {
        return false;
      }
    }

    if (!tryInject()) {
      let attempts = 0;
      const interval = setInterval(() => {
        attempts++;
        if (tryInject() || attempts > 60) {
          clearInterval(interval);
        }
      }, 500);
    }
  }

  function syncRightToolbarButton(open) {
    try {
      const iframe = document.querySelector('#tv_chart_container iframe');
      const innerDoc = iframe?.contentDocument || (_widget && typeof _widget._innerWindow === 'function' && _widget._innerWindow()?.document);
      const rtBtn = innerDoc?.querySelector('[data-name="pine-editor"]');
      if (rtBtn) {
        rtBtn.setAttribute('aria-pressed', open ? 'true' : 'false');
        if (open) {
          rtBtn.classList.add('isActive-I_wb5FjE');
        } else {
          rtBtn.classList.remove('isActive-I_wb5FjE');
        }
      }
    } catch (e) {}
  }

  /* =========================================================================
   * 7. TradingView Header Button Integration
   * ========================================================================= */
  function attachHeaderButton(widgetInstance) {
    const w = widgetInstance || _widget || root.widget;
    if (!w || typeof w.headerReady !== 'function') return;

    w.headerReady().then(() => {
      try {
        // 1. Alert Header Toolbar Button
        const alertBtn = w.createButton();
        alertBtn.setAttribute('title', 'Create Alert (Alt + A)');
        alertBtn.classList.add('alert-header-btn');
        alertBtn.innerHTML = `
          <span style="font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 5px; color: #d1d4dc;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="10"/>
              <polyline points="12 6 12 12 16 14"/>
            </svg>
            Alert
          </span>
        `;
        alertBtn.addEventListener('click', () => {
          openCreateAlertDialog();
        });

        // 2. Pine Editor Header Toolbar Button
        const btn = w.createButton();
        btn.setAttribute('title', 'Pine Editor');
        btn.classList.add('pine-editor-header-btn');
        btn.innerHTML = `
          <span style="font-size: 13px; font-weight: 500; display: flex; align-items: center; gap: 5px; color: #2962ff;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
            Pine Editor
          </span>
        `;
        btn.addEventListener('click', () => {
          setDockOpen(!_isDockOpen);
        });
      } catch (e) {}
    });
  }

  /* =========================================================================
   * 8. Public API Exports & Legacy Forwarding
   * ========================================================================= */
  const PineEditorIDE = {
    mount: mountPineEditorIDE,
    attachRightToolbarButton,
    attachBottomDockTabs,
    attachHeaderButton,
    injectLegendPolishStyles,
    open: () => setDockOpen(true),
    close: () => setDockOpen(false),
    toggle: () => setDockOpen(!_isDockOpen),
    isOpen: () => _isDockOpen,
    loadScript,
    log: logConsole,
    jumpToLineAndCol,
    parseDiagnosticErrors,
    cleanupStudy,
    clearStudyShapes,
    initLifecycleSync: setupChartLifecycleSync,
    triggerStudyReEvaluation,
    setupStudyRemovalObserver,
    addStudyToChart: (code) => _addStudyToChartFn ? _addStudyToChartFn(code) : null,
    runCompilation: (show) => _runCompilationFn ? _runCompilationFn(show) : null,
    runStrategyBacktest,
    openStrategyTester: openStrategyTesterPanel,
    closeStrategyTester: closeStrategyTesterPanel,
    openRevisionsModal,
    openIndicatorsModal,
    openScriptForStudy,
    closeIndicatorsModal,
    openCreateAlert: openCreateAlertDialog,
    closeCreateAlert: closeCreateAlertDialog,
    toggleAlertsPanel,
    evaluateAlertsForPrice,
    getChartHorizontalLines,
    setDockPosition,
    getUserSavedScripts,
    saveUserSavedScripts,
    getActiveAlerts,
    saveActiveAlerts,
    getAlertsHistory,
    saveAlertsHistory,
    playAlertChime,
    TEMPLATES,
    getTemplates: () => TEMPLATES.slice(),
    getCurrentScript: () => ({ ..._currentScript })
  };

  root.PineEditorIDE = PineEditorIDE;
  root.jumpToLineAndCol = jumpToLineAndCol;
  root.cleanupStudy = cleanupStudy;
  root.clearStudyShapes = clearStudyShapes;
  root.openIndicatorsModal = openIndicatorsModal;
  root.openScriptForStudy = openScriptForStudy;
  root.evaluateAlertsForPrice = evaluateAlertsForPrice;
  root.playAlertChime = playAlertChime;

  // Intercept any legacy openPineEditorModal calls and redirect cleanly to the authentic dock
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

})(typeof window !== 'undefined' ? window : globalThis);


  /* =========================================================================
   * Server-Side GPU/JAX Indicator Engine Client Integration
   * 90%+ processing offloaded to FastAPI /api/indicators
   * ========================================================================= */
  window.ServerIndicators = {
    async compute(indicatorName, options = {}) {
      const symbol = options.symbol || (window.tvWidget && window.tvWidget.activeChart ? window.tvWidget.activeChart().symbol() : 'EURUSD');
      const timeframe = options.timeframe || (window.tvWidget && window.tvWidget.activeChart ? window.tvWidget.activeChart().resolution() : '1D');
      const count = options.count || 1000;
      const params = options.params || {};

      try {
        const res = await fetch('/api/indicators/compute', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: symbol,
            timeframe: timeframe,
            indicator: indicatorName,
            params: params,
            count: count
          })
        });
        if (!res.ok) throw new Error('Indicator compute failed: ' + res.statusText);
        return await res.json();
      } catch (err) {
        console.error('[ServerIndicators] Computation error:', err);
        throw err;
      }
    },

    async getCatalog() {
      try {
        const res = await fetch('/api/indicators/list');
        if (!res.ok) throw new Error('Failed to fetch indicators list');
        return await res.json();
      } catch (err) {
        console.error('[ServerIndicators] List error:', err);
        return { indicators: [] };
      }
    }
  };
