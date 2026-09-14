const fs = require('fs');
const path = require('path');

const targetPath = path.join(__dirname, '..', '..', '..', '..', '..', 'e:', 'TRADINGVIEW ADVANCED', 'pine_editor_ide.js');
let code = fs.readFileSync('e:\\TRADINGVIEW ADVANCED\\pine_editor_ide.js', 'utf8');

console.log('Original pine_editor_ide.js size:', code.length, 'bytes');

// 1. Replace TEMPLATES (lines 44 to ~738)
const templateStart = code.indexOf('const TEMPLATES = [');
if (templateStart === -1) {
  throw new Error('Could not find TEMPLATES array start');
}

// Find where TEMPLATES ends
const templateEndMarker = 'const CURRENT_SCRIPT_KEY =';
const templateEnd = code.indexOf(templateEndMarker, templateStart);
if (templateEnd === -1) {
  throw new Error('Could not find CURRENT_SCRIPT_KEY after TEMPLATES');
}

const cleanTemplatesBlock = `const TEMPLATES = [
    {
      id: "blank_indicator",
      name: "Blank Indicator",
      code: \`//@version=5\\nindicator("My Script", overlay=true)\\nplot(close, "Close Price", color=color.blue)\\n\`
    },
    {
      id: "moving_average",
      name: "Moving Average",
      code: \`//@version=5\\nindicator("Moving Average", overlay=true)\\nlen = input.int(14, "Length", minval=1)\\nsrc = input(close, "Source")\\nout = ta.sma(src, len)\\nplot(out, "SMA", color=color.blue, linewidth=2)\\n\`
    },
    {
      id: "rsi",
      name: "Relative Strength Index",
      code: \`//@version=5\\nindicator("Relative Strength Index", overlay=false)\\nlen = input.int(14, "Length", minval=1)\\nsrc = input(close, "Source")\\nup = ta.rma(math.max(ta.change(src), 0), len)\\ndown = ta.rma(-math.min(ta.change(src), 0), len)\\nrsi = down == 0 ? 100 : up == 0 ? 0 : 100 - (100 / (1 + up / down))\\nplot(rsi, "RSI", color=color.purple)\\nhline(70, "Overbought", color=color.red, linestyle=hline.style_dotted)\\nhline(30, "Oversold", color=color.green, linestyle=hline.style_dotted)\\n\`
    },
    {
      id: "bollinger_bands",
      name: "Bollinger Bands",
      code: \`//@version=5\\nindicator("Bollinger Bands", overlay=true)\\nlength = input.int(20, minval=1)\\nsrc = input(close, title="Source")\\nmult = input.float(2.0, minval=0.001, maxval=50, title="StdDev")\\nbasis = ta.sma(src, length)\\ndev = mult * ta.stdev(src, length)\\nupper = basis + dev\\nlower = basis - dev\\nplot(basis, "Basis", color=color.orange)\\np1 = plot(upper, "Upper", color=color.blue)\\np2 = plot(lower, "Lower", color=color.blue)\\nfill(p1, p2, title = "Background", color=color.rgb(33, 150, 243, 90))\\n\`
    },
    {
      id: "macd",
      name: "MACD",
      code: \`//@version=5\\nindicator("MACD", overlay=false)\\nfast_length = input(title="Fast Length", defval=12)\\nslow_length = input(title="Slow Length", defval=26)\\nsrc = input(title="Source", defval=close)\\nsignal_length = input.int(title="Signal Smoothing",  minval = 1, maxval = 50, defval = 9)\\nfast_ma = ta.ema(src, fast_length)\\nslow_ma = ta.ema(src, slow_length)\\nmacd = fast_ma - slow_ma\\nsignal = ta.ema(macd, signal_length)\\nhist = macd - signal\\nplot(hist, title="Histogram", style=plot.style_columns, color=(hist>=0 ? (hist[1] < hist ? color.teal : color.green) : (hist[1] < hist ? color.maroon : color.red)))\\nplot(macd, title="MACD", color=color.blue)\\nplot(signal, title="Signal", color=color.orange)\\n\`
    }
  ];

  `;

code = code.slice(0, templateStart) + cleanTemplatesBlock + code.slice(templateEnd);
console.log('Replaced TEMPLATES successfully.');

// 2. Replace DEFAULT_USER_SCRIPTS (set to empty array) and clean mock scripts
const defaultUserScriptsStart = code.indexOf('const DEFAULT_USER_SCRIPTS = [');
if (defaultUserScriptsStart !== -1) {
  const defaultUserScriptsEndMarker = 'function getUserSavedScripts()';
  const defaultUserScriptsEnd = code.indexOf(defaultUserScriptsEndMarker, defaultUserScriptsStart);
  if (defaultUserScriptsEnd !== -1) {
    const cleanDefaultScriptsBlock = `// No pre-seeded mock custom scripts
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

  `;
    code = code.slice(0, defaultUserScriptsStart) + cleanDefaultScriptsBlock + code.slice(defaultUserScriptsEnd);
    console.log('Replaced DEFAULT_USER_SCRIPTS and added BUILTIN_TECHNICALS.');
  }
}

