/**
 * TradingView Native Indicator Engine (tv_indicator_engine.js)
 * 
 * High-performance TradingView Advanced Charts native indicator engine conforming to
 * metainfo v52/53 specification and TradingView JSServer.studyLibrary architecture.
 * 
 * Features:
 * - Full TradingView Metainfo v52/53 schema generation & validation.
 * - Genuine native technical calculation functions for SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume.
 * - Context-driven execution engine (TradingView Std library & SeriesVarTracker).
 * - Standalone array/bar calculation API (TVIndicatorEngine.calc).
 * - Dynamic custom indicator registration: TVIndicatorEngine.registerStudy(studyDef).
 * - TradingView widget bridge: TVIndicatorEngine.getCustomIndicators(PineJS) compatible with custom_indicators_getter.
 * - Standalone runner & mock context for Node.js headless testing and verification.
 */

(function(global, factory) {
  'use strict';
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = factory();
  } else if (typeof define === 'function' && define.amd) {
    define([], factory);
  } else {
    const root = typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : global);
    root.TVIndicatorEngine = factory();
  }
})(typeof self !== 'undefined' ? self : this, function() {
  'use strict';

  /* =========================================================================
   * 1. SeriesVarTracker & Historical Memory
   * ========================================================================= */
  class SeriesVarTracker {
    constructor(initialVal = NaN) {
      this.history = [];
      this.current = initialVal;
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

  /* =========================================================================
   * 2. Standalone Array & Series Calculation Engine (TVIndicatorEngine.calc)
   * ========================================================================= */
  const calc = {
    /**
     * Simple Moving Average
     * @param {Array<number>} source
     * @param {number} length
     * @returns {Array<number>}
     */
    sma(source, length) {
      if (!Array.isArray(source) || length <= 0) return [];
      const result = new Array(source.length);
      let sum = 0;
      let validCount = 0;

      for (let i = 0; i < source.length; i++) {
        const val = source[i];
        if (typeof val !== 'number' || isNaN(val)) {
          sum = 0;
          validCount = 0;
          result[i] = NaN;
          continue;
        }

        sum += val;
        validCount++;

        if (validCount > length) {
          sum -= source[i - length];
          validCount = length;
        }

        if (validCount === length) {
          result[i] = sum / length;
        } else {
          result[i] = NaN;
        }
      }
      return result;
    },

    /**
     * Exponential Moving Average
     * @param {Array<number>} source
     * @param {number} length
     * @returns {Array<number>}
     */
    ema(source, length) {
      if (!Array.isArray(source) || length <= 0) return [];
      const result = new Array(source.length);
      const alpha = 2 / (length + 1);
      let prevEMA = NaN;
      let seedSum = 0;
      let seedCount = 0;

      for (let i = 0; i < source.length; i++) {
        const val = source[i];
        if (typeof val !== 'number' || isNaN(val)) {
          result[i] = NaN;
          continue;
        }

        if (isNaN(prevEMA)) {
          seedSum += val;
          seedCount++;
          if (seedCount === length) {
            prevEMA = seedSum / length;
            result[i] = prevEMA;
          } else {
            result[i] = NaN;
          }
        } else {
          prevEMA = alpha * val + (1 - alpha) * prevEMA;
          result[i] = prevEMA;
        }
      }
      return result;
    },

    /**
     * Wilder's Smoothed Moving Average (RMA)
     * @param {Array<number>} source
     * @param {number} length
     * @returns {Array<number>}
     */
    rma(source, length) {
      if (!Array.isArray(source) || length <= 0) return [];
      const result = new Array(source.length);
      let prevRMA = NaN;
      let seedSum = 0;
      let seedCount = 0;

      for (let i = 0; i < source.length; i++) {
        const val = source[i];
        if (typeof val !== 'number' || isNaN(val)) {
          result[i] = NaN;
          continue;
        }

        if (isNaN(prevRMA)) {
          seedSum += val;
          seedCount++;
          if (seedCount === length) {
            prevRMA = seedSum / length;
            result[i] = prevRMA;
          } else {
            result[i] = NaN;
          }
        } else {
          prevRMA = (prevRMA * (length - 1) + val) / length;
          result[i] = prevRMA;
        }
      }
      return result;
    },

    /**
     * Standard Deviation
     * @param {Array<number>} source
     * @param {number} length
     * @returns {Array<number>}
     */
    stdev(source, length) {
      if (!Array.isArray(source) || length <= 0) return [];
      const result = new Array(source.length);
      const smaValues = this.sma(source, length);

      for (let i = 0; i < source.length; i++) {
        const mean = smaValues[i];
        if (isNaN(mean)) {
          result[i] = NaN;
          continue;
        }

        let sumSq = 0;
        let valid = true;
        for (let j = 0; j < length; j++) {
          const v = source[i - j];
          if (typeof v !== 'number' || isNaN(v)) {
            valid = false;
            break;
          }
          sumSq += Math.pow(v - mean, 2);
        }

        result[i] = valid ? Math.sqrt(sumSq / length) : NaN;
      }
      return result;
    },

    /**
     * Relative Strength Index (RSI) using Wilder's RMA
     * @param {Array<number>} source
     * @param {number} length
     * @returns {Array<number>}
     */
    rsi(source, length = 14) {
      if (!Array.isArray(source) || length <= 0) return [];
      const n = source.length;
      const result = new Array(n).fill(NaN);
      if (n <= length) return result;

      const gains = new Array(n).fill(0);
      const losses = new Array(n).fill(0);

      for (let i = 1; i < n; i++) {
        const diff = source[i] - source[i - 1];
        if (!isNaN(diff)) {
          if (diff > 0) gains[i] = diff;
          else if (diff < 0) losses[i] = -diff;
        }
      }

      const avgGains = this.rma(gains, length);
      const avgLosses = this.rma(losses, length);

      for (let i = 0; i < n; i++) {
        const ag = avgGains[i];
        const al = avgLosses[i];
        if (isNaN(ag) || isNaN(al)) {
          result[i] = NaN;
        } else if (al === 0) {
          result[i] = 100;
        } else if (ag === 0) {
          result[i] = 0;
        } else {
          const rs = ag / al;
          result[i] = 100 - (100 / (1 + rs));
        }
      }
      return result;
    },

    /**
     * Moving Average Convergence/Divergence (MACD)
     * @param {Array<number>} source
     * @param {number} fastLength
     * @param {number} slowLength
     * @param {number} signalLength
     * @returns {{ macd: Array<number>, signal: Array<number>, hist: Array<number> }}
     */
    macd(source, fastLength = 12, slowLength = 26, signalLength = 9) {
      if (!Array.isArray(source)) return { macd: [], signal: [], hist: [] };
      const fastEMA = this.ema(source, fastLength);
      const slowEMA = this.ema(source, slowLength);
      const n = source.length;

      const macdLine = new Array(n);
      for (let i = 0; i < n; i++) {
        const f = fastEMA[i];
        const s = slowEMA[i];
        macdLine[i] = (isNaN(f) || isNaN(s)) ? NaN : f - s;
      }

      // Filter leading NaNs for signal line calculation
      const signalLine = this.ema(macdLine, signalLength);
      const hist = new Array(n);
      for (let i = 0; i < n; i++) {
        const m = macdLine[i];
        const sig = signalLine[i];
        hist[i] = (isNaN(m) || isNaN(sig)) ? NaN : m - sig;
      }

      return { macd: macdLine, signal: signalLine, hist };
    },

    /**
     * Bollinger Bands
     * @param {Array<number>} source
     * @param {number} length
     * @param {number} mult
     * @returns {{ basis: Array<number>, upper: Array<number>, lower: Array<number> }}
     */
    bollingerBands(source, length = 20, mult = 2.0) {
      if (!Array.isArray(source)) return { basis: [], upper: [], lower: [] };
      const basis = this.sma(source, length);
      const dev = this.stdev(source, length);
      const n = source.length;

      const upper = new Array(n);
      const lower = new Array(n);

      for (let i = 0; i < n; i++) {
        const b = basis[i];
        const d = dev[i];
        if (isNaN(b) || isNaN(d)) {
          upper[i] = NaN;
          lower[i] = NaN;
        } else {
          upper[i] = b + mult * d;
          lower[i] = b - mult * d;
        }
      }
      return { basis, upper, lower };
    },

    /**
     * True Range for OHLC bar sequence
     * @param {Array<{ high: number, low: number, close: number }>} bars
     * @returns {Array<number>}
     */
    tr(bars) {
      if (!Array.isArray(bars) || bars.length === 0) return [];
      const n = bars.length;
      const trValues = new Array(n);

      for (let i = 0; i < n; i++) {
        const b = bars[i];
        const high = b.high;
        const low = b.low;
        if (i === 0) {
          trValues[i] = high - low;
        } else {
          const prevClose = bars[i - 1].close;
          trValues[i] = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
        }
      }
      return trValues;
    },

    /**
     * Average True Range (ATR)
     * @param {Array<{ high: number, low: number, close: number }>} bars
     * @param {number} length
     * @returns {Array<number>}
     */
    atr(bars, length = 14) {
      if (!Array.isArray(bars) || bars.length === 0) return [];
      const trValues = this.tr(bars);
      return this.rma(trValues, length);
    },

    /**
     * SuperTrend ATR trailing stop
     * @param {Array<{ high: number, low: number, close: number }>} bars
     * @param {number} factor
     * @param {number} atrPeriod
     * @returns {{ superTrend: Array<number>, direction: Array<number> }}
     */
    supertrend(bars, factor = 3.0, atrPeriod = 10) {
      if (!Array.isArray(bars) || bars.length === 0) return { superTrend: [], direction: [] };
      const n = bars.length;
      const atrValues = this.atr(bars, atrPeriod);

      const superTrend = new Array(n).fill(NaN);
      const direction = new Array(n).fill(1); // -1 = up/bullish, 1 = down/bearish

      let prevFinalUpper = NaN;
      let prevFinalLower = NaN;
      let prevST = NaN;
      let prevDir = 1;

      for (let i = 0; i < n; i++) {
        const b = bars[i];
        const hl2 = (b.high + b.low) / 2;
        const atrVal = atrValues[i];

        if (isNaN(atrVal)) {
          superTrend[i] = NaN;
          direction[i] = 1;
          continue;
        }

        const basicUpper = hl2 + factor * atrVal;
        const basicLower = hl2 - factor * atrVal;
        const prevClose = i > 0 ? bars[i - 1].close : NaN;

        let finalUpper = basicUpper;
        if (!isNaN(prevFinalUpper) && !isNaN(prevClose)) {
          finalUpper = (basicUpper < prevFinalUpper || prevClose > prevFinalUpper) ? basicUpper : prevFinalUpper;
        }

        let finalLower = basicLower;
        if (!isNaN(prevFinalLower) && !isNaN(prevClose)) {
          finalLower = (basicLower > prevFinalLower || prevClose < prevFinalLower) ? basicLower : prevFinalLower;
        }

        let dir = 1;
        let st = finalUpper;

        if (isNaN(prevST)) {
          dir = b.close > finalUpper ? -1 : 1;
          st = dir === -1 ? finalLower : finalUpper;
        } else if (prevDir === -1) {
          if (b.close < finalLower) {
            dir = 1;
            st = finalUpper;
          } else {
            dir = -1;
            st = finalLower;
          }
        } else {
          if (b.close > finalUpper) {
            dir = -1;
            st = finalLower;
          } else {
            dir = 1;
            st = finalUpper;
          }
        }

        superTrend[i] = st;
        direction[i] = dir;

        prevFinalUpper = finalUpper;
        prevFinalLower = finalLower;
        prevST = st;
        prevDir = dir;
      }

      return { superTrend, direction };
    },

    /**
     * Volume with optional moving average and bar direction
     * @param {Array<{ open: number, close: number, volume: number }>} bars
     * @param {number} maLength
     * @returns {{ volume: Array<number>, volumeMA: Array<number>, isUp: Array<boolean> }}
     */
    volume(bars, maLength = 20) {
      if (!Array.isArray(bars)) return { volume: [], volumeMA: [], isUp: [] };
      const n = bars.length;
      const volumes = bars.map(b => (b && typeof b.volume === 'number') ? b.volume : 0);
      const isUp = bars.map((b, i) => {
        if (!b) return true;
        if (typeof b.open === 'number' && typeof b.close === 'number') {
          return b.close >= b.open;
        }
        if (i > 0 && typeof b.close === 'number' && typeof bars[i - 1].close === 'number') {
          return b.close >= bars[i - 1].close;
        }
        return true;
      });

      const volumeMA = this.sma(volumes, maLength);
      return { volume: volumes, volumeMA, isUp };
    }
  };

  /* =========================================================================
   * 3. TradingView Execution Context Standard Library (TVIndicatorEngine.Std)
   * ========================================================================= */
  const Std = {
    // 0. Source Resolution Helper
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
    volume(ctx) { return ctx && ctx.symbol ? (ctx.symbol.volume || 0) : 0; },
    time(ctx) { return ctx && ctx.symbol ? (ctx.symbol.time || 0) : 0; },
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

    // 2. Math & Utility Helpers
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

    // 3. Technical Indicators on Context
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
      let s = 0;
      for (let i = 0; i < len; i++) {
        const v = sVar.get(i);
        if (isNaN(v)) return NaN;
        s += v;
      }
      return s / len;
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

      let dir = 1;
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
    }
  };

  /* =========================================================================
   * 4. Metainfo Schema Generator (Conforming to TradingView v52/53)
   * ========================================================================= */
  function createMetainfo(options = {}) {
    const version = options.version === 53 ? 53 : 52;
    const name = options.name || 'Custom Indicator';
    const description = options.description || name;
    const shortDescription = options.shortDescription || name;
    const isPriceStudy = Boolean(options.is_price_study);
    const sanitizedId = (options.id || `${name.replace(/[^a-zA-Z0-9_-]/g, '_')}@tv-customstudies-1`);

    const plots = Array.isArray(options.plots) ? options.plots : [];
    const inputs = Array.isArray(options.inputs) ? options.inputs : [];
    const styles = options.styles || {};
    const defaultStyles = (options.defaults && options.defaults.styles) || {};
    const defaultInputs = (options.defaults && options.defaults.inputs) || {};

    // Ensure all plots have corresponding styles and default styles
    plots.forEach(plot => {
      if (!styles[plot.id]) {
        styles[plot.id] = {
          title: plot.title || plot.id,
          histogramBase: 0,
          joinPoints: false
        };
      }
      if (!defaultStyles[plot.id]) {
        defaultStyles[plot.id] = {
          linestyle: 0,
          linewidth: plot.linewidth || 1,
          plottype: plot.type === 'shapes' ? 'shape_triangle_up' : (plot.plottype !== undefined ? plot.plottype : 0),
          trackPrice: false,
          transparency: 0,
          visible: true,
          color: plot.color || '#2196F3'
        };
      }
    });

    // Populate default input dictionary
    inputs.forEach((inp, idx) => {
      const slot = inp.slotIndex !== undefined ? inp.slotIndex : idx;
      if (defaultInputs[inp.id] === undefined) defaultInputs[inp.id] = inp.defval;
      if (defaultInputs[slot] === undefined) defaultInputs[slot] = inp.defval;
    });

    const metainfo = {
      _metainfoVersion: version,
      isTVScript: false,
      isTVScriptStub: false,
      is_hidden_study: Boolean(options.is_hidden_study),
      is_price_study: isPriceStudy,
      id: sanitizedId,
      scriptIdPart: '',
      name: name,
      description: description,
      shortDescription: shortDescription,
      plots: plots,
      defaults: {
        styles: defaultStyles,
        inputs: defaultInputs
      },
      styles: styles,
      inputs: inputs,
      format: options.format || { type: isPriceStudy ? 'inherit' : 'price', precision: options.precision || 2 }
    };

    if (options.bands) metainfo.bands = options.bands;
    if (options.defaults && options.defaults.bands) metainfo.defaults.bands = options.defaults.bands;
    if (options.filledAreas) metainfo.filledAreas = options.filledAreas;
    if (options.defaults && options.defaults.filledAreasStyle) {
      metainfo.defaults.filledAreasStyle = options.defaults.filledAreasStyle;
    }
    if (options.palettes) metainfo.palettes = options.palettes;
    if (options.defaults && options.defaults.palettes) {
      metainfo.defaults.palettes = options.defaults.palettes;
    }

    return metainfo;
  }

  /* =========================================================================
   * 5. Built-in Study Library (SMA, EMA, RSI, MACD, BB, ATR, SuperTrend, Volume)
   * ========================================================================= */
  const BuiltinStudies = {
    // 1. SMA (Simple Moving Average)
    sma: {
      name: "Moving Average",
      metainfo: createMetainfo({
        version: 52,
        name: "Moving Average",
        description: "Moving Average",
        shortDescription: "MA",
        is_price_study: true,
        id: "Moving Average@tv-basicstudies-1",
        plots: [{ id: "plot_0", type: "line" }],
        styles: {
          plot_0: { title: "Plot", histogramBase: 0, joinPoints: false }
        },
        inputs: [
          { id: "length", name: "Length", defval: 9, type: "integer", min: 1, max: 10000 },
          { id: "source", name: "Source", defval: "close", type: "source", options: ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"] },
          { id: "offset", name: "Offset", defval: 0, type: "integer", min: -10000, max: 10000 }
        ],
        defaults: {
          styles: {
            plot_0: { linestyle: 0, linewidth: 1, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#2196F3" }
          },
          inputs: { length: 9, source: "close", offset: 0 }
        }
      }),
      constructor: function() {
        this.main = function(ctx, inputCallback) {
          const length = inputCallback(0);
          const source = inputCallback(1);
          return [Std.sma(source, length, ctx)];
        };
      }
    },

    // 2. EMA (Exponential Moving Average)
    ema: {
      name: "Moving Average Exponential",
      metainfo: createMetainfo({
        version: 52,
        name: "Moving Average Exponential",
        description: "Moving Average Exponential",
        shortDescription: "EMA",
        is_price_study: true,
        id: "Moving Average Exponential@tv-basicstudies-1",
        plots: [{ id: "plot_0", type: "line" }],
        styles: {
          plot_0: { title: "Plot", histogramBase: 0, joinPoints: false }
        },
        inputs: [
          { id: "length", name: "Length", defval: 9, type: "integer", min: 1, max: 10000 },
          { id: "source", name: "Source", defval: "close", type: "source", options: ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"] },
          { id: "offset", name: "Offset", defval: 0, type: "integer", min: -10000, max: 10000 }
        ],
        defaults: {
          styles: {
            plot_0: { linestyle: 0, linewidth: 1, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#2196F3" }
          },
          inputs: { length: 9, source: "close", offset: 0 }
        }
      }),
      constructor: function() {
        this.main = function(ctx, inputCallback) {
          const length = inputCallback(0);
          const source = inputCallback(1);
          return [Std.ema(source, length, ctx)];
        };
      }
    },

    // 3. RSI (Relative Strength Index)
    rsi: {
      name: "Relative Strength Index",
      metainfo: createMetainfo({
        version: 52,
        name: "Relative Strength Index",
        description: "Relative Strength Index",
        shortDescription: "RSI",
        is_price_study: false,
        id: "Relative Strength Index@tv-basicstudies-1",
        plots: [{ id: "plot_0", type: "line" }],
        styles: {
          plot_0: { title: "Plot", histogramBase: 0, joinPoints: false, zorder: 1 }
        },
        bands: [
          { id: "hline_0", name: "UpperLimit", zorder: -1.1 },
          { id: "hline_2", name: "MiddleLimit", zorder: -1.11 },
          { id: "hline_1", name: "LowerLimit", zorder: -1.111 }
        ],
        filledAreas: [
          { id: "fill_0", objAId: "hline_0", objBId: "hline_1", type: "hline_hline", title: "Hlines Background", zorder: -2 }
        ],
        inputs: [
          { id: "length", name: "Length", defval: 14, type: "integer", min: 1, max: 2000 },
          { id: "source", name: "Source", defval: "close", type: "source", options: ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"] }
        ],
        defaults: {
          styles: {
            plot_0: { linestyle: 0, linewidth: 1, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#7E57C2" }
          },
          bands: [
            { color: "#787B86", linestyle: 2, linewidth: 1, visible: true, value: 70, zorder: -1.1 },
            { color: "#787B86", linestyle: 2, linewidth: 1, visible: true, value: 50, zorder: -1.11 },
            { color: "#787B86", linestyle: 2, linewidth: 1, visible: true, value: 30, zorder: -1.111 }
          ],
          filledAreasStyle: {
            fill_0: { color: "#7E57C2", transparency: 90, visible: true }
          },
          inputs: { length: 14, source: "close" }
        }
      }),
      constructor: function() {
        this.main = function(ctx, inputCallback) {
          const length = inputCallback(0);
          const source = inputCallback(1);
          return [Std.rsi(source, length, ctx)];
        };
      }
    },

    // 4. MACD (Moving Average Convergence/Divergence)
    macd: {
      name: "Moving Average Convergence/Divergence",
      metainfo: createMetainfo({
        version: 52,
        name: "Moving Average Convergence/Divergence",
        description: "Moving Average Convergence/Divergence",
        shortDescription: "MACD",
        is_price_study: false,
        id: "Moving Average Convergence/Divergence@tv-basicstudies-1",
        plots: [
          { id: "plot_0", type: "line" }, // Histogram
          { id: "plot_1", type: "line" }, // MACD line
          { id: "plot_2", type: "line" }, // Signal line
          { id: "plot_3", palette: "palette_0", target: "plot_0", type: "colorer" }
        ],
        styles: {
          plot_0: { title: "Histogram", histogramBase: 0, joinPoints: false },
          plot_1: { title: "MACD", histogramBase: 0, joinPoints: false },
          plot_2: { title: "Signal", histogramBase: 0, joinPoints: false }
        },
        palettes: {
          palette_0: {
            colors: {
              0: { name: "Growing Up" },
              1: { name: "Falling Up" },
              2: { name: "Growing Down" },
              3: { name: "Falling Down" }
            }
          }
        },
        inputs: [
          { id: "fastLength", name: "Fast Length", defval: 12, type: "integer", min: 1, max: 2000 },
          { id: "slowLength", name: "Slow Length", defval: 26, type: "integer", min: 1, max: 2000 },
          { id: "signalLength", name: "Signal Length", defval: 9, type: "integer", min: 1, max: 2000 },
          { id: "source", name: "Source", defval: "close", type: "source", options: ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"] }
        ],
        defaults: {
          styles: {
            plot_0: { linestyle: 0, linewidth: 1, plottype: 5, trackPrice: false, transparency: 0, visible: true, color: "#26A69A" },
            plot_1: { linestyle: 0, linewidth: 1, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#2196F3" },
            plot_2: { linestyle: 0, linewidth: 1, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#FF6D00" }
          },
          palettes: {
            palette_0: {
              colors: {
                0: { color: "#26A69A", width: 1, style: 0 },
                1: { color: "#B2DFDB", width: 1, style: 0 },
                2: { color: "#FFCDD2", width: 1, style: 0 },
                3: { color: "#FF5252", width: 1, style: 0 }
              }
            }
          },
          inputs: { fastLength: 12, slowLength: 26, signalLength: 9, source: "close" }
        }
      }),
      constructor: function() {
        this.main = function(ctx, inputCallback) {
          const fastLen = inputCallback(0);
          const slowLen = inputCallback(1);
          const sigLen = inputCallback(2);
          const source = inputCallback(3);
          const [macdLine, signalLine, hist] = Std.macd(source, fastLen, slowLen, sigLen, ctx);

          const histVar = ctx.new_var(hist);
          const prevHist = histVar.get(1);

          let colorIdx = 0;
          if (hist >= 0) {
            colorIdx = (isNaN(prevHist) || hist >= prevHist) ? 0 : 1;
          } else {
            colorIdx = (isNaN(prevHist) || hist <= prevHist) ? 3 : 2;
          }

          return [hist, macdLine, signalLine, colorIdx];
        };
      }
    },

    // 4b. MACD Short Form Alias
    macd_short: {
      name: "MACD",
      metainfo: createMetainfo({
        version: 52,
        name: "MACD",
        description: "MACD",
        shortDescription: "MACD",
        is_price_study: false,
        id: "MACD@tv-basicstudies-1",
        plots: [
          { id: "plot_0", type: "line" },
          { id: "plot_1", type: "line" },
          { id: "plot_2", type: "line" },
          { id: "plot_3", palette: "palette_0", target: "plot_0", type: "colorer" }
        ],
        styles: {
          plot_0: { title: "Histogram", histogramBase: 0, joinPoints: false },
          plot_1: { title: "MACD", histogramBase: 0, joinPoints: false },
          plot_2: { title: "Signal", histogramBase: 0, joinPoints: false }
        },
        palettes: {
          palette_0: {
            colors: {
              0: { name: "Growing Up" },
              1: { name: "Falling Up" },
              2: { name: "Growing Down" },
              3: { name: "Falling Down" }
            }
          }
        },
        inputs: [
          { id: "fastLength", name: "Fast Length", defval: 12, type: "integer", min: 1, max: 2000 },
          { id: "slowLength", name: "Slow Length", defval: 26, type: "integer", min: 1, max: 2000 },
          { id: "signalLength", name: "Signal Length", defval: 9, type: "integer", min: 1, max: 2000 },
          { id: "source", name: "Source", defval: "close", type: "source", options: ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"] }
        ],
        defaults: {
          styles: {
            plot_0: { linestyle: 0, linewidth: 1, plottype: 5, trackPrice: false, transparency: 0, visible: true, color: "#26A69A" },
            plot_1: { linestyle: 0, linewidth: 1, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#2196F3" },
            plot_2: { linestyle: 0, linewidth: 1, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#FF6D00" }
          },
          palettes: {
            palette_0: {
              colors: {
                0: { color: "#26A69A", width: 1, style: 0 },
                1: { color: "#B2DFDB", width: 1, style: 0 },
                2: { color: "#FFCDD2", width: 1, style: 0 },
                3: { color: "#FF5252", width: 1, style: 0 }
              }
            }
          },
          inputs: { fastLength: 12, slowLength: 26, signalLength: 9, source: "close" }
        }
      }),
      constructor: function() {
        this.main = function(ctx, inputCallback) {
          const fastLen = inputCallback(0);
          const slowLen = inputCallback(1);
          const sigLen = inputCallback(2);
          const source = inputCallback(3);
          const [macdLine, signalLine, hist] = Std.macd(source, fastLen, slowLen, sigLen, ctx);

          const histVar = ctx.new_var(hist);
          const prevHist = histVar.get(1);

          let colorIdx = 0;
          if (hist >= 0) {
            colorIdx = (isNaN(prevHist) || hist >= prevHist) ? 0 : 1;
          } else {
            colorIdx = (isNaN(prevHist) || hist <= prevHist) ? 3 : 2;
          }

          return [hist, macdLine, signalLine, colorIdx];
        };
      }
    },

    // 5. Bollinger Bands (Native, Metainfo v53)
    bollingerBands: {
      name: "Bollinger Bands (Native)",
      metainfo: createMetainfo({
        version: 53,
        name: "Bollinger Bands (Native)",
        description: "Bollinger Bands (Native)",
        shortDescription: "BB (Native)",
        is_price_study: true,
        id: "Bollinger Bands (Native)@tv-basicstudies-1",
        plots: [
          { id: "plot_0", type: "line" }, // Median
          { id: "plot_1", type: "line" }, // Upper
          { id: "plot_2", type: "line" }  // Lower
        ],
        styles: {
          plot_0: { title: "Median", histogramBase: 0, joinPoints: false },
          plot_1: { title: "Upper", histogramBase: 0, joinPoints: false },
          plot_2: { title: "Lower", histogramBase: 0, joinPoints: false }
        },
        filledAreas: [
          { id: "fill_0", objAId: "plot_1", objBId: "plot_2", type: "plot_plot", title: "Plots Background" }
        ],
        inputs: [
          { id: "length", name: "length", defval: 20, type: "integer", min: 1, max: 10000 },
          { id: "mult", name: "mult", defval: 2, type: "float", min: 0.001, max: 50 },
          { id: "source", name: "Source", defval: "close", type: "source", options: ["open", "high", "low", "close", "hl2", "hlc3", "ohlc4"] },
          { id: "offset", name: "Offset", defval: 0, type: "integer", min: -10000, max: 10000 }
        ],
        defaults: {
          styles: {
            plot_0: { linestyle: 0, linewidth: 1, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#FF6D00" },
            plot_1: { linestyle: 0, linewidth: 1, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#2196F3" },
            plot_2: { linestyle: 0, linewidth: 1, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#2196F3" }
          },
          filledAreasStyle: {
            fill_0: { color: "#2196F3", transparency: 95, visible: true }
          },
          inputs: { length: 20, mult: 2, source: "close", offset: 0 }
        }
      }),
      constructor: function() {
        this.main = function(ctx, inputCallback) {
          const length = inputCallback(0);
          const mult = inputCallback(1);
          const source = inputCallback(2);
          const [basis, upper, lower] = Std.bb(source, length, mult, ctx);
          return [basis, upper, lower];
        };
      }
    },

    // 6. ATR (Average True Range)
    atr: {
      name: "Average True Range",
      metainfo: createMetainfo({
        version: 52,
        name: "Average True Range",
        description: "Average True Range",
        shortDescription: "ATR",
        is_price_study: false,
        id: "Average True Range@tv-basicstudies-1",
        plots: [{ id: "plot_0", type: "line" }],
        styles: {
          plot_0: { title: "Plot", histogramBase: 0, joinPoints: false }
        },
        inputs: [
          { id: "length", name: "length", defval: 14, type: "integer", min: 1, max: 2000 }
        ],
        defaults: {
          styles: {
            plot_0: { linestyle: 0, linewidth: 1, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#B71C1C" }
          },
          inputs: { length: 14 }
        }
      }),
      constructor: function() {
        this.main = function(ctx, inputCallback) {
          const length = inputCallback(0);
          return [Std.atr(length, ctx)];
        };
      }
    },

    // 7. SuperTrend
    supertrend: {
      name: "SuperTrend",
      metainfo: createMetainfo({
        version: 52,
        name: "SuperTrend",
        description: "SuperTrend",
        shortDescription: "SuperTrend",
        is_price_study: true,
        id: "SuperTrend@tv-basicstudies-1",
        plots: [
          { id: "plot_0", type: "line" },
          { id: "plot_1", palette: "palette_0", target: "plot_0", type: "colorer" },
          { id: "plot_2", type: "shapes" },
          { id: "plot_3", type: "shapes" }
        ],
        styles: {
          plot_0: { title: "SuperTrend", histogramBase: 0, joinPoints: false, isHidden: false },
          plot_2: { title: "Up Arrow", histogramBase: 0, joinPoints: false, isHidden: false },
          plot_3: { title: "Down Arrow", histogramBase: 0, joinPoints: false, isHidden: false }
        },
        palettes: {
          palette_0: {
            colors: {
              0: { name: "Up Trend" },
              1: { name: "Down Trend" }
            }
          }
        },
        inputs: [
          { id: "atrPeriod", name: "ATR Period", defval: 10, type: "integer", min: 1, max: 2000 },
          { id: "factor", name: "Factor", defval: 3.0, type: "float", min: 0.01, max: 50, step: 0.1 }
        ],
        defaults: {
          styles: {
            plot_0: { linestyle: 0, linewidth: 2, plottype: 0, trackPrice: false, transparency: 0, visible: true, color: "#000080" },
            plot_2: { linestyle: 0, linewidth: 2, plottype: "shape_arrow_up", trackPrice: false, location: "BelowBar", transparency: 0, visible: true, color: "#00E676" },
            plot_3: { linestyle: 0, linewidth: 2, plottype: "shape_arrow_down", trackPrice: false, location: "AboveBar", transparency: 0, visible: true, color: "#FF5252" }
          },
          palettes: {
            palette_0: {
              colors: {
                0: { color: "#00E676", width: 2, style: 0 },
                1: { color: "#FF5252", width: 2, style: 0 }
              }
            }
          },
          inputs: { atrPeriod: 10, factor: 3.0 }
        }
      }),
      constructor: function() {
        this.main = function(ctx, inputCallback) {
          const atrPeriod = inputCallback(0);
          const factor = inputCallback(1);
          const [st, dir] = Std.supertrend(factor, atrPeriod, ctx);

          const dirVar = ctx.new_var(dir);
          const prevDir = dirVar.get(1);

          const upSignal = (!isNaN(prevDir) && prevDir === 1 && dir === -1) ? 1 : NaN;
          const downSignal = (!isNaN(prevDir) && prevDir === -1 && dir === 1) ? 1 : NaN;
          const colorIdx = dir === -1 ? 0 : 1;

          return [st, colorIdx, upSignal, downSignal];
        };
      }
    },

    // 8. Volume
    volume: {
      name: "Volume",
      metainfo: createMetainfo({
        version: 52,
        name: "Volume",
        description: "Volume",
        shortDescription: "Volume",
        is_price_study: false,
        id: "Volume@tv-basicstudies-1",
        format: { type: "volume" },
        plots: [
          { id: "vol", type: "line" },
          { id: "volumePalette", palette: "volumePalette", target: "vol", type: "colorer" },
          { id: "vol_ma", type: "line" }
        ],
        styles: {
          vol: { title: "Volume", histogramBase: 0 },
          vol_ma: { title: "Volume MA", histogramBase: 0 }
        },
        palettes: {
          volumePalette: {
            colors: {
              0: { name: "Falling" },
              1: { name: "Growing" }
            }
          }
        },
        inputs: [
          { id: "showMA", name: "Show MA", defval: false, type: "bool" },
          { id: "length", name: "MA Length", defval: 20, type: "integer", min: 1, max: 2000 }
        ],
        defaults: {
          styles: {
            vol: { linestyle: 0, linewidth: 1, plottype: 5, trackPrice: false, transparency: 30, visible: true, color: "#26A69A" },
            vol_ma: { linestyle: 0, linewidth: 1, plottype: 0, trackPrice: false, transparency: 0, visible: false, color: "#2196F3" }
          },
          palettes: {
            volumePalette: {
              colors: {
                0: { color: "#FF5252", width: 1, style: 0 },
                1: { color: "#26A69A", width: 1, style: 0 }
              }
            }
          },
          inputs: { showMA: false, length: 20 }
        }
      }),
      constructor: function() {
        this.main = function(ctx, inputCallback) {
          const showMA = inputCallback(0);
          const maLen = inputCallback(1);
          const vol = Std.volume(ctx);
          const close = Std.close(ctx);
          const open = Std.open(ctx);

          const isUp = !isNaN(close) && !isNaN(open) ? close >= open : true;
          const colorIdx = isUp ? 1 : 0;

          const volMA = showMA ? Std.sma("volume", maLen, ctx) : NaN;
          return [vol, colorIdx, volMA];
        };
      }
    }
  };

  /* =========================================================================
   * 6. Standalone Execution Runtime & Mock Context
   * ========================================================================= */
  class TradingViewStudyMockContext {
    constructor(bars) {
      this.bars = bars || [];
      this.barIndex = 0;
      this._vars = [];
      this._varsIndex = 0;
      this.Std = Std;
      this.symbol = {
        open: 0, high: 0, low: 0, close: 0, volume: 0, time: 0, index: 0,
        isdwm: () => false,
        bartime: () => this.bars[this.barIndex] ? this.bars[this.barIndex].time : 0
      };
    }

    new_var(initialVal) {
      if (this._vars.length <= this._varsIndex) {
        this._vars.push(new SeriesVarTracker(initialVal));
      }
      const v = this._vars[this._varsIndex++];
      if (arguments.length > 0 && initialVal !== undefined) {
        v.set(initialVal);
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

  /* =========================================================================
   * 7. TVIndicatorEngine Core Singleton & Registry
   * ========================================================================= */
  const _studyRegistry = new Map();

  // Populate built-in studies
  Object.keys(BuiltinStudies).forEach(key => {
    const study = BuiltinStudies[key];
    _studyRegistry.set(study.name, study);
    _studyRegistry.set(study.metainfo.id, study);
    if (study.metainfo && study.metainfo.description) {
      _studyRegistry.set(study.metainfo.description, study);
    }
    _studyRegistry.set(key.toLowerCase(), study);
  });

  const TVIndicatorEngine = {
    version: '1.0.0',
    metainfoVersions: [52, 53],
    calc,
    Std,
    BuiltinStudies,
    createMetainfo,
    TradingViewStudyMockContext,

    /**
     * Initialize engine with TradingView's PineJS runtime
     * @param {Object} PineJS
     */
    init(PineJS) {
      if (PineJS && PineJS.Std) {
        Object.assign(this.Std, PineJS.Std);
      }
    },

    /**
     * Register a custom indicator definition
     * @param {Object} studyDef - Object with { name, metainfo, constructor }
     * @returns {Object} The registered study descriptor
     */
    registerStudy(studyDef) {
      if (!studyDef || typeof studyDef !== 'object') {
        throw new Error('Study definition must be an object');
      }
      if (!studyDef.name || typeof studyDef.name !== 'string') {
        throw new Error('Study definition must include a valid name string');
      }
      if (!studyDef.constructor || typeof studyDef.constructor !== 'function') {
        throw new Error('Study definition must include a valid constructor function');
      }

      let metainfo = studyDef.metainfo;
      if (!metainfo || typeof metainfo !== 'object') {
        // Automatically generate conforming metainfo v52 if omitted
        metainfo = createMetainfo({
          name: studyDef.name,
          description: studyDef.description || studyDef.name,
          is_price_study: Boolean(studyDef.overlay || studyDef.is_price_study),
          plots: studyDef.plots || [{ id: "plot_0", type: "line" }]
        });
      } else {
        // Enforce version 52 or 53
        if (!metainfo._metainfoVersion || (metainfo._metainfoVersion !== 52 && metainfo._metainfoVersion !== 53)) {
          metainfo._metainfoVersion = 52;
        }
        if (!metainfo.id) {
          metainfo.id = `${studyDef.name.replace(/[^a-zA-Z0-9_-]/g, '_')}@tv-customstudies-1`;
        }
        if (!metainfo.plots) metainfo.plots = [];
        if (!metainfo.inputs) metainfo.inputs = [];
        if (!metainfo.defaults) metainfo.defaults = { styles: {}, inputs: {} };
      }

      const descriptor = {
        name: studyDef.name,
        metainfo: metainfo,
        constructor: studyDef.constructor
      };

      _studyRegistry.set(studyDef.name, descriptor);
      _studyRegistry.set(metainfo.id, descriptor);

      return descriptor;
    },

    /**
     * Unregister a custom indicator by name or ID
     * @param {string} nameOrId
     * @returns {boolean}
     */
    unregisterStudy(nameOrId) {
      if (!nameOrId) return false;
      const study = _studyRegistry.get(nameOrId);
      if (!study) return false;

      _studyRegistry.delete(study.name);
      _studyRegistry.delete(study.metainfo.id);
      return true;
    },

    /**
     * Retrieve a study descriptor by name or ID
     * @param {string} nameOrId
     * @returns {Object|null}
     */
    getStudy(nameOrId) {
      if (!nameOrId) return null;
      if (_studyRegistry.has(nameOrId)) return _studyRegistry.get(nameOrId);
      const lower = nameOrId.toLowerCase();
      if (_studyRegistry.has(lower)) return _studyRegistry.get(lower);
      for (const [k, v] of _studyRegistry.entries()) {
        if (typeof k === 'string' && k.toLowerCase() === lower) return v;
      }
      return null;
    },

    /**
     * List all registered studies with metadata
     * @returns {Array<Object>}
     */
    listStudies() {
      const uniqueStudies = new Set(_studyRegistry.values());
      return Array.from(uniqueStudies).map(s => ({
        name: s.name,
        id: s.metainfo.id,
        description: s.metainfo.description,
        is_price_study: s.metainfo.is_price_study,
        version: s.metainfo._metainfoVersion,
        plotsCount: s.metainfo.plots.length,
        inputsCount: s.metainfo.inputs.length
      }));
    },

    /**
     * Get all unique study descriptors for TradingView studyLibrary
     * @returns {Array<Object>}
     */
    getAllStudies() {
      const unique = new Map();
      _studyRegistry.forEach(study => {
        if (!unique.has(study.name)) {
          unique.set(study.name, study);
        }
      });
      return Array.from(unique.values());
    },

    /**
     * TradingView custom_indicators_getter hook
     * Returns a Promise resolving to an array of Study Descriptors conforming to TV metainfo v52/53
     * 
     * Usage in TradingView widget options:
     * custom_indicators_getter: function(PineJS) {
     *   return TVIndicatorEngine.getCustomIndicators(PineJS);
     * }
     * 
     * @param {Object} PineJS
     * @returns {Promise<Array<Object>>}
     */
    getCustomIndicators(PineJS) {
      this.init(PineJS);
      const studies = this.getAllStudies();
      return Promise.resolve(studies);
    },

    /**
     * Plot a study onto a TradingView chart widget dynamically
     * @param {Object} widget - TradingView widget instance
     * @param {string} studyNameOrId - Name, ID, or description of the study to plot
     * @param {boolean} [isOverlay] - Whether to plot on the main price chart or in a separate pane
     * @param {Array} [inputs] - Optional study inputs
     * @returns {Promise<string>} Resolves to the created study entity ID
     */
    async plotStudy(widget, studyNameOrId, isOverlay, inputs) {
      if (!widget) {
        throw new Error('TradingView widget instance is required');
      }
      if (!studyNameOrId || typeof studyNameOrId !== 'string') {
        throw new Error('Study name or ID is required');
      }

      // 1. Locate study descriptor
      let descriptor = this.getStudy(studyNameOrId);
      if (!descriptor) {
        const lower = studyNameOrId.toLowerCase();
        const all = this.getAllStudies();
        descriptor = all.find(s => 
          (s.name && s.name.toLowerCase() === lower) ||
          (s.metainfo && s.metainfo.description && s.metainfo.description.toLowerCase() === lower) ||
          (s.metainfo && s.metainfo.shortDescription && s.metainfo.shortDescription.toLowerCase() === lower) ||
          (s.metainfo && s.metainfo.id && s.metainfo.id.toLowerCase() === lower)
        );
      }

      // Determine overlay flag
      let overlay = isOverlay;
      if (overlay === undefined || overlay === null) {
        overlay = descriptor && descriptor.metainfo ? Boolean(descriptor.metainfo.is_price_study) : false;
      }

      // Ensure study descriptor is present in widget's JSServer.studyLibrary if available
      try {
        const innerWin = (typeof widget._innerWindow === 'function' ? widget._innerWindow() : null) || window;
        if (innerWin && innerWin.JSServer && Array.isArray(innerWin.JSServer.studyLibrary) && descriptor) {
          const exists = innerWin.JSServer.studyLibrary.some(s => s && (s.name === descriptor.name || (s.metainfo && s.metainfo.id === descriptor.metainfo.id)));
          if (!exists) {
            innerWin.JSServer.studyLibrary.push(descriptor);
          }
        }
      } catch (e) {
        // Continue if innerWindow is inaccessible
      }

      // 2. Get the active chart object
      const chart = typeof widget.activeChart === 'function' ? widget.activeChart() : (typeof widget.chart === 'function' ? widget.chart() : null);
      if (!chart) {
        throw new Error('TradingView chart is not ready or activeChart method unavailable');
      }

      // Determine the study name TradingView's createStudy expects (it searches description or name)
      const targetName = (descriptor && descriptor.metainfo && descriptor.metainfo.description)
        ? descriptor.metainfo.description
        : (descriptor ? descriptor.name : studyNameOrId);

      try {
        return await chart.createStudy(targetName, overlay, false, inputs || []);
      } catch (firstErr) {
        // If failed with description, try descriptor.name as fallback
        if (descriptor && descriptor.name && descriptor.name !== targetName) {
          try {
            return await chart.createStudy(descriptor.name, overlay, false, inputs || []);
          } catch (secondErr) {
            throw firstErr;
          }
        }
        throw firstErr;
      }
    },

    /**
     * Execute a study over a set of OHLCV bars for testing & analysis
     * @param {string|Object} studyNameOrDef
     * @param {Array<Object>} bars
     * @param {Object} inputOverrides
     * @returns {Object}
     */
    executeStudy(studyNameOrDef, bars, inputOverrides = {}) {
      let descriptor = typeof studyNameOrDef === 'string'
        ? this.getStudy(studyNameOrDef)
        : studyNameOrDef;

      if (!descriptor || !descriptor.metainfo || !descriptor.constructor) {
        throw new Error(`Invalid or unregistered study: ${typeof studyNameOrDef === 'string' ? studyNameOrDef : 'object'}`);
      }

      if (!Array.isArray(bars) || bars.length === 0) {
        throw new Error('Bars array must be non-empty');
      }

      const metainfo = descriptor.metainfo;
      const instance = new descriptor.constructor();
      const ctx = new TradingViewStudyMockContext(bars);

      // Map input values
      const inputMap = {};
      metainfo.inputs.forEach((inp, idx) => {
        const slot = inp.slotIndex !== undefined ? inp.slotIndex : idx;
        let val = inp.defval;
        if (inputOverrides[inp.id] !== undefined) val = inputOverrides[inp.id];
        else if (inputOverrides[inp.name] !== undefined) val = inputOverrides[inp.name];
        else if (inputOverrides[slot] !== undefined) val = inputOverrides[slot];

        inputMap[slot] = val;
        inputMap[inp.id] = val;
      });

      const inputCallback = function(idOrIdx) {
        if (inputMap[idOrIdx] !== undefined) return inputMap[idOrIdx];
        return inputMap[0];
      };

      if (typeof instance.init === 'function') {
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
          throw new Error(`Execution error at bar ${i} in study "${descriptor.name}": ${err.message}`);
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
        studyName: descriptor.name,
        barsCount: bars.length,
        metainfo: metainfo,
        plotValues: plotResults
      };
    },

    /**
     * Create mock OHLCV bars for verification & testing
     * @param {number} count
     * @param {number} basePrice
     * @returns {Array<Object>}
     */
    createMockBars(count = 50, basePrice = 100) {
      const bars = [];
      let price = basePrice;
      const now = Math.floor(Date.now() / 1000);

      for (let i = 0; i < count; i++) {
        const delta = Math.sin(i * 0.2) * 2 + (Math.sin(i * 0.05) * 4);
        const open = price;
        const close = open + delta;
        const high = Math.max(open, close) + 1.2;
        const low = Math.min(open, close) - 1.2;
        const volume = Math.floor(1000 + Math.abs(Math.cos(i * 0.3)) * 500);

        bars.push({
          time: now - (count - i) * 60,
          open: parseFloat(open.toFixed(2)),
          high: parseFloat(high.toFixed(2)),
          low: parseFloat(low.toFixed(2)),
          close: parseFloat(close.toFixed(2)),
          volume: volume
        });
        price = close;
      }
      return bars;
    }
  };

  return TVIndicatorEngine;
});
