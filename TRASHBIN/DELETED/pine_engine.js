/**
 * Pine Script v5 Transpiler, Starter Templates & LocalStorage Storage Engine
 * For TradingView Advanced Charts (TT v29.6.0)
 * 
 * Provides:
 * - PineScriptTemplates: 5 pre-built professional starter templates
 * - PineScriptStorage: LocalStorage persistence & CRUD manager
 * - TradingViewCustomEngine.Std: Complete technical analysis & mathematical library
 * - PineTranspiler: Pine Script v5 AST parser & TradingView Metainfo (v52) generator
 * - PineScriptRuntime: Standalone execution runtime & test validator
 * - PineScriptHighlighter: Syntax tokenizing & HTML highlighter
 * - PineEngine: Unified singleton & Charting Library bridge
 */

(function(global, factory) {
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define(factory);
  } else {
    const exportsObj = factory();
    global.PineEngine = exportsObj.PineEngine;
    global.PineScriptTemplates = exportsObj.PineScriptTemplates;
    global.PineScriptStorage = exportsObj.PineScriptStorage;
    global.PineTranspiler = exportsObj.PineTranspiler;
    global.PineScriptRuntime = exportsObj.PineScriptRuntime;
    global.PineScriptHighlighter = exportsObj.PineScriptHighlighter;
    global.TradingViewCustomEngine = exportsObj.TradingViewCustomEngine;
  }
})(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  /* =========================================================================
   * 1. PineScriptTemplates (5 Starter Templates)
   * ========================================================================= */
  const PineScriptTemplates = {
    ema_cross: {
      id: "template_ema_cross",
      name: "EMA Cross Strategy",
      description: "Fast and Slow Exponential Moving Average crossover system with buy/sell triangle markers",
      overlay: true,
      code: `//@version=5
indicator("EMA Cross Strategy", overlay=true)

fastLen = input.int(9, "Fast EMA Length", minval=1)
slowLen = input.int(21, "Slow EMA Length", minval=1)

fastEMA = ta.ema(close, fastLen)
slowEMA = ta.ema(close, slowLen)

bullish = ta.crossover(fastEMA, slowEMA)
bearish = ta.crossunder(fastEMA, slowEMA)

plot(fastEMA, "Fast EMA", color=color.green, linewidth=2)
plot(slowEMA, "Slow EMA", color=color.red, linewidth=2)
plotshape(bullish, "Buy Signal", style=shape.triangleup, location=location.belowbar, color=color.green)
plotshape(bearish, "Sell Signal", style=shape.triangledown, location=location.abovebar, color=color.red)
`
    },

    rsi: {
      id: "template_rsi",
      name: "Relative Strength Index (RSI)",
      description: "Momentum oscillator measuring the speed and change of price movements with overbought/oversold levels",
      overlay: false,
      code: `//@version=5
indicator("RSI Indicator", overlay=false, precision=2)

length = input.int(14, "RSI Length", minval=1)
rsiVal = ta.rsi(close, length)

plot(rsiVal, "RSI", color=color.purple, linewidth=2)
hline(70, "Overbought", color=color.red, linestyle=hline.style_dotted)
hline(30, "Oversold", color=color.green, linestyle=hline.style_dotted)
`
    },

    macd: {
      id: "template_macd",
      name: "MACD Oscillator",
      description: "Moving Average Convergence Divergence trend-following momentum indicator with signal line and histogram",
      overlay: false,
      code: `//@version=5
indicator("MACD Oscillator", overlay=false)

fastLen = input.int(12, "Fast Length", minval=1)
slowLen = input.int(26, "Slow Length", minval=1)
sigLen = input.int(9, "Signal Length", minval=1)

[macd, signal, hist] = ta.macd(close, fastLen, slowLen, sigLen)

plot(macd, "MACD", color=color.blue, linewidth=2)
plot(signal, "Signal", color=color.orange, linewidth=2)
plot(hist, "Histogram", color=color.gray, linewidth=1, style=plot.style_histogram)
`
    },

    bollinger_bands: {
      id: "template_bb",
      name: "Bollinger Bands with Cloud Fill",
      description: "Volatility bands placed above and below a moving average with standard deviation multiplier and translucent cloud fill",
      overlay: true,
      code: `//@version=5
indicator("Bollinger Bands", overlay=true)

length = input.int(20, "Length", minval=1)
mult = input.float(2.0, "Multiplier", minval=0.1, maxval=50.0)

[basis, upper, lower] = ta.bb(close, length, mult)

plot(basis, "Basis", color=color.orange, linewidth=1)
p1 = plot(upper, "Upper Band", color=color.blue, linewidth=1)
p2 = plot(lower, "Lower Band", color=color.blue, linewidth=1)
fill(p1, p2, color=color.blue, title="BB Cloud Fill")
`
    },

    supertrend: {
      id: "template_supertrend",
      name: "SuperTrend Trailing Stop with Bar Color",
      description: "ATR-based trailing stop plotting dynamic support/resistance lines with automatic candlestick bar coloring",
      overlay: true,
      code: `//@version=5
indicator("SuperTrend Indicator", overlay=true)

atrPeriod = input.int(10, "ATR Period", minval=1)
factor = input.float(3.0, "Factor", minval=0.1, step=0.1)

[superTrend, direction] = ta.supertrend(factor, atrPeriod)

plot(direction < 0 ? superTrend : na, "Up Trend", color=color.green, linewidth=2, style=plot.style_linebr)
plot(direction > 0 ? superTrend : na, "Down Trend", color=color.red, linewidth=2, style=plot.style_linebr)
barcolor(direction < 0 ? color.green : color.red)
`
    },

    stoch_rsi: {
      id: "template_stoch_rsi",
      name: "Stochastic RSI Oscillator",
      description: "Stochastic applied to RSI values providing sensitive overbought/oversold and momentum signals",
      overlay: false,
      code: `//@version=5
indicator("Stochastic RSI", overlay=false, precision=2)

smoothK = input.int(3, "K Smoothing", minval=1)
smoothD = input.int(3, "D Smoothing", minval=1)
lengthRSI = input.int(14, "RSI Length", minval=1)
lengthStoch = input.int(14, "Stochastic Length", minval=1)

rsiVal = ta.rsi(close, lengthRSI)
k = ta.sma(ta.stoch(rsiVal, rsiVal, rsiVal, lengthStoch), smoothK)
d = ta.sma(k, smoothD)

plot(k, "%K", color=color.blue, linewidth=2)
plot(d, "%D", color=color.orange, linewidth=2)
hline(80, "Overbought", color=color.red, linestyle=hline.style_dashed)
hline(20, "Oversold", color=color.green, linestyle=hline.style_dashed)
`
    },

    ttm_squeeze: {
      id: "template_ttm_squeeze",
      name: "TTM Squeeze Momentum (BB & KC)",
      description: "Identifies consolidation periods when Bollinger Bands compress inside Keltner Channels followed by explosive breakouts",
      overlay: false,
      code: `//@version=5
indicator("TTM Squeeze Momentum", overlay=false)

length = input.int(20, "Length", minval=1)
bbMult = input.float(2.0, "BB Mult", minval=0.1)
kcMult = input.float(1.5, "KC Mult", minval=0.1)

[bbBasis, bbUpper, bbLower] = ta.bb(close, length, bbMult)
[kcBasis, kcUpper, kcLower] = ta.kc(close, length, kcMult, true)

squeezeOn = (bbLower > kcLower) and (bbUpper < kcUpper)
momentum = ta.mom(close, 12)

plot(momentum, "Squeeze Momentum", color=momentum >= 0 ? color.green : color.red, style=plot.style_columns)
plotshape(squeezeOn, "Squeeze Active", style=shape.circle, location=location.bottom, color=color.orange)
`
    },

    pivot_breakout: {
      id: "template_pivot_breakout",
      name: "Pivot High/Low Breakout Strategy",
      description: "Detects swing highs and swing lows across customizable lookback bars with directional breakout markers",
      overlay: true,
      code: `//@version=5
indicator("Pivot High/Low Breakout", overlay=true)

leftLen = input.int(5, "Left Bars", minval=1)
rightLen = input.int(5, "Right Bars", minval=1)

ph = ta.pivothigh(high, leftLen, rightLen)
pl = ta.pivotlow(low, leftLen, rightLen)

plot(ph, "Pivot High", color=color.red, linewidth=2, style=plot.style_circles)
plot(pl, "Pivot Low", color=color.green, linewidth=2, style=plot.style_circles)
plotshape(ph, "Swing High", style=shape.triangledown, location=location.abovebar, color=color.red)
plotshape(pl, "Swing Low", style=shape.triangleup, location=location.belowbar, color=color.green)
`
    }
  };


  /* =========================================================================
   * 2. PineScriptStorage (LocalStorage Persistence & Storage Manager)
   * ========================================================================= */
  class PineScriptStorageManager {
    constructor() {
      this.STORAGE_KEY = 'tv_custom_pine_scripts';
      this._memoryStore = {};
    }

    _isLocalStorageAvailable() {
      try {
        if (typeof window === 'undefined' || !window.localStorage) return false;
        const testKey = '__storage_test__';
        window.localStorage.setItem(testKey, '1');
        window.localStorage.removeItem(testKey);
        return true;
      } catch (e) {
        return false;
      }
    }

    _readRaw() {
      if (this._isLocalStorageAvailable()) {
        try {
          const raw = window.localStorage.getItem(this.STORAGE_KEY);
          return raw ? JSON.parse(raw) : [];
        } catch (e) {
          console.warn('Failed to parse Pine scripts from localStorage:', e);
          return [];
        }
      }
      return this._memoryStore[this.STORAGE_KEY] || [];
    }

    _writeRaw(data) {
      if (this._isLocalStorageAvailable()) {
        try {
          window.localStorage.setItem(this.STORAGE_KEY, JSON.stringify(data));
          return true;
        } catch (e) {
          console.error('Failed to save Pine scripts to localStorage:', e);
          return false;
        }
      }
      this._memoryStore[this.STORAGE_KEY] = data;
      return true;
    }

    getTemplates() {
      return Object.keys(PineScriptTemplates).map(key => ({
        ...PineScriptTemplates[key],
        isTemplate: true
      }));
    }

    getCustomScripts() {
      const scripts = this._readRaw();
      return Array.isArray(scripts) ? scripts : [];
    }

    getAllScripts() {
      const templates = this.getTemplates();
      const custom = this.getCustomScripts();
      return [...templates, ...custom];
    }

    getScriptById(id) {
      if (!id) return null;
      // Check templates
      for (const key of Object.keys(PineScriptTemplates)) {
        if (PineScriptTemplates[key].id === id || key === id) {
          return { ...PineScriptTemplates[key], isTemplate: true };
        }
      }
      // Check custom scripts
      const custom = this.getCustomScripts();
      return custom.find(s => s.id === id) || null;
    }

    saveScript(scriptData) {
      if (!scriptData || typeof scriptData !== 'object') {
        throw new Error('Invalid script data object');
      }
      if (!scriptData.name || !scriptData.name.trim()) {
        throw new Error('Script name is required');
      }
      if (typeof scriptData.code !== 'string') {
        throw new Error('Script code is required');
      }

      const scripts = this.getCustomScripts();
      const now = Date.now();

      // Extract overlay from code if not explicitly given
      let overlay = scriptData.overlay;
      if (overlay === undefined) {
        const match = scriptData.code.match(/(?:indicator|study)\s*\([^)]*overlay\s*=\s*(true|false)/);
        overlay = match ? match[1] === 'true' : false;
      }

      const id = scriptData.id && !scriptData.id.startsWith('template_')
        ? scriptData.id
        : `custom_${now}_${Math.random().toString(36).substring(2, 8)}`;

      const record = {
        id: id,
        name: scriptData.name.trim(),
        description: scriptData.description || '',
        code: scriptData.code,
        overlay: Boolean(overlay),
        createdAt: scriptData.createdAt || now,
        lastModified: now,
        isTemplate: false
      };

      const existingIndex = scripts.findIndex(s => s.id === id);
      if (existingIndex >= 0) {
        scripts[existingIndex] = { ...scripts[existingIndex], ...record, createdAt: scripts[existingIndex].createdAt };
      } else {
        scripts.push(record);
      }

      this._writeRaw(scripts);
      return record;
    }

    deleteScript(id) {
      if (!id) return false;
      if (id.startsWith('template_')) {
        console.warn('Cannot delete built-in starter templates');
        return false;
      }
      const scripts = this.getCustomScripts();
      const initialLength = scripts.length;
      const filtered = scripts.filter(s => s.id !== id);
      if (filtered.length !== initialLength) {
        this._writeRaw(filtered);
        return true;
      }
      return false;
    }

    exportAll() {
      const custom = this.getCustomScripts();
      return JSON.stringify({
        version: 1,
        exportedAt: new Date().toISOString(),
        scripts: custom
      }, null, 2);
    }

    importAll(jsonString) {
      if (!jsonString || typeof jsonString !== 'string') {
        throw new Error('Invalid JSON string for import');
      }
      let parsed;
      try {
        parsed = JSON.parse(jsonString);
      } catch (e) {
        throw new Error('Malformed JSON string: ' + e.message);
      }

      const list = Array.isArray(parsed) ? parsed : (parsed.scripts && Array.isArray(parsed.scripts) ? parsed.scripts : null);
      if (!list) {
        throw new Error('Import data must contain an array of script objects');
      }

      let count = 0;
      for (const item of list) {
        if (item && item.name && typeof item.code === 'string') {
          this.saveScript(item);
          count++;
        }
      }
      return count;
    }

    clearCustomScripts() {
      this._writeRaw([]);
      return true;
    }
  }

  const PineScriptStorage = new PineScriptStorageManager();


  /* =========================================================================
   * 3. TradingViewCustomEngine.Std (Standard Technical Analysis & Math Library)
   * ========================================================================= */
  class SeriesVarTracker {
    constructor() {
      this.history = [];
      this.current = NaN;
    }
    get(offset = 0) {
      if (offset === 0) return this.current;
      const idx = this.history.length - offset;
      return (idx >= 0 && idx < this.history.length) ? this.history[idx] : NaN;
    }
    set(val) {
      this.current = val;
    }
    _commit() {
      this.history.push(this.current);
    }
  }

  const TradingViewCustomEngine = {
    _pineJS: null,

    init(PineJS) {
      this._pineJS = PineJS;
      if (PineJS && PineJS.Std) {
        Object.assign(this.Std, PineJS.Std);
      }
    },

    Std: {
      // 0. Source / Series Resolution Helper
      _resolveSource(s, ctx) {
        if (typeof s === 'string') {
          if (ctx && ctx.symbol && ctx.symbol[s] !== undefined) {
            return ctx.symbol[s];
          }
          if (typeof this[s] === 'function') {
            return this[s](ctx);
          }
        }
        return s;
      },

      // 1. Context Symbol Accessors
      open(ctx) { return ctx && ctx.symbol ? ctx.symbol.open : NaN; },
      high(ctx) { return ctx && ctx.symbol ? ctx.symbol.high : NaN; },
      low(ctx) { return ctx && ctx.symbol ? ctx.symbol.low : NaN; },
      close(ctx) { return ctx && ctx.symbol ? ctx.symbol.close : NaN; },
      volume(ctx) { return ctx && ctx.symbol ? ctx.symbol.volume : 0; },
      time(ctx) { return ctx && ctx.symbol ? ctx.symbol.time : 0; },
      hl2(ctx) {
        if (!ctx || !ctx.symbol) return NaN;
        return (ctx.symbol.high + ctx.symbol.low) / 2;
      },
      hlc3(ctx) {
        if (!ctx || !ctx.symbol) return NaN;
        return (ctx.symbol.high + ctx.symbol.low + ctx.symbol.close) / 3;
      },
      ohlc4(ctx) {
        if (!ctx || !ctx.symbol) return NaN;
        return (ctx.symbol.open + ctx.symbol.high + ctx.symbol.low + ctx.symbol.close) / 4;
      },
      n(ctx) {
        if (!ctx || !ctx.symbol) return 1;
        return (typeof ctx.symbol.index === 'number') ? ctx.symbol.index + 1 : 1;
      },

      // 2. Utility & Math
      nz(v, def = 0) {
        if (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) {
          return def;
        }
        return v;
      },
      na(v) {
        return (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) ? 1 : 0;
      },
      isZero(v) { return v === 0; },
      fixnan(v, ctx) {
        const vVar = ctx.new_var(v);
        const prev = vVar.get(1);
        if (isNaN(v) && !isNaN(prev)) {
          vVar.set(prev);
          return prev;
        }
        return v;
      },
      avg(...vals) {
        let sum = 0;
        let count = 0;
        for (const val of vals) {
          if (!isNaN(val) && val !== null) {
            sum += val;
            count++;
          }
        }
        return count > 0 ? sum / count : NaN;
      },

      colorNew(colorHex, transp) {
        if (!colorHex || typeof colorHex !== 'string') return colorHex;
        if (colorHex.startsWith('#') && (colorHex.length === 7 || colorHex.length === 9)) {
          const alpha = Math.max(0, Math.min(100, 100 - transp)) / 100;
          const r = parseInt(colorHex.slice(1, 3), 16);
          const g = parseInt(colorHex.slice(3, 5), 16);
          const b = parseInt(colorHex.slice(5, 7), 16);
          return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
        }
        return colorHex;
      },

      seriesVar(name, currentVal, ctx) {
        currentVal = this._resolveSource(currentVal, ctx);
        const v = ctx.new_var(currentVal);
        return v;
      },

      // 3. Technical Indicators
      change(series, ctx) {
        series = this._resolveSource(series, ctx);
        if (series && typeof series.get === 'function') {
          return series.get(0) - series.get(1);
        }
        const sVar = ctx ? ctx.new_var(series) : null;
        return sVar ? sVar.get(0) - sVar.get(1) : NaN;
      },

      cum(source, ctx) {
        source = this._resolveSource(source, ctx);
        const val = (source && typeof source.get === 'function') ? source.get(0) : source;
        const cumVar = ctx.new_var();
        const prev = cumVar.get(1);
        const res = isNaN(prev) ? this.nz(val) : prev + this.nz(val);
        cumVar.set(res);
        return res;
      },

      sum(series, len, ctx) {
        series = this._resolveSource(series, ctx);
        const val = (series && typeof series.get === 'function') ? series.get(0) : series;
        const sVar = (series && typeof series.get === 'function') ? series : ctx.new_var(val);
        const sumVar = ctx.new_var();
        const prevSum = sumVar.get(1);
        const oldestVal = sVar.get(len);
        let res;
        if (isNaN(prevSum)) {
          let s = 0;
          for (let i = 0; i < len; i++) {
            const v = sVar.get(i);
            if (isNaN(v)) { s = NaN; break; }
            s += v;
          }
          res = s;
        } else {
          res = prevSum + this.nz(sVar.get(0)) - this.nz(oldestVal);
        }
        sumVar.set(res);
        return res;
      },

      sma(series, len, ctx) {
        series = this._resolveSource(series, ctx);
        const val = (series && typeof series.get === 'function') ? series.get(0) : series;
        const sVar = (series && typeof series.get === 'function') ? series : ctx.new_var(val);
        let sum = 0;
        for (let i = 0; i < len; i++) {
          const v = sVar.get(i);
          if (isNaN(v)) return NaN;
          sum += v;
        }
        return sum / len;
      },

      rma(series, len, ctx) {
        series = this._resolveSource(series, ctx);
        const val = (series && typeof series.get === 'function') ? series.get(0) : series;
        const sVar = (series && typeof series.get === 'function') ? series : ctx.new_var(val);
        const prevRma = ctx.new_var();
        const prev = prevRma.get(1);
        const cur = sVar.get(0);
        let res;
        if (isNaN(prev)) {
          res = this.sma(sVar, len, ctx);
        } else {
          res = isNaN(cur) ? NaN : (cur + (len - 1) * prev) / len;
        }
        prevRma.set(res);
        return res;
      },

      ema(series, len, ctx) {
        series = this._resolveSource(series, ctx);
        const val = (series && typeof series.get === 'function') ? series.get(0) : series;
        const sVar = (series && typeof series.get === 'function') ? series : ctx.new_var(val);
        const prevEma = ctx.new_var();
        const prev = prevEma.get(1);
        const cur = sVar.get(0);
        const alpha = 2 / (len + 1);
        let res;
        if (isNaN(prev)) {
          res = this.sma(sVar, len, ctx);
        } else {
          res = isNaN(cur) ? NaN : alpha * cur + (1 - alpha) * prev;
        }
        prevEma.set(res);
        return res;
      },

      wma(series, len, ctx) {
        series = this._resolveSource(series, ctx);
        const val = (series && typeof series.get === 'function') ? series.get(0) : series;
        const sVar = (series && typeof series.get === 'function') ? series : ctx.new_var(val);
        let norm = 0;
        let sum = 0;
        for (let i = 0; i < len; i++) {
          const v = sVar.get(i);
          if (isNaN(v)) return NaN;
          const weight = len - i;
          sum += v * weight;
          norm += weight;
        }
        return norm > 0 ? sum / norm : NaN;
      },

      vwma(series, len, ctx) {
        series = this._resolveSource(series, ctx);
        const val = (series && typeof series.get === 'function') ? series.get(0) : series;
        const vol = ctx.symbol ? ctx.symbol.volume : 1;
        const sVar = (series && typeof series.get === 'function') ? series : ctx.new_var(val);
        const vVar = ctx.new_var(vol);
        const pvVar = ctx.new_var(sVar.get(0) * vVar.get(0));
        
        let sumPV = 0;
        let sumV = 0;
        for (let i = 0; i < len; i++) {
          const pv = pvVar.get(i);
          const v = vVar.get(i);
          if (isNaN(pv) || isNaN(v)) return NaN;
          sumPV += pv;
          sumV += v;
        }
        return sumV > 0 ? sumPV / sumV : NaN;
      },

      swma(series, ctx) {
        series = this._resolveSource(series, ctx);
        const val = (series && typeof series.get === 'function') ? series.get(0) : series;
        const sVar = (series && typeof series.get === 'function') ? series : ctx.new_var(val);
        const p0 = sVar.get(0);
        const p1 = sVar.get(1);
        const p2 = sVar.get(2);
        const p3 = sVar.get(3);
        if (isNaN(p0) || isNaN(p1) || isNaN(p2) || isNaN(p3)) return NaN;
        return (p3 * 1 / 6) + (p2 * 2 / 6) + (p1 * 2 / 6) + (p0 * 1 / 6);
      },

      stdev(series, len, ctx) {
        series = this._resolveSource(series, ctx);
        const val = (series && typeof series.get === 'function') ? series.get(0) : series;
        const sVar = (series && typeof series.get === 'function') ? series : ctx.new_var(val);
        const mean = this.sma(sVar, len, ctx);
        if (isNaN(mean)) return NaN;
        let sumSq = 0;
        for (let i = 0; i < len; i++) {
          const v = sVar.get(i);
          if (isNaN(v)) return NaN;
          sumSq += Math.pow(v - mean, 2);
        }
        return Math.sqrt(sumSq / len);
      },

      variance(series, len, ctx) {
        series = this._resolveSource(series, ctx);
        const sd = this.stdev(series, len, ctx);
        return isNaN(sd) ? NaN : Math.pow(sd, 2);
      },

      highest(series, len, ctx) {
        series = this._resolveSource(series, ctx);
        const val = (series && typeof series.get === 'function') ? series.get(0) : series;
        const sVar = (series && typeof series.get === 'function') ? series : ctx.new_var(val);
        let maxVal = -Infinity;
        for (let i = 0; i < len; i++) {
          const v = sVar.get(i);
          if (isNaN(v)) return NaN;
          if (v > maxVal) maxVal = v;
        }
        return maxVal === -Infinity ? NaN : maxVal;
      },

      lowest(series, len, ctx) {
        series = this._resolveSource(series, ctx);
        const val = (series && typeof series.get === 'function') ? series.get(0) : series;
        const sVar = (series && typeof series.get === 'function') ? series : ctx.new_var(val);
        let minVal = Infinity;
        for (let i = 0; i < len; i++) {
          const v = sVar.get(i);
          if (isNaN(v)) return NaN;
          if (v < minVal) minVal = v;
        }
        return minVal === Infinity ? NaN : minVal;
      },

      highestbars(series, len, ctx) {
        series = this._resolveSource(series, ctx);
        const val = (series && typeof series.get === 'function') ? series.get(0) : series;
        const sVar = (series && typeof series.get === 'function') ? series : ctx.new_var(val);
        let maxVal = -Infinity;
        let maxIdx = 0;
        for (let i = 0; i < len; i++) {
          const v = sVar.get(i);
          if (isNaN(v)) return NaN;
          if (v > maxVal) { maxVal = v; maxIdx = -i; }
        }
        return maxVal === -Infinity ? NaN : maxIdx;
      },

      lowestbars(series, len, ctx) {
        series = this._resolveSource(series, ctx);
        const val = (series && typeof series.get === 'function') ? series.get(0) : series;
        const sVar = (series && typeof series.get === 'function') ? series : ctx.new_var(val);
        let minVal = Infinity;
        let minIdx = 0;
        for (let i = 0; i < len; i++) {
          const v = sVar.get(i);
          if (isNaN(v)) return NaN;
          if (v < minVal) { minVal = v; minIdx = -i; }
        }
        return minVal === Infinity ? NaN : minIdx;
      },

      tr(handleFirstBar, ctx) {
        const high = ctx.symbol.high;
        const low = ctx.symbol.low;
        const closeVar = ctx.new_var(ctx.symbol.close);
        const prevClose = closeVar.get(1);
        if (isNaN(prevClose)) {
          return handleFirstBar ? high - low : NaN;
        }
        return Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
      },

      atr(len, ctx) {
        const trVal = this.tr(true, ctx);
        const trVar = ctx.new_var(isNaN(trVal) ? (ctx.symbol.high - ctx.symbol.low) : trVal);
        return this.rma(trVar, len, ctx);
      },

      cross(s1, s2, ctx) {
        s1 = this._resolveSource(s1, ctx);
        s2 = this._resolveSource(s2, ctx);
        const v1 = (s1 && typeof s1.get === 'function') ? s1 : ctx.new_var(s1);
        const v2 = (s2 && typeof s2.get === 'function') ? s2 : ctx.new_var(s2);
        const d0 = v1.get(0) - v2.get(0);
        const d1 = v1.get(1) - v2.get(1);
        return (!isNaN(d0) && !isNaN(d1)) && ((d0 > 0 && d1 <= 0) || (d0 < 0 && d1 >= 0));
      },

      crossover(s1, s2, ctx) {
        s1 = this._resolveSource(s1, ctx);
        s2 = this._resolveSource(s2, ctx);
        const v1 = (s1 && typeof s1.get === 'function') ? s1 : ctx.new_var(s1);
        const v2 = (s2 && typeof s2.get === 'function') ? s2 : ctx.new_var(s2);
        return (v1.get(0) > v2.get(0)) && (v1.get(1) <= v2.get(1));
      },

      crossunder(s1, s2, ctx) {
        s1 = this._resolveSource(s1, ctx);
        s2 = this._resolveSource(s2, ctx);
        const v1 = (s1 && typeof s1.get === 'function') ? s1 : ctx.new_var(s1);
        const v2 = (s2 && typeof s2.get === 'function') ? s2 : ctx.new_var(s2);
        return (v1.get(0) < v2.get(0)) && (v1.get(1) >= v2.get(1));
      },

      rsi(source, len, ctx) {
        source = this._resolveSource(source, ctx);
        const val = (source && typeof source.get === 'function') ? source.get(0) : source;
        const sVar = (source && typeof source.get === 'function') ? source : ctx.new_var(val);
        const chg = sVar.get(0) - sVar.get(1);
        const up = Math.max(isNaN(chg) ? 0 : chg, 0);
        const down = -Math.min(isNaN(chg) ? 0 : chg, 0);
        const upVar = ctx.new_var(up);
        const downVar = ctx.new_var(down);
        const upRma = this.rma(upVar, len, ctx);
        const downRma = this.rma(downVar, len, ctx);
        if (isNaN(upRma) || isNaN(downRma)) return NaN;
        if (downRma === 0) return 100;
        if (upRma === 0) return 0;
        const rs = upRma / downRma;
        return 100 - (100 / (1 + rs));
      },

      macd(source, fastLen, slowLen, sigLen, ctx) {
        source = this._resolveSource(source, ctx);
        const val = (source && typeof source.get === 'function') ? source.get(0) : source;
        const sVar = (source && typeof source.get === 'function') ? source : ctx.new_var(val);
        const fastEMA = this.ema(sVar, fastLen, ctx);
        const slowEMA = this.ema(sVar, slowLen, ctx);
        const macdLine = isNaN(fastEMA) || isNaN(slowEMA) ? NaN : fastEMA - slowEMA;
        const macdVar = ctx.new_var(isNaN(macdLine) ? 0 : macdLine);
        const signalLine = this.ema(macdVar, sigLen, ctx);
        const hist = isNaN(macdLine) || isNaN(signalLine) ? NaN : macdLine - signalLine;
        return [macdLine, signalLine, hist];
      },

      bb(source, len, mult, ctx) {
        source = this._resolveSource(source, ctx);
        const val = (source && typeof source.get === 'function') ? source.get(0) : source;
        const sVar = (source && typeof source.get === 'function') ? source : ctx.new_var(val);
        const basis = this.sma(sVar, len, ctx);
        const dev = mult * this.stdev(sVar, len, ctx);
        const upper = isNaN(basis) || isNaN(dev) ? NaN : basis + dev;
        const lower = isNaN(basis) || isNaN(dev) ? NaN : basis - dev;
        return [basis, upper, lower];
      },

      supertrend(factor, atrPeriod, ctx) {
        const high = ctx.symbol.high;
        const low = ctx.symbol.low;
        const close = ctx.symbol.close;
        const hl2 = (high + low) / 2;
        const atr = this.atr(atrPeriod, ctx);

        const finalUpperVar = ctx.new_var();
        const finalLowerVar = ctx.new_var();
        const superTrendVar = ctx.new_var();
        const dirVar = ctx.new_var();
        const closeVar = ctx.new_var(close);

        if (isNaN(atr)) {
          finalUpperVar.set(NaN);
          finalLowerVar.set(NaN);
          superTrendVar.set(NaN);
          dirVar.set(1);
          return [NaN, 1];
        }

        const basicUpper = hl2 + factor * atr;
        const basicLower = hl2 - factor * atr;

        const prevFinalUpper = finalUpperVar.get(1);
        const prevFinalLower = finalLowerVar.get(1);
        const prevClose = closeVar.get(1);
        const prevST = superTrendVar.get(1);
        const prevDir = dirVar.get(1);

        let finalUpper = basicUpper;
        if (!isNaN(prevFinalUpper) && !isNaN(prevClose)) {
          finalUpper = (basicUpper < prevFinalUpper || prevClose > prevFinalUpper) ? basicUpper : prevFinalUpper;
        }

        let finalLower = basicLower;
        if (!isNaN(prevFinalLower) && !isNaN(prevClose)) {
          finalLower = (basicLower > prevFinalLower || prevClose < prevFinalLower) ? basicLower : prevFinalLower;
        }

        let dir = 1; // 1 = bearish/down, -1 = bullish/up
        let st = finalUpper;

        if (isNaN(prevST)) {
          dir = close > finalUpper ? -1 : 1;
          st = dir === -1 ? finalLower : finalUpper;
        } else if (prevDir === -1) {
          if (close < finalLower) {
            dir = 1;
            st = finalUpper;
          } else {
            dir = -1;
            st = finalLower;
          }
        } else {
          if (close > finalUpper) {
            dir = -1;
            st = finalLower;
          } else {
            dir = 1;
            st = finalUpper;
          }
        }

        finalUpperVar.set(finalUpper);
        finalLowerVar.set(finalLower);
        superTrendVar.set(st);
        dirVar.set(dir);

        return [st, dir];
      },

      valuewhen(cond, source, occurrence, ctx) {
        source = this._resolveSource(source, ctx);
        const val = (source && typeof source.get === 'function') ? source.get(0) : source;
        const valVar = ctx.new_var(val);
        const histVar = ctx.new_var();
        let historyArr = histVar.get(1);
        if (!Array.isArray(historyArr)) historyArr = [];
        else historyArr = historyArr.slice();

        if (cond) {
          historyArr.unshift(valVar.get(0));
          if (historyArr.length > 50) historyArr.pop();
        }
        histVar.set(historyArr);

        const occ = occurrence || 0;
        return (historyArr.length > occ) ? historyArr[occ] : NaN;
      },

      barssince(cond, ctx) {
        const countVar = ctx.new_var();
        const prevCount = countVar.get(1);
        let res;
        if (cond) {
          res = 0;
        } else {
          res = isNaN(prevCount) ? NaN : prevCount + 1;
        }
        countVar.set(res);
        return res;
      },

      stoch(close, high, low, length, ctx) {
        close = this._resolveSource(close, ctx);
        high = this._resolveSource(high, ctx);
        low = this._resolveSource(low, ctx);
        const cVal = (close && typeof close.get === 'function') ? close.get(0) : close;
        const ll = this.lowest(low, length, ctx);
        const hh = this.highest(high, length, ctx);
        const range = hh - ll;
        return (range !== 0 && !isNaN(range)) ? 100 * ((cVal - ll) / range) : 50;
      },

      cci(source, length, ctx) {
        source = this._resolveSource(source, ctx);
        const sVar = (source && typeof source.get === 'function') ? source : ctx.new_var(source);
        const mean = this.sma(sVar, length, ctx);
        if (isNaN(mean)) return NaN;
        let devSum = 0;
        for (let i = 0; i < length; i++) {
          const v = sVar.get(i);
          if (isNaN(v)) return NaN;
          devSum += Math.abs(v - mean);
        }
        const meanDev = devSum / length;
        return meanDev !== 0 ? (sVar.get(0) - mean) / (0.015 * meanDev) : 0;
      },

      mom(source, length, ctx) {
        source = this._resolveSource(source, ctx);
        const sVar = (source && typeof source.get === 'function') ? source : ctx.new_var(source);
        const cur = sVar.get(0);
        const prev = sVar.get(length);
        return (!isNaN(cur) && !isNaN(prev)) ? cur - prev : NaN;
      },

      roc(source, length, ctx) {
        source = this._resolveSource(source, ctx);
        const sVar = (source && typeof source.get === 'function') ? source : ctx.new_var(source);
        const cur = sVar.get(0);
        const prev = sVar.get(length);
        return (!isNaN(cur) && !isNaN(prev) && prev !== 0) ? 100 * (cur - prev) / prev : 0;
      },

      kc(source, length, mult, use_tr, ctx) {
        source = this._resolveSource(source, ctx);
        const basis = this.ema(source, length, ctx);
        const range = use_tr ? this.atr(length, ctx) : this.ema(this.high(ctx) - this.low(ctx), length, ctx);
        const dev = (mult || 1.5) * range;
        return [basis, basis + dev, basis - dev];
      },

      bbw(source, length, mult, ctx) {
        source = this._resolveSource(source, ctx);
        const [basis, upper, lower] = this.bb(source, length, mult, ctx);
        return (!isNaN(basis) && basis !== 0 && !isNaN(upper) && !isNaN(lower)) ? (upper - lower) / basis : NaN;
      },

      pivothigh(source, left, right, ctx) {
        source = this._resolveSource(source, ctx);
        const sVar = (source && typeof source.get === 'function') ? source : ctx.new_var(source);
        const center = sVar.get(right);
        if (isNaN(center)) return NaN;
        for (let i = 0; i <= left + right; i++) {
          if (i === right) continue;
          const v = sVar.get(i);
          if (isNaN(v) || v >= center) return NaN;
        }
        return center;
      },

      pivotlow(source, left, right, ctx) {
        source = this._resolveSource(source, ctx);
        const sVar = (source && typeof source.get === 'function') ? source : ctx.new_var(source);
        const center = sVar.get(right);
        if (isNaN(center)) return NaN;
        for (let i = 0; i <= left + right; i++) {
          if (i === right) continue;
          const v = sVar.get(i);
          if (isNaN(v) || v <= center) return NaN;
        }
        return center;
      },

      wpr(length, ctx) {
        const c = this.close(ctx);
        const h = this.high(ctx);
        const l = this.low(ctx);
        const hh = this.highest(h, length, ctx);
        const ll = this.lowest(l, length, ctx);
        const range = hh - ll;
        return (range !== 0 && !isNaN(range)) ? -100 * ((hh - c) / range) : -50;
      },

      colorGradient(val, bottomVal, topVal, bottomCol, topCol) {
        if (isNaN(val) || bottomVal === topVal) return bottomCol;
        const ratio = Math.max(0, Math.min(1, (val - bottomVal) / (topVal - bottomVal)));
        const parseHex = (hex) => {
          if (!hex || typeof hex !== 'string') return [33, 150, 243];
          const h = hex.replace('#', '');
          return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
        };
        const c1 = parseHex(bottomCol);
        const c2 = parseHex(topCol);
        const r = Math.round(c1[0] + ratio * (c2[0] - c1[0]));
        const g = Math.round(c1[1] + ratio * (c2[1] - c1[1]));
        const b = Math.round(c1[2] + ratio * (c2[2] - c1[2]));
        return `rgb(${r}, ${g}, ${b})`;
      },

      colorRgb(r, g, b, a = 1.0) {
        return `rgba(${r}, ${g}, ${b}, ${a})`;
      }
    }
  };


  /* =========================================================================
   * 4. PineTranspiler (Pine Script v5 Parser & Metainfo Generator)
   * ========================================================================= */
  class PineTranspiler {
    constructor() {
      this.reset();
    }

    reset() {
      this.title = "Custom Indicator";
      this.shortTitle = "Custom";
      this.overlay = false;
      this.precision = 2;
      this.inputs = [];
      this.plots = [];
      this.bands = [];
      this.fills = [];
      this.plotVars = new Map();
      this.codeStatements = [];
      this.errors = [];
      this.warnings = [];
      this.varNames = new Set();
      this.inputVarNames = new Map();
    }

    transpile(pineCode) {
      this.reset();
      if (!pineCode || typeof pineCode !== 'string' || !pineCode.trim()) {
        return {
          success: false,
          name: this.title,
          metainfo: null,
          constructor: null,
          constructorCode: "",
          errors: ["Pine Script source code cannot be empty"],
          warnings: []
        };
      }

      const lines = pineCode.split(/\r?\n/);
      const cleanLines = [];

      // Step 1: Pre-process & filter lines
      for (let i = 0; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line || line.startsWith('//')) continue;
        
        // Strip trailing comment safely outside string literals
        line = this._stripTrailingComment(line);
        if (line.trim()) cleanLines.push(line.trim());
      }

      // Step 2: Parse indicator header
      for (const line of cleanLines) {
        const indMatch = line.match(/^(?:indicator|study)\s*\((.*)\)$/);
        if (indMatch) {
          this._parseIndicatorHeader(indMatch[1]);
          break;
        }
      }

      // Step 3: Parse inputs, plots, and calculations
      const bodyStatements = [];
      let inputCounter = 0;
      let plotCounter = 0;

      for (const line of cleanLines) {
        if (line.match(/^(?:indicator|study)\s*\(/)) continue;

        // 3a. Input declarations: varName = input[.<type>](...)
        const inputMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*input(?:\.([a-zA-Z_]+))?\s*\((.*)\)$/);
        if (inputMatch) {
          const varName = inputMatch[1];
          const inputType = inputMatch[2] || 'auto';
          const argsStr = inputMatch[3];
          const inputDef = this._parseInput(inputCounter++, varName, inputType, argsStr);
          this.inputs.push(inputDef);
          this.varNames.add(varName);
          this.inputVarNames.set(varName, inputDef);
          bodyStatements.push(`const ${varName} = this._input(${inputDef.slotIndex});`);
          continue;
        }

        // 3b. Plot: plot(...) or assigned var = plot(...)
        const plotAssignedMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*plot\s*\((.*)\)$/);
        const plotMatch = line.match(/^plot\s*\((.*)\)$/);
        if (plotAssignedMatch || plotMatch) {
          const varName = plotAssignedMatch ? plotAssignedMatch[1] : null;
          const argsStr = plotAssignedMatch ? plotAssignedMatch[2] : plotMatch[1];
          const plotDef = this._parsePlot(plotCounter++, argsStr);
          if (varName) {
            plotDef.rawVar = varName;
            this.plotVars.set(varName, plotDef.id);
            this.varNames.add(varName);
          }
          this.plots.push(plotDef);
          bodyStatements.push(`const _plot_${plotDef.id}_val = ${this._transformExpr(plotDef.expr)};`);
          if (varName) {
            bodyStatements.push(`const ${varName} = _plot_${plotDef.id}_val;`);
          }
          continue;
        }

        // 3c. PlotShape: plotshape(...)
        const plotShapeMatch = line.match(/^plotshape\s*\((.*)\)$/);
        if (plotShapeMatch) {
          const shapeDef = this._parsePlotShape(plotCounter++, plotShapeMatch[1]);
          this.plots.push(shapeDef);
          bodyStatements.push(`const _plot_${shapeDef.id}_val = (${this._transformExpr(shapeDef.expr)}) ? 1 : 0;`);
          continue;
        }

        // 3d. PlotChar: plotchar(...)
        const plotCharMatch = line.match(/^plotchar\s*\((.*)\)$/);
        if (plotCharMatch) {
          const charDef = this._parsePlotChar(plotCounter++, plotCharMatch[1]);
          this.plots.push(charDef);
          bodyStatements.push(`const _plot_${charDef.id}_val = (${this._transformExpr(charDef.expr)}) ? 1 : 0;`);
          continue;
        }

        // 3e. PlotArrow: plotarrow(...)
        const plotArrowMatch = line.match(/^plotarrow\s*\((.*)\)$/);
        if (plotArrowMatch) {
          const arrowDef = this._parsePlotArrow(plotCounter++, plotArrowMatch[1]);
          this.plots.push(arrowDef);
          bodyStatements.push(`const _plot_${arrowDef.id}_val = ${this._transformExpr(arrowDef.expr)};`);
          continue;
        }

        // 3f. BarColor: barcolor(...)
        const barColorMatch = line.match(/^barcolor\s*\((.*)\)$/);
        if (barColorMatch) {
          const barDef = this._parseBarColor(plotCounter++, barColorMatch[1]);
          this.plots.push(barDef);
          bodyStatements.push(`const _plot_${barDef.id}_val = ${this._transformExpr(barDef.expr)};`);
          continue;
        }

        // 3g. BGColor: bgcolor(...)
        const bgcolorMatch = line.match(/^bgcolor\s*\((.*)\)$/);
        if (bgcolorMatch) {
          const bgDef = this._parseBgColor(plotCounter++, bgcolorMatch[1]);
          this.plots.push(bgDef);
          bodyStatements.push(`const _plot_${bgDef.id}_val = ${this._transformExpr(bgDef.expr)};`);
          continue;
        }

        // 3h. Fill: fill(...)
        const fillMatch = line.match(/^fill\s*\((.*)\)$/);
        if (fillMatch) {
          const fillDef = this._parseFill(this.fills.length, fillMatch[1]);
          this.fills.push(fillDef);
          continue;
        }

        // 3i. HLine: hline(...)
        const hlineMatch = line.match(/^hline\s*\((.*)\)$/);
        if (hlineMatch) {
          const bandDef = this._parseHline(this.bands.length, hlineMatch[1]);
          this.bands.push(bandDef);
          continue;
        }

        // 3j. AlertCondition: alertcondition(...)
        const alertMatch = line.match(/^alertcondition\s*\((.*)\)$/);
        if (alertMatch) {
          continue; // Recognized syntax, processed gracefully
        }

        // 3f. Tuple destructuring assignment: [a, b, c] = expr
        const tupleMatch = line.match(/^\[\s*([a-zA-Z0-9_,\s]+)\s*\]\s*=\s*(.*)$/);
        if (tupleMatch) {
          const vars = tupleMatch[1].split(',').map(v => v.trim());
          const expr = tupleMatch[2].trim();
          vars.forEach(v => this.varNames.add(v));
          bodyStatements.push(`const [${vars.join(', ')}] = ${this._transformExpr(expr)};`);
          continue;
        }

        // 3g. Standard assignment: varName = expr / varName := expr / var varName = expr
        const assignMatch = line.match(/^(?:var\s+)?([a-zA-Z_][a-zA-Z0-9_]*)\s*(?::=|=)\s*(.*)$/);
        if (assignMatch) {
          const varName = assignMatch[1];
          const expr = assignMatch[2].trim();
          this.varNames.add(varName);
          const transformedExpr = this._transformExpr(expr);
          bodyStatements.push(`const ${varName} = ${transformedExpr};`);
          continue;
        }

        // 3h. Fallback statement
        bodyStatements.push(this._transformExpr(line) + ';');
      }

      // Step 4: Build return array of plot expressions
      if (this.plots.length === 0) {
        this.warnings.push("No plot() or plotshape() statements found in script");
      }
      const returnExpressions = this.plots.map(p => `_plot_${p.id}_val`);
      const returnStatement = `return [${returnExpressions.join(', ')}];`;

      // Step 5: Build TradingView compliant Metainfo (v52)
      const sanitizedName = this.title.replace(/[^a-zA-Z0-9_-]/g, '_');
      const studyId = `${sanitizedName}@tv-customstudies-1`;

      const metaPlots = this.plots.map(p => ({
        id: p.id,
        type: p.plotType || 'line'
      }));

      const metaStyles = {};
      const metaDefaultStyles = {};

      this.plots.forEach(p => {
        if (p.plotType === 'shapes') {
          metaStyles[p.id] = {
            title: p.title || p.id,
            isHidden: false
          };
          metaDefaultStyles[p.id] = {
            plottype: p.shapeStyle || 'shape_triangle_up',
            visible: true,
            location: p.location || 'AboveBar',
            transparency: 0,
            color: p.color || '#4CAF50'
          };
        } else if (p.plotType === 'chars') {
          metaStyles[p.id] = {
            title: p.title || p.id,
            isHidden: false
          };
          metaDefaultStyles[p.id] = {
            char: p.char || '★',
            location: p.location || 'AboveBar',
            color: p.color || '#2196F3',
            textColor: p.textColor || '#FFFFFF',
            visible: true
          };
        } else if (p.plotType === 'bar_color') {
          metaStyles[p.id] = {
            title: p.title || p.id
          };
          metaDefaultStyles[p.id] = {
            color: '#2196F3',
            visible: true
          };
        } else if (p.plotType === 'arrows') {
          metaStyles[p.id] = {
            title: p.title || p.id
          };
          metaDefaultStyles[p.id] = {
            colorUp: p.colorUp || '#4CAF50',
            colorDown: p.colorDown || '#FF5252',
            visible: true
          };
        } else if (p.plotType === 'bg_colorer') {
          metaStyles[p.id] = {
            title: p.title || p.id
          };
          metaDefaultStyles[p.id] = {
            color: p.color || '#2196F3',
            transparency: 80,
            visible: true
          };
        } else {
          metaStyles[p.id] = {
            title: p.title || p.id,
            histogramBase: 0,
            joinPoints: false
          };
          metaDefaultStyles[p.id] = {
            linestyle: 0,
            linewidth: p.linewidth || 1,
            plottype: p.plottype !== undefined ? p.plottype : 0,
            trackPrice: false,
            transparency: 0,
            visible: true,
            color: p.color || '#2196F3'
          };
        }
      });

      const metaInputs = this.inputs.map((inp, idx) => ({
        slotIndex: inp.slotIndex !== undefined ? inp.slotIndex : idx,
        id: inp.id,
        name: inp.name,
        defval: inp.defval,
        type: inp.type,
        min: inp.min,
        max: inp.max,
        options: inp.options
      }));

      const defaultInputs = {};
      this.inputs.forEach((inp, idx) => {
        const slot = inp.slotIndex !== undefined ? inp.slotIndex : idx;
        defaultInputs[inp.id] = inp.defval;
        defaultInputs[slot] = inp.defval;
      });

      const metainfo = {
        _metainfoVersion: 52,
        isTVScript: false,
        isTVScriptStub: false,
        is_hidden_study: false,
        is_price_study: this.overlay,
        id: studyId,
        scriptIdPart: "",
        name: this.title,
        description: this.title,
        shortDescription: this.shortTitle || this.title,
        plots: metaPlots,
        defaults: {
          styles: metaDefaultStyles,
          inputs: defaultInputs
        },
        styles: metaStyles,
        inputs: metaInputs,
        format: {
          type: this.overlay ? "inherit" : "price",
          precision: this.precision
        }
      };

      if (this.bands.length > 0) {
        metainfo.bands = this.bands.map(b => ({
          id: b.id,
          name: b.name,
          zorder: -1.1
        }));
        metainfo.defaults.bands = this.bands.map(b => ({
          color: b.color || '#787B86',
          linestyle: b.linestyle !== undefined ? b.linestyle : 2,
          linewidth: b.linewidth || 1,
          visible: true,
          value: b.value
        }));
      }

      if (this.fills && this.fills.length > 0) {
        metainfo.filledAreas = this.fills.map(f => {
          const plotA = this.plots.find(p => p.rawVar === f.p1 || p.id === f.p1) || this.plots[0];
          const plotB = this.plots.find(p => p.rawVar === f.p2 || p.id === f.p2) || this.plots[1] || this.plots[0];
          return {
            id: f.id,
            objAId: plotA ? plotA.id : 'plot_0',
            objBId: plotB ? plotB.id : 'plot_1',
            type: 'plot_plot',
            title: f.title
          };
        });
        metainfo.defaults.filledAreas = this.fills.map(f => ({
          id: f.id,
          color: f.color,
          transparency: f.transp !== undefined ? f.transp : 80,
          visible: true
        }));
      }

      // Step 6: Generate Constructor Function Code & Instance
      const constructorFunctionCode = `function() {
  this.init = function(context, inputCallback) {
    this._context = context;
    this._input = inputCallback;
  };

  this.main = function(context, inputCallback) {
    this._context = context;
    this._input = inputCallback;
    const Std = (typeof TradingViewCustomEngine !== 'undefined' ? TradingViewCustomEngine.Std : null) || (this._context && this._context.Std ? this._context.Std : null);
    const _ctx = this._context;

    ${bodyStatements.join('\n    ')}

    ${returnStatement}
  };
}`;

      let constructorFn = null;
      try {
        /* eslint-disable no-new-func */
        constructorFn = new Function(`return ${constructorFunctionCode}`)();
      } catch (err) {
        this.errors.push(`Compilation error in constructor generation: ${err.message}`);
      }

      return {
        success: this.errors.length === 0,
        name: this.title,
        overlay: this.overlay,
        metainfo,
        constructor: constructorFn,
        constructorCode: constructorFunctionCode,
        rawBodyStatements: bodyStatements,
        errors: this.errors,
        warnings: this.warnings
      };
    }

    _stripTrailingComment(line) {
      let inQuotes = false;
      let quoteChar = '';
      for (let i = 0; i < line.length - 1; i++) {
        const c = line[i];
        if ((c === '"' || c === "'") && (i === 0 || line[i - 1] !== '\\')) {
          if (!inQuotes) {
            inQuotes = true;
            quoteChar = c;
          } else if (c === quoteChar) {
            inQuotes = false;
          }
        } else if (!inQuotes && c === '/' && line[i + 1] === '/') {
          return line.substring(0, i);
        }
      }
      return line;
    }

    _parseIndicatorHeader(argsStr) {
      const parts = this._splitArgs(argsStr);
      if (parts.length > 0) {
        const first = parts[0].trim();
        if (first.startsWith('"') || first.startsWith("'")) {
          this.title = first.replace(/^['"]|['"]$/g, '');
        }
      }

      for (const part of parts) {
        const titleMatch = part.match(/(?:title\s*=\s*)?["']([^"']+)["']/);
        if (part.startsWith('title=') && titleMatch) {
          this.title = titleMatch[1];
        }

        const shortTitleMatch = part.match(/shorttitle\s*=\s*["']([^"']+)["']/);
        if (shortTitleMatch) {
          this.shortTitle = shortTitleMatch[1];
        }

        const overlayMatch = part.match(/overlay\s*=\s*(true|false)/);
        if (overlayMatch) {
          this.overlay = overlayMatch[1] === 'true';
        }

        const precMatch = part.match(/precision\s*=\s*([0-9]+)/);
        if (precMatch) {
          this.precision = parseInt(precMatch[1], 10);
        }
      }

      if (!this.shortTitle) this.shortTitle = this.title;
    }

    _parseInput(index, varName, inputType, argsStr) {
      const id = `in_${index}`;
      let defval = 0;
      let name = varName;
      let type = 'integer';
      let min = undefined;
      let max = undefined;
      let options = undefined;

      const parts = this._splitArgs(argsStr);

      if (parts.length > 0) {
        const rawVal = parts[0].trim();
        if (rawVal === 'true' || rawVal === 'false') {
          defval = rawVal === 'true';
          type = 'bool';
        } else if (rawVal.startsWith('"') || rawVal.startsWith("'")) {
          defval = rawVal.replace(/^['"]|['"]$/g, '');
          type = 'text';
        } else if (['open', 'high', 'low', 'close', 'hl2', 'hlc3', 'ohlc4', 'volume'].includes(rawVal)) {
          defval = rawVal;
          type = 'source';
          options = ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"];
        } else if (!isNaN(Number(rawVal))) {
          if (rawVal.includes('.') || inputType === 'float') {
            defval = parseFloat(rawVal);
            type = 'float';
          } else {
            defval = parseInt(rawVal, 10);
            type = 'integer';
          }
        }
      }

      if (inputType === 'int') type = 'integer';
      else if (inputType === 'float') type = 'float';
      else if (inputType === 'bool') type = 'bool';
      else if (inputType === 'string') type = 'text';
      else if (inputType === 'source') {
        type = 'source';
        options = ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"];
      } else if (inputType === 'color') type = 'color';

      for (let i = 0; i < parts.length; i++) {
        const part = parts[i].trim();
        const titleMatch = part.match(/(?:title|name)\s*=\s*["']([^"']+)["']/);
        if (titleMatch) {
          name = titleMatch[1];
        } else if (i === 1 && (part.startsWith('"') || part.startsWith("'"))) {
          name = part.replace(/^['"]|['"]$/g, '');
        }

        const minMatch = part.match(/minval\s*=\s*([0-9.-]+)/);
        if (minMatch) min = parseFloat(minMatch[1]);

        const maxMatch = part.match(/maxval\s*=\s*([0-9.-]+)/);
        if (maxMatch) max = parseFloat(maxMatch[1]);
      }

      return {
        slotIndex: index,
        id,
        name,
        defval,
        type,
        min: min !== undefined ? min : (type === 'integer' || type === 'float' ? 0 : undefined),
        max: max !== undefined ? max : (type === 'integer' || type === 'float' ? 10000 : undefined),
        options
      };
    }

    _parsePlot(index, argsStr) {
      const parts = this._splitArgs(argsStr);
      const expr = parts[0] || '0';
      let title = `Plot ${index + 1}`;
      let color = '#2196F3';
      let linewidth = 1;
      let plottype = 0;

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].trim();
        const titleMatch = part.match(/(?:title\s*=\s*)?["']([^"']+)["']/);
        if (titleMatch && !part.includes('color') && !part.includes('style')) {
          title = titleMatch[1];
        }

        const colMatch = part.match(/(?:color\s*=\s*)?(color\.[a-zA-Z_]+|#[0-9a-fA-F]{3,8})/);
        if (colMatch) {
          color = this._resolveColor(colMatch[1]);
        }

        const widthMatch = part.match(/linewidth\s*=\s*([0-9]+)/);
        if (widthMatch) {
          linewidth = parseInt(widthMatch[1], 10);
        }

        const styleMatch = part.match(/style\s*=\s*plot\.style_([a-zA-Z_]+)/);
        if (styleMatch) {
          const s = styleMatch[1];
          if (s === 'line') plottype = 0;
          else if (s === 'histogram') plottype = 1;
          else if (s === 'cross') plottype = 3;
          else if (s === 'area') plottype = 4;
          else if (s === 'columns') plottype = 5;
          else if (s === 'circles') plottype = 6;
          else if (s === 'linebr') plottype = 7;
          else if (s === 'stepline') plottype = 9;
        }
      }

      return {
        id: `plot_${index}`,
        plotType: 'line',
        expr,
        title,
        color,
        linewidth,
        plottype
      };
    }

    _parsePlotShape(index, argsStr) {
      const parts = this._splitArgs(argsStr);
      const expr = parts[0] || 'false';
      let title = `Shape ${index + 1}`;
      let shapeStyle = 'shape_triangle_up';
      let location = 'AboveBar';
      let color = '#4CAF50';

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].trim();
        const titleMatch = part.match(/(?:title\s*=\s*)?["']([^"']+)["']/);
        if (titleMatch && !part.includes('style') && !part.includes('location') && !part.includes('color')) {
          title = titleMatch[1];
        }

        const styleMatch = part.match(/style\s*=\s*shape\.([a-zA-Z_]+)/);
        if (styleMatch) {
          const s = styleMatch[1];
          if (s === 'triangledown') shapeStyle = 'shape_triangle_down';
          else if (s === 'triangleup') shapeStyle = 'shape_triangle_up';
          else if (s === 'arrowdown') shapeStyle = 'shape_arrow_down';
          else if (s === 'arrowup') shapeStyle = 'shape_arrow_up';
          else if (s === 'cross') shapeStyle = 'shape_cross';
          else if (s === 'circle') shapeStyle = 'shape_circle';
          else if (s === 'square') shapeStyle = 'shape_square';
          else if (s === 'diamond') shapeStyle = 'shape_diamond';
        }

        const locMatch = part.match(/location\s*=\s*location\.([a-zA-Z_]+)/);
        if (locMatch) {
          const l = locMatch[1];
          if (l === 'abovebar') location = 'AboveBar';
          else if (l === 'belowbar') location = 'BelowBar';
          else if (l === 'top') location = 'Top';
          else if (l === 'bottom') location = 'Bottom';
          else if (l === 'absolute') location = 'Absolute';
        }

        const colMatch = part.match(/(?:color\s*=\s*)?(color\.[a-zA-Z_]+|#[0-9a-fA-F]{3,8})/);
        if (colMatch) {
          color = this._resolveColor(colMatch[1]);
        }
      }

      return {
        id: `plot_${index}`,
        plotType: 'shapes',
        expr,
        title,
        shapeStyle,
        location,
        color
      };
    }

    _parseHline(index, argsStr) {
      const parts = this._splitArgs(argsStr);
      const value = parseFloat(parts[0]) || 0;
      let name = `HLine ${index + 1}`;
      let color = '#787B86';
      let linestyle = 2; // dotted

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].trim();
        const titleMatch = part.match(/(?:title\s*=\s*)?["']([^"']+)["']/);
        if (titleMatch) name = titleMatch[1];

        const colMatch = part.match(/(?:color\s*=\s*)?(color\.[a-zA-Z_]+|#[0-9a-fA-F]{3,8})/);
        if (colMatch) color = this._resolveColor(colMatch[1]);

        const styleMatch = part.match(/linestyle\s*=\s*hline\.style_([a-zA-Z_]+)/);
        if (styleMatch) {
          const s = styleMatch[1];
          if (s === 'solid') linestyle = 0;
          else if (s === 'dotted') linestyle = 1;
          else if (s === 'dashed') linestyle = 2;
        }
      }

      return {
        id: `hline_${index}`,
        name,
        value,
        color,
        linestyle
      };
    }

    _parseBgColor(index, argsStr) {
      const parts = this._splitArgs(argsStr);
      const expr = parts[0] || 'na';
      let title = `Background ${index + 1}`;
      let color = '#2196F3';

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].trim();
        const titleMatch = part.match(/(?:title\s*=\s*)?["']([^"']+)["']/);
        if (titleMatch) title = titleMatch[1];
        const colMatch = part.match(/(?:color\s*=\s*)?(color\.[a-zA-Z_]+|#[0-9a-fA-F]{3,8})/);
        if (colMatch) color = this._resolveColor(colMatch[1]);
      }

      return {
        id: `plot_${index}`,
        plotType: 'bg_colorer',
        expr,
        title,
        color
      };
    }

    _parsePlotChar(index, argsStr) {
      const parts = this._splitArgs(argsStr);
      const expr = parts[0] || 'false';
      let title = `Char ${index + 1}`;
      let char = '★';
      let location = 'AboveBar';
      let color = '#2196F3';
      let textColor = '#FFFFFF';
      let size = 'auto';

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].trim();
        const titleMatch = part.match(/(?:title\s*=\s*)?["']([^"']+)["']/);
        if (titleMatch && !part.includes('char') && !part.includes('color') && !part.includes('location')) {
          title = titleMatch[1];
        }
        const charMatch = part.match(/(?:char\s*=\s*)?["']([^"']+)["']/);
        if (charMatch && part.includes('char')) char = charMatch[1];

        const locMatch = part.match(/location\s*=\s*location\.([a-zA-Z_]+)/);
        if (locMatch) {
          const l = locMatch[1];
          if (l === 'abovebar') location = 'AboveBar';
          else if (l === 'belowbar') location = 'BelowBar';
          else if (l === 'top') location = 'Top';
          else if (l === 'bottom') location = 'Bottom';
          else if (l === 'absolute') location = 'Absolute';
        }

        const colMatch = part.match(/(?:color\s*=\s*)?(color\.[a-zA-Z_]+|#[0-9a-fA-F]{3,8})/);
        if (colMatch) color = this._resolveColor(colMatch[1]);

        const textColMatch = part.match(/(?:textcolor\s*=\s*)?(color\.[a-zA-Z_]+|#[0-9a-fA-F]{3,8})/);
        if (textColMatch) textColor = this._resolveColor(textColMatch[1]);
      }

      return {
        id: `plot_${index}`,
        plotType: 'chars',
        expr,
        title,
        char,
        location,
        color,
        textColor,
        size
      };
    }

    _parseBarColor(index, argsStr) {
      const parts = this._splitArgs(argsStr);
      const expr = parts[0] || 'na';
      let title = `Bar Color ${index + 1}`;
      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].trim();
        const titleMatch = part.match(/(?:title\s*=\s*)?["']([^"']+)["']/);
        if (titleMatch) title = titleMatch[1];
      }
      return {
        id: `plot_${index}`,
        plotType: 'bar_color',
        expr,
        title
      };
    }

    _parsePlotArrow(index, argsStr) {
      const parts = this._splitArgs(argsStr);
      const expr = parts[0] || '0';
      let title = `Arrow ${index + 1}`;
      let colorUp = '#4CAF50';
      let colorDown = '#FF5252';

      for (let i = 1; i < parts.length; i++) {
        const part = parts[i].trim();
        const colUpMatch = part.match(/colorup\s*=\s*(color\.[a-zA-Z_]+|#[0-9a-fA-F]{3,8})/);
        if (colUpMatch) colorUp = this._resolveColor(colUpMatch[1]);
        const colDnMatch = part.match(/colordown\s*=\s*(color\.[a-zA-Z_]+|#[0-9a-fA-F]{3,8})/);
        if (colDnMatch) colorDown = this._resolveColor(colDnMatch[1]);
      }

      return {
        id: `plot_${index}`,
        plotType: 'arrows',
        expr,
        title,
        colorUp,
        colorDown
      };
    }

    _parseFill(index, argsStr) {
      const parts = this._splitArgs(argsStr);
      const p1 = parts[0] ? parts[0].trim() : '';
      const p2 = parts[1] ? parts[1].trim() : '';
      let title = `Fill ${index + 1}`;
      let color = '#2196F3';
      let transp = 80;

      for (let i = 2; i < parts.length; i++) {
        const part = parts[i].trim();
        const colMatch = part.match(/(?:color\s*=\s*)?(color\.[a-zA-Z_]+|#[0-9a-fA-F]{3,8})/);
        if (colMatch) color = this._resolveColor(colMatch[1]);
        const transpMatch = part.match(/transp\s*=\s*([0-9]+)/);
        if (transpMatch) transp = parseInt(transpMatch[1], 10);
      }

      return {
        id: `fill_${index}`,
        p1,
        p2,
        title,
        color,
        transp
      };
    }

    _resolveColor(colorName) {
      const colors = {
        'color.red': '#FF5252',
        'color.green': '#4CAF50',
        'color.blue': '#2196F3',
        'color.orange': '#FF9800',
        'color.purple': '#9C27B0',
        'color.yellow': '#FFEB3B',
        'color.white': '#FFFFFF',
        'color.black': '#000000',
        'color.gray': '#787B86',
        'color.maroon': '#880E4F',
        'color.navy': '#0D47A1',
        'color.teal': '#009688',
        'color.olive': '#827717',
        'color.aqua': '#00BCD4',
        'color.lime': '#00E676',
        'color.fuchsia': '#E040FB',
        'color.silver': '#B0BEC5'
      };
      return colors[colorName] || colorName;
    }

    _isInsideQuotes(str, targetIndex) {
      let inQuotes = false;
      let quoteChar = '';
      for (let i = 0; i < targetIndex; i++) {
        const ch = str[i];
        if ((ch === '"' || ch === "'") && (i === 0 || str[i - 1] !== '\\')) {
          if (!inQuotes) {
            inQuotes = true;
            quoteChar = ch;
          } else if (ch === quoteChar) {
            inQuotes = false;
          }
        }
      }
      return inQuotes;
    }

    _extractFunctionCall(str, startIdx) {
      let depth = 1;
      let inQuotes = false;
      let quoteChar = '';
      for (let i = startIdx + 1; i < str.length; i++) {
        const ch = str[i];
        if ((ch === '"' || ch === "'") && (i === 0 || str[i - 1] !== '\\')) {
          if (!inQuotes) {
            inQuotes = true;
            quoteChar = ch;
          } else if (ch === quoteChar) {
            inQuotes = false;
          }
        } else if (!inQuotes) {
          if (ch === '(') depth++;
          else if (ch === ')') {
            depth--;
            if (depth === 0) {
              return {
                argsStr: str.slice(startIdx + 1, i),
                endIndex: i
              };
            }
          }
        }
      }
      return null;
    }

    _mapFunctionCall(fnName, args) {
      switch (fnName) {
        case 'ta.sma':
          return `Std.sma(${args[0] || '0'}, ${args[1] || '14'}, _ctx)`;
        case 'ta.ema':
          return `Std.ema(${args[0] || '0'}, ${args[1] || '14'}, _ctx)`;
        case 'ta.rma':
          return `Std.rma(${args[0] || '0'}, ${args[1] || '14'}, _ctx)`;
        case 'ta.wma':
          return `Std.wma(${args[0] || '0'}, ${args[1] || '14'}, _ctx)`;
        case 'ta.vwma':
          return `Std.vwma(${args[0] || '0'}, ${args[1] || '14'}, _ctx)`;
        case 'ta.swma':
          return `Std.swma(${args[0] || '0'}, _ctx)`;
        case 'ta.rsi':
          return `Std.rsi(${args[0] || '0'}, ${args[1] || '14'}, _ctx)`;
        case 'ta.sum':
          return `Std.sum(${args[0] || '0'}, ${args[1] || '10'}, _ctx)`;
        case 'ta.crossover':
          return `Std.crossover(${args[0] || '0'}, ${args[1] || '0'}, _ctx)`;
        case 'ta.crossunder':
          return `Std.crossunder(${args[0] || '0'}, ${args[1] || '0'}, _ctx)`;
        case 'ta.cross':
          return `Std.cross(${args[0] || '0'}, ${args[1] || '0'}, _ctx)`;
        case 'ta.macd':
          return `Std.macd(${args[0] || '0'}, ${args[1] || '12'}, ${args[2] || '26'}, ${args[3] || '9'}, _ctx)`;
        case 'ta.stdev':
          return `Std.stdev(${args[0] || '0'}, ${args[1] || '14'}, _ctx)`;
        case 'ta.variance':
          return `Std.variance(${args[0] || '0'}, ${args[1] || '14'}, _ctx)`;
        case 'ta.atr':
          return `Std.atr(${args[0] || '14'}, _ctx)`;
        case 'ta.tr':
          return `Std.tr(${args[0] || 'false'}, _ctx)`;
        case 'ta.highest':
          return `Std.highest(${args[0] || '0'}, ${args[1] || '14'}, _ctx)`;
        case 'ta.lowest':
          return `Std.lowest(${args[0] || '0'}, ${args[1] || '14'}, _ctx)`;
        case 'ta.highestbars':
          return `Std.highestbars(${args[0] || '0'}, ${args[1] || '14'}, _ctx)`;
        case 'ta.lowestbars':
          return `Std.lowestbars(${args[0] || '0'}, ${args[1] || '14'}, _ctx)`;
        case 'ta.change':
          return `Std.change(${args[0] || '0'}, _ctx)`;
        case 'ta.cum':
          return `Std.cum(${args[0] || '0'}, _ctx)`;
        case 'ta.bb':
          return `Std.bb(${args[0] || '0'}, ${args[1] || '20'}, ${args[2] || '2.0'}, _ctx)`;
        case 'ta.supertrend':
          return `Std.supertrend(${args[0] || '3.0'}, ${args[1] || '10'}, _ctx)`;
        case 'ta.valuewhen':
          return `Std.valuewhen(${args[0] || 'false'}, ${args[1] || '0'}, ${args[2] !== undefined ? args[2] : '0'}, _ctx)`;
        case 'ta.barssince':
          return `Std.barssince(${args[0] || 'false'}, _ctx)`;
        case 'ta.stoch':
          return `Std.stoch(${args[0] || 'Std.close(_ctx)'}, ${args[1] || 'Std.high(_ctx)'}, ${args[2] || 'Std.low(_ctx)'}, ${args[3] || '14'}, _ctx)`;
        case 'ta.cci':
          return `Std.cci(${args[0] || 'Std.close(_ctx)'}, ${args[1] || '20'}, _ctx)`;
        case 'ta.mom':
          return `Std.mom(${args[0] || 'Std.close(_ctx)'}, ${args[1] || '10'}, _ctx)`;
        case 'ta.roc':
          return `Std.roc(${args[0] || 'Std.close(_ctx)'}, ${args[1] || '10'}, _ctx)`;
        case 'ta.kc':
          return `Std.kc(${args[0] || 'Std.close(_ctx)'}, ${args[1] || '20'}, ${args[2] || '1.5'}, ${args[3] || 'true'}, _ctx)`;
        case 'ta.bbw':
          return `Std.bbw(${args[0] || 'Std.close(_ctx)'}, ${args[1] || '20'}, ${args[2] || '2.0'}, _ctx)`;
        case 'ta.pivothigh':
          return `Std.pivothigh(${args[0] || 'Std.high(_ctx)'}, ${args[1] || '5'}, ${args[2] || '5'}, _ctx)`;
        case 'ta.pivotlow':
          return `Std.pivotlow(${args[0] || 'Std.low(_ctx)'}, ${args[1] || '5'}, ${args[2] || '5'}, _ctx)`;
        case 'ta.wpr':
          return `Std.wpr(${args[0] || '14'}, _ctx)`;
        case 'color.from_gradient':
          return `Std.colorGradient(${args.join(', ')})`;
        case 'color.rgb':
          return `Std.colorRgb(${args.join(', ')})`;
        case 'fixnan':
          return `Std.fixnan(${args[0] || '0'}, _ctx)`;
        case 'nz':
          return `Std.nz(${args[0] || '0'}${args[1] !== undefined ? ', ' + args[1] : ''})`;
        case 'na':
          return `Std.na(${args[0] || '0'})`;
        case 'color.new':
          return `Std.colorNew(${args[0] || '"#2196F3"'}, ${args[1] || '0'})`;
        case 'math.max':
          return `Math.max(${args.join(', ')})`;
        case 'math.min':
          return `Math.min(${args.join(', ')})`;
        case 'math.abs':
          return `Math.abs(${args[0] || '0'})`;
        case 'math.sqrt':
          return `Math.sqrt(${args[0] || '0'})`;
        case 'math.pow':
          return `Math.pow(${args[0] || '0'}, ${args[1] || '1'})`;
        case 'math.round':
          return `Math.round(${args[0] || '0'})`;
        case 'math.floor':
          return `Math.floor(${args[0] || '0'})`;
        case 'math.ceil':
          return `Math.ceil(${args[0] || '0'})`;
        case 'math.avg':
          return `Std.avg(${args.join(', ')})`;
        default:
          return `${fnName}(${args.join(', ')})`;
      }
    }

    _transformFunctionCalls(str) {
      let result = '';
      let lastIndex = 0;
      const fnRegex = /\b(ta\.[a-zA-Z0-9_]+|color\.new|color\.from_gradient|color\.rgb|fixnan|nz|na|math\.[a-zA-Z0-9_]+)\s*\(/g;
      let match;
      while ((match = fnRegex.exec(str)) !== null) {
        const fnName = match[1];
        const matchStart = match.index;
        if (this._isInsideQuotes(str, matchStart)) {
          continue;
        }
        const openParenIdx = matchStart + match[0].length - 1;
        const extracted = this._extractFunctionCall(str, openParenIdx);
        if (!extracted) {
          continue;
        }

        result += str.slice(lastIndex, matchStart);
        const rawArgs = this._splitArgs(extracted.argsStr);
        const transformedArgs = rawArgs.map(arg => this._transformExpr(arg));

        const replacement = this._mapFunctionCall(fnName, transformedArgs);
        result += replacement;

        lastIndex = extracted.endIndex + 1;
        fnRegex.lastIndex = lastIndex;
      }
      result += str.slice(lastIndex);
      return result;
    }

    _transformExpr(expr) {
      if (!expr || typeof expr !== 'string') return expr;
      let t = expr;

      // 1. Transform function calls (ta.*, math.*, nz, na, fixnan, color.new) with balanced args
      t = this._transformFunctionCalls(t);

      // 2. Standalone ta.tr (without parentheses)
      t = t.replace(/\bta\.tr\b(?!\s*\()/g, 'Std.tr(false, _ctx)');

      // 3. Built-in series indexing: close[1], open[1], etc.
      t = t.replace(/\b(close|open|high|low|volume|hl2|hlc3|ohlc4)\[([0-9]+)\]/g, (m, src, offset) => {
        return `Std.seriesVar('${src}', Std.${src}(_ctx), _ctx).get(${offset})`;
      });

      // 4. Standalone built-ins (ensure no double wrap with negative lookbehind/lookahead)
      t = t.replace(/(?<!Std\.)(?<!['"])\b(close|open|high|low|volume|time|hl2|hlc3|ohlc4)\b(?!['"])(?!\s*(?::=|(?:=(?![=]))))/g, (m, src) => {
        return `Std.${src}(_ctx)`;
      });
      t = t.replace(/(?<!Std\.)\bbar_index\b/g, 'Std.n(_ctx)');

      // 5. Custom variables historical indexing: myVar[1]
      t = t.replace(/(?<!Std\.)\b([a-zA-Z_][a-zA-Z0-9_]*)\[([0-9]+)\]/g, (m, varName, offset) => {
        return `Std.seriesVar('${varName}', ${varName}, _ctx).get(${offset})`;
      });

      // 6. Boolean operators
      t = t.replace(/\band\b/g, '&&');
      t = t.replace(/\bor\b/g, '||');
      t = t.replace(/\bnot\b/g, '!');

      // 7. Color constants (excluding color.new which is already transformed)
      t = t.replace(/\bcolor\.(?!new\b)([a-zA-Z_]+)\b/g, (m, c) => `"${this._resolveColor('color.' + c)}"`);

      // 8. Constants (na as NaN with negative lookbehind)
      t = t.replace(/(?<!Std\.)\bna\b(?!\s*\()/g, 'NaN');

      return t;
    }

    _splitArgs(str) {
      const results = [];
      let current = '';
      let inQuotes = false;
      let quoteChar = '';
      let parenDepth = 0;
      let bracketDepth = 0;

      for (let i = 0; i < str.length; i++) {
        const char = str[i];
        if ((char === '"' || char === "'") && (i === 0 || str[i - 1] !== '\\')) {
          if (!inQuotes) {
            inQuotes = true;
            quoteChar = char;
          } else if (char === quoteChar) {
            inQuotes = false;
          }
          current += char;
        } else if (!inQuotes) {
          if (char === '(') { parenDepth++; current += char; }
          else if (char === ')') { parenDepth--; current += char; }
          else if (char === '[') { bracketDepth++; current += char; }
          else if (char === ']') { bracketDepth--; current += char; }
          else if (char === ',' && parenDepth === 0 && bracketDepth === 0) {
            results.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        } else {
          current += char;
        }
      }
      if (current.trim()) results.push(current.trim());
      return results;
    }
  }


  /* =========================================================================
   * 5. PineScriptRuntime (Standalone Execution Runtime & Verifier)
   * ========================================================================= */
  class TradingViewStudyMockContext {
    constructor(bars) {
      this.bars = bars || [];
      this.barIndex = 0;
      this._vars = [];
      this._varsIndex = 0;
      this.Std = TradingViewCustomEngine.Std;
      this.symbol = {
        open: 0, high: 0, low: 0, close: 0, volume: 0, time: 0, index: 0,
        isdwm: () => false,
        bartime: () => this.bars[this.barIndex] ? this.bars[this.barIndex].time : 0
      };
    }

    new_var(e) {
      if (this._vars.length <= this._varsIndex) {
        this._vars.push(new SeriesVarTracker());
      }
      const v = this._vars[this._varsIndex++];
      if (arguments.length > 0 && e !== undefined) {
        v.set(e);
      }
      return v;
    }

    setMinimumAdditionalDepth() {}

    _startBar(i) {
      this.barIndex = i;
      this._varsIndex = 0;
      const b = this.bars[i] || { open: 0, high: 0, low: 0, close: 0, volume: 0, time: 0 };
      this.symbol.open = b.open;
      this.symbol.high = b.high;
      this.symbol.low = b.low;
      this.symbol.close = b.close;
      this.symbol.volume = b.volume || 1000;
      this.symbol.time = b.time || (i * 60);
      this.symbol.index = i;
    }

    _finishBar() {
      for (let j = 0; j < this._vars.length; j++) {
        this._vars[j]._commit();
      }
    }
  }

  const PineScriptRuntime = {
    TradingViewStudyMockContext,

    createMockBars(count = 60, basePrice = 100) {
      const bars = [];
      let price = basePrice;
      for (let i = 0; i < count; i++) {
        const trend = Math.sin(i / 8) * 5;
        const noise = (Math.sin(i * 1.5) * 2);
        const open = price;
        const close = open + trend + noise;
        const high = Math.max(open, close) + Math.abs(Math.sin(i)) * 2 + 0.5;
        const low = Math.min(open, close) - Math.abs(Math.cos(i)) * 2 - 0.5;
        const volume = Math.floor(1000 + Math.abs(Math.sin(i)) * 500);
        bars.push({
          time: 1700000000 + i * 60,
          open,
          high,
          low,
          close,
          volume
        });
        price = close;
      }
      return bars;
    },

    execute(transpiledResult, bars, inputOverrides = {}) {
      if (!transpiledResult || !transpiledResult.metainfo) {
        throw new Error('Invalid transpiled study descriptor');
      }
      if (!bars || !Array.isArray(bars) || bars.length === 0) {
        throw new Error('Bars array cannot be empty');
      }

      const metainfo = transpiledResult.metainfo;
      const constructorFn = transpiledResult.constructor;
      if (typeof constructorFn !== 'function') {
        throw new Error('Study constructor function is not executable');
      }

      const instance = new constructorFn();
      const ctx = new TradingViewStudyMockContext(bars);

      const inputValues = {};
      metainfo.inputs.forEach((inp, idx) => {
        const slot = (inp.slotIndex !== undefined) ? inp.slotIndex : idx;
        const val = inputOverrides[inp.id] !== undefined
          ? inputOverrides[inp.id]
          : (inputOverrides[inp.name] !== undefined ? inputOverrides[inp.name] : inp.defval);
        inputValues[slot] = val;
        inputValues[inp.id] = val;
        inputValues[inp.name] = val;
      });

      const inputCallback = function(idxOrId) {
        if (inputValues[idxOrId] !== undefined) {
          return inputValues[idxOrId];
        }
        return inputValues[0];
      };

      if (instance.init) {
        instance.init(ctx, inputCallback);
      }

      const plotsCount = metainfo.plots.length;
      const plotResults = {};
      metainfo.plots.forEach(p => {
        plotResults[p.id] = [];
      });

      for (let i = 0; i < bars.length; i++) {
        ctx._startBar(i);
        let ret = [];
        try {
          ret = instance.main(ctx, inputCallback);
        } catch (err) {
          throw new Error(`Runtime error at bar ${i}: ${err.message}`);
        }
        ctx._finishBar();

        if (Array.isArray(ret)) {
          for (let pIdx = 0; pIdx < plotsCount; pIdx++) {
            const plotId = metainfo.plots[pIdx].id;
            plotResults[plotId].push(ret[pIdx]);
          }
        }
      }

      return {
        success: true,
        barsCount: bars.length,
        plotsMeta: metainfo.plots,
        plotValues: plotResults
      };
    }
  };


  /* =========================================================================
   * 6. PineScriptHighlighter (Syntax Tokenizer & HTML Highlighter)
   * ========================================================================= */
  const PineScriptHighlighter = {
    keywords: new Set([
      'indicator', 'study', 'strategy', 'input', 'input.int', 'input.float', 'input.bool',
      'input.string', 'input.color', 'input.source', 'plot', 'plotshape', 'plotchar',
      'plotcandle', 'plotbar', 'plotarrow', 'bgcolor', 'barcolor', 'hline', 'fill',
      'if', 'else', 'for', 'to', 'by', 'while', 'var', 'varip', 'switch', 'case', 'default',
      'true', 'false', 'na', 'and', 'or', 'not'
    ]),

    builtins: new Set([
      'open', 'high', 'low', 'close', 'volume', 'time', 'hl2', 'hlc3', 'ohlc4', 'bar_index',
      'color.red', 'color.green', 'color.blue', 'color.orange', 'color.purple', 'color.yellow',
      'color.white', 'color.black', 'color.gray', 'color.maroon', 'color.navy', 'color.teal',
      'color.olive', 'color.aqua', 'color.lime', 'color.fuchsia', 'color.silver', 'color.new',
      'shape.triangleup', 'shape.triangledown', 'shape.arrowup', 'shape.arrowdown', 'shape.cross',
      'shape.circle', 'shape.square', 'shape.diamond', 'shape.flag',
      'location.abovebar', 'location.belowbar', 'location.top', 'location.bottom', 'location.absolute',
      'size.auto', 'size.tiny', 'size.small', 'size.normal', 'size.large', 'size.huge',
      'plot.style_line', 'plot.style_histogram', 'plot.style_cross', 'plot.style_area',
      'plot.style_columns', 'plot.style_circles', 'plot.style_linebr', 'plot.style_stepline',
      'hline.style_solid', 'hline.style_dotted', 'hline.style_dashed'
    ]),

    taFunctions: new Set([
      'ta.sma', 'ta.ema', 'ta.rma', 'ta.wma', 'ta.vwma', 'ta.swma', 'ta.rsi', 'ta.macd',
      'ta.crossover', 'ta.crossunder', 'ta.cross', 'ta.highest', 'ta.lowest', 'ta.highestbars',
      'ta.lowestbars', 'ta.tr', 'ta.atr', 'ta.stdev', 'ta.variance', 'ta.change', 'ta.cum',
      'ta.bb', 'ta.supertrend', 'ta.valuewhen', 'ta.barssince', 'ta.stoch', 'ta.cci',
      'ta.mom', 'ta.roc', 'ta.kc', 'ta.bbw', 'ta.pivothigh', 'ta.pivotlow', 'ta.wpr',
      'color.new', 'color.from_gradient', 'color.rgb',
      'math.max', 'math.min', 'math.abs', 'math.sqrt', 'math.pow', 'math.round',
      'math.floor', 'math.ceil', 'math.avg'
    ]),

    escapeHtml(text) {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    },

    highlight(code) {
      if (!code || typeof code !== 'string') return '';
      const lines = code.split('\n');

      const highlightedLines = lines.map(line => {
        let comment = '';
        const commentIdx = line.indexOf('//');
        if (commentIdx !== -1) {
          comment = `<span class="pine-comment">${this.escapeHtml(line.slice(commentIdx))}</span>`;
          line = line.slice(0, commentIdx);
        }

        const tokenRegex = /(".*?"|'.*?'|[a-zA-Z_][a-zA-Z0-9_.]*|[0-9]+(?:\.[0-9]+)?|[+\-*/=<>!:]+|[(),[\]{}])/g;
        let result = '';
        let lastIdx = 0;
        let match;

        while ((match = tokenRegex.exec(line)) !== null) {
          if (match.index > lastIdx) {
            result += this.escapeHtml(line.slice(lastIdx, match.index));
          }
          lastIdx = tokenRegex.lastIndex;

          const token = match[0];
          if (token.startsWith('"') || token.startsWith("'")) {
            result += `<span class="pine-string">${this.escapeHtml(token)}</span>`;
          } else if (!isNaN(Number(token))) {
            result += `<span class="pine-number">${token}</span>`;
          } else if (this.keywords.has(token)) {
            result += `<span class="pine-keyword">${token}</span>`;
          } else if (this.taFunctions.has(token)) {
            result += `<span class="pine-ta-function">${token}</span>`;
          } else if (this.builtins.has(token)) {
            result += `<span class="pine-builtin">${token}</span>`;
          } else if (token.includes('.')) {
            result += `<span class="pine-property">${token}</span>`;
          } else if (/^[+\-*/=<>!:]+$/.test(token)) {
            result += `<span class="pine-operator">${this.escapeHtml(token)}</span>`;
          } else {
            result += `<span class="pine-ident">${this.escapeHtml(token)}</span>`;
          }
        }

        if (lastIdx < line.length) {
          result += this.escapeHtml(line.slice(lastIdx));
        }

        return result + comment;
      });

      return highlightedLines.join('\n');
    }
  };


  /* =========================================================================
   * 7. PineEngine (Global Singleton & Chart Integration Adapter)
   * ========================================================================= */
  const PineEngine = {
    Templates: PineScriptTemplates,
    Storage: PineScriptStorage,
    Transpiler: PineTranspiler,
    Runtime: PineScriptRuntime,
    Highlighter: PineScriptHighlighter,
    Std: TradingViewCustomEngine.Std,

    /**
     * Initializes PineEngine with TradingView's PineJS runtime
     */
    init(PineJS) {
      TradingViewCustomEngine.init(PineJS);
    },

    /**
     * Parse & transpile Pine Script code to TradingView Study Descriptor
     */
    transpile(pineCode) {
      const transpiler = new PineTranspiler();
      return transpiler.transpile(pineCode);
    },

    /**
     * Validate Pine Script code for syntactic errors
     */
    validate(pineCode) {
      const res = this.transpile(pineCode);
      return {
        valid: res.success,
        errors: res.errors,
        warnings: res.warnings,
        descriptor: res
      };
    },

    /**
     * Hook for TradingView widget custom_indicators_getter option
     * Returns Promise<Array<StudyDescriptor>>
     */
    getCustomIndicators(PineJS) {
      this.init(PineJS);

      const allScripts = PineScriptStorage.getAllScripts();
      const studies = [];

      for (const script of allScripts) {
        if (!script || !script.code) continue;
        const res = this.transpile(script.code);
        if (res.success && res.metainfo && res.constructor) {
          studies.push({
            name: res.name,
            metainfo: res.metainfo,
            constructor: res.constructor
          });
        } else {
          console.warn(`Failed to transpile script "${script.name}":`, res.errors);
        }
      }

      return Promise.resolve(studies);
    },

    /**
     * Dynamically register and plot a Pine Script indicator onto an active chart widget
     */
    async registerDynamicStudy(widget, scriptCode) {
      if (!widget) {
        throw new Error('TradingView widget instance is required');
      }

      const res = this.transpile(scriptCode);
      if (!res.success) {
        throw new Error(`Compilation failed: ${res.errors.join(', ')}`);
      }

      const studyDescriptor = {
        name: res.name,
        metainfo: res.metainfo,
        constructor: res.constructor
      };

      // In TradingView standalone widget, inject into inner iframe's JSServer studyLibrary
      try {
        let innerWindow = null;
        if (typeof widget._innerWindow === 'function') {
          innerWindow = widget._innerWindow();
        } else if (typeof window !== 'undefined') {
          innerWindow = window;
        }

        if (innerWindow && innerWindow.JSServer && Array.isArray(innerWindow.JSServer.studyLibrary)) {
          const lib = innerWindow.JSServer.studyLibrary;
          const filtered = lib.filter(
            s => s.name !== studyDescriptor.name && (!s.metainfo || s.metainfo.id !== studyDescriptor.metainfo.id)
          );
          lib.length = 0;
          lib.push.apply(lib, filtered);
          lib.push(studyDescriptor);
        }

        // Also inject into studyMetaInfoRepository if available
        if (innerWindow && innerWindow.TradingView && typeof innerWindow.TradingView.studyMetaInfoRepository === 'function') {
          const repo = innerWindow.TradingView.studyMetaInfoRepository();
          if (repo && repo._javaStudiesMetaInfo && Array.isArray(repo._javaStudiesMetaInfo)) {
            const metaList = repo._javaStudiesMetaInfo;
            const filteredMeta = metaList.filter(
              m => m.name !== studyDescriptor.name && m.id !== studyDescriptor.metainfo.id
            );
            metaList.length = 0;
            metaList.push.apply(metaList, filteredMeta);
            metaList.push(studyDescriptor.metainfo);
          }
        }
      } catch (injectionErr) {
        console.warn('Could not inject study directly into innerWindow JSServer:', injectionErr);
      }

      // Plot onto active chart
      const chart = widget.activeChart ? widget.activeChart() : widget;
      if (!chart || typeof chart.createStudy !== 'function') {
        throw new Error('Active chart does not expose createStudy method');
      }

      const isOverlay = res.overlay;
      const studyId = await chart.createStudy(studyDescriptor.name, isOverlay, false);

      return {
        studyId,
        studyDescriptor,
        name: res.name,
        isOverlay
      };
    }
  };


  /* =========================================================================
   * 8. Export Module
   * ========================================================================= */
  return {
    PineEngine,
    PineScriptTemplates,
    PineScriptStorage,
    PineTranspiler,
    PineScriptRuntime,
    PineScriptHighlighter,
    TradingViewCustomEngine
  };
});