// 3. Update getUserSavedScripts to filter out mock IDs
const getUserSavedScriptsOld = `  function getUserSavedScripts() {
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
  }`;

const getUserSavedScriptsNew = `  function getUserSavedScripts() {
    try {
      const raw = localStorage.getItem(USER_SAVED_SCRIPTS_KEY);
      if (raw) {
        let parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          // Filter out any obsolete mock IDs
          parsed = parsed.filter(s => {
            if (!s || !s.id) return false;
            if (MOCK_SCRIPT_IDS.has(s.id) || MOCK_SCRIPT_IDS.has(s.name)) return false;
            if (s.id.startsWith('user_script_') && ['Higher Highs and Lower Lows', 'Multi-Session Time Cycles', 'Pivot Points', 'Previous Tick Close', 'TIME CYCLE', 'Trend Channel'].includes(s.name)) return false;
            return true;
          });
          return parsed;
        }
      }
    } catch (e) {}
    return [];
  }`;

if (code.includes('function getUserSavedScripts()')) {
  code = code.replace(getUserSavedScriptsOld, getUserSavedScriptsNew);
  console.log('Updated getUserSavedScripts.');
}

// 4. Update getRecentlyUsedScripts
const getRecentlyOld = `const defaults = ["Sessions [LuxAlgo] by LuxAlgo", "Multi-Session Time Cycles", "TIME CYCLE"];`;
const getRecentlyNew = `const defaults = ["Moving Average", "Relative Strength Index", "Bollinger Bands"];`;
code = code.replace(getRecentlyOld, getRecentlyNew);

// 5. Update renderIndicatorsModal logic
const renderModalOldMarker = `    if (_activeIndicatorsCategory === 'myscripts') {
      itemsToRender = getUserSavedScripts();
    } else if (_activeIndicatorsCategory === 'favorites') {
      itemsToRender = getUserSavedScripts().filter(s => s.isFavorite);
    } else if (_activeIndicatorsCategory === 'technicals') {
      itemsToRender = TEMPLATES.map(t => ({ id: t.id, name: t.name, code: t.code, isFavorite: false, isBuiltIn: true }));
    } else if (_activeIndicatorsCategory === 'editors_picks' || _activeIndicatorsCategory === 'top' || _activeIndicatorsCategory === 'trending') {
      itemsToRender = [
        { id: "sessions_luxalgo", name: "Sessions [LuxAlgo] by LuxAlgo", code: TEMPLATES[0].code, isFavorite: false },
        { id: "user_script_hh_ll", name: "Higher Highs and Lower Lows", code: DEFAULT_USER_SCRIPTS[0].code, isFavorite: false },
        { id: "user_script_trend_channel", name: "Trend Channel", code: DEFAULT_USER_SCRIPTS[5].code, isFavorite: false },
        { id: "user_script_time_cycle", name: "TIME CYCLE", code: DEFAULT_USER_SCRIPTS[4].code, isFavorite: false },
        { id: "user_script_multi_session", name: "Multi-Session Time Cycles", code: DEFAULT_USER_SCRIPTS[1].code, isFavorite: false }
      ];
    } else {
      itemsToRender = [];
    }`;

const renderModalNewMarker = `    if (_activeIndicatorsCategory === 'myscripts') {
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

if (code.includes(renderModalOldMarker)) {
  code = code.replace(renderModalOldMarker, renderModalNewMarker);
  console.log('Updated renderIndicatorsModal items mapping.');
} else {
  console.warn('Could not match renderModalOldMarker exactly!');
}

// 6. Handle empty state for myscripts
const emptyStateOld = `    if (itemsToRender.length === 0) {
      list.innerHTML = \`
        <div style="padding: 32px 16px; text-align: center; color: #787b86; font-size: 13px;">
          No indicators found matching "\${escapeHtml(q || _activeIndicatorsCategory)}".
        </div>
      \`;
      return;
    }`;

const emptyStateNew = `    if (itemsToRender.length === 0) {
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

if (code.includes(emptyStateOld)) {
  code = code.replace(emptyStateOld, emptyStateNew);
  console.log('Updated empty state in renderIndicatorsModal.');
}

// 7. Add ServerIndicators client helper at the bottom of the file
if (!code.includes('window.ServerIndicators')) {
  code += `\n
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
`;
  console.log('Appended window.ServerIndicators.');
}

fs.writeFileSync('e:\\TRADINGVIEW ADVANCED\\pine_editor_ide.js', code, 'utf8');
console.log('Successfully written updated pine_editor_ide.js!');
