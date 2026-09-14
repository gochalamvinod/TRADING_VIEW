import re

with open('pine_indicators.js', 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Expand Std with additional ta functions
old_std_end = """      const lower = isNaN(basis) || isNaN(dev) ? NaN : basis - dev;
      return [basis, upper, lower];
    }
  };"""

new_std_end = """      const lower = isNaN(basis) || isNaN(dev) ? NaN : basis - dev;
      return [basis, upper, lower];
    },
    bbw(source, len, mult, ctx) {
      const [basis, upper, lower] = this.bb(source, len, mult, ctx);
      return (upper - lower) / basis;
    },
    crossover(s1, s2) {
      const v1 = (s1 && typeof s1.valueOf === 'function') ? s1.valueOf() : Number(s1);
      const v2 = (s2 && typeof s2.valueOf === 'function') ? s2.valueOf() : Number(s2);
      const prev1 = (s1 && s1[1] !== undefined) ? s1[1] : v1;
      const prev2 = (s2 && s2[1] !== undefined) ? s2[1] : v2;
      return v1 > v2 && prev1 <= prev2;
    },
    crossunder(s1, s2) {
      const v1 = (s1 && typeof s1.valueOf === 'function') ? s1.valueOf() : Number(s1);
      const v2 = (s2 && typeof s2.valueOf === 'function') ? s2.valueOf() : Number(s2);
      const prev1 = (s1 && s1[1] !== undefined) ? s1[1] : v1;
      const prev2 = (s2 && s2[1] !== undefined) ? s2[1] : v2;
      return v1 < v2 && prev1 >= prev2;
    },
    cross(s1, s2) {
      return this.crossover(s1, s2) || this.crossunder(s1, s2);
    },
    change(source, len = 1) {
      const cur = (source && typeof source.valueOf === 'function') ? source.valueOf() : Number(source);
      const prev = (source && source[len] !== undefined) ? source[len] : NaN;
      return isNaN(prev) ? NaN : cur - prev;
    },
    cum(source) {
      const cur = (source && typeof source.valueOf === 'function') ? source.valueOf() : Number(source);
      this._cum = (this._cum || 0) + (isNaN(cur) ? 0 : cur);
      return this._cum;
    },
    highest(source, len = 14) {
      let max = -Infinity;
      for (let i = 0; i < len; i++) {
        const v = (source && source[i] !== undefined) ? source[i] : ((i === 0 && typeof source === 'number') ? source : NaN);
        if (isNaN(v)) return NaN;
        if (v > max) max = v;
      }
      return max === -Infinity ? NaN : max;
    },
    lowest(source, len = 14) {
      let min = Infinity;
      for (let i = 0; i < len; i++) {
        const v = (source && source[i] !== undefined) ? source[i] : ((i === 0 && typeof source === 'number') ? source : NaN);
        if (isNaN(v)) return NaN;
        if (v < min) min = v;
      }
      return min === Infinity ? NaN : min;
    },
    highestbars(source, len = 14) {
      let max = -Infinity;
      let maxIdx = 0;
      for (let i = 0; i < len; i++) {
        const v = (source && source[i] !== undefined) ? source[i] : ((i === 0 && typeof source === 'number') ? source : NaN);
        if (!isNaN(v) && v > max) { max = v; maxIdx = -i; }
      }
      return maxIdx;
    },
    lowestbars(source, len = 14) {
      let min = Infinity;
      let minIdx = 0;
      for (let i = 0; i < len; i++) {
        const v = (source && source[i] !== undefined) ? source[i] : ((i === 0 && typeof source === 'number') ? source : NaN);
        if (!isNaN(v) && v < min) { min = v; minIdx = -i; }
      }
      return minIdx;
    },
    wma(source, len, ctx) {
      source = this._resolveSource(source, ctx);
      const sVar = (source && typeof source.get === 'function') ? source : (ctx ? ctx.new_var(Number(source)) : null);
      if (!sVar) return NaN;
      let norm = 0, sum = 0;
      for (let i = 0; i < len; i++) {
        const weight = len - i;
        norm += weight;
        const v = sVar.get(i);
        if (isNaN(v)) return NaN;
        sum += v * weight;
      }
      return norm > 0 ? sum / norm : NaN;
    },
    vwma(source, len, ctx) {
      if (!ctx || !ctx.symbol) return NaN;
      const vol = ctx.symbol.volume || 1;
      const srcVal = (source && typeof source.valueOf === 'function') ? source.valueOf() : Number(source);
      const pvVar = ctx.new_var(srcVal * vol);
      const vVar = ctx.new_var(vol);
      const pvSum = this.sma(pvVar, len, ctx) * len;
      const vSum = this.sma(vVar, len, ctx) * len;
      return vSum > 0 ? pvSum / vSum : NaN;
    },
    cci(source, len, ctx) {
      source = this._resolveSource(source, ctx);
      const ma = this.sma(source, len, ctx);
      const sVar = (source && typeof source.get === 'function') ? source : (ctx ? ctx.new_var(Number(source)) : null);
      if (!sVar) return NaN;
      let dev = 0;
      for (let i = 0; i < len; i++) {
        const v = sVar.get(i);
        if (isNaN(v)) return NaN;
        dev += Math.abs(v - ma);
      }
      dev = dev / len;
      const cur = sVar.get(0);
      return dev === 0 ? 0 : (cur - ma) / (0.015 * dev);
    },
    stoch(close, high, low, len = 14) {
      const c = (close && typeof close.valueOf === 'function') ? close.valueOf() : Number(close);
      const h = this.highest(high, len);
      const l = this.lowest(low, len);
      return (h - l === 0) ? 50 : 100 * (c - l) / (h - l);
    },
    barssince(cond) {
      if (cond) { this._bsCount = 0; return 0; }
      if (this._bsCount !== undefined) { this._bsCount++; return this._bsCount; }
      return NaN;
    },
    valuewhen(cond, source, occurrence = 0) {
      this._vwHistory = this._vwHistory || [];
      if (cond) {
        const v = (source && typeof source.valueOf === 'function') ? source.valueOf() : Number(source);
        this._vwHistory.unshift(v);
        if (this._vwHistory.length > 50) this._vwHistory.pop();
      }
      return (this._vwHistory && this._vwHistory[occurrence] !== undefined) ? this._vwHistory[occurrence] : NaN;
    },
    supertrend(factor, atrPeriod, ctx) {
      const factorVal = Number(factor) || 3.0;
      const periodVal = Number(atrPeriod) || 10;
      const atr = this.atr(periodVal, ctx);
      const hl2 = ctx && ctx.symbol ? (ctx.symbol.high + ctx.symbol.low) / 2 : 0;
      const c = ctx && ctx.symbol ? ctx.symbol.close : 0;
      const upper = hl2 + factorVal * atr;
      const lower = hl2 - factorVal * atr;
      const dir = c > hl2 ? 1 : -1;
      return [dir === 1 ? lower : upper, dir];
    }
  };"""

assert old_std_end in content, "Could not find old_std_end in content"
content = content.replace(old_std_end, new_std_end, 1)
print("Updated Std with extended ta functions successfully.")

# 2. Update plotshape parser in parsePineMetadata
old_shape_parser = """    // ── 4. Parse plotshape(...) Declarations (Balanced Parenthesis Parser) ───────
    const shapes = [];
    const shapeCalls = extractFunctionCalls(source, 'plotshape');
    shapeCalls.forEach((argsStr, sIdx) => {
      const titleMatch = /title\\s*=\\s*(?:"([^"]+)"|'([^']+)')/i.exec(argsStr);
      let sTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : null;
      if (!sTitle) {
        const parts = argsStr.split(',').map(s => s.trim());
        if (parts[1] && !parts[1].includes('=')) {
          sTitle = parts[1].replace(/['"]/g, '');
        }
      }
      if (!sTitle) sTitle = `Shape ${sIdx + 1}`;

      let display = 7;
      if (/display\\s*=\\s*display\\.none/i.test(argsStr)) {
        display = 0;
      } else if (/display\\s*=\\s*display\\.all\\s*-\\s*display\\.status_line/i.test(argsStr)) {
        display = 7;
      } else if (/display\\s*=\\s*display\\.all\\s*-\\s*display\\.price_scale/i.test(argsStr) || sTitle.toLowerCase().includes('session')) {
        display = 11;
      } else if (/display\\s*=\\s*display\\.all/i.test(argsStr)) {
        display = 15;
      }

      shapes.push({
        id: `shape_${sIdx}`,
        title: sTitle,
        color: '#00E676',
        display: display
      });
    });"""

new_shape_parser = """    // ── 4. Parse plotshape(...) Declarations (Balanced Parenthesis Parser) ───────
    const shapes = [];
    const shapeCalls = extractFunctionCalls(source, 'plotshape');
    shapeCalls.forEach((argsStr, sIdx) => {
      const titleMatch = /title\\s*=\\s*(?:"([^"]+)"|'([^']+)')/i.exec(argsStr);
      let sTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : null;
      if (!sTitle) {
        const parts = argsStr.split(',').map(s => s.trim());
        if (parts[1] && !parts[1].includes('=')) {
          sTitle = parts[1].replace(/['"]/g, '');
        }
      }
      if (!sTitle) sTitle = `Shape ${sIdx + 1}`;

      // Style / shape mapping
      let plottype = 'shape_triangle_up';
      const styleMatch = /style\\s*=\\s*shape\\.([a-zA-Z0-9_]+)/i.exec(argsStr) || /(?:^|,)\\s*shape\\.([a-zA-Z0-9_]+)/i.exec(argsStr);
      if (styleMatch) {
        const sName = styleMatch[1].toLowerCase();
        const map = {
          triangleup: 'shape_triangle_up',
          triangledown: 'shape_triangle_down',
          arrowup: 'shape_arrow_up',
          arrowdown: 'shape_arrow_down',
          circle: 'shape_circle',
          square: 'shape_square',
          diamond: 'shape_diamond',
          cross: 'shape_cross',
          xcross: 'shape_xcross',
          flag: 'shape_flag',
          labelup: 'shape_label_up',
          labeldown: 'shape_label_down'
        };
        if (map[sName]) plottype = map[sName];
      } else if (sTitle.toLowerCase().includes('sell') || sTitle.toLowerCase().includes('bear')) {
        plottype = 'shape_triangle_down';
      }

      // Location mapping
      let location = 'BelowBar';
      const locMatch = /location\\s*=\\s*location\\.([a-zA-Z0-9_]+)/i.exec(argsStr) || /(?:^|,)\\s*location\\.([a-zA-Z0-9_]+)/i.exec(argsStr);
      if (locMatch) {
        const lName = locMatch[1].toLowerCase();
        const map = {
          belowbar: 'BelowBar',
          abovebar: 'AboveBar',
          top: 'Top',
          bottom: 'Bottom',
          absolute: 'Absolute'
        };
        if (map[lName]) location = map[lName];
      } else if (plottype === 'shape_triangle_down' || plottype === 'shape_arrow_down' || plottype === 'shape_label_down') {
        location = 'AboveBar';
      }

      // Color mapping
      let color = '#00E676';
      const colMatch = /color\\s*=\\s*(?:color\\.)?([a-zA-Z0-9_#]+)/i.exec(argsStr);
      if (colMatch) {
        const cVal = colMatch[1].toLowerCase();
        const colMap = {
          green: '#089981',
          lime: '#00e676',
          red: '#f23645',
          maroon: '#880e4f',
          blue: '#2962ff',
          navy: '#1a237e',
          orange: '#ff9800',
          yellow: '#ffeb3b',
          purple: '#9c27b0',
          white: '#ffffff',
          black: '#000000',
          gray: '#787b86',
          grey: '#787b86',
          teal: '#00897b',
          aqua: '#00e5ff',
          silver: '#b0bec5'
        };
        if (colMap[cVal]) color = colMap[cVal];
        else if (colMatch[1].startsWith('#')) color = colMatch[1].slice(0, 7);
      } else if (sTitle.toLowerCase().includes('sell') || sTitle.toLowerCase().includes('bear') || plottype.includes('down')) {
        color = '#F23645';
      }

      let display = 15;
      if (/display\\s*=\\s*display\\.none/i.test(argsStr)) {
        display = 0;
      } else if (/display\\s*=\\s*display\\.all\\s*-\\s*display\\.status_line/i.test(argsStr)) {
        display = 7;
      } else if (/display\\s*=\\s*display\\.all\\s*-\\s*display\\.price_scale/i.test(argsStr) || sTitle.toLowerCase().includes('session')) {
        display = 11;
      } else if (/display\\s*=\\s*display\\.all/i.test(argsStr)) {
        display = 15;
      }

      shapes.push({
        id: `shape_${sIdx}`,
        title: sTitle,
        color: color,
        plottype: plottype,
        location: location,
        display: display
      });
    });"""

assert old_shape_parser in content, "Could not find old_shape_parser in content"
content = content.replace(old_shape_parser, new_shape_parser, 1)
print("Updated plotshape parser in parsePineMetadata successfully.")

# 3. Update createStudyFromTranspiled shape styles
old_shape_styles = """    // C. Shapes Plots
    (meta.shapes || []).forEach((s, idx) => {
      tvPlots.push({ id: s.id, type: 'shapes' });
      tvStyles[s.id] = {
        title: s.title || `Shape ${idx + 1}`,
        histogramBase: 0,
        joinPoints: false
      };
      defaultStyles[s.id] = {
        linestyle: 0,
        linewidth: 2,
        plottype: 'shape_triangle_up',
        location: 'BelowBar',
        trackPrice: false,
        transparency: 0,
        visible: true,
        display: (s.display !== undefined) ? s.display : 7,
        color: s.color || '#00E676'
      };
    });"""

new_shape_styles = """    // C. Shapes Plots
    (meta.shapes || []).forEach((s, idx) => {
      tvPlots.push({ id: s.id, type: 'shapes' });
      tvStyles[s.id] = {
        title: s.title || `Shape ${idx + 1}`,
        histogramBase: 0,
        joinPoints: false
      };
      defaultStyles[s.id] = {
        linestyle: 0,
        linewidth: 2,
        plottype: s.plottype || 'shape_triangle_up',
        location: s.location || 'BelowBar',
        trackPrice: false,
        transparency: 0,
        visible: true,
        display: (s.display !== undefined) ? s.display : 15,
        color: s.color || '#00E676'
      };
    });"""

assert old_shape_styles in content, "Could not find old_shape_styles in content"
content = content.replace(old_shape_styles, new_shape_styles, 1)
print("Updated shape styles in createStudyFromTranspiled successfully.")

# 4. Update evalColor and barEvaluator definition and execution
eval_block_regex = r"    const evalColor = \{[\s\S]*?barEvaluator = new Function\([\s\S]*?transpiledJs\s*\);\s*\} catch\(e\)"
eval_match = re.search(eval_block_regex, content)
assert eval_match, "Could not match evalColor / barEvaluator block"

new_eval_block = """    const evalColor = {
      green: '#089981',
      lime: '#00e676',
      red: '#f23645',
      maroon: '#880e4f',
      blue: '#2962ff',
      navy: '#1a237e',
      yellow: '#ffeb3b',
      orange: '#ff9800',
      purple: '#9c27b0',
      teal: '#00897b',
      olive: '#827717',
      aqua: '#00e5ff',
      fuchsia: '#d500f9',
      silver: '#b0bec5',
      gray: '#787b86',
      grey: '#787b86',
      white: '#ffffff',
      black: '#000000',
      new: (c, t) => {
        if (typeof c === 'string' && c.startsWith('#') && t !== undefined) {
          const alpha = Math.max(0, Math.min(255, Math.round((1 - t / 100) * 255))).toString(16).padStart(2, '0');
          return c.slice(0, 7) + alpha;
        }
        return c;
      },
      rgb: (r, g, b, a) => (a !== undefined ? `rgba(${r},${g},${b},${1 - a/100})` : `rgb(${r},${g},${b})`),
      from_gradient: (val, min, max, c1, c2) => c1
    };

    const evalShape = {
      triangleup: 'shape_triangle_up',
      triangledown: 'shape_triangle_down',
      circle: 'shape_circle',
      square: 'shape_square',
      diamond: 'shape_diamond',
      cross: 'shape_cross',
      xcross: 'shape_xcross',
      arrowup: 'shape_arrow_up',
      arrowdown: 'shape_arrow_down',
      flag: 'shape_flag',
      labelup: 'shape_label_up',
      labeldown: 'shape_label_down'
    };

    const evalLocation = {
      abovebar: 'AboveBar',
      belowbar: 'BelowBar',
      top: 'Top',
      bottom: 'Bottom',
      absolute: 'Absolute'
    };

    const evalSize = {
      auto: 'auto',
      tiny: 'tiny',
      small: 'small',
      normal: 'normal',
      large: 'large',
      huge: 'huge'
    };

    const evalDisplay = {
      none: 0,
      pane: 1,
      data_window: 2,
      price_scale: 4,
      status_line: 8,
      all: 15
    };

    const evalStr = {
      tostring: (val) => String(val),
      format: (fmt, ...args) => {
        let i = 0;
        return String(fmt).replace(/\{(\\d+)?\}/g, (_, idx) => args[idx !== undefined ? Number(idx) : i++]);
      },
      length: (s) => String(s).length,
      contains: (s, sub) => String(s).includes(sub),
      pos: (s, sub) => String(s).indexOf(sub),
      substring: (s, start, end) => String(s).slice(start, end),
      replace_all: (s, target, repl) => String(s).replaceAll(target, repl),
      lower: (s) => String(s).toLowerCase(),
      upper: (s) => String(s).toUpperCase()
    };

    const evalInput = function(defval, title) {
      if (typeof defval === 'object' && defval !== null) return defval.defval !== undefined ? defval.defval : defval;
      return defval;
    };
    evalInput.int = (defval) => (typeof defval === 'object' && defval !== null ? defval.defval : defval);
    evalInput.float = (defval) => (typeof defval === 'object' && defval !== null ? defval.defval : defval);
    evalInput.bool = (defval) => (typeof defval === 'object' && defval !== null ? defval.defval : defval);
    evalInput.string = (defval) => (typeof defval === 'object' && defval !== null ? defval.defval : defval);
    evalInput.color = (defval) => (typeof defval === 'object' && defval !== null ? defval.defval : defval);
    evalInput.symbol = (defval) => (typeof defval === 'object' && defval !== null ? defval.defval : defval);
    evalInput.timeframe = (defval) => (typeof defval === 'object' && defval !== null ? defval.defval : defval);
    evalInput.source = (defval) => (typeof defval === 'object' && defval !== null ? defval.defval : defval);

    const evalPlot = {
      style_line: 0,
      style_histogram: 1,
      style_cross: 3,
      style_area: 4,
      style_columns: 5,
      style_circles: 6,
      style_linebr: 7,
      style_stepline: 9
    };

    let barEvaluator = null;
    if (transpiledJs && typeof transpiledJs === 'string' && transpiledJs.trim()) {
      try {
        barEvaluator = new Function(
          'open', 'high', 'low', 'close', 'volume', 'time', 'bar_index',
          'hl2', 'hlc3', 'ohlc4', 'tr',
          'plotcandle', 'plot', 'plotbar', 'plotshape', 'plotchar', 'plotarrow', 'hline', 'fill',
          'indicator', 'strategy', 'color', 'shape', 'location', 'size', 'display', 'str', 'input',
          'na', 'nz', 'ta', 'math', 'syminfo', 'timeframe', 'barstate', 'Math',
          transpiledJs
        );
      } catch(e)"""

content = content[:eval_match.start()] + new_eval_block + content[eval_match.end():]
print("Updated eval block and barEvaluator Function signature successfully.")

# 5. Update studyConstructor state variables and makeSeries indexing
old_study_start = """    // Study constructor executing for every bar
    const studyConstructor = function() {
      let htfAggState = {};
      let lastBarIdx = -1;
      let historyO = [];
      let historyH = [];
      let historyL = [];
      let historyC = [];
      let historyV = [];

      this.init = function(ctx, inputCallback) {
        htfAggState = {};
        lastBarIdx = -1;
        historyO = [];
        historyH = [];
        historyL = [];
        historyC = [];
        historyV = [];
      };

      this.main = function(ctx, inputCallback) {
        const c = ctx.symbol.close;
        const o = ctx.symbol.open !== undefined ? ctx.symbol.open : c;
        const h = ctx.symbol.high !== undefined ? ctx.symbol.high : c;
        const l = ctx.symbol.low !== undefined ? ctx.symbol.low : c;
        const v = ctx.symbol.volume || 0;
        const t = ctx.symbol.time || (ctx.symbol.bartime ? ctx.symbol.bartime() : Date.now());
        const i = ctx.symbol.index !== undefined ? ctx.symbol.index : (lastBarIdx + 1);
        lastBarIdx = i;

        // Series history accessor for Pine subscript indexing like close[1]
        function makeSeries(val, arr) {
          const numObj = new Number(val);
          return new Proxy(numObj, {
            get(target, prop) {
              if (prop === Symbol.toPrimitive || prop === 'valueOf') return () => val;
              const idx = parseInt(prop, 10);
              if (!isNaN(idx)) {
                if (idx === 0) return val;
                if (arr && arr.length >= idx) {
                  return arr[arr.length - idx];
                }
                return val;
              }
              return target[prop];
            }
          });
        }

        const seriesO = makeSeries(o, historyO);
        const seriesH = makeSeries(h, historyH);
        const seriesL = makeSeries(l, historyL);
        const seriesC = makeSeries(c, historyC);

        historyO.push(o);
        historyH.push(h);
        historyL.push(l);
        historyC.push(c);
        historyV.push(v);
        if (historyO.length > 500) {
          historyO.shift(); historyH.shift(); historyL.shift(); historyC.shift(); historyV.shift();
        }

        const evalCandles = [];
        const evalPlots = [];
        const evalBars = [];
        const evalShapes = [];

        if (barEvaluator) {
          try {
            barEvaluator(
              seriesO, seriesH, seriesL, seriesC, v, t, i,
              // plotcandle
              (co, ch, cl, cc, copts) => {
                evalCandles.push({ o: Number(co), h: Number(ch), l: Number(cl), c: Number(cc), opts: copts || {} });
              },
              // plot
              (pval, ptitle, popts) => {
                evalPlots.push({ val: Number(pval), title: ptitle, opts: popts || {} });
              },
              // plotbar
              (bo, bh, bl, bc, bopts) => {
                evalBars.push({ o: Number(bo), h: Number(bh), l: Number(bl), c: Number(bc), opts: bopts || {} });
              },
              // plotshape
              (sval, sopts) => {
                evalShapes.push({ val: sval, opts: sopts || {} });
              },
              () => {}, // plotchar
              () => {}, // plotarrow
              () => {}, // hline
              () => {}, // fill
              () => {}, // indicator
              evalColor,
              NaN,
              (val, d = 0) => (val === null || val === undefined || isNaN(val) ? d : val),
              Std,
              Math,
              { mintick: 0.00001, ticker: (ctx.symbol && ctx.symbol.ticker) || 'SYMBOL' },
              { islast: true, isfirst: (i === 0) },
              Math
            );
          } catch(e) {}
        }"""

new_study_start = """    // Study constructor executing for every bar
    const studyConstructor = function() {
      let htfAggState = {};
      let lastBarIdx = -1;
      let historyO = [];
      let historyH = [];
      let historyL = [];
      let historyC = [];
      let historyV = [];
      let historyT = [];
      let historyI = [];
      let historyHL2 = [];
      let historyHLC3 = [];
      let historyOHLC4 = [];
      let historyTR = [];

      this.init = function(ctx, inputCallback) {
        htfAggState = {};
        lastBarIdx = -1;
        historyO = [];
        historyH = [];
        historyL = [];
        historyC = [];
        historyV = [];
        historyT = [];
        historyI = [];
        historyHL2 = [];
        historyHLC3 = [];
        historyOHLC4 = [];
        historyTR = [];
      };

      this.main = function(ctx, inputCallback) {
        const c = ctx.symbol.close;
        const o = ctx.symbol.open !== undefined ? ctx.symbol.open : c;
        const h = ctx.symbol.high !== undefined ? ctx.symbol.high : c;
        const l = ctx.symbol.low !== undefined ? ctx.symbol.low : c;
        const v = ctx.symbol.volume || 0;
        const t = ctx.symbol.time || (ctx.symbol.bartime ? ctx.symbol.bartime() : Date.now());
        const i = ctx.symbol.index !== undefined ? ctx.symbol.index : (lastBarIdx + 1);
        lastBarIdx = i;

        const hl2 = (h + l) / 2;
        const hlc3 = (h + l + c) / 3;
        const ohlc4 = (o + h + l + c) / 4;
        const prevC = historyC.length > 0 ? historyC[historyC.length - 1] : NaN;
        const tr = isNaN(prevC) ? (h - l) : Math.max(h - l, Math.abs(h - prevC), Math.abs(l - prevC));

        // Series history accessor for Pine subscript indexing like open[1] or close[2]
        function makeSeries(val, arr) {
          const numObj = new Number(val);
          return new Proxy(numObj, {
            get(target, prop) {
              if (prop === Symbol.toPrimitive) return (hint) => val;
              if (prop === 'valueOf') return () => val;
              const idx = parseInt(prop, 10);
              if (!isNaN(idx)) {
                if (idx === 0) return val;
                const targetIdx = arr.length - 1 - idx;
                return (targetIdx >= 0 && targetIdx < arr.length) ? arr[targetIdx] : NaN;
              }
              return target[prop];
            }
          });
        }

        const seriesO = makeSeries(o, historyO);
        const seriesH = makeSeries(h, historyH);
        const seriesL = makeSeries(l, historyL);
        const seriesC = makeSeries(c, historyC);
        const seriesV = makeSeries(v, historyV);
        const seriesT = makeSeries(t, historyT);
        const seriesI = makeSeries(i, historyI);
        const seriesHL2 = makeSeries(hl2, historyHL2);
        const seriesHLC3 = makeSeries(hlc3, historyHLC3);
        const seriesOHLC4 = makeSeries(ohlc4, historyOHLC4);
        const seriesTR = makeSeries(tr, historyTR);

        historyO.push(o);
        historyH.push(h);
        historyL.push(l);
        historyC.push(c);
        historyV.push(v);
        historyT.push(t);
        historyI.push(i);
        historyHL2.push(hl2);
        historyHLC3.push(hlc3);
        historyOHLC4.push(ohlc4);
        historyTR.push(tr);
        if (historyO.length > 1000) {
          historyO.shift(); historyH.shift(); historyL.shift(); historyC.shift(); historyV.shift();
          historyT.shift(); historyI.shift(); historyHL2.shift(); historyHLC3.shift(); historyOHLC4.shift(); historyTR.shift();
        }

        const evalCandles = [];
        const evalPlots = [];
        const evalBars = [];
        const evalShapes = [];
        const evalChars = [];
        const evalArrows = [];

        // Pine Ta namespace automatically wired with active bar ctx
        const pineTa = Object.assign({}, Std, {
          sma: (src, len) => Std.sma(src, len, ctx),
          ema: (src, len) => Std.ema(src, len, ctx),
          rma: (src, len) => Std.rma(src, len, ctx),
          wma: (src, len) => Std.wma(src, len, ctx),
          vwma: (src, len) => Std.vwma(src, len, ctx),
          rsi: (src, len) => Std.rsi(src, len, ctx),
          macd: (src, fast, slow, sig) => Std.macd(src, fast, slow, sig, ctx),
          stdev: (src, len) => Std.stdev(src, len, ctx),
          tr: (handleFirst) => Std.tr(handleFirst, ctx),
          atr: (len) => Std.atr(len, ctx),
          bb: (src, len, mult) => Std.bb(src, len, mult, ctx),
          bbw: (src, len, mult) => Std.bbw(src, len, mult, ctx),
          cci: (src, len) => Std.cci(src, len, ctx),
          crossover: (s1, s2) => Std.crossover(s1, s2),
          crossunder: (s1, s2) => Std.crossunder(s1, s2),
          cross: (s1, s2) => Std.cross(s1, s2),
          change: (src, len) => Std.change(src, len),
          cum: (src) => Std.cum(src),
          highest: (src, len) => Std.highest(src, len),
          lowest: (src, len) => Std.lowest(src, len),
          highestbars: (src, len) => Std.highestbars(src, len),
          lowestbars: (src, len) => Std.lowestbars(src, len),
          stoch: (close, high, low, len) => Std.stoch(close, high, low, len),
          supertrend: (factor, atrPeriod) => Std.supertrend(factor, atrPeriod, ctx),
          barssince: (cond) => Std.barssince(cond),
          valuewhen: (cond, src, occ) => Std.valuewhen(cond, src, occ)
        });

        const pineMath = Object.assign({}, Math, {
          avg: (...args) => args.reduce((a, b) => a + Number(b), 0) / (args.length || 1),
          sum: (...args) => args.reduce((a, b) => a + Number(b), 0),
          todegrees: (rad) => Number(rad) * 180 / Math.PI,
          toradians: (deg) => Number(deg) * Math.PI / 180,
          pi: Math.PI,
          e: Math.E
        });

        if (barEvaluator) {
          try {
            barEvaluator(
              seriesO, seriesH, seriesL, seriesC, seriesV, seriesT, seriesI,
              seriesHL2, seriesHLC3, seriesOHLC4, seriesTR,
              // plotcandle
              (co, ch, cl, cc, copts) => {
                evalCandles.push({ o: Number(co), h: Number(ch), l: Number(cl), c: Number(cc), opts: copts || {} });
              },
              // plot
              (pval, ...rest) => {
                let popts = {};
                let ptitle = '';
                if (rest.length === 1 && typeof rest[0] === 'object' && rest[0] !== null) {
                  popts = rest[0];
                  ptitle = popts.title || '';
                } else if (rest.length > 0) {
                  if (typeof rest[0] === 'string') {
                    ptitle = rest[0];
                    if (typeof rest[1] === 'object') popts = rest[1];
                    else popts = { color: rest[1], linewidth: rest[2], style: rest[3] };
                  } else if (typeof rest[0] === 'object') {
                    popts = rest[0];
                    ptitle = popts.title || '';
                  }
                }
                evalPlots.push({ val: Number(pval), title: ptitle, opts: popts });
              },
              // plotbar
              (bo, bh, bl, bc, bopts) => {
                evalBars.push({ o: Number(bo), h: Number(bh), l: Number(bl), c: Number(bc), opts: bopts || {} });
              },
              // plotshape
              (sval, ...rest) => {
                let sopts = {};
                if (rest.length === 1 && typeof rest[0] === 'object' && rest[0] !== null) {
                  sopts = rest[0];
                } else if (rest.length > 0) {
                  sopts = { title: rest[0], style: rest[1], location: rest[2], color: rest[3], offset: rest[4], text: rest[5], textcolor: rest[6], size: rest[8] };
                }
                evalShapes.push({ val: sval, opts: sopts });
              },
              // plotchar
              (cval, ...rest) => {
                let copts = {};
                if (rest.length === 1 && typeof rest[0] === 'object' && rest[0] !== null) {
                  copts = rest[0];
                } else if (rest.length > 0) {
                  copts = { title: rest[0], char: rest[1], location: rest[2], color: rest[3] };
                }
                evalChars.push({ val: cval, opts: copts });
              },
              // plotarrow
              (aval, ...rest) => {
                let aopts = {};
                if (rest.length === 1 && typeof rest[0] === 'object' && rest[0] !== null) {
                  aopts = rest[0];
                } else if (rest.length > 0) {
                  aopts = { title: rest[0], colordown: rest[1], colorup: rest[2] };
                }
                evalArrows.push({ val: aval, opts: aopts });
              },
              () => {}, // hline
              () => {}, // fill
              () => {}, // indicator
              () => {}, // strategy
              evalColor,
              evalShape,
              evalLocation,
              evalSize,
              evalDisplay,
              evalStr,
              evalInput,
              NaN,
              (val, d = 0) => (val === null || val === undefined || isNaN(val) ? d : val),
              pineTa,
              pineMath,
              { mintick: 0.00001, ticker: (ctx.symbol && ctx.symbol.ticker) || 'SYMBOL', currency: 'USD' },
              { isintraday: true, isdaily: false, isweekly: false, ismonthly: false, multiplier: 1, period: '1' },
              { islast: true, isfirst: (i === 0), isconfirmed: true, isnew: true, ishistory: true, isrealtime: false },
              Math
            );
          } catch(e) {
            console.warn('[PineIndicators] barEvaluator runtime error on bar', i, e.message);
          }
        }"""

assert old_study_start in content, "Could not find old_study_start in content"
content = content.replace(old_study_start, new_study_start, 1)
print("Updated studyConstructor start and series creation successfully.")

# 6. Update studyConstructor main return handling for shapes, chars, arrows, and baseline
old_main_return = """          } else if (!hasCandles && !hasBars && !meta.title.toLowerCase().includes('session')) {
            // Adaptive trend baseline: ensure scripts with 0 plots never produce blank charts
            const baselineVal = isPriceStudy ? Std.ema('close', 14, ctx) : Std.rsi('close', 14, ctx);
            plotValues.push(isNaN(baselineVal) ? (isPriceStudy ? c : 50) : baselineVal);
          }
        }

        // 3. Process Shapes Plots (Signals)
        (meta.shapes || []).forEach((s) => {
          let shapeVal = NaN;
          const sTitle = (s.title || '').toLowerCase();
          const fast = Std.sma('close', currentInputs.fastLen || 9, ctx);
          const slow = Std.sma('close', currentInputs.slowLen || 21, ctx);
          const diff = ctx.new_var(fast - slow);

          if (sTitle.includes('buy') || sTitle.includes('bullish')) {
            if (diff.get(0) > 0 && diff.get(1) <= 0) shapeVal = 1;
          } else if (sTitle.includes('sell') || sTitle.includes('bearish')) {
            if (diff.get(0) < 0 && diff.get(1) >= 0) shapeVal = 1;
          }
          plotValues.push(shapeVal);
        });

        // 4. Process Chars and Arrows Plots
        (meta.chars || []).forEach(() => {
          plotValues.push(NaN);
        });
        (meta.arrows || []).forEach(() => {
          plotValues.push(NaN);
        });"""

new_main_return = """          } else if (!hasCandles && !hasBars && !meta.title.toLowerCase().includes('session') && (meta.shapes || []).length === 0 && (meta.chars || []).length === 0 && (meta.arrows || []).length === 0) {
            // Adaptive trend baseline: ensure scripts with 0 plots never produce blank charts
            const baselineVal = isPriceStudy ? Std.ema('close', 14, ctx) : Std.rsi('close', 14, ctx);
            plotValues.push(isNaN(baselineVal) ? (isPriceStudy ? c : 50) : baselineVal);
          }
        }

        // 3. Process Shapes Plots (Signals)
        (meta.shapes || []).forEach((s, sIdx) => {
          let shapeVal = NaN;
          if (evalShapes && evalShapes[sIdx] !== undefined) {
            const sVal = evalShapes[sIdx].val;
            const isTriggered = (sVal === true || (typeof sVal === 'number' && !isNaN(sVal) && sVal !== 0));
            shapeVal = isTriggered ? 1 : NaN;
          } else {
            const sTitle = (s.title || '').toLowerCase();
            const fast = Std.sma('close', currentInputs.fastLen || 9, ctx);
            const slow = Std.sma('close', currentInputs.slowLen || 21, ctx);
            const diff = ctx.new_var(fast - slow);

            if (sTitle.includes('buy') || sTitle.includes('bullish')) {
              if (diff.get(0) > 0 && diff.get(1) <= 0) shapeVal = 1;
            } else if (sTitle.includes('sell') || sTitle.includes('bearish')) {
              if (diff.get(0) < 0 && diff.get(1) >= 0) shapeVal = 1;
            }
          }
          plotValues.push(shapeVal);
        });

        // 4. Process Chars and Arrows Plots
        (meta.chars || []).forEach((ch, chIdx) => {
          let charVal = NaN;
          if (evalChars && evalChars[chIdx] !== undefined) {
            const cVal = evalChars[chIdx].val;
            charVal = (cVal === true || (typeof cVal === 'number' && !isNaN(cVal) && cVal !== 0)) ? 1 : NaN;
          }
          plotValues.push(charVal);
        });
        (meta.arrows || []).forEach((ar, arIdx) => {
          let arrowVal = NaN;
          if (evalArrows && evalArrows[arIdx] !== undefined) {
            const aVal = evalArrows[arIdx].val;
            arrowVal = (typeof aVal === 'number' && !isNaN(aVal)) ? aVal : NaN;
          }
          plotValues.push(arrowVal);
        });"""

assert old_main_return in content, "Could not find old_main_return in content"
content = content.replace(old_main_return, new_main_return, 1)
print("Updated shapes/chars/arrows/baseline plotValues return handling successfully.")

with open('pine_indicators.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("SUCCESS: pine_indicators.js updated and written successfully!")
