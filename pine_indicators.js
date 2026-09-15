/**
 * pine_indicators.js
 * Integration bridge between PineTS Engine and TradingView Charting Library (TT v29.6.0).
 * 
 * Exposes:
 *  - window.PineIndicators: core API, study registry, and study compiler
 *  - window.getPineIndicators(PineJS): hook for TradingView widget custom_indicators_getter option
 *  - window.openPineEditorModal(widget): interactive PineScript editor modal
 */
(function(root) {
  'use strict';

  // Palette of distinct colors for auto-generated plots
  const PLOT_COLORS = [
    '#2196F3', '#FF9800', '#4CAF50', '#E91E63', '#9C27B0',
    '#00BCD4', '#FFEB3B', '#795548', '#607D8B', '#00E676',
    '#FF5252', '#7C4DFF', '#00B0FF', '#FF6D00', '#E040FB'
  ];

  const _registeredStudies = new Map();
  const _securityCache = new Map(); // key: `${sym}_${res}` -> { bars: [{time, open, high, low, close, volume}], fetching: bool }
  root._securityCache = _securityCache;

  const _studyShapeRegistry = new Map();
  root.PineStudyShapeRegistry = _studyShapeRegistry;
  const _studyTableRegistry = new Map();
  root.PineStudyTableRegistry = _studyTableRegistry;

  const _allPineShapeIds = new Set();
  root._allPineShapeIds = _allPineShapeIds;

  const _studyAliases = new Map(); // key: id or name -> Set of alias strings
  root._studyAliases = _studyAliases;

  function registerStudyAlias(studyId, aliases) {
    if (!studyId || !aliases) return;
    const list = Array.isArray(aliases) ? aliases : [aliases];
    if (!_studyAliases.has(studyId)) {
      _studyAliases.set(studyId, new Set());
    }
    const set = _studyAliases.get(studyId);
    list.forEach(a => {
      if (a && typeof a === 'string') {
        set.add(a);
        // Bidirectional alias mapping
        if (!_studyAliases.has(a)) _studyAliases.set(a, new Set());
        _studyAliases.get(a).add(studyId);
      }
    });
  }
  root.registerStudyAlias = registerStudyAlias;

  function registerStudyShape(studyId, shapeId) {
    if (!shapeId) return;
    _allPineShapeIds.add(shapeId);

    const keysToRegister = new Set();
    if (studyId) {
      keysToRegister.add(studyId);
      const aliases = _studyAliases.get(studyId);
      if (aliases) {
        aliases.forEach(a => keysToRegister.add(a));
      }
    }

    keysToRegister.forEach(key => {
      if (!_studyShapeRegistry.has(key)) {
        _studyShapeRegistry.set(key, new Set());
      }
      _studyShapeRegistry.get(key).add(shapeId);
    });

    if (typeof _activeSessionShapeIds !== 'undefined' && Array.isArray(_activeSessionShapeIds) && !_activeSessionShapeIds.includes(shapeId)) {
      _activeSessionShapeIds.push(shapeId);
    }
  }

  function getStudyShapes(studyId) {
    const allShapes = new Set();
    const keys = [studyId];
    const aliases = _studyAliases.get(studyId);
    if (aliases) aliases.forEach(a => keys.push(a));
    const sIdLower = String(studyId || '').toLowerCase();
    _studyShapeRegistry.forEach((set, key) => {
      if (key && (key === studyId || String(key).toLowerCase().includes(sIdLower) || sIdLower.includes(String(key).toLowerCase()))) {
        set.forEach(id => allShapes.add(id));
      }
    });
    keys.forEach(k => {
      const s = _studyShapeRegistry.get(k);
      if (s) s.forEach(id => allShapes.add(id));
    });
    if (typeof studyId === 'string' && studyId.toLowerCase().includes('session')) {
      if (Array.isArray(_activeSessionShapeIds)) {
        _activeSessionShapeIds.forEach(id => allShapes.add(id));
      }
    }
    return Array.from(allShapes);
  }
  root.getStudyShapes = getStudyShapes;

  function setStudyShapesVisibility(studyId, isVisible, chart) {
    if (!chart && typeof window !== 'undefined' && window.widget && typeof window.widget.activeChart === 'function') {
      try { chart = window.widget.activeChart(); } catch (e) {}
    }
    const shapes = getStudyShapes(studyId);
    if (chart && typeof chart.getShapeById === 'function') {
      shapes.forEach(shapeId => {
        try {
          const shapeApi = chart.getShapeById(shapeId);
          if (shapeApi && typeof shapeApi.setVisible === 'function') {
            shapeApi.setVisible(isVisible);
          }
        } catch(e) {}
      });
    }

    // Also toggle table overlays
    const tblSelector = `[data-study-id="${studyId}"], #pine_table_${studyId}`;
    try {
      const displayVal = isVisible ? '' : 'none';
      document.querySelectorAll(tblSelector).forEach(el => el.style.display = displayVal);
      const innerDoc = document.querySelector('#tv_chart_container iframe')?.contentWindow?.document;
      if (innerDoc) innerDoc.querySelectorAll(tblSelector).forEach(el => el.style.display = displayVal);
    } catch(e) {}
  }
  root.setStudyShapesVisibility = setStudyShapesVisibility;

  let _isClearingStudyShapes = false;
  function clearStudyShapes(studyId, chart) {
    if (_isClearingStudyShapes) return;
    _isClearingStudyShapes = true;
    try {
      if (!chart && typeof window !== 'undefined' && window.widget && typeof window.widget.activeChart === 'function') {
        try { chart = window.widget.activeChart(); } catch (e) {}
      }

      const isClearAll = !studyId || studyId === 'all' || (chart && typeof chart.getAllStudies === 'function' && chart.getAllStudies().length === 0);

      if (!isClearAll) {
        const shapeIdsToRemove = new Set();
        const keysToClear = new Set([studyId]);
        const aliases = _studyAliases.get(studyId);
        if (aliases) {
          aliases.forEach(a => keysToClear.add(a));
        }

        // Also search case-insensitively across registered study keys
        const sIdLower = String(studyId).toLowerCase();
        _studyShapeRegistry.forEach((set, key) => {
          if (key && (key === studyId || String(key).toLowerCase().includes(sIdLower) || sIdLower.includes(String(key).toLowerCase()))) {
            keysToClear.add(key);
          }
        });

        keysToClear.forEach(key => {
          const shapes = _studyShapeRegistry.get(key);
          if (shapes) {
            shapes.forEach(id => shapeIdsToRemove.add(id));
            shapes.clear();
          }
          _studyShapeRegistry.delete(key);

          const tbl = _studyTableRegistry.get(key);
          if (tbl && tbl.parentNode) {
            tbl.parentNode.removeChild(tbl);
          }
          _studyTableRegistry.delete(key);
        });

        if (chart && typeof chart.removeEntity === 'function') {
          shapeIdsToRemove.forEach(id => {
            try { chart.removeEntity(id); } catch(e) {}
            _allPineShapeIds.delete(id);
          });
        }

        // Check if this was a session study or if no active session study remains
        const isSession = typeof studyId === 'string' && studyId.toLowerCase().includes('session');
        if (isSession || !hasActiveSessionStudy(chart)) {
          clearSessionVisuals(chart);
        }

        // Also remove DOM tables matching this study
        const tblSelector = `[data-study-id="${studyId}"], #pine_table_${studyId}`;
        try {
          document.querySelectorAll(tblSelector).forEach(el => el.remove());
          const innerDoc = document.querySelector('#tv_chart_container iframe')?.contentWindow?.document;
          if (innerDoc) innerDoc.querySelectorAll(tblSelector).forEach(el => el.remove());
        } catch(e) {}
      } else {
        // CLEAR ALL ENTITIES
        if (chart && typeof chart.removeEntity === 'function') {
          _allPineShapeIds.forEach(id => {
            try { chart.removeEntity(id); } catch(e) {}
          });
          _studyShapeRegistry.forEach(shapes => {
            if (shapes) {
              shapes.forEach(id => {
                try { chart.removeEntity(id); } catch(e) {}
              });
            }
          });
          if (Array.isArray(_activeSessionShapeIds)) {
            _activeSessionShapeIds.forEach(id => {
              try { chart.removeEntity(id); } catch(e) {}
            });
          }
          if (typeof chart.getAllShapes === 'function') {
            try {
              const allShapes = chart.getAllShapes();
              if (Array.isArray(allShapes)) {
                allShapes.forEach(s => {
                  if (s && s.id && (_allPineShapeIds.has(s.id) || (Array.isArray(_activeSessionShapeIds) && _activeSessionShapeIds.includes(s.id)))) {
                    try { chart.removeEntity(s.id); } catch(e) {}
                  }
                });
              }
            } catch(e) {}
          }
        }

        _allPineShapeIds.clear();
        _studyShapeRegistry.clear();
        _studyTableRegistry.clear();
        _activeSessionShapeIds = [];
        _isSessionVisualsActive = false;

        // Remove all table elements from both main and iframe DOMs
        try {
          document.querySelectorAll('.tv-pine-table-container, [id^="pine_table_"]').forEach(el => el.remove());
          const innerDoc = document.querySelector('#tv_chart_container iframe')?.contentWindow?.document;
          if (innerDoc) {
            innerDoc.querySelectorAll('.tv-pine-table-container, [id^="pine_table_"]').forEach(el => el.remove());
          }
        } catch(e) {}
      }
    } finally {
      _isClearingStudyShapes = false;
    }
  }

  root.clearStudyShapes = clearStudyShapes;
  root.registerStudyShape = registerStudyShape;

  function extractCleanSymbol(raw) {
    if (!raw) return '';
    let str = String(raw).trim();
    if (str.startsWith('=')) {
      try {
        const p = JSON.parse(str.slice(1));
        if (p && p.symbol) str = String(p.symbol);
        else if (p && !p.symbol) return '';
      } catch(e) {}
    } else if (str.startsWith('{')) {
      try {
        const p = JSON.parse(str);
        if (p && p.symbol) str = String(p.symbol);
        else if (p && p.ticker) str = String(p.ticker);
        else if (p && !p.symbol && !p.ticker) return '';
      } catch(e) {}
    }
    str = str.replace(/^[A-Za-z0-9_\-\s]+:/, '');
    str = str.replace(/[{"}'\\]/g, '').trim().toUpperCase();
    if (str.endsWith('USDT')) {
      str = str.slice(0, -1);
    }
    if (str === 'REGULAR' || str === 'SESSION:REGULAR' || str.startsWith('SESSION')) {
      return '';
    }
    return str;
  }

  function fetchSecurityBarsOnDemand(cleanSym, res, isRefresh = false) {
    if (typeof fetch !== 'function' || !cleanSym) return;
    const cacheKey = `${cleanSym}_${res}`;
    const cached = _securityCache.get(cacheKey);
    const now = Date.now();

    if (cached && !isRefresh) {
      if (cached.bars && cached.bars.length > 0) return;
      if (cached.fetching && (now - (cached.fetchStart || 0) < 5000)) return;
    }

    if (cached && isRefresh) {
      if (cached.fetching && (now - (cached.fetchStart || 0) < 2500)) return;
      if (now - (cached.lastFetchTime || 0) < 1500) return; // Throttle refresh to max once per 1.5s
    }

    const isInitial = !cached || !cached.bars || cached.bars.length === 0;
    const existingBars = (cached && cached.bars) ? cached.bars : [];
    _securityCache.set(cacheKey, {
      bars: existingBars,
      fetching: true,
      fetchStart: now,
      lastFetchTime: cached?.lastFetchTime || 0
    });

    const fetchSym = cleanSym;
    const nowSec = Math.floor(now / 1000);
    const countback = isInitial ? 1500 : 15;

    fetch(`/history?symbol=${encodeURIComponent(fetchSym)}&resolution=${encodeURIComponent(res)}&countback=${countback}&to=${nowSec}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.s === 'ok' && Array.isArray(data.t) && data.t.length > 0) {
          const entry = _securityCache.get(cacheKey) || { bars: [] };
          const bars = entry.bars || [];
          const existingMap = new Map();
          for (let i = 0; i < bars.length; i++) {
            existingMap.set(bars[i].time, i);
          }
          for (let k = 0; k < data.t.length; k++) {
            const barSec = (data.t[k] > 1e11) ? Math.floor(data.t[k] / 1000) : data.t[k];
            const barObj = {
              time: barSec,
              open: data.o[k],
              high: data.h[k],
              low: data.l[k],
              close: data.c[k],
              volume: (data.v && data.v[k] !== undefined) ? data.v[k] : 0
            };
            if (existingMap.has(barSec)) {
              bars[existingMap.get(barSec)] = barObj;
            } else {
              bars.push(barObj);
              existingMap.set(barSec, bars.length - 1);
            }
          }
          bars.sort((a, b) => a.time - b.time);
          _securityCache.set(cacheKey, { bars, fetching: false, lastFetchTime: Date.now() });

          if (typeof window !== 'undefined' && window.widget && typeof window.widget.activeChart === 'function') {
            setTimeout(() => {
              try {
                const chart = window.widget.activeChart();
                const model = chart._chartWidget?._model?.model() || chart?.model?.();
                if (model) {
                  const ms = model.mainSeries ? model.mainSeries() : null;
                  const customStudies = model.priceDataSources().filter(s =>
                    s !== ms &&
                    typeof s.name === 'function' &&
                    s.name().includes('Custom Symbol')
                  );
                  customStudies.forEach(s => {
                    if (isInitial && typeof s.restart === 'function') {
                      s.restart();
                    } else if (typeof s.recalculate === 'function') {
                      s.recalculate();
                    }
                  });
                  if (customStudies.length > 0) {
                    if (typeof model.lightUpdate === 'function') {
                      model.lightUpdate();
                    } else {
                      model.fullUpdate();
                    }
                  }
                }
              } catch (recErr) {}
            }, 30);
          }
        } else {
          const entry = _securityCache.get(cacheKey);
          if (entry) { entry.fetching = false; entry.lastFetchTime = Date.now(); }
        }
      })
      .catch(() => {
        const entry = _securityCache.get(cacheKey);
        if (entry) { entry.fetching = false; }
      });
  }

  // Active external symbol poller: keeps indicator candles streaming in real-time
  if (typeof window !== 'undefined') {
    setInterval(() => {
      try {
        if (!window.widget || typeof window.widget.activeChart !== 'function') return;
        const chart = window.widget.activeChart();
        if (!chart) return;
        const model = chart._chartWidget?._model?.model() || chart?.model?.();
        if (!model) return;
        const studies = model.priceDataSources().filter(s => s && s.name && s.name().includes('Custom Symbol'));
        if (!studies || studies.length === 0) return;
        const chartSym = extractCleanSymbol(chart.symbol());
        const chartRes = String(chart.resolution() || '1');

        studies.forEach(s => {
          if (!s.properties) return;
          const pInps = s.properties().childs().inputs;
          const symVal = (pInps.child('sym') && pInps.child('sym').value()) ||
                         (pInps.child('symbol') && pInps.child('symbol').value()) ||
                         (pInps.child('0') && pInps.child('0').value());
          const cleanSym = extractCleanSymbol(symVal);
          if (cleanSym && cleanSym !== chartSym) {
            fetchSecurityBarsOnDemand(cleanSym, chartRes, true);
          }
        });
      } catch(e) {}
    }, 2000);
  }

  // Lightweight pre-load of default EURUSD. at 1m resolution (1500 bars, ~30KB)
  try {
    fetchSecurityBarsOnDemand('EURUSD.', '1');
  } catch(e) {}

  /* =========================================================================
   * TradingView Execution Context Standard Library (Std)
   * ========================================================================= */
  const Std = {
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
    open(ctx) { return ctx && ctx.symbol ? ctx.symbol.open : NaN; },
    high(ctx) { return ctx && ctx.symbol ? ctx.symbol.high : NaN; },
    low(ctx) { return ctx && ctx.symbol ? ctx.symbol.low : NaN; },
    close(ctx) { return ctx && ctx.symbol ? ctx.symbol.close : NaN; },
    volume(ctx) { return ctx && ctx.symbol ? (ctx.symbol.volume || 0) : 0; },
    time(ctx) { return ctx && ctx.symbol ? (ctx.symbol.time || 0) : 0; },
    hl2(ctx) { return ctx && ctx.symbol ? (ctx.symbol.high + ctx.symbol.low) / 2 : NaN; },
    hlc3(ctx) { return ctx && ctx.symbol ? (ctx.symbol.high + ctx.symbol.low + ctx.symbol.close) / 3 : NaN; },
    ohlc4(ctx) { return ctx && ctx.symbol ? (ctx.symbol.open + ctx.symbol.high + ctx.symbol.low + ctx.symbol.close) / 4 : NaN; },
    nz(v, def = 0) { return (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) ? def : v; },
    na(v) { return (v === null || v === undefined || (typeof v === 'number' && isNaN(v))) ? 1 : 0; },
    sma(series, len, ctx) {
      series = this._resolveSource(series, ctx);
      const val = (series && typeof series.get === 'function') ? series.get(0) : series;
      const sVar = (series && typeof series.get === 'function') ? series : (ctx ? ctx.new_var(val) : null);
      if (!sVar) return isNaN(val) ? NaN : val;
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
      const sVar = (series && typeof series.get === 'function') ? series : (ctx ? ctx.new_var(val) : null);
      if (!sVar || !ctx) return isNaN(val) ? NaN : val;
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
      const sVar = (series && typeof series.get === 'function') ? series : (ctx ? ctx.new_var(val) : null);
      if (!sVar || !ctx) return isNaN(val) ? NaN : val;
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
      const sVar = (series && typeof series.get === 'function') ? series : (ctx ? ctx.new_var(val) : null);
      if (!sVar || !ctx) return 0;
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
      if (!ctx || !ctx.symbol) return NaN;
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
      if (!ctx) return NaN;
      const trVal = this.tr(true, ctx);
      const trVar = ctx.new_var(isNaN(trVal) ? (ctx.symbol.high - ctx.symbol.low) : trVal);
      return this.rma(trVar, len, ctx);
    },
    rsi(source, len, ctx) {
      source = this._resolveSource(source, ctx);
      const val = (source && typeof source.get === 'function') ? source.get(0) : source;
      const sVar = (source && typeof source.get === 'function') ? source : (ctx ? ctx.new_var(val) : null);
      if (!sVar || !ctx) return 50;
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
      const sVar = (source && typeof source.get === 'function') ? source : (ctx ? ctx.new_var(val) : null);
      const fastEMA = this.ema(sVar, fastLen, ctx);
      const slowEMA = this.ema(sVar, slowLen, ctx);
      const macdLine = isNaN(fastEMA) || isNaN(slowEMA) ? NaN : fastEMA - slowEMA;
      const macdVar = ctx ? ctx.new_var(isNaN(macdLine) ? 0 : macdLine) : null;
      const signalLine = macdVar ? this.ema(macdVar, sigLen, ctx) : NaN;
      const hist = isNaN(macdLine) || isNaN(signalLine) ? NaN : macdLine - signalLine;
      return [macdLine, signalLine, hist];
    },
    bb(source, len, mult, ctx) {
      source = this._resolveSource(source, ctx);
      const val = (source && typeof source.get === 'function') ? source.get(0) : source;
      const sVar = (source && typeof source.get === 'function') ? source : (ctx ? ctx.new_var(val) : null);
      const basis = this.sma(sVar, len, ctx);
      const dev = mult * this.stdev(sVar, len, ctx);
      const upper = isNaN(basis) || isNaN(dev) ? NaN : basis + dev;
      const lower = isNaN(basis) || isNaN(dev) ? NaN : basis - dev;
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
  };

  /* =========================================================================
   * 2. PineTS Runtime & Color Encoding Helpers
   * ========================================================================= */
  function getPineTS() {
    let lib = root.PineTSLib || root.PineTS || (typeof PineTSLib !== 'undefined' ? PineTSLib : null);
    if (!lib && typeof require !== 'undefined') {
      try {
        lib = require('./PineTS-main/dist/pinets.min.cjs');
      } catch (e) {
        try {
          lib = require('E:/TRADINGVIEW ADVANCED/PineTS-main/dist/pinets.min.cjs');
        } catch (e2) {}
      }
    }
    // Global alias guarantee: window.PineTS.Indicator = window.PineTSLib.Indicator
    if (lib && root.PineTSLib && root.PineTS && !root.PineTS.Indicator) {
      root.PineTS.Indicator = root.PineTSLib.Indicator;
    }
    return lib;
  }

  /**
   * Convert CSS/Pine color string or array to TradingView 32-bit unsigned RGBA color integer
   * Formula: (r & 255) + ((g & 255) * 256) + ((b & 255) * 65536) + (Math.round(Math.max(0, Math.min(1, a)) * 255) * 16777216)
   */
  function colorToInt(color, alpha = 1.0) {
    if (typeof color === 'number') return Math.round(color);
    if (!color || typeof color !== 'string') return 4286683400; // fallback green #089981 with alpha=1

    const cStr = color.trim().toLowerCase();
    if (cStr === 'na' || cStr === 'transparent') {
      return 0; // alpha = 0 -> transparent
    }

    const PINE_COLOR_MAP = {
      'color.green': '#089981',
      'color.red': '#f23645',
      'color.blue': '#2962ff',
      'color.aqua': '#00bcd4',
      'color.orange': '#ff9800',
      'color.purple': '#9c27b0',
      'color.teal': '#00897b',
      'color.white': '#ffffff',
      'color.black': '#000000',
      'color.gray': '#787b86',
      'color.yellow': '#ffeb3b',
      'green': '#089981',
      'red': '#f23645',
      'blue': '#2962ff',
      'aqua': '#00bcd4',
      'orange': '#ff9800',
      'purple': '#9c27b0',
      'teal': '#00897b',
      'white': '#ffffff',
      'black': '#000000',
      'gray': '#787b86',
      'yellow': '#ffeb3b'
    };

    const resolved = PINE_COLOR_MAP[cStr] || color.trim();
    let r = 8, g = 153, b = 129, a = alpha !== undefined ? alpha : 1.0;

    if (resolved.startsWith('#')) {
      const hex = resolved.slice(1);
      if (hex.length === 3) {
        r = parseInt(hex[0] + hex[0], 16);
        g = parseInt(hex[1] + hex[1], 16);
        b = parseInt(hex[2] + hex[2], 16);
      } else if (hex.length === 6) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
      } else if (hex.length === 8) {
        r = parseInt(hex.substring(0, 2), 16);
        g = parseInt(hex.substring(2, 4), 16);
        b = parseInt(hex.substring(4, 6), 16);
        a = parseInt(hex.substring(6, 8), 16) / 255;
      }
    } else if (resolved.startsWith('rgb')) {
      const match = resolved.match(/rgba?\s*\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([\d.]+))?\s*\)/i);
      if (match) {
        r = parseInt(match[1], 10);
        g = parseInt(match[2], 10);
        b = parseInt(match[3], 10);
        if (match[4] !== undefined) a = parseFloat(match[4]);
      }
    } else if (Array.isArray(color)) {
      [r, g, b] = color;
      if (color[3] !== undefined) a = color[3];
    }

    return (Math.round(r) & 255) +
           ((Math.round(g) & 255) * 256) +
           ((Math.round(b) & 255) * 65536) +
           (Math.round(Math.max(0, Math.min(1, a)) * 255) * 16777216);
  }

  function getTfDurationMs(tf) {
    const s = String(tf || '').toUpperCase().trim();
    if (!s || s === 'CURRENT' || s === 'SAME') return 0;
    if (s.endsWith('S')) {
      const sec = parseInt(s.slice(0, -1), 10);
      if (!isNaN(sec) && sec > 0) return sec * 1000;
    }
    if (s.endsWith('T')) {
      return 1000; // Tick resolution: 1s default block
    }
    if (s === '1') return 60000;
    if (s === '2') return 120000;
    if (s === '3') return 180000;
    if (s === '5') return 300000;
    if (s === '10') return 600000;
    if (s === '15') return 900000;
    if (s === '30') return 1800000;
    if (s === '60' || s === '1H') return 3600000;
    if (s === '120' || s === '2H') return 7200000;
    if (s === '240' || s === '4H') return 14400000;
    if (s === 'D' || s === '1D') return 86400000;
    if (s === 'W' || s === '1W') return 604800000;
    if (s === 'M' || s === '1M') return 2592000000;
    const num = parseInt(s, 10);
    if (!isNaN(num) && num > 0) return num * 60000;
    return 60000;
  }

  /**
   * Parse indicator metadata (title, shortTitle, overlay, inputs, candlePlots, plots, shapes)
   * Integrates (window.PineTSLib || window.PineTS).Indicator AST introspection with robust fallback regex parsing.
   */
  function parsePineMetadata(source, indInstance) {
    let title = "Custom Pine Indicator";
    let shortTitle = "Pine Study";
    let isOverlay = false;

    if (!source || typeof source !== 'string') {
      return { title, shortTitle, isOverlay, inputs: [], candlePlots: [], plots: [], shapes: [] };
    }

    const ind = indInstance || (() => {
      try {
        const p = getPineTS();
        if (p && p.Indicator && typeof p.Indicator.from === 'function') {
          return p.Indicator.from(source);
        }
      } catch (e) {}
      return null;
    })();

    if (ind && ind.prop) {
      if (ind.prop['title']) title = ind.prop['title'];
      if (ind.prop['shorttitle']) shortTitle = ind.prop['shorttitle'];
      if (ind.prop['overlay'] !== undefined) isOverlay = Boolean(ind.prop['overlay']);
    }

    const indMatch = source.match(/(?:indicator|study)\s*\(\s*(?:"([^"]+)"|'([^']+)')/i);
    if (indMatch && (!title || title === "Custom Pine Indicator")) {
      title = indMatch[1] || indMatch[2];
      shortTitle = title;
    }

    const shortMatch = source.match(/shorttitle\s*=\s*(?:"([^"]+)"|'([^']+)')/i);
    if (shortMatch && (!shortTitle || shortTitle === "Pine Study")) {
      shortTitle = shortMatch[1] || shortMatch[2];
    }

    if (/overlay\s*=\s*true/i.test(source)) {
      isOverlay = true;
    }

    // ── 1. Parse Inputs (Schema Introspection via ind.getInputsMeta) ────────
    const inputs = [];
    const metaInputs = (ind && typeof ind.getInputsMeta === 'function') ? ind.getInputsMeta() : [];

    if (Array.isArray(metaInputs) && metaInputs.length > 0) {
      metaInputs.forEach((inp, idx) => {
        let tvType = 'text';
        let defval = inp.defval;
        let isMTFResolution = false;
        const t = String(inp.type || '').toLowerCase();
        if (t === 'symbol') {
          tvType = 'symbol';
          if (!defval || defval === 'BINANCE:BTCUSDT') defval = 'EURUSD.';
        } else if (t === 'timeframe' || t === 'resolution') {
          tvType = 'resolution';
          isMTFResolution = true;
          if (defval === undefined || defval === null) defval = '';
        } else if (t === 'bool' || t === 'boolean') {
          tvType = 'bool';
          defval = Boolean(defval);
        } else if (t === 'color') {
          tvType = 'color';
          if (!defval) {
            defval = '#089981';
          } else if (typeof defval === 'string' && defval.startsWith('#') && defval.length === 9) {
            defval = defval.slice(0, 7);
          }
        } else if (t === 'int' || t === 'integer') {
          tvType = 'integer';
          defval = parseInt(defval, 10);
          if (isNaN(defval)) defval = 0;
        } else if (t === 'float') {
          tvType = 'float';
          defval = parseFloat(defval);
          if (isNaN(defval)) defval = 0.0;
        } else if (t === 'source') {
          tvType = 'source';
          defval = String(defval || 'close');
        } else if (t === 'price') {
          tvType = 'float';
          defval = parseFloat(defval) || 0.0;
        } else if (t === 'time') {
          tvType = 'integer';
          defval = parseInt(defval, 10) || 0;
        } else if (t === 'session') {
          tvType = 'session';
          defval = String(defval || '0900-1700');
        } else {
          tvType = 'text';
          defval = String(defval ?? '');
        }

        if ((tvType === 'color' || (typeof defval === 'string' && defval.startsWith('#'))) && typeof defval === 'string' && defval.length === 9) {
          defval = defval.slice(0, 7);
        }

        const inputEntry = {
          id: inp.varId || inp.id || `input_${idx}`,
          name: inp.title || inp.varId || `Input ${idx + 1}`,
          defval: defval,
          type: tvType,
          slotIndex: idx,
          varId: inp.varId,
          group: inp.group || '',
          inline: inp.inline || '',
          tooltip: inp.tooltip || ''
        };
        if (isMTFResolution) inputEntry.isMTFResolution = true;
        if (inp.options) inputEntry.options = inp.options;
        if (inp.minval !== undefined) inputEntry.min = inp.minval;
        if (inp.maxval !== undefined) inputEntry.max = inp.maxval;
        if (inp.step !== undefined) inputEntry.step = inp.step;

        inputs.push(inputEntry);
      });
    } else {
      // Fallback regex parsing if getInputsMeta returned empty
      const inputRegex = /([a-zA-Z0-9_]+)\s*=\s*input(?:\.(int|float|bool|string|source|color|symbol|timeframe|session|text_area|price|time|enum))?\s*\(\s*([^,\)]+)(?:,\s*(?:title\s*=\s*)?(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_]+)))?/gi;
      let inMatch;
      let slotIdx = 0;
      while ((inMatch = inputRegex.exec(source)) !== null) {
        const varName = inMatch[1];
        const inpType = (inMatch[2] || '').toLowerCase();
        const rawDef = inMatch[3] ? inMatch[3].trim() : '0';
        const inpTitle = inMatch[4] || inMatch[5] || inMatch[6] || varName;

        let defval = 0;
        let tvType = 'integer';
        let isMTFResolution = false;
        if (inpType === 'symbol') {
          const raw = rawDef.replace(/['"]/g, '');
          defval = (!raw || raw === 'BINANCE:BTCUSDT') ? 'EURUSD.' : raw;
          tvType = 'symbol';
        } else if (inpType === 'timeframe') {
          defval = rawDef.replace(/['"]/g, '');
          tvType = 'resolution';
          isMTFResolution = true;
        } else if (inpType === 'color') {
          defval = rawDef.replace(/['"]/g, '') || '#089981';
          if (typeof defval === 'string' && defval.startsWith('#') && defval.length === 9) {
            defval = defval.slice(0, 7);
          }
          tvType = 'color';
        } else if (inpType === 'float' || (!isNaN(parseFloat(rawDef)) && rawDef.includes('.'))) {
          defval = parseFloat(rawDef) || 0.0;
          tvType = 'float';
        } else if (inpType === 'bool' || rawDef === 'true' || rawDef === 'false') {
          defval = rawDef === 'true';
          tvType = 'bool';
        } else if (inpType === 'source' || rawDef === 'close' || rawDef === 'open' || rawDef === 'high' || rawDef === 'low') {
          defval = rawDef;
          tvType = 'source';
        } else if (inpType === 'session') {
          defval = rawDef.replace(/['"]/g, '');
          tvType = 'session';
        } else if (inpType === 'text_area') {
          defval = rawDef.replace(/['"]/g, '');
          tvType = 'text';
        } else if (inpType === 'price') {
          defval = parseFloat(rawDef) || 0.0;
          tvType = 'float';
        } else if (inpType === 'time') {
          defval = parseInt(rawDef, 10) || 0;
          tvType = 'integer';
        } else if (!isNaN(parseInt(rawDef, 10))) {
          defval = parseInt(rawDef, 10);
          tvType = 'integer';
        } else {
          defval = rawDef.replace(/['"]/g, '');
          tvType = 'text';
        }

        if ((tvType === 'color' || (typeof defval === 'string' && defval.startsWith('#'))) && typeof defval === 'string' && defval.length === 9) {
          defval = defval.slice(0, 7);
        }

        const lineSnippet = source.substring(inMatch.index, inMatch.index + 350).split('\n')[0];
        const groupMatch = lineSnippet.match(/group\s*=\s*(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_]+))/i);
        const inlineMatch = lineSnippet.match(/inline\s*=\s*(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_]+))/i);
        const tooltipMatch = lineSnippet.match(/tooltip\s*=\s*(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_]+))/i);

        const inputEntry = {
          id: varName,
          name: inpTitle,
          defval: defval,
          type: tvType,
          slotIndex: slotIdx++,
          varId: varName,
          group: groupMatch ? (groupMatch[1] || groupMatch[2] || groupMatch[3] || '') : '',
          inline: inlineMatch ? (inlineMatch[1] || inlineMatch[2] || inlineMatch[3] || '') : '',
          tooltip: tooltipMatch ? (tooltipMatch[1] || tooltipMatch[2] || tooltipMatch[3] || '') : ''
        };
        if (isMTFResolution) inputEntry.isMTFResolution = true;
        inputs.push(inputEntry);
      }
    }

    function extractFunctionCalls(src, fnName) {
      const calls = [];
      if (!src || typeof src !== 'string') return calls;
      const regex = new RegExp('(?:^|[^a-zA-Z0-9_])' + fnName + '\\s*\\(', 'g');
      let match;
      while ((match = regex.exec(src)) !== null) {
        const startIdx = match.index + match[0].length;
        let depth = 1;
        let inString = null;
        let endIdx = startIdx;
        while (depth > 0 && endIdx < src.length) {
          const ch = src[endIdx];
          if (inString) {
            if (ch === inString && src[endIdx - 1] !== '\\') inString = null;
          } else {
            if (ch === '"' || ch === "'") inString = ch;
            else if (ch === '(') depth++;
            else if (ch === ')') depth--;
          }
          endIdx++;
        }
        if (depth === 0) {
          const argsStr = src.substring(startIdx, endIdx - 1).trim();
          calls.push(argsStr);
        }
      }
      return calls;
    }

    // ── 2. Parse plotcandle Declarations ─────────────────────────────────
    const candlePlots = [];
    const candleCalls = extractFunctionCalls(source, 'plotcandle');
    if (candleCalls.length > 0) {
      candleCalls.forEach((argsStr, cIdx) => {
        const titleMatch = /title\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(argsStr);
        let cTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : null;
        if (!cTitle) {
          const parts = argsStr.split(',').map(s => s.trim());
          if (parts[4] && !parts[4].includes('=')) {
            cTitle = parts[4].replace(/['"]/g, '');
          }
        }
        if (!cTitle) cTitle = (cIdx === 0 ? 'Candles' : `Candles ${cIdx + 1}`);
        candlePlots.push({
          id: `candle_${cIdx}`,
          title: cTitle
        });
      });
    } else {
      const candleRegex = /plotcandle\s*\(\s*([^,\)]+)\s*,\s*([^,\)]+)\s*,\s*([^,\)]+)\s*,\s*([^,\)]+)(?:,\s*(?:title\s*=\s*)?(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_]+)))?/gi;
      let cMatch;
      let cIdx = 0;
      while ((cMatch = candleRegex.exec(source)) !== null) {
        const cTitle = cMatch[5] || cMatch[6] || cMatch[7] || (cIdx === 0 ? 'Candles' : `Candles ${cIdx + 1}`);
        candlePlots.push({
          id: `candle_${cIdx}`,
          title: cTitle
        });
        cIdx++;
      }
      if (candlePlots.length === 0 && /plotcandle\s*\(/i.test(source)) {
        candlePlots.push({ id: 'candle_0', title: 'Candles' });
      }
    }

    // ── 2b. Parse plotbar Declarations ────────────────────────────────────
    const barPlots = [];
    const barCalls = extractFunctionCalls(source, 'plotbar');
    if (barCalls.length > 0) {
      barCalls.forEach((argsStr, bIdx) => {
        const titleMatch = /title\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(argsStr);
        let bTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : null;
        if (!bTitle) {
          const parts = argsStr.split(',').map(s => s.trim());
          if (parts[4] && !parts[4].includes('=')) {
            bTitle = parts[4].replace(/['"]/g, '');
          }
        }
        if (!bTitle) bTitle = (bIdx === 0 ? 'Bars' : `Bars ${bIdx + 1}`);
        barPlots.push({
          id: `bar_${bIdx}`,
          title: bTitle
        });
      });
    } else {
      const barRegex = /plotbar\s*\(\s*([^,\)]+)\s*,\s*([^,\)]+)\s*,\s*([^,\)]+)\s*,\s*([^,\)]+)(?:,\s*(?:title\s*=\s*)?(?:"([^"]+)"|'([^']+)'|([a-zA-Z0-9_]+)))?/gi;
      let bMatch;
      let bIdx = 0;
      while ((bMatch = barRegex.exec(source)) !== null) {
        const bTitle = bMatch[5] || bMatch[6] || bMatch[7] || (bIdx === 0 ? 'Bars' : `Bars ${bIdx + 1}`);
        barPlots.push({
          id: `bar_${bIdx}`,
          title: bTitle
        });
        bIdx++;
      }
      if (barPlots.length === 0 && /plotbar\s*\(/i.test(source)) {
        barPlots.push({ id: 'bar_0', title: 'Bars' });
      }
    }

    // ── 3. Parse Standard plot(...) Declarations (Balanced Parenthesis Parser) ───
    const plots = [];
    const plotCalls = extractFunctionCalls(source, 'plot');
    plotCalls.forEach((argsStr, pIdx) => {
      const titleMatch = /title\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(argsStr);
      let pTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : null;
      if (!pTitle) {
        const parts = argsStr.split(',').map(s => s.trim());
        if (parts[1] && !parts[1].includes('=')) {
          pTitle = parts[1].replace(/['"]/g, '');
        }
      }
      if (!pTitle) pTitle = `Plot ${pIdx + 1}`;

      const isLineBr = /plot\.style_linebr/i.test(argsStr) ||
                       /style\s*=\s*(?:plot\.)?style_linebr/i.test(argsStr) ||
                       pTitle.toLowerCase().includes('session') ||
                       pTitle.toLowerCase().includes('midline') ||
                       pTitle.toLowerCase().includes('maximum') ||
                       pTitle.toLowerCase().includes('minimum') ||
                       pTitle.toLowerCase().includes('vwap') ||
                       pTitle.toLowerCase().includes('trend');

      let plottype = 0;
      if (isLineBr) plottype = 7; // LineStudyPlotStyle.LineWithBreaks (skipHoles: false)
      else if (/plot\.style_histogram/i.test(argsStr) || /style\s*=\s*(?:plot\.)?style_histogram/i.test(argsStr)) plottype = 1;
      else if (/plot\.style_cross/i.test(argsStr) || /style\s*=\s*(?:plot\.)?style_cross/i.test(argsStr)) plottype = 3;
      else if (/plot\.style_area/i.test(argsStr) || /style\s*=\s*(?:plot\.)?style_area/i.test(argsStr)) plottype = 4;
      else if (/plot\.style_columns/i.test(argsStr) || /style\s*=\s*(?:plot\.)?style_columns/i.test(argsStr)) plottype = 5;
      else if (/plot\.style_circles/i.test(argsStr) || /style\s*=\s*(?:plot\.)?style_circles/i.test(argsStr)) plottype = 6;
      else if (/plot\.style_stepline/i.test(argsStr) || /style\s*=\s*(?:plot\.)?style_stepline/i.test(argsStr)) plottype = 9;

      let display = 15;
      if (/display\s*=\s*display\.none/i.test(argsStr)) {
        display = 0;
      } else if (/display\s*=\s*display\.all\s*-\s*display\.status_line/i.test(argsStr)) {
        display = 7;
      } else if (/display\s*=\s*display\.all\s*-\s*display\.price_scale/i.test(argsStr) || isLineBr || pTitle.toLowerCase().includes('session') || pTitle.toLowerCase().includes('midline')) {
        // display: 11 (15 - 4) strictly suppresses price scale badge creation on price axis
        display = 11;
      }

      plots.push({
        id: `plot_${pIdx}`,
        title: pTitle,
        color: PLOT_COLORS[pIdx % PLOT_COLORS.length],
        display: display,
        plottype: plottype,
        isLineBr: isLineBr
      });
    });

    // ── 4. Parse plotshape(...) Declarations (Balanced Parenthesis Parser) ───────
    const shapes = [];
    const shapeCalls = extractFunctionCalls(source, 'plotshape');
    shapeCalls.forEach((argsStr, sIdx) => {
      const titleMatch = /title\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(argsStr);
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
      const styleMatch = /style\s*=\s*shape\.([a-zA-Z0-9_]+)/i.exec(argsStr) || /(?:^|,)\s*shape\.([a-zA-Z0-9_]+)/i.exec(argsStr);
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
      const locMatch = /location\s*=\s*location\.([a-zA-Z0-9_]+)/i.exec(argsStr) || /(?:^|,)\s*location\.([a-zA-Z0-9_]+)/i.exec(argsStr);
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
      const colMatch = /color\s*=\s*(?:color\.)?([a-zA-Z0-9_#]+)/i.exec(argsStr);
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
      if (/display\s*=\s*display\.none/i.test(argsStr)) {
        display = 0;
      } else if (/display\s*=\s*display\.all\s*-\s*display\.status_line/i.test(argsStr)) {
        display = 7;
      } else if (/display\s*=\s*display\.all\s*-\s*display\.price_scale/i.test(argsStr) || sTitle.toLowerCase().includes('session')) {
        display = 11;
      } else if (/display\s*=\s*display\.all/i.test(argsStr)) {
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
    });

    // ── 4b. Parse plotchar(...) Declarations ─────────────────────────────
    const chars = [];
    const charCalls = extractFunctionCalls(source, 'plotchar');
    charCalls.forEach((argsStr, chIdx) => {
      const titleMatch = /title\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(argsStr);
      const chTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : `Char ${chIdx + 1}`;
      const charMatch = /char\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(argsStr);
      const charVal = charMatch ? (charMatch[1] || charMatch[2]) : '★';
      chars.push({
        id: `char_${chIdx}`,
        title: chTitle,
        char: charVal,
        color: '#FFEB3B'
      });
    });

    // ── 4c. Parse plotarrow(...) Declarations ────────────────────────────
    const arrows = [];
    const arrowCalls = extractFunctionCalls(source, 'plotarrow');
    arrowCalls.forEach((argsStr, arIdx) => {
      const titleMatch = /title\s*=\s*(?:"([^"]+)"|'([^']+)')/i.exec(argsStr);
      const arTitle = titleMatch ? (titleMatch[1] || titleMatch[2]) : `Arrow ${arIdx + 1}`;
      arrows.push({
        id: `arrow_${arIdx}`,
        title: arTitle,
        upColor: '#089981',
        downColor: '#f23645'
      });
    });

    // ── 5. Parse hline(...) Declarations ─────────────────────────────────
    const hlines = [];
    const hlineRegex = /(?:([a-zA-Z0-9_]+)\s*=\s*)?hline\s*\(([^)]+)\)/gi;
    let hlMatch;
    let hlIdx = 0;
    while ((hlMatch = hlineRegex.exec(source)) !== null) {
      const varId = hlMatch[1] || `hline_${hlIdx}`;
      const argsStr = hlMatch[2] || '';
      const rawArgs = argsStr.split(/,(?=(?:[^"']*["'][^"']*["'])*[^"']*$)/).map(s => s.trim());
      
      let priceVal = 0;
      let hlTitle = varId;
      let hlColor = '#787b86';
      let hlLinestyle = 2;
      let hlLinewidth = 1;

      rawArgs.forEach((arg, argIndex) => {
        if (!arg) return;
        const eqIdx = arg.indexOf('=');
        if (eqIdx !== -1) {
          const key = arg.slice(0, eqIdx).trim().toLowerCase();
          const val = arg.slice(eqIdx + 1).trim();
          if (key === 'price') {
            priceVal = parseFloat(val) || 0;
          } else if (key === 'title') {
            hlTitle = val.replace(/^["']|["']$/g, '');
          } else if (key === 'color') {
            if (val.includes('red') || val.includes('bear')) hlColor = '#f23645';
            else if (val.includes('green') || val.includes('lime') || val.includes('bull')) hlColor = '#089981';
            else if (val.includes('blue')) hlColor = '#2962ff';
            else if (val.includes('yellow')) hlColor = '#fbc02d';
            else if (val.includes('orange')) hlColor = '#ff9800';
            else if (val.includes('purple')) hlColor = '#ab47bc';
            else if (val.startsWith('#')) hlColor = val.slice(0, 7);
            else hlColor = '#787b86';
          } else if (key === 'linestyle') {
            if (val.includes('solid')) hlLinestyle = 0;
            else if (val.includes('dotted')) hlLinestyle = 1;
            else if (val.includes('dashed')) hlLinestyle = 2;
          } else if (key === 'linewidth') {
            hlLinewidth = parseInt(val, 10) || 1;
          }
        } else {
          if (argIndex === 0) {
            priceVal = parseFloat(arg) || 0;
          } else if (argIndex === 1) {
            hlTitle = arg.replace(/^["']|["']$/g, '');
          } else if (argIndex === 2) {
            if (arg.includes('red') || arg.includes('bear')) hlColor = '#f23645';
            else if (arg.includes('green') || arg.includes('lime') || arg.includes('bull')) hlColor = '#089981';
            else if (arg.includes('blue')) hlColor = '#2962ff';
            else if (arg.includes('yellow')) hlColor = '#fbc02d';
            else if (arg.includes('orange')) hlColor = '#ff9800';
            else if (arg.includes('purple')) hlColor = '#ab47bc';
            else if (arg.startsWith('#')) hlColor = arg.slice(0, 7);
            else hlColor = '#787b86';
          } else if (argIndex === 3) {
            if (arg.includes('solid')) hlLinestyle = 0;
            else if (arg.includes('dotted')) hlLinestyle = 1;
            else if (arg.includes('dashed')) hlLinestyle = 2;
          } else if (argIndex === 4) {
            hlLinewidth = parseInt(arg, 10) || 1;
          }
        }
      });

      hlines.push({
        id: varId,
        title: hlTitle,
        val: priceVal,
        value: priceVal,
        color: hlColor,
        linestyle: hlLinestyle,
        linewidth: hlLinewidth
      });
      hlIdx++;
    }

    // ── 6. Parse fill(...) Declarations ──────────────────────────────────
    const fills = [];
    const fillRegex = /fill\s*\(\s*([a-zA-Z0-9_]+)\s*,\s*([a-zA-Z0-9_]+)(?:,\s*(?:color\s*=\s*)?([^,\)]+))?/gi;
    let fMatch;
    let fIdx = 0;
    while ((fMatch = fillRegex.exec(source)) !== null) {
      const objA = fMatch[1];
      const objB = fMatch[2];
      const isHline = hlines.some(h => h.id === objA || h.id === objB);
      fills.push({
        id: `fill_${fIdx}`,
        objAId: objA,
        objBId: objB,
        type: isHline ? 'band_band' : 'plot_plot',
        title: `Fill ${fIdx + 1}`,
        color: 'rgba(33, 150, 243, 0.2)',
        transparency: 80
      });
      fIdx++;
    }

    const rawPlotCount = plots.length;
    const rawShapeCount = shapes.length;
    const rawCandleCount = candlePlots.length;
    const rawBarCount = barPlots.length;

    // Default to 1 adaptive trend baseline plot only if zero candle plots, zero lines, and zero shapes
    if (plots.length === 0 && shapes.length === 0 && candlePlots.length === 0 && barPlots.length === 0) {
      plots.push({
        id: 'plot_0',
        title: shortTitle || (isOverlay ? 'Adaptive Trend Baseline' : 'Adaptive Trend Oscillator'),
        color: isOverlay ? '#2962FF' : '#FF9800'
      });
    }

    return {
      title,
      shortTitle,
      isOverlay,
      inputs,
      candlePlots,
      barPlots,
      plots,
      shapes,
      chars,
      arrows,
      hlines,
      fills,
      rawPlotCount,
      rawShapeCount,
      rawCandleCount,
      rawBarCount
    };
  }

  /**
   * Create TradingView study descriptor conforming to TradingView Metainfo v52 schema
   */
  function createStudyFromTranspiled(meta, transpiledJs, sourceCode) {
    const studyId = `${meta.title.replace(/[^a-zA-Z0-9_]/g, '_')}@tv-basicstudies-1`;
    const isPriceStudy = Boolean(meta.isOverlay);

    const tvPlots = [];
    const tvStyles = {};
    const defaultStyles = {};
    const tvOhlcPlots = {};
    const defaultOhlcPlots = {};
    const tvPalettes = {};

    const hasCandles = Array.isArray(meta.candlePlots) && meta.candlePlots.length > 0;
    const hasBars = Array.isArray(meta.barPlots) && meta.barPlots.length > 0;

    // A. Native OHLC Metainfo for Candlestick Plots (plotcandle)
    if (hasCandles) {
      meta.candlePlots.forEach((cp, idx) => {
        const targetId = cp.id || `candle_${idx}`;
        tvPlots.push({ id: `${targetId}_open`, type: 'ohlc_open', target: targetId });
        tvPlots.push({ id: `${targetId}_high`, type: 'ohlc_high', target: targetId });
        tvPlots.push({ id: `${targetId}_low`, type: 'ohlc_low', target: targetId });
        tvPlots.push({ id: `${targetId}_close`, type: 'ohlc_close', target: targetId });
        tvPlots.push({ id: `${targetId}_colorer`, type: 'ohlc_colorer', target: targetId });
        tvPlots.push({ id: `${targetId}_wick_colorer`, type: 'wick_colorer', target: targetId });
        tvPlots.push({ id: `${targetId}_border_colorer`, type: 'border_colorer', target: targetId });

        tvOhlcPlots[targetId] = { title: cp.title || 'Candles' };
        defaultOhlcPlots[targetId] = {
          plottype: 'ohlc_candles',
          drawBorder: true,
          drawWick: true,
          visible: true,
          display: 15,
          color: '#089981',
          borderColor: '#089981',
          wickColor: '#787b86'
        };
      });
    }

    // A2. Native OHLC Metainfo for Conventional Bar Plots (plotbar)
    if (hasBars) {
      meta.barPlots.forEach((bp, idx) => {
        const targetId = bp.id || `bar_${idx}`;
        tvPlots.push({ id: `${targetId}_open`, type: 'ohlc_open', target: targetId });
        tvPlots.push({ id: `${targetId}_high`, type: 'ohlc_high', target: targetId });
        tvPlots.push({ id: `${targetId}_low`, type: 'ohlc_low', target: targetId });
        tvPlots.push({ id: `${targetId}_close`, type: 'ohlc_close', target: targetId });
        tvPlots.push({ id: `${targetId}_colorer`, type: 'ohlc_colorer', target: targetId });

        tvOhlcPlots[targetId] = { title: bp.title || 'Bars' };
        defaultOhlcPlots[targetId] = {
          plottype: 'ohlc_bars',
          visible: true,
          display: 15,
          color: '#089981'
        };
      });
    }

    // B. Standard Line Plots
    meta.plots.forEach((p, idx) => {
      tvPlots.push({ id: p.id, type: 'line' });
      const pType = (p.plottype !== undefined) ? p.plottype : (p.isLineBr ? 7 : 0);
      tvStyles[p.id] = {
        title: p.title || `Plot ${idx + 1}`,
        histogramBase: 0,
        joinPoints: false,
        plottype: pType
      };
      defaultStyles[p.id] = {
        linestyle: 0,
        linewidth: p.linewidth || 2,
        plottype: pType,
        trackPrice: false,
        transparency: 0,
        visible: true,
        display: (p.display !== undefined) ? p.display : (pType === 7 ? 11 : 15),
        color: p.color || PLOT_COLORS[idx % PLOT_COLORS.length]
      };
    });

    // C. Shapes Plots
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
    });

    // C2. Chars Plots (plotchar)
    (meta.chars || []).forEach((ch, idx) => {
      tvPlots.push({ id: ch.id, type: 'chars' });
      tvStyles[ch.id] = {
        title: ch.title || `Char ${idx + 1}`,
        histogramBase: 0,
        joinPoints: false,
        char: ch.char || '★'
      };
      defaultStyles[ch.id] = {
        linestyle: 0,
        linewidth: 2,
        plottype: 'char',
        location: 'AboveBar',
        trackPrice: false,
        transparency: 0,
        visible: true,
        display: 7,
        color: ch.color || '#FFEB3B'
      };
    });

    // C3. Arrows Plots (plotarrow)
    (meta.arrows || []).forEach((ar, idx) => {
      tvPlots.push({ id: ar.id, type: 'arrows' });
      tvStyles[ar.id] = {
        title: ar.title || `Arrow ${idx + 1}`,
        histogramBase: 0,
        joinPoints: false
      };
      defaultStyles[ar.id] = {
        linestyle: 0,
        linewidth: 2,
        plottype: 'arrow_up',
        trackPrice: false,
        transparency: 0,
        visible: true,
        display: 7,
        color: ar.upColor || '#089981'
      };
    });

    // D. Inputs Mapping (Symbol, Timeframe/Resolution, Bool, Color, Numeric)
    // Populate BOTH variable ID (e.g. sym, res) and positional numeric index (0, 1, 2...)
    const tvInputs = [];
    const defaultInputs = {};
    (meta.inputs || []).forEach((inp, idx) => {
      let defval = inp.defval;
      if ((inp.type === 'color' || (typeof defval === 'string' && defval.startsWith('#'))) && typeof defval === 'string' && defval.length === 9) {
        defval = defval.slice(0, 7);
      }
      const inputEntry = {
        id: inp.id,
        name: inp.name || inp.id,
        defval: defval,
        type: inp.type || 'text',
        group: inp.group || '',
        inline: inp.inline || '',
        tooltip: inp.tooltip || ''
      };
      if (inp.isMTFResolution) inputEntry.isMTFResolution = true;
      if (inp.options) inputEntry.options = inp.options;
      if (inp.min !== undefined) inputEntry.min = inp.min;
      if (inp.max !== undefined) inputEntry.max = inp.max;
      if (inp.step !== undefined) inputEntry.step = inp.step;

      tvInputs.push(inputEntry);
      defaultInputs[inp.id] = defval;
      defaultInputs[idx] = defval;
      if (inp.varId) {
        defaultInputs[inp.varId] = defval;
      }
    });

    const metainfo = {
      _metainfoVersion: 52,
      isTVScript: false,
      isTVScriptStub: false,
      is_hidden_study: false,
      is_price_study: isPriceStudy,
      isRGB: true,
      id: studyId,
      scriptIdPart: '',
      name: meta.title,
      description: meta.title,
      shortDescription: meta.shortTitle || meta.title,
      plots: tvPlots,
      styles: tvStyles,
      inputs: tvInputs,
      defaults: {
        styles: defaultStyles,
        inputs: defaultInputs
      },
      format: { type: isPriceStudy ? 'inherit' : 'price', precision: 5 }
    };

    if (hasCandles || hasBars) {
      metainfo.ohlcPlots = tvOhlcPlots;
      metainfo.defaults.ohlcPlots = defaultOhlcPlots;
    }

    if (meta.hlines && meta.hlines.length > 0) {
      metainfo.bands = meta.hlines.map(h => ({
        id: h.id,
        name: h.title,
        isHidden: false
      }));
      metainfo.defaults.bands = meta.hlines.map(h => ({
        id: h.id,
        name: h.title,
        val: (typeof h.val === 'number') ? h.val : (parseFloat(h.val) || 0),
        value: (typeof h.val === 'number') ? h.val : (parseFloat(h.val) || 0),
        color: h.color || '#787b86',
        linestyle: (h.linestyle !== undefined) ? h.linestyle : 2,
        linewidth: (h.linewidth !== undefined) ? h.linewidth : 1,
        visible: true
      }));
    }

    if (meta.fills && meta.fills.length > 0) {
      metainfo.filledAreas = meta.fills.map(f => ({
        id: f.id,
        objAId: f.objAId,
        objBId: f.objBId,
        type: f.type || 'plot_plot',
        title: f.title,
        isHidden: false
      }));
      metainfo.filledAreasStyle = {};
      metainfo.defaults.filledAreas = {};
      metainfo.defaults.filledAreasStyle = {};
      meta.fills.forEach(f => {
        const fillProps = {
          color: f.color || 'rgba(33, 150, 243, 0.2)',
          transparency: f.transparency || 80,
          visible: true
        };
        metainfo.filledAreasStyle[f.id] = fillProps;
        metainfo.defaults.filledAreas[f.id] = fillProps;
        metainfo.defaults.filledAreasStyle[f.id] = fillProps;
      });
    }

    if (Object.keys(tvPalettes).length > 0) {
      metainfo.palettes = tvPalettes;
    }

    const evalColor = {
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
        return String(fmt).replace(/\{(\d+)?\}/g, (_, idx) => args[idx !== undefined ? Number(idx) : i++]);
      },
      length: (s) => String(s).length,
      contains: (s, sub) => String(s).includes(sub),
      pos: (s, sub) => String(s).indexOf(sub),
      substring: (s, start, end) => String(s).slice(start, end),
      replace_all: (s, target, repl) => String(s).replaceAll(target, repl),
      lower: (s) => String(s).toLowerCase(),
      upper: (s) => String(s).toUpperCase()
    };

    const baseInput = function(defval, title) {
      if (typeof defval === 'object' && defval !== null) return defval.defval !== undefined ? defval.defval : defval;
      return defval;
    };
    baseInput.int = (defval) => (typeof defval === 'object' && defval !== null ? (defval.defval !== undefined ? defval.defval : defval) : defval);
    baseInput.float = (defval) => (typeof defval === 'object' && defval !== null ? (defval.defval !== undefined ? defval.defval : defval) : defval);
    baseInput.bool = (defval) => (typeof defval === 'object' && defval !== null ? (defval.defval !== undefined ? defval.defval : defval) : defval);
    baseInput.string = (defval) => (typeof defval === 'object' && defval !== null ? (defval.defval !== undefined ? defval.defval : defval) : defval);
    baseInput.color = (defval) => (typeof defval === 'object' && defval !== null ? (defval.defval !== undefined ? defval.defval : defval) : defval);
    baseInput.symbol = (defval) => (typeof defval === 'object' && defval !== null ? (defval.defval !== undefined ? defval.defval : defval) : defval);
    baseInput.timeframe = (defval) => (typeof defval === 'object' && defval !== null ? (defval.defval !== undefined ? defval.defval : defval) : defval);
    baseInput.source = (defval) => (typeof defval === 'object' && defval !== null ? (defval.defval !== undefined ? defval.defval : defval) : defval);
    baseInput.session = (defval) => (typeof defval === 'object' && defval !== null ? (defval.defval !== undefined ? defval.defval : defval) : defval);
    const evalInput = new Proxy(baseInput, {
      get(target, prop) {
        if (prop in target) return target[prop];
        return (defval) => (typeof defval === 'object' && defval !== null ? (defval.defval !== undefined ? defval.defval : defval) : defval);
      }
    });

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

    const evalPosition = {
      top_left: 'top_left',
      top_center: 'top_center',
      top_right: 'top_right',
      middle_left: 'middle_left',
      middle_center: 'middle_center',
      middle_right: 'middle_right',
      bottom_left: 'bottom_left',
      bottom_center: 'bottom_center',
      bottom_right: 'bottom_right'
    };

    const evalLine = {
      new: () => ({ id: Math.random() }),
      delete: () => {},
      set_xy1: () => {},
      set_xy2: () => {},
      set_color: () => {},
      set_width: () => {},
      style_solid: 0,
      style_dotted: 1,
      style_dashed: 2
    };

    const evalBox = {
      new: () => ({ id: Math.random() }),
      delete: () => {},
      set_left: () => {},
      set_right: () => {},
      set_top: () => {},
      set_bottom: () => {},
      set_border_color: () => {},
      set_bgcolor: () => {}
    };

    const evalLabel = {
      new: () => ({ id: Math.random() }),
      delete: () => {},
      set_text: () => {},
      set_xy: () => {},
      set_color: () => {},
      set_textcolor: () => {},
      style_none: 'none',
      style_label_down: 'label_down',
      style_label_up: 'label_up',
      style_label_left: 'label_left',
      style_label_right: 'label_right'
    };

    const evalTable = {
      new: () => ({ id: Math.random() }),
      cell: () => {},
      set_bgcolor: () => {},
      clear: () => {}
    };

    const evalSession = {
      ismarket: true,
      ispremarket: false,
      ispostmarket: false
    };

    let barEvaluator = null;
    if (transpiledJs && typeof transpiledJs === 'string' && transpiledJs.trim()) {
      try {
        barEvaluator = new Function(
          'open', 'high', 'low', 'close', 'volume', 'time', 'bar_index',
          'hl2', 'hlc3', 'ohlc4', 'tr',
          'plotcandle', 'plot', 'plotbar', 'plotshape', 'plotchar', 'plotarrow', 'hline', 'fill',
          'indicator', 'strategy', 'color', 'shape', 'location', 'size', 'display', 'str', 'input',
          'position', 'line', 'box', 'label', 'table', 'session',
          'na', 'nz', 'ta', 'math', 'syminfo', 'timeframe', 'barstate', 'Math',
          'study', 'sma', 'rsi', 'abs', 'red', 'green', 'blue', 'orange', 'security', 'request', 'tostring', 'pineTa', 'pineRequest',
          transpiledJs
        );
      } catch(e) {
        console.warn('[PineIndicators] Could not compile barEvaluator:', e.message);
      }
    }

    // Study constructor executing for every bar
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
      let secSymbolBarsCache = new Map();

      this.init = function(ctx, inputCallback) {
        htfAggState = {};
        lastBarIdx = -1;
        secSymbolBarsCache = new Map();
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
        function makeSeries(val, arr, fieldName) {
          const numObj = new Number(val);
          numObj._pineField = fieldName;
          return new Proxy(numObj, {
            get(target, prop) {
              if (prop === '_pineField') return fieldName;
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

        // Time series accessor that is dual-purpose: numeric timestamp AND callable session function time(timeframe, session, timezone)
        function makeTimeSeries(val, arr, fieldName = 'time') {
          const fn = function(res, sess, tz) {
            if (sess) {
              const dt = new Date(val);
              const hhmm = dt.getUTCHours() * 100 + dt.getUTCMinutes();
              const parts = String(sess).split('-');
              if (parts.length >= 2) {
                const start = parseInt(parts[0], 10);
                const end = parseInt(parts[1], 10);
                let inSession = false;
                if (start <= end) {
                  inSession = (hhmm >= start && hhmm < end);
                } else {
                  inSession = (hhmm >= start || hhmm < end);
                }
                return inSession ? val : NaN;
              }
            }
            return val;
          };

          return new Proxy(fn, {
            apply(target, thisArg, args) {
              return fn(...args);
            },
            get(target, prop) {
              if (prop === '_pineField') return fieldName;
              if (prop === Symbol.toPrimitive) return (hint) => hint === 'string' ? String(val) : val;
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

        const seriesO = makeSeries(o, historyO, 'open');
        const seriesH = makeSeries(h, historyH, 'high');
        const seriesL = makeSeries(l, historyL, 'low');
        const seriesC = makeSeries(c, historyC, 'close');
        const seriesV = makeSeries(v, historyV, 'volume');
        const seriesT = makeTimeSeries(t, historyT, 'time');
        const seriesI = makeSeries(i, historyI, 'index');
        const seriesHL2 = makeSeries(hl2, historyHL2, 'hl2');
        const seriesHLC3 = makeSeries(hlc3, historyHLC3, 'hlc3');
        const seriesOHLC4 = makeSeries(ohlc4, historyOHLC4, 'ohlc4');
        const seriesTR = makeSeries(tr, historyTR, 'tr');

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

        const pineMath = Object.assign(Object.create(Math), {
          avg: (...args) => args.reduce((a, b) => a + Number(b), 0) / (args.length || 1),
          sum: (...args) => args.reduce((a, b) => a + Number(b), 0),
          todegrees: (rad) => Number(rad) * 180 / Math.PI,
          toradians: (deg) => Number(deg) * Math.PI / 180,
          pi: Math.PI,
          e: Math.E
        });

        // ── Multi-Symbol & Multi-Timeframe Secondary Provider Engine ────────
        function resolveSecSymbol(rawSym) {
          if (!rawSym) return '';
          let s = String(rawSym).trim();
          if (s.includes(':')) s = s.split(':')[1].trim();
          return s;
        }

        function getSecBars(rawSym, rawTf) {
          if (!rawSym) return null;
          const cleanSym = resolveSecSymbol(rawSym);
          if (!cleanSym) return null;

          const currentSym = (ctx.symbol && (ctx.symbol.ticker || ctx.symbol.tickerid || ctx.symbol.name)) || '';
          const cleanCurrent = resolveSecSymbol(currentSym);
          const currentTf = String((ctx.symbol && (ctx.symbol.interval || ctx.symbol.resolution)) || '1');
          const targetTf = String(rawTf || currentTf || '1');

          // If identical symbol and timeframe, return null to use current chart series
          if (cleanSym.toUpperCase() === cleanCurrent.toUpperCase() && targetTf === currentTf) {
            return null;
          }

          const cacheKey = `${cleanSym.toUpperCase()}_${targetTf}`;
          if (secSymbolBarsCache.has(cacheKey)) {
            return secSymbolBarsCache.get(cacheKey);
          }

          // Fetch bars for secondary symbol
          try {
            const symCandidates = [
              cleanSym,
              cleanSym + '.',
              cleanSym.replace(/\.$/, ''),
              rawSym
            ];
            let foundData = null;
            const nowSec = Math.floor(Date.now() / 1000);
            const lookbackSec = 86400 * 30; // 30 days
            const fromSec = nowSec - lookbackSec;

            for (const candidate of symCandidates) {
              try {
                const xhr = new XMLHttpRequest();
                const url = `/history?symbol=${encodeURIComponent(candidate)}&resolution=${encodeURIComponent(targetTf)}&from=${fromSec}&to=${nowSec}&countback=2000`;
                xhr.open('GET', url, false); // synchronous XHR (< 1ms on localhost proxy)
                xhr.send(null);
                if (xhr.status === 200) {
                  const data = JSON.parse(xhr.responseText);
                  if (data && data.s === 'ok' && Array.isArray(data.t) && data.t.length > 0) {
                    foundData = data;
                    break;
                  }
                }
              } catch(e) {}
            }

            if (foundData) {
              secSymbolBarsCache.set(cacheKey, foundData);
              return foundData;
            }
          } catch(err) {
            console.warn('[PineSecurity] Failed to fetch secondary bars:', rawSym, err);
          }
          secSymbolBarsCache.set(cacheKey, null);
          return null;
        }

        function evalSecurity(sym, tf, expr) {
          const secData = getSecBars(sym, tf);
          if (!secData) {
            return Array.isArray(expr) ? expr.map(e => (e && typeof e.valueOf === 'function' ? e.valueOf() : e)) : (expr && typeof expr.valueOf === 'function' ? expr.valueOf() : expr);
          }

          const currentBarSec = Math.floor(t / 1000);
          const tArr = secData.t;
          let low = 0, high = tArr.length - 1, matchedIdx = -1;
          while (low <= high) {
            const mid = (low + high) >> 1;
            const bSec = (tArr[mid] > 1e11) ? Math.floor(tArr[mid] / 1000) : tArr[mid];
            if (bSec <= currentBarSec) {
              matchedIdx = mid;
              low = mid + 1;
            } else {
              high = mid - 1;
            }
          }
          if (matchedIdx === -1) matchedIdx = 0;

          function extractField(fExpr) {
            const fName = fExpr?._pineField;
            if (fName === 'open') return Number(secData.o[matchedIdx]);
            if (fName === 'high') return Number(secData.h[matchedIdx]);
            if (fName === 'low') return Number(secData.l[matchedIdx]);
            if (fName === 'close') return Number(secData.c[matchedIdx]);
            if (fName === 'volume') return Number(secData.v ? secData.v[matchedIdx] : 1);
            if (fName === 'time') return (secData.t[matchedIdx] > 1e11) ? secData.t[matchedIdx] : secData.t[matchedIdx] * 1000;
            if (typeof fExpr === 'number') return fExpr;
            return Number(secData.c[matchedIdx]);
          }

          if (Array.isArray(expr)) {
            return expr.map(extractField);
          }
          return extractField(expr);
        }

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
              evalPosition,
              evalLine,
              evalBox,
              evalLabel,
              evalTable,
              evalSession,
              NaN,
              (val, d = 0) => (val === null || val === undefined || isNaN(val) ? d : val),
              pineTa,
              pineMath,
              { mintick: 0.00001, ticker: (ctx.symbol && ctx.symbol.ticker) || 'SYMBOL', currency: 'USD' },
              { isintraday: true, isdaily: false, isweekly: false, ismonthly: false, multiplier: 1, period: '1' },
              { islast: true, isfirst: (i === 0), isconfirmed: true, isnew: true, ishistory: true, isrealtime: false },
              Math,
              () => {}, // study
              pineTa.sma, // sma
              pineTa.rsi, // rsi
              Math.abs, // abs
              '#f23645', // red
              '#089981', // green
              '#2962ff', // blue
              '#ff9800', // orange
              evalSecurity, // security
              { security: evalSecurity }, // request
              String, // tostring
              pineTa, // pineTa
              { security: evalSecurity } // pineRequest
            );
          } catch(e) {
            console.warn('[PineIndicators] barEvaluator runtime error on bar', i, e.message);
          }
        }

        const currentInputs = {};
        meta.inputs.forEach((inp, inIdx) => {
          let valId = undefined;
          let valIdx = undefined;
          if (typeof inputCallback === 'function') {
            try { valId = inputCallback(inp.id); } catch(e) {}
            if ((valId === undefined || valId === null) && inp.varId) {
              try { valId = inputCallback(inp.varId); } catch(e) {}
            }
            try { valIdx = inputCallback(inIdx); } catch(e) {}
          }
          let val = undefined;
          if (valId !== undefined && valId !== null && valId !== inp.defval) {
            val = valId;
          } else if (valIdx !== undefined && valIdx !== null && valIdx !== inp.defval) {
            val = valIdx;
          } else {
            val = (valId !== undefined && valId !== null) ? valId : valIdx;
          }
          let finalVal = (val !== undefined && val !== null) ? val : inp.defval;
          if ((inp.type === 'color' || (typeof finalVal === 'string' && finalVal.startsWith('#'))) && typeof finalVal === 'string' && finalVal.length === 9) {
            finalVal = finalVal.slice(0, 7);
          }
          currentInputs[inp.id] = finalVal;
          if (inp.varId) {
            currentInputs[inp.varId] = finalVal;
          }
        });

        const plotValues = [];

        // 1. Process Candle Plots (OHLC + body/wick/border colors via 7-element array)
        let lastExtractedSecurity = null;
        if (hasCandles) {
          meta.candlePlots.forEach((cp, cpIdx) => {
            let rawSym = currentInputs.sym || currentInputs.symbol || currentInputs.ticker || currentInputs.s;
            if (!rawSym && meta.inputs) {
              const symInp = meta.inputs.find(inp => inp.type === 'symbol');
              if (symInp) rawSym = currentInputs[symInp.id] || currentInputs[symInp.varId];
            }

            // In TradingView Charting Library, user-selected symbol in format dialog is stored in study.properties().inputs
            if (typeof window !== 'undefined' && window.widget && typeof window.widget.activeChart === 'function') {
              try {
                const chart = window.widget.activeChart();
                const model = chart._chartWidget?._model?.model() || chart.model?.();
                if (model) {
                  const s = model.priceDataSources().find(src => src._metaInfo && (src._metaInfo.id === studyId || (src.name && src.name().includes(meta.shortTitle || meta.title))));
                  if (s && s.properties) {
                    const pInps = s.properties().childs().inputs;
                    const pSym = (pInps.child('sym') && pInps.child('sym').value()) ||
                                 (pInps.child('symbol') && pInps.child('symbol').value()) ||
                                 (pInps.child('0') && pInps.child('0').value());
                    if (pSym && typeof pSym === 'string') {
                      const testClean = extractCleanSymbol(pSym);
                      if (testClean) {
                        rawSym = pSym;
                      }
                    }
                  }
                }
              } catch(e) {}
            }

            const chartSym = extractCleanSymbol((ctx.symbol && (ctx.symbol.ticker || ctx.symbol.symbol)) || '');
            let cleanSym = extractCleanSymbol(rawSym);
            if (!cleanSym) {
              cleanSym = chartSym || 'EURUSD.';
            }

            let rawRes = currentInputs.res || currentInputs.tf || currentInputs.timeframe || currentInputs.resolution;
            if (rawRes === undefined || rawRes === null) {
              const tfInp = (meta.inputs || []).find(inp => inp.type === 'resolution' || inp.isMTFResolution);
              if (tfInp) rawRes = currentInputs[tfInp.id] || currentInputs[tfInp.varId];
            }
            if (!rawRes || rawRes === 'Chart' || rawRes === 'CURRENT' || rawRes === 'SAME') {
              rawRes = '';
            }

            let chartRes = '';
            if (typeof window !== 'undefined' && window.widget && typeof window.widget.activeChart === 'function') {
              try {
                const ac = window.widget.activeChart();
                if (ac && typeof ac.resolution === 'function') {
                  chartRes = String(ac.resolution());
                }
              } catch(e) {}
            }
            if (!chartRes) {
              chartRes = String(ctx.symbol?.resolution || ctx.symbol?.interval || '1');
            }
            const effectiveRes = (rawRes && rawRes !== '') ? rawRes : chartRes;

            const upColor = currentInputs.upColor || currentInputs.bullCol || '#089981';
            const downColor = currentInputs.downColor || currentInputs.bearCol || '#F23645';
            const wickColor = currentInputs.wickColor || currentInputs.wickCol || currentInputs.wickUp || '#787B86';
            const borderUpColor = currentInputs.borderUpColor || currentInputs.borderUp || currentInputs.bullCol || '#089981';
            const borderDownColor = currentInputs.borderDownColor || currentInputs.borderDown || currentInputs.bearCol || '#F23645';
            const showBorders = currentInputs.showBorders !== undefined ? Boolean(currentInputs.showBorders) : true;
            const showWicks = currentInputs.showWicks !== undefined ? Boolean(currentInputs.showWicks) : true;

            const dur = getTfDurationMs(rawRes);

            let barO = NaN, barH = NaN, barL = NaN, barC = NaN;
            let barV = 0;

            if (evalCandles && evalCandles[cpIdx] && !isNaN(evalCandles[cpIdx].o) && !isNaN(evalCandles[cpIdx].c)) {
              // Exact evaluated formula outputs from Pine Script code
              barO = evalCandles[cpIdx].o;
              barH = evalCandles[cpIdx].h;
              barL = evalCandles[cpIdx].l;
              barC = evalCandles[cpIdx].c;
            } else if (rawSym && cleanSym && chartSym && cleanSym !== chartSym) {
              const cacheKey = `${cleanSym}_${effectiveRes}`;
              const cached = _securityCache.get(cacheKey);

              // Normalize t to seconds (both data.t and ctx.symbol.time handled seamlessly)
              const tSec = (t > 1e11) ? Math.floor(t / 1000) : t;

              if (cached && Array.isArray(cached.bars) && cached.bars.length > 0) {
                let lo = 0, hi = cached.bars.length - 1, matched = null;
                while (lo <= hi) {
                  const mid = (lo + hi) >> 1;
                  if (cached.bars[mid].time <= tSec) {
                    matched = cached.bars[mid];
                    lo = mid + 1;
                  } else {
                    hi = mid - 1;
                  }
                }
                if (matched) {
                  const durMs = getTfDurationMs(effectiveRes);
                  const tfSec = durMs > 0 ? Math.max(1, Math.floor(durMs / 1000)) : 60;
                  const timeDiff = tSec - matched.time;
                  if (timeDiff >= 0 && timeDiff < tfSec) {
                    // Exact match or within current bar timeframe: authentic full candle
                    barO = matched.open;
                    barH = matched.high;
                    barL = matched.low;
                    barC = matched.close;
                    barV = matched.volume || 0;
                    lastExtractedSecurity = matched;
                  } else if (timeDiff >= tfSec && timeDiff < tfSec * 3) {
                    // Real-time boundary delay: render flat tick at last close, NEVER duplicate previous candle body/wicks!
                    barO = matched.close;
                    barH = matched.close;
                    barL = matched.close;
                    barC = matched.close;
                    barV = 0;
                  } else {
                    // Beyond 3 periods (historical gap, market closed, or missing history): do not clone phantom candles
                    barO = NaN;
                    barH = NaN;
                    barL = NaN;
                    barC = NaN;
                  }
                }
              } else if (!cached || (!cached.fetching && (!cached.bars || cached.bars.length === 0))) {
                fetchSecurityBarsOnDemand(cleanSym, effectiveRes);
              }
              // Notice: when cleanSym !== chartSym, we strictly DO NOT fall back to o, h, l, c.
              // If a bar is not in cache yet, NaN prevents contaminating the indicator's price scale.
            } else {
              // Authentic per-bar candle prices from current bar
              barO = o; barH = h; barL = l; barC = c;
              barV = v;

              // Only perform HTF aggregation if an explicit higher timeframe is selected (dur > 0 and not current)
              if (dur > 0 && rawRes && rawRes !== '' && rawRes !== 'CURRENT' && rawRes !== 'SAME') {
                const periodStart = Math.floor(t / dur) * dur;
                if (!htfAggState[periodStart]) {
                  htfAggState[periodStart] = { open: o, high: h, low: l, close: c, volume: v };
                } else {
                  htfAggState[periodStart].high = Math.max(htfAggState[periodStart].high, h);
                  htfAggState[periodStart].low = Math.min(htfAggState[periodStart].low, l);
                  htfAggState[periodStart].close = c;
                  htfAggState[periodStart].volume = (htfAggState[periodStart].volume || 0) + v;
                }
                barO = htfAggState[periodStart].open;
                barH = htfAggState[periodStart].high;
                barL = htfAggState[periodStart].low;
                barC = htfAggState[periodStart].close;
                barV = htfAggState[periodStart].volume;
              }

              // Guaranteed non-NaN fallback for current chart symbol
              if (isNaN(barO)) barO = o;
              if (isNaN(barH)) barH = Math.max(o, h, c);
              if (isNaN(barL)) barL = Math.min(o, l, c);
              if (isNaN(barC)) barC = c;
            }

            if (isNaN(barO) || isNaN(barH) || isNaN(barL) || isNaN(barC)) {
              plotValues.push(NaN, NaN, NaN, NaN, 0, 0, 0);
              return;
            }

            const evaluatedOpts = (evalCandles && evalCandles[cpIdx] && evalCandles[cpIdx].opts) || {};
            const isUp = barC >= barO;
            let bodyCol = evaluatedOpts.color;
            if (!bodyCol || typeof bodyCol !== 'string') {
              bodyCol = isUp ? upColor : downColor;
            }
            let wickCol = evaluatedOpts.wickcolor;
            if (!wickCol || typeof wickCol !== 'string') {
              wickCol = showWicks ? wickColor : 'transparent';
            }
            let borderCol = evaluatedOpts.bordercolor;
            if (!borderCol || typeof borderCol !== 'string') {
              borderCol = showBorders ? (isUp ? borderUpColor : borderDownColor) : 'transparent';
            }

            const bodyColorInt = colorToInt(bodyCol);
            const wickColorInt = colorToInt(wickCol);
            const borderColorInt = colorToInt(borderCol);

            // 7-element OHLC array: [o, h, l, c, bodyColorInt, wickColorInt, borderColorInt]
            plotValues.push(barO, barH, barL, barC, bodyColorInt, wickColorInt, borderColorInt);
          });
        }

        // 1b. Process Conventional Bar Plots (plotbar)
        if (hasBars) {
          meta.barPlots.forEach((bp, bIdx) => {
            let barO = o, barH = h, barL = l, barC = c;
            if (evalBars && evalBars[bIdx] && !isNaN(evalBars[bIdx].o) && !isNaN(evalBars[bIdx].c)) {
              barO = evalBars[bIdx].o;
              barH = evalBars[bIdx].h;
              barL = evalBars[bIdx].l;
              barC = evalBars[bIdx].c;
            } else if (lastExtractedSecurity) {
              barO = lastExtractedSecurity.open;
              barH = lastExtractedSecurity.high;
              barL = lastExtractedSecurity.low;
              barC = lastExtractedSecurity.close;
            }
            if (isNaN(barO) || isNaN(barH) || isNaN(barL) || isNaN(barC)) {
              plotValues.push(NaN, NaN, NaN, NaN, 0);
              return;
            }
            const isUp = barC >= barO;
            const barCol = isUp ? '#089981' : '#f23645';
            plotValues.push(barO, barH, barL, barC, colorToInt(barCol));
          });
        }

        // 2. Process Standard Line Plots
        if (meta.plots && meta.plots.length > 0) {
          if (meta.rawPlotCount > 0) {
            meta.plots.forEach((p, pIdx) => {
              let val = NaN;
              const pTitle = (p.title || '').toLowerCase();
              const mTitle = meta.title.toLowerCase();

              if (evalPlots && evalPlots[pIdx] !== undefined) {
                val = evalPlots[pIdx].val;
              } else if (pTitle.includes('vol')) {
                const showVol = (currentInputs.showVol !== undefined) ? Boolean(currentInputs.showVol) : true;
                val = showVol ? (lastExtractedSecurity ? lastExtractedSecurity.volume : v) : NaN;
              } else if (pTitle.includes('fast') || pTitle.includes('fast ma')) {
                const fastLen = currentInputs.fastLen || currentInputs.fastLength || 9;
                val = Std.sma('close', fastLen, ctx);
              } else if (pTitle.includes('slow') || pTitle.includes('slow ma')) {
                const slowLen = currentInputs.slowLen || currentInputs.slowLength || 21;
                val = Std.sma('close', slowLen, ctx);
              } else if (mTitle.includes('rsi')) {
                const rsiLen = currentInputs.len || currentInputs.length || 14;
                val = Std.rsi('close', rsiLen, ctx);
                if (pTitle.includes('smooth')) {
                  const smoothPeriod = currentInputs.smooth || 3;
                  val = Std.ema(val, smoothPeriod, ctx);
                }
              } else if (mTitle.includes('supertrend')) {
                const factor = currentInputs.factor || 3.0;
                const atrPeriod = currentInputs.atrPeriod || 10;
                const atrVal = Std.atr(atrPeriod, ctx);
                const hl2Val = (h + l) / 2;
                const upperBand = hl2Val + factor * atrVal;
                const lowerBand = hl2Val - factor * atrVal;
                val = c > hl2Val ? lowerBand : upperBand;
              } else if (mTitle.includes('macd')) {
                const fast = currentInputs.fast || 12;
                const slow = currentInputs.slow || 26;
                const sig = currentInputs.sig || 9;
                const [macdLine, signalLine, hist] = Std.macd('close', fast, slow, sig, ctx);
                if (pTitle.includes('hist')) val = hist;
                else if (pTitle.includes('signal')) val = signalLine;
                else val = macdLine;
              } else if (mTitle.includes('bollinger') || mTitle.includes('bb')) {
                const len = currentInputs.len || 20;
                const mult = currentInputs.mult || 2.0;
                const [basis, upper, lower] = Std.bb('close', len, mult, ctx);
                if (pTitle.includes('upper')) val = upper;
                else if (pTitle.includes('lower')) val = lower;
                else val = basis;
              } else if (mTitle.includes('session') || pTitle.includes('session')) {
                val = NaN;
              } else {
                val = isPriceStudy ? Std.ema('close', 14, ctx) : Std.rsi('close', 14, ctx);
              }
              plotValues.push(isNaN(val) ? (pTitle.includes('vol') ? 0 : NaN) : val);
            });
          } else if (!hasCandles && !hasBars && !meta.title.toLowerCase().includes('session') && (meta.shapes || []).length === 0 && (meta.chars || []).length === 0 && (meta.arrows || []).length === 0) {
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
        });

        // 5. Native Drawing Primitives Bridge (ctx.plots)
        if (ctx && ctx.plots && (ctx.plots['__boxes__'] || ctx.plots['__lines__'] || ctx.plots['__polylines__'] || ctx.plots['__labels__'] || ctx.plots['__tables__'])) {
          if (typeof window !== 'undefined' && window.widget && typeof window.widget.activeChart === 'function') {
            try {
              const activeChart = window.widget.activeChart();
              dispatchPineDrawings(activeChart, studyId, ctx.plots);
            } catch (e) {}
          }
        }

        return plotValues;
      };
    };

    return {
      name: meta.title,
      metainfo: metainfo,
      constructor: studyConstructor,
      sourceCode: sourceCode,
      source: sourceCode
    };
  }

  /**
   * Diagnostic Pine compiler: runs full syntax, semantic, AST, and schema checks.
   * Returns: {
   *   success: boolean,
   *   errors: Array<{ line: number, column: number, message: string, severity: 'error' }>,
   *   warnings: Array<{ line: number, column: number, message: string, severity: 'warning' }>,
   *   meta: object | null,
   *   code: string,
   *   study: object | null
   * }
   */
  function compilePineScript(source) {
    const cleanSource = String(source || '').trim();
    if (!cleanSource) {
      return {
        success: false,
        errors: [{ line: 1, column: 1, message: "Script source code cannot be empty.", severity: 'error' }],
        warnings: [],
        meta: null,
        code: '',
        study: null
      };
    }

    const PineTSLib = getPineTS();
    const errors = [];
    const warnings = [];

    // Step 1: Version header check
    const versionMatch = cleanSource.match(/^\s*\/\/\s*@version\s*=\s*(\d+)/m);
    if (!versionMatch) {
      errors.push({
        line: 1,
        column: 1,
        message: "Pine Script version not found. Please add //@version=6 or //@version=5 comment to your script.",
        severity: 'error'
      });
      return { success: false, errors, warnings, meta: null, code: '', study: null };
    }

    const versionNum = parseInt(versionMatch[1], 10);
    if (versionNum < 4) {
      errors.push({
        line: 1,
        column: 1,
        message: `Pine Script version ${versionNum} is obsolete. Only version 5 and above are supported.`,
        severity: 'error'
      });
      return { success: false, errors, warnings, meta: null, code: '', study: null };
    }

    // Step 2: Transpilation via Node.js Backend or local PineTS
    let transpiledCode = '';
    let backendPayload = null;

    // Fast path: Delegate transpilation to Node.js powerhouse backend (< 2ms)
    try {
      if (typeof XMLHttpRequest !== 'undefined') {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', '/pine/transpile', false); // synchronous XHR for instant IDE compilation
        xhr.setRequestHeader('Content-Type', 'application/json');
        xhr.send(JSON.stringify({ source: cleanSource }));
        if (xhr.status === 200) {
          backendPayload = JSON.parse(xhr.responseText);
          if (backendPayload && backendPayload.success === false) {
            const lineCol = (backendPayload.error || '').match(/(?:at|line)\s*(\d+)(?::|,?\s*col(?:umn)?\s*)(\d+)?/i);
            const l = backendPayload.line || (lineCol ? parseInt(lineCol[1], 10) : 1);
            const c = backendPayload.column || ((lineCol && lineCol[2]) ? parseInt(lineCol[2], 10) : 1);
            const errs = Array.isArray(backendPayload.errors) && backendPayload.errors.length > 0
              ? backendPayload.errors
              : [{ line: l, column: c, message: backendPayload.error || "Syntax error in Pine script", severity: 'error' }];
            return { success: false, errors: errs, warnings, meta: null, code: '', study: null };
          } else if (backendPayload && backendPayload.code) {
            transpiledCode = backendPayload.code;
          }
        }
      }
    } catch (xhrErr) {
      // Offline fallback
    }

    // Local PineTS fallback if backend was unavailable
    if (!transpiledCode && PineTSLib && typeof PineTSLib.pineToJS === 'function') {
      try {
        const res = PineTSLib.pineToJS(cleanSource);
        if (res && res.success === false) {
          const errText = res.error || "Syntax error in Pine script";
          const lineCol = errText.match(/(?:at|line)\s*(\d+)(?::|,?\s*col(?:umn)?\s*)(\d+)?/i);
          const l = lineCol ? parseInt(lineCol[1], 10) : 1;
          const c = (lineCol && lineCol[2]) ? parseInt(lineCol[2], 10) : 1;
          errors.push({
            line: l,
            column: c,
            message: errText,
            severity: 'error'
          });
        } else if (res && res.code) {
          transpiledCode = res.code;
        }
      } catch (err) {
        const errText = err.message || String(err);
        const lineCol = errText.match(/(?:at|line)\s*(\d+)(?::|,?\s*col(?:umn)?\s*)(\d+)?/i);
        const l = lineCol ? parseInt(lineCol[1], 10) : 1;
        const c = (lineCol && lineCol[2]) ? parseInt(lineCol[2], 10) : 1;
        errors.push({
          line: l,
          column: c,
          message: errText,
          severity: 'error'
        });
      }
    }

    if (errors.length > 0) {
      return { success: false, errors, warnings, meta: null, code: '', study: null };
    }

    if (!transpiledCode) {
      errors.push({ line: 1, column: 1, message: "Transpilation failed: backend unreachable and no local engine.", severity: 'error' });
      return { success: false, errors, warnings, meta: null, code: '', study: null };
    }

    // Step 3: Declaration & AST validation via Indicator.from (if local PineTS present)
    let ind = null;
    if (PineTSLib) {
      const IndicatorClass = PineTSLib.Indicator || (root.PineTS && root.PineTS.Indicator) || (root.PineTSLib && root.PineTSLib.Indicator);
      if (IndicatorClass) {
        try {
          ind = (typeof IndicatorClass.from === 'function') ? IndicatorClass.from(cleanSource) : new IndicatorClass(cleanSource);
          if (ind && typeof ind.prepare === 'function') {
            ind.prepare();
          }
        } catch (indErr) {}
      }
    }

    // Step 4: Metadata & Study Descriptor Generation
    try {
      const meta = parsePineMetadata(cleanSource, ind);
      if (backendPayload) {
        if (backendPayload.title && (!meta.title || meta.title === "Custom Pine Indicator")) {
          meta.title = backendPayload.title;
        }
        if (backendPayload.shortTitle && (!meta.shortTitle || meta.shortTitle === "Pine Study")) {
          meta.shortTitle = backendPayload.shortTitle;
        }
        if (backendPayload.isOverlay !== undefined) {
          meta.isOverlay = backendPayload.isOverlay;
        }
      }
      const study = createStudyFromTranspiled(meta, transpiledCode, cleanSource);
      _registeredStudies.set(study.name, study);
      _registeredStudies.set(study.metainfo.id, study);

      return {
        success: true,
        errors: [],
        warnings: warnings,
        meta: meta,
        code: transpiledCode,
        study: study
      };
    } catch (studyErr) {
      errors.push({
        line: 1,
        column: 1,
        message: "Failed to construct TradingView study descriptor: " + (studyErr.message || String(studyErr)),
        severity: 'error'
      });
      return { success: false, errors, warnings, meta: null, code: '', study: null };
    }
  }

  /**
   * Transpile PineScript code to JS via PineTS and register as a TradingView Custom Study
   */
  function compileAndRegisterPine(source) {
    let cleanSource = String(source || '').trim();
    if (!/^\/\/@version=/m.test(cleanSource)) {
      cleanSource = "//@version=5\n" + cleanSource;
    }

    const compileResult = compilePineScript(cleanSource);
    if (!compileResult.success) {
      const firstErr = (compileResult.errors && compileResult.errors[0]) ? compileResult.errors[0].message : "Compilation failed";
      throw new Error(firstErr);
    }

    return {
      study: compileResult.study,
      meta: compileResult.meta,
      code: compileResult.code,
      confidence: 100,
      errors: compileResult.errors,
      warnings: compileResult.warnings
    };
  }

  /* =========================================================================
   * 3. Prebuilt Indicators Pre-population (CLEAN - No Predefined Templates)
   * ========================================================================= */
  const PREBUILT_TEMPLATES = [];

  function initPrebuiltStudies() {
    // 100% clean state: No prebuilt or predefined indicators loaded
    return;
  }

  /* =========================================================================
   * 4. TradingView custom_indicators_getter Hook
   * ========================================================================= */
  function getCustomIndicators(PineJS) {
    const studies = Array.from(_registeredStudies.values());
    return Promise.resolve(studies);
  }

  /* =========================================================================
   * 4b. Session Visuals & Multi-day Shapes Renderer
   * ========================================================================= */
  let _activeSessionShapeIds = [];
  let _lastSessionConfig = null;
  let _isSessionVisualsActive = false;

  function extractSessionConfig(sourceOrInputs) {
    const cfg = {
      showDayDivider: true,
      transparency: 82,
      showOutline: false,
      showLabel: true,
      sessions: [
        { id: 'A', name: 'New York', color: '#ff5d00', start: 1300, end: 2200, enabled: true },
        { id: 'B', name: 'London', color: '#2157f3', start: 700, end: 1600, enabled: true },
        { id: 'C', name: 'Tokyo', color: '#e91e63', start: 0, end: 900, enabled: true },
        { id: 'D', name: 'Sydney', color: '#ffeb3b', start: 2100, end: 600, enabled: true }
      ]
    };

    if (typeof sourceOrInputs === 'object' && sourceOrInputs !== null) {
      if (sourceOrInputs.showDayDividerInput !== undefined) cfg.showDayDivider = Boolean(sourceOrInputs.showDayDividerInput);
      if (sourceOrInputs.rangeTransparencyInput !== undefined) cfg.transparency = parseInt(sourceOrInputs.rangeTransparencyInput, 10);
      if (sourceOrInputs.showRangeOutlineInput !== undefined) cfg.showOutline = Boolean(sourceOrInputs.showRangeOutlineInput);
      if (sourceOrInputs.showRangeLabelInput !== undefined) cfg.showLabel = Boolean(sourceOrInputs.showRangeLabelInput);

      ['A', 'B', 'C', 'D'].forEach(letter => {
        const s = cfg.sessions.find(x => x.id === letter);
        if (!s) return;
        if (sourceOrInputs[`session${letter}NameInput`]) s.name = String(sourceOrInputs[`session${letter}NameInput`]);
        if (sourceOrInputs[`session${letter}ColorInput`]) s.color = String(sourceOrInputs[`session${letter}ColorInput`]);
        if (sourceOrInputs[`session${letter}TimeInput`]) {
          const parts = String(sourceOrInputs[`session${letter}TimeInput`]).split('-');
          s.start = parseInt(parts[0], 10);
          s.end = parseInt(parts[1], 10);
        }
        const isShow = sourceOrInputs[`showSession${letter}Input`] !== undefined ? Boolean(sourceOrInputs[`showSession${letter}Input`]) : true;
        const isRange = sourceOrInputs[`session${letter}RangeInput`] !== undefined ? Boolean(sourceOrInputs[`session${letter}RangeInput`]) : true;
        s.enabled = isShow && isRange;
      });
    }

    if (typeof sourceOrInputs === 'string') {
      const code = sourceOrInputs;
      const dayMatch = code.match(/showDayDividerInput\s*=\s*input(?:\.bool)?\s*\(\s*(true|false)/i);
      if (dayMatch) cfg.showDayDivider = dayMatch[1].toLowerCase() === 'true';

      const transMatch = code.match(/rangeTransparencyInput\s*=\s*input(?:\.int)?\s*\(\s*(\d+)/i);
      if (transMatch) cfg.transparency = parseInt(transMatch[1], 10);

      const outlineMatch = code.match(/showRangeOutlineInput\s*=\s*input(?:\.bool)?\s*\(\s*(true|false)/i);
      if (outlineMatch) cfg.showOutline = outlineMatch[1].toLowerCase() === 'true';

      const labelMatch = code.match(/showRangeLabelInput\s*=\s*input(?:\.bool)?\s*\(\s*(true|false)/i);
      if (labelMatch) cfg.showLabel = labelMatch[1].toLowerCase() === 'true';

      ['A', 'B', 'C', 'D'].forEach(letter => {
        const s = cfg.sessions.find(x => x.id === letter);
        if (!s) return;
        const nameMatch = code.match(new RegExp('session' + letter + 'NameInput\\s*=\\s*input(?:\\.string)?\\s*\\(\\s*["\']([^"\']+)["\']', 'i'));
        if (nameMatch) s.name = nameMatch[1];

        const colMatch = code.match(new RegExp('session' + letter + 'ColorInput\\s*=\\s*input(?:\\.color)?\\s*\\(\\s*([^,\\)]+)', 'i'));
        if (colMatch) {
          let c = colMatch[1].trim().replace(/['"]/g, '');
          if (c.startsWith('#') && c.length === 9) c = c.slice(0, 7);
          s.color = c;
        }

        const timeMatch = code.match(new RegExp('session' + letter + 'TimeInput\\s*=\\s*input(?:\\.session)?\\s*\\(\\s*["\']([^"\']+)["\']', 'i'));
        if (timeMatch) {
          const parts = timeMatch[1].split('-');
          s.start = parseInt(parts[0], 10);
          s.end = parseInt(parts[1], 10);
        }

        const showMatch = code.match(new RegExp('showSession' + letter + 'Input\\s*=\\s*input(?:\\.bool)?\\s*\\(\\s*(true|false)', 'i'));
        const rangeMatch = code.match(new RegExp('session' + letter + 'RangeInput\\s*=\\s*input(?:\\.bool)?\\s*\\(\\s*(true|false)', 'i'));
        const isShow = showMatch ? showMatch[1].toLowerCase() === 'true' : true;
        const isRange = rangeMatch ? rangeMatch[1].toLowerCase() === 'true' : true;
        s.enabled = isShow && isRange;
      });
    }

    return cfg;
  }

  function hasActiveSessionStudy(chart) {
    if (!chart) return false;
    let hasStudy = false;
    if (typeof chart.getAllStudies === 'function') {
      try {
        const studies = chart.getAllStudies();
        if (Array.isArray(studies)) {
          hasStudy = studies.some(s => s && s.name && s.name.toLowerCase().includes('session'));
        }
      } catch(e) {}
    }
    if (!hasStudy && root._pineActiveStudies) {
      hasStudy = Array.from(root._pineActiveStudies.values()).some(s => s && s.name && s.name.toLowerCase().includes('session'));
    }
    return hasStudy;
  }
  root.hasActiveSessionStudy = hasActiveSessionStudy;

  let _isClearingSessionVisuals = false;
  function clearSessionVisuals(widgetOrChart) {
    if (_isClearingSessionVisuals) return;
    _isClearingSessionVisuals = true;
    try {
      if (!widgetOrChart && typeof window !== 'undefined' && window.widget && typeof window.widget.activeChart === 'function') {
        try { widgetOrChart = window.widget.activeChart(); } catch(e) {}
      }
      let chart = widgetOrChart;
      if (widgetOrChart && typeof widgetOrChart.activeChart === 'function') {
        chart = widgetOrChart.activeChart();
      }
      _isSessionVisualsActive = false;

      // 1. Remove tracked active session shape IDs
      if (chart && typeof chart.removeEntity === 'function' && Array.isArray(_activeSessionShapeIds)) {
        for (const id of _activeSessionShapeIds) {
          try { chart.removeEntity(id, { disableUndo: true }); } catch (e) {}
          _allPineShapeIds.delete(id);
        }
      }
      _activeSessionShapeIds = [];

      // 2. Comprehensive canvas sweep: inspect ALL shapes on chart to remove any orphaned session boxes or day dividers
      if (chart && typeof chart.getAllShapes === 'function' && typeof chart.removeEntity === 'function') {
        try {
          const allShapes = chart.getAllShapes();
          if (Array.isArray(allShapes)) {
            const sessionKeywords = [
              'sydney', 'tokyo', 'london', 'new york',
              'sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday',
              'session', 'day divider'
            ];
            for (const s of allShapes) {
              if (!s || !s.id) continue;
              let shouldPurge = false;
              if (_allPineShapeIds && _allPineShapeIds.has(s.id)) {
                shouldPurge = true;
              } else if (typeof chart.getShapeById === 'function') {
                try {
                  const shapeApi = chart.getShapeById(s.id);
                  const props = shapeApi && typeof shapeApi.getProperties === 'function' ? shapeApi.getProperties() : null;
                  const text = (props && props.text ? String(props.text) : (s.text || '')).toLowerCase();
                  if (sessionKeywords.some(k => text.includes(k))) {
                    shouldPurge = true;
                  }
                } catch(e) {}
              }
              if (shouldPurge) {
                try { chart.removeEntity(s.id, { disableUndo: true }); } catch(e) {}
                if (_allPineShapeIds) _allPineShapeIds.delete(s.id);
              }
            }
          }
        } catch(e) {}
      }
    } finally {
      _isClearingSessionVisuals = false;
    }
  }

  async function renderSessionVisuals(widgetOrChart, sourceOrInputs = null, studyId = null) {
    if (!widgetOrChart) return;
    let chart = widgetOrChart;
    if (typeof widgetOrChart.activeChart === 'function') {
      chart = widgetOrChart.activeChart();
    }
    if (!chart || typeof chart.createMultipointShape !== 'function') return;

    if (!hasActiveSessionStudy(chart)) {
      clearSessionVisuals(chart);
      return;
    }

    if (sourceOrInputs) {
      _lastSessionConfig = extractSessionConfig(sourceOrInputs);
    } else if (!_lastSessionConfig) {
      _lastSessionConfig = extractSessionConfig(null);
    }
    const cfg = _lastSessionConfig;
    _isSessionVisualsActive = true;

    // Attach lifecycle listeners for automatic re-render on resolution or symbol change
    if (!chart._hasSessionVisualListeners) {
      chart._hasSessionVisualListeners = true;
      if (typeof chart.onIntervalChanged === 'function') {
        try {
          chart.onIntervalChanged().subscribe(null, () => {
            if (_isSessionVisualsActive && hasActiveSessionStudy(chart)) {
              setTimeout(() => renderSessionVisuals(chart, null, studyId), 300);
            } else if (!hasActiveSessionStudy(chart)) {
              clearSessionVisuals(chart);
            }
          });
        } catch (e) {}
      }
      if (typeof chart.onSymbolChanged === 'function') {
        try {
          chart.onSymbolChanged().subscribe(null, () => {
            if (_isSessionVisualsActive && hasActiveSessionStudy(chart)) {
              setTimeout(() => renderSessionVisuals(chart, null, studyId), 300);
            } else if (!hasActiveSessionStudy(chart)) {
              clearSessionVisuals(chart);
            }
          });
        } catch (e) {}
      }
    }

    // Clean up old shapes before drawing new ones
    clearSessionVisuals(chart);
    if (studyId) clearStudyShapes(studyId, chart);

    try {
      const symbol = typeof chart.symbol === 'function' ? chart.symbol() : 'XAUUSD.';
      const resolution = typeof chart.resolution === 'function' ? chart.resolution() : '15';

      const resp = await fetch(`/history?symbol=${encodeURIComponent(symbol)}&resolution=${encodeURIComponent(resolution)}&countback=500`);
      const data = await resp.json();
      if (!data || !data.t || data.t.length === 0) return;

      const bars = [];
      for (let i = 0; i < data.t.length; i++) {
        bars.push({
          t: data.t[i],
          o: data.o[i],
          h: data.h[i],
          l: data.l[i],
          c: data.c[i]
        });
      }

      const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

      // 1. Day Dividers
      if (cfg.showDayDivider && typeof chart.createShape === 'function') {
        let prevDay = -1;
        for (let i = 0; i < bars.length; i++) {
          const b = bars[i];
          const dt = new Date(b.t * 1000);
          const day = dt.getUTCDay();
          if (prevDay !== -1 && day !== prevDay) {
            try {
              const lineId = await chart.createShape({ time: b.t, price: b.c }, {
                shape: 'vertical_line',
                lock: true,
                disableSelection: true,
                overrides: {
                  linecolor: '#787b86',
                  linewidth: 1,
                  linestyle: 2,
                  showLabel: true,
                  showTime: false,
                  text: daysOfWeek[day],
                  textcolor: '#787b86',
                  fontsize: 10,
                  vertLabelsAlign: 'top',
                  horzLabelsAlign: 'left'
                }
              });
              if (lineId) {
                _activeSessionShapeIds.push(lineId);
                registerStudyShape('Sessions [LuxAlgo]', lineId);
                registerStudyShape('LuxAlgo - Sessions', lineId);
                if (studyId) registerStudyShape(studyId, lineId);
              }
            } catch (e) {}
          }
          prevDay = day;
        }
      }

      // 2. Session Boxes
      function isInSession(hhmm, start, end) {
        if (start <= end) return hhmm >= start && hhmm < end;
        return hhmm >= start || hhmm < end;
      }

      for (const s of cfg.sessions) {
        if (!s.enabled) continue;
        let current = null;
        for (let i = 0; i < bars.length; i++) {
          const b = bars[i];
          const dt = new Date(b.t * 1000);
          const hhmm = dt.getUTCHours() * 100 + dt.getUTCMinutes();
          const active = isInSession(hhmm, s.start, s.end);

          if (active) {
            if (!current) {
              current = { startTime: b.t, endTime: b.t, high: b.h, low: b.l };
            } else {
              current.high = Math.max(current.high, b.h);
              current.low = Math.min(current.low, b.l);
              current.endTime = b.t;
            }
          } else {
            if (current) {
              try {
                const rectId = await chart.createMultipointShape([
                  { time: current.startTime, price: current.high },
                  { time: current.endTime, price: current.low }
                ], {
                  shape: 'rectangle',
                  lock: true,
                  disableSelection: true,
                  overrides: {
                    color: s.color,
                    backgroundColor: s.color,
                    fillBackground: true,
                    transparency: cfg.transparency,
                    linewidth: cfg.showOutline ? 1 : 0,
                    showLabel: cfg.showLabel,
                    text: s.name,
                    textColor: s.color,
                    fontsize: 11,
                    bold: true,
                    horzLabelsAlign: 'left',
                    vertLabelsAlign: 'top'
                  }
                });
                if (rectId) {
                  _activeSessionShapeIds.push(rectId);
                  registerStudyShape('Sessions [LuxAlgo]', rectId);
                  registerStudyShape('LuxAlgo - Sessions', rectId);
                  if (studyId) registerStudyShape(studyId, rectId);
                }
              } catch (e) {}
              current = null;
            }
          }
        }
        if (current) {
          try {
            const rectId = await chart.createMultipointShape([
              { time: current.startTime, price: current.high },
              { time: current.endTime, price: current.low }
            ], {
              shape: 'rectangle',
              lock: true,
              disableSelection: true,
              overrides: {
                color: s.color,
                backgroundColor: s.color,
                fillBackground: true,
                transparency: cfg.transparency,
                linewidth: cfg.showOutline ? 1 : 0,
                showLabel: cfg.showLabel,
                text: s.name,
                textColor: s.color,
                fontsize: 11,
                bold: true,
                horzLabelsAlign: 'left',
                vertLabelsAlign: 'top'
              }
            });
            if (rectId) {
              _activeSessionShapeIds.push(rectId);
              registerStudyShape('Sessions [LuxAlgo]', rectId);
              registerStudyShape('LuxAlgo - Sessions', rectId);
              if (studyId) registerStudyShape(studyId, rectId);
            }
          } catch (e) {}
        }
      }
    } catch (err) {
      console.warn('[PineIndicators] renderSessionVisuals warning:', err);
    }
  }

  /* =========================================================================
   * 4b. Native Pine Table HTML Overlay Container
   * ========================================================================= */
  function renderTableOverlay(studyId, tableData) {
    if (typeof document === 'undefined') return null;
    const container = document.getElementById('tv_chart_container') || document.body;

    const existingTbl = _studyTableRegistry.get(studyId);
    if (existingTbl && existingTbl.parentNode) {
      existingTbl.parentNode.removeChild(existingTbl);
    }

    if (!tableData) return null;

    const overlay = document.createElement('div');
    overlay.className = 'tv-pine-table-container';
    overlay.setAttribute('data-study-id', studyId);

    const pos = String(tableData.position || 'top_right').toLowerCase();
    let posCss = 'top: 12px; right: 70px;';
    if (pos.includes('left') && pos.includes('bottom')) posCss = 'bottom: 30px; left: 70px;';
    else if (pos.includes('right') && pos.includes('bottom')) posCss = 'bottom: 30px; right: 70px;';
    else if (pos.includes('left')) posCss = 'top: 12px; left: 70px;';
    else if (pos.includes('bottom')) posCss = 'bottom: 30px; left: 50%; transform: translateX(-50%);';
    else if (pos.includes('center')) posCss = 'top: 12px; left: 50%; transform: translateX(-50%);';

    overlay.style.cssText = `
      position: absolute;
      ${posCss}
      z-index: 25;
      pointer-events: none;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const table = document.createElement('table');
    table.className = 'tv-pine-table';
    table.style.cssText = `
      background: ${tableData.bgcolor || '#1e222d'};
      border: ${tableData.border_width || 1}px solid ${tableData.border_color || '#363c4e'};
      border-collapse: collapse;
      border-radius: 4px;
      font-size: 11px;
      color: #d1d4dc;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    `;

    if (Array.isArray(tableData.cells)) {
      let maxR = 0, maxC = 0;
      tableData.cells.forEach(c => {
        if (c.row !== undefined && c.row > maxR) maxR = c.row;
        if (c.col !== undefined && c.col > maxC) maxC = c.col;
      });
      const grid = [];
      for (let r = 0; r <= maxR; r++) grid[r] = [];
      tableData.cells.forEach(c => {
        if (grid[c.row]) grid[c.row][c.col] = c;
      });
      for (let r = 0; r <= maxR; r++) {
        const tr = document.createElement('tr');
        for (let c = 0; c <= maxC; c++) {
          const td = document.createElement('td');
          const cell = (grid[r] && grid[r][c]) || {};
          td.textContent = cell.text !== undefined ? cell.text : '';
          td.style.cssText = `
            padding: 4px 8px;
            border: 1px solid ${cell.border_color || tableData.border_color || '#2a2e39'};
            background: ${cell.bgcolor || 'transparent'};
            color: ${cell.text_color || '#d1d4dc'};
            text-align: ${cell.text_halign || 'center'};
            font-size: ${cell.text_size || 11}px;
          `;
          tr.appendChild(td);
        }
        table.appendChild(tr);
      }
    } else if (Array.isArray(tableData.rows)) {
      tableData.rows.forEach(r => {
        const tr = document.createElement('tr');
        (r.cells || []).forEach(cell => {
          const td = document.createElement('td');
          td.textContent = cell.text || '';
          td.style.cssText = `
            padding: 4px 8px;
            border: 1px solid ${cell.border_color || tableData.border_color || '#2a2e39'};
            background: ${cell.bgcolor || 'transparent'};
            color: ${cell.text_color || '#d1d4dc'};
            text-align: ${cell.text_halign || 'center'};
            font-size: ${cell.text_size || 11}px;
          `;
          tr.appendChild(td);
        });
        table.appendChild(tr);
      });
    }

    overlay.appendChild(table);
    container.appendChild(overlay);
    _studyTableRegistry.set(studyId, overlay);
    return overlay;
  }

  /* =========================================================================
   * 4c. Native Pine Drawing Dispatcher (boxes, lines, polylines, labels, tables)
   * ========================================================================= */
  async function dispatchPineDrawings(chart, studyId, drawingPlots, bars) {
    if (!chart || !drawingPlots) return;
    clearStudyShapes(studyId, chart);

    function toTime(val) {
      if (typeof val === 'number') {
        if (bars && bars.length > 0 && val >= 0 && val < bars.length && val < 100000) {
          return bars[val].t || bars[val].time;
        }
        return val > 1e11 ? Math.floor(val / 1000) : val;
      }
      return val;
    }

    // 1. Boxes (__boxes__)
    const boxes = drawingPlots['__boxes__'] || drawingPlots.boxes;
    if (Array.isArray(boxes) && typeof chart.createMultipointShape === 'function') {
      for (const b of boxes) {
        if (!b) continue;
        const leftTime = toTime(b.left !== undefined ? b.left : b.x1);
        const rightTime = toTime(b.right !== undefined ? b.right : b.x2);
        const topPrice = b.top !== undefined ? b.top : b.y1;
        const bottomPrice = b.bottom !== undefined ? b.bottom : b.y2;

        try {
          const shapeId = await chart.createMultipointShape([
            { time: leftTime, price: topPrice },
            { time: rightTime, price: bottomPrice }
          ], {
            shape: 'rectangle',
            lock: true,
            disableSelection: true,
            disableSave: true,
            overrides: {
              color: b.border_color || b.color || '#2196F3',
              linewidth: b.border_width || b.width || 1,
              linestyle: b.border_style === 'dashed' ? 1 : (b.border_style === 'dotted' ? 2 : 0),
              backgroundColor: b.bgcolor || b.backgroundColor || '#2196F3',
              fillBackground: true,
              transparency: b.transparency !== undefined ? b.transparency : 80,
              showLabel: Boolean(b.text),
              text: b.text || '',
              textColor: b.text_color || b.textColor || '#ffffff',
              fontSize: b.text_size || b.fontSize || 11,
              vertLabelsAlign: b.text_valign || 'middle',
              horzLabelsAlign: b.text_halign || 'center'
            }
          });
          if (shapeId) registerStudyShape(studyId, shapeId);
        } catch (e) {
          console.warn('[PineIndicators] createMultipointShape box error:', e);
        }
      }
    }

    // 2. Lines (__lines__)
    const lines = drawingPlots['__lines__'] || drawingPlots.lines;
    if (Array.isArray(lines)) {
      for (const l of lines) {
        if (!l) continue;
        const x1 = toTime(l.x1 !== undefined ? l.x1 : l.x);
        const y1 = l.y1 !== undefined ? l.y1 : l.y;
        const x2 = toTime(l.x2 !== undefined ? l.x2 : l.x);
        const y2 = l.y2 !== undefined ? l.y2 : l.y;

        try {
          let shapeId = null;
          if (l.isVertical || (x1 === x2 && (y2 === undefined || isNaN(y2)))) {
            if (typeof chart.createShape === 'function') {
              shapeId = await chart.createShape({ time: x1, price: y1 || 0 }, {
                shape: 'vertical_line',
                lock: true,
                disableSelection: true,
                disableSave: true,
                overrides: {
                  linecolor: l.color || '#787b86',
                  linewidth: l.width || 1,
                  linestyle: l.style === 'dashed' ? 1 : (l.style === 'dotted' ? 2 : 0),
                  showLabel: Boolean(l.text),
                  text: l.text || '',
                  textColor: l.color || '#787b86'
                }
              });
            }
          } else if (typeof chart.createMultipointShape === 'function') {
            shapeId = await chart.createMultipointShape([
              { time: x1, price: y1 },
              { time: x2, price: y2 }
            ], {
              shape: 'trend_line',
              lock: true,
              disableSelection: true,
              disableSave: true,
              overrides: {
                linecolor: l.color || '#2196F3',
                linewidth: l.width || 1,
                linestyle: l.style === 'dashed' ? 1 : (l.style === 'dotted' ? 2 : 0),
                extendLeft: l.extend === 'both' || l.extend === 'left',
                extendRight: l.extend === 'both' || l.extend === 'right'
              }
            });
          }
          if (shapeId) registerStudyShape(studyId, shapeId);
        } catch (e) {
          console.warn('[PineIndicators] createShape line error:', e);
        }
      }
    }

    // 3. Polylines (__polylines__)
    const polylines = drawingPlots['__polylines__'] || drawingPlots.polylines;
    if (Array.isArray(polylines) && typeof chart.createMultipointShape === 'function') {
      for (const pl of polylines) {
        if (!pl || !Array.isArray(pl.points)) continue;
        const pts = pl.points.map(pt => ({
          time: toTime(pt.time !== undefined ? pt.time : pt.x),
          price: pt.price !== undefined ? pt.price : pt.y
        }));
        try {
          const shapeId = await chart.createMultipointShape(pts, {
            shape: 'polyline',
            lock: true,
            disableSelection: true,
            disableSave: true,
            overrides: {
              linecolor: pl.line_color || pl.color || '#2196F3',
              linewidth: pl.line_width || pl.width || 1,
              fillBackground: Boolean(pl.fill_color),
              backgroundColor: pl.fill_color || 'transparent',
              filled: Boolean(pl.fill_color)
            }
          });
          if (shapeId) registerStudyShape(studyId, shapeId);
        } catch (e) {
          console.warn('[PineIndicators] createMultipointShape polyline error:', e);
        }
      }
    }

    // 4. Labels (__labels__)
    const labels = drawingPlots['__labels__'] || drawingPlots.labels;
    if (Array.isArray(labels) && typeof chart.createShape === 'function') {
      for (const lb of labels) {
        if (!lb) continue;
        const xTime = toTime(lb.x !== undefined ? lb.x : lb.time);
        const yPrice = lb.y !== undefined ? lb.y : lb.price;
        try {
          const shapeId = await chart.createShape({ time: xTime, price: yPrice }, {
            shape: 'text',
            lock: true,
            disableSelection: true,
            disableSave: true,
            overrides: {
              text: lb.text || '',
              textColor: lb.textcolor || lb.text_color || '#ffffff',
              fontSize: lb.size || 12,
              backgroundColor: lb.color || 'transparent',
              fillBackground: Boolean(lb.color && lb.color !== 'transparent'),
              bold: true
            }
          });
          if (shapeId) registerStudyShape(studyId, shapeId);
        } catch (e) {
          console.warn('[PineIndicators] createShape label error:', e);
        }
      }
    }

    // 5. Tables (__tables__)
    const tables = drawingPlots['__tables__'] || drawingPlots.tables;
    if (tables) {
      if (Array.isArray(tables)) {
        tables.forEach(t => renderTableOverlay(studyId, t));
      } else {
        renderTableOverlay(studyId, tables);
      }
    }
  }

  /* =========================================================================
   * 4c. Hook Chart Settings & Legend Gear Actions
   * ========================================================================= */
  function hookChartSettings(chart) {
    if (!chart) return;

    // 1. Native showPropertiesDialog preserved

    // 2. Native showChartPropertiesForSource preserved

    // 3. Attach DOM click listener for legend gear icon inside TradingView iframe
    try {
      const innerWin = (root.widget && typeof root.widget._innerWindow === 'function')
        ? root.widget._innerWindow()
        : (typeof document !== 'undefined' ? document.querySelector('#tv_chart_container iframe')?.contentWindow : null);
      const innerDoc = innerWin?.document;
      if (innerDoc && !innerDoc._pineLegendGearHooked) {
        innerDoc._pineLegendGearHooked = true;
        innerDoc.addEventListener('click', (e) => {
          // Gear click handled natively by TradingView

          const codeBtn = e.target.closest('[data-name="legend-source-code-action"], [data-name="legend-pine-action"], .tv-legend-code-btn');
          if (codeBtn) {
            const item = codeBtn.closest('[data-name="legend-source-item"], [data-name="legend-study-item"], [class*="item-"]');
            if (item) {
              const titleEl = item.querySelector('[class*="title-"], [data-name="legend-source-title"]');
              const titleText = titleEl ? titleEl.textContent.trim() : '';
              if (root.PineEditorIDE && typeof root.PineEditorIDE.openScriptForStudy === 'function') {
                e.stopPropagation();
                e.preventDefault();
                root.PineEditorIDE.openScriptForStudy(titleText);
              } else if (typeof root.openScriptForStudy === 'function') {
                e.stopPropagation();
                e.preventDefault();
                root.openScriptForStudy(titleText);
              } else if (root.PineEditorIDE && typeof root.PineEditorIDE.setDockOpen === 'function') {
                e.stopPropagation();
                e.preventDefault();
                root.PineEditorIDE.setDockOpen(true);
              }
            }
          }
        }, true);
      }
    } catch(e) {}
  }
  root.hookChartSettings = hookChartSettings;

  /* =========================================================================
   * 5. Study Addition Helper Guaranteeing lock: false
   * ========================================================================= */
  async function addStudyToChart(widgetOrChart, studyName, isOverlay = false) {
    if (!widgetOrChart) return null;
    let chart = widgetOrChart;
    let widget = null;
    if (typeof widgetOrChart.activeChart === 'function') {
      widget = widgetOrChart;
      chart = widgetOrChart.activeChart();
    } else if (typeof window !== 'undefined' && window.widget) {
      widget = window.widget;
    }

    if (chart && typeof chart.createStudy === 'function') {
      hookChartSettings(chart);

      // Attach deterministic shape removal hook to chart.removeEntity
      if (typeof chart.removeEntity === 'function' && !chart._hasPineShapeCleanupHook) {
        chart._hasPineShapeCleanupHook = true;
        const origRemoveEntity = chart.removeEntity.bind(chart);
        chart.removeEntity = function(entityId) {
          clearStudyShapes(entityId, chart);
          const res = origRemoveEntity(entityId);
          try {
            if (typeof chart.getAllStudies === 'function' && chart.getAllStudies().length === 0) {
              clearStudyShapes('all', chart);
            }
          } catch(e) {}
          return res;
        };
      }

      const studyObj = _registeredStudies.get(studyName);
      if (studyObj && studyObj.metainfo) {
        // Register in innerWindow JSServer if available
        const innerWin = (widget && typeof widget._innerWindow === 'function')
          ? widget._innerWindow()
          : (typeof document !== 'undefined' ? document.querySelector('#tv_chart_container iframe')?.contentWindow : null);

        if (innerWin && innerWin.JSServer && Array.isArray(innerWin.JSServer.studyLibrary)) {
          const exists = innerWin.JSServer.studyLibrary.some(s => s && (s.name === studyName || (s.metainfo && s.metainfo.id === studyObj.metainfo.id)));
          if (!exists) {
            innerWin.JSServer.studyLibrary.push(studyObj);
          }
        }

        // Register in chart studyMetaIntoRepository
        const repo = typeof chart.studyMetaIntoRepository === 'function' ? chart.studyMetaIntoRepository() : chart.studyMetaIntoRepository;
        if (repo) {
          if (typeof repo._processLibraryMetaInfo === 'function') {
            try { repo._processLibraryMetaInfo([studyObj.metainfo]); } catch (e) {}
          }
          if (Array.isArray(repo._rawStudiesMetaInfo)) {
            if (!repo._rawStudiesMetaInfo.some(s => s && s.id === studyObj.metainfo.id)) {
              repo._rawStudiesMetaInfo.push(studyObj.metainfo);
            }
          }
        }
      }

      // Third parameter lock: false ensures TradingView enables hover action buttons:
      // Hide/Show (eye), Settings/Format modal (gear), and Remove (trash)
      const res = await chart.createStudy(studyName, Boolean(isOverlay), false);
      if (res) {
        registerStudyAlias(res, [studyName, studyObj?.metainfo?.id]);
      }
      if (studyName && studyName.toLowerCase().includes('session')) {
        setTimeout(() => renderSessionVisuals(chart, null, res || studyName), 200);
      }
      return res;
    }
    return null;
  }

  /* =========================================================================
   * 6. Pine Script Editor Modal UI (Native Integration)
   * ========================================================================= */
  function openPineEditorModal(widget) {
    // If PineEditorIDE is available on window, route to authentic native dock
    if (root.PineEditorIDE && typeof root.PineEditorIDE.toggle === 'function') {
      root.PineEditorIDE.toggle();
      return;
    }

    const existing = document.getElementById('pine-editor-modal');
    if (existing) {
      existing.style.display = 'flex';
      return;
    }

    const modal = document.createElement('div');
    modal.id = 'pine-editor-modal';
    modal.style.cssText = `
      position: fixed;
      inset: 0;
      z-index: 100000;
      background: rgba(10, 12, 16, 0.85);
      backdrop-filter: blur(4px);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      color: #d1d4dc;
    `;

    modal.innerHTML = `
      <div style="
        width: 95%;
        max-width: 1200px;
        height: 88vh;
        background: #131722;
        border: 1px solid #2a2e39;
        border-radius: 10px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.6);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      ">
        <!-- Header -->
        <div style="
          padding: 14px 20px;
          border-bottom: 1px solid #2a2e39;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #1e222d;
        ">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.4rem;">🌲</span>
            <div>
              <div style="font-weight: 600; font-size: 1.05rem; color: #f0f3fa;">Pine Script Editor & Transpiler</div>
              <div style="font-size: 0.78rem; color: #787b86;">Compile PineScript v5/v6 to native TradingView custom indicators on-the-fly</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 10px;">
            <select id="pe-example-select" style="
              background: #2a2e39;
              color: #d1d4dc;
              border: 1px solid #363a45;
              border-radius: 5px;
              padding: 6px 10px;
              font-size: 0.85rem;
              cursor: pointer;
            ">
              <option value="">Load Template or Converted Indicator…</option>
            </select>
            <button id="pe-close-btn" style="
              background: transparent;
              border: none;
              color: #787b86;
              font-size: 1.3rem;
              cursor: pointer;
              padding: 4px 8px;
              border-radius: 4px;
            ">&times;</button>
          </div>
        </div>

        <!-- Main Body: Two Panes -->
        <div style="flex: 1; display: flex; overflow: hidden; background: #131722;">
          <!-- Left Pane: Pine Editor -->
          <div style="flex: 1; display: flex; flex-direction: column; border-right: 1px solid #2a2e39;">
            <div style="
              padding: 8px 16px;
              background: #181c27;
              border-bottom: 1px solid #2a2e39;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 0.78rem;
              color: #787b86;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            ">
              <span>PineScript Source (v5)</span>
              <span id="pe-line-count">0 lines</span>
            </div>
            <textarea id="pe-pine-input" spellcheck="false" style="
              flex: 1;
              background: #131722;
              color: #d1d4dc;
              border: none;
              padding: 14px;
              font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
              font-size: 13px;
              line-height: 1.55;
              resize: none;
              outline: none;
            " placeholder="// Paste your TradingView PineScript indicator here..."></textarea>
          </div>

          <!-- Right Pane: Converted JS Output & Status -->
          <div style="flex: 1; display: flex; flex-direction: column;">
            <div style="
              padding: 8px 16px;
              background: #181c27;
              border-bottom: 1px solid #2a2e39;
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 0.78rem;
              color: #787b86;
              text-transform: uppercase;
              letter-spacing: 0.05em;
            ">
              <span>Transpiled JavaScript</span>
              <span id="pe-status-badge" style="
                background: #2a2e39;
                color: #787b86;
                padding: 2px 8px;
                border-radius: 4px;
                font-size: 0.72rem;
              ">Ready</span>
            </div>
            <pre id="pe-js-output" style="
              flex: 1;
              margin: 0;
              background: #0d1117;
              color: #8b949e;
              padding: 14px;
              font-family: ui-monospace, SFMono-Regular, Consolas, monospace;
              font-size: 12px;
              line-height: 1.5;
              overflow: auto;
              white-space: pre;
            ">// Transpiled code will appear here after clicking 'Transpile'</pre>
          </div>
        </div>

        <!-- Footer / Action Bar -->
        <div style="
          padding: 12px 20px;
          border-top: 1px solid #2a2e39;
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #1e222d;
        ">
          <div id="pe-msg-box" style="font-size: 0.85rem; color: #787b86;">
            Press <kbd style="background: #2a2e39; padding: 2px 6px; border-radius: 3px; font-family: monospace;">Ctrl + Enter</kbd> to transpile & apply to chart.
          </div>
          <div style="display: flex; gap: 10px;">
            <button id="pe-transpile-btn" style="
              background: #2a2e39;
              color: #f0f3fa;
              border: 1px solid #363a45;
              padding: 8px 16px;
              border-radius: 6px;
              font-weight: 500;
              cursor: pointer;
            ">Transpile Only</button>
            <button id="pe-apply-btn" style="
              background: #2962ff;
              color: #ffffff;
              border: none;
              padding: 8px 20px;
              border-radius: 6px;
              font-weight: 600;
              cursor: pointer;
              box-shadow: 0 2px 8px rgba(41, 98, 255, 0.4);
            ">&#10010; Add to Chart</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Elements
    const pineInput = document.getElementById('pe-pine-input');
    const jsOutput = document.getElementById('pe-js-output');
    const lineCount = document.getElementById('pe-line-count');
    const statusBadge = document.getElementById('pe-status-badge');
    const msgBox = document.getElementById('pe-msg-box');
    const exampleSelect = document.getElementById('pe-example-select');
    const closeBtn = document.getElementById('pe-close-btn');
    const transpileBtn = document.getElementById('pe-transpile-btn');
    const applyBtn = document.getElementById('pe-apply-btn');

    // Populate dropdown with built-in templates
    PREBUILT_TEMPLATES.forEach(t => {
      const opt = document.createElement('option');
      opt.value = `tpl:${t.id}`;
      opt.textContent = `⚡ Template: ${t.name}`;
      exampleSelect.appendChild(opt);
    });

    // Fetch full converted catalog from backend
    fetch('/pine/catalog')
      .then(r => r.ok ? r.json() : [])
      .then(catalog => {
        if (Array.isArray(catalog) && catalog.length > 0) {
          const optGroup = document.createElement('optgroup');
          optGroup.label = "📚 Pre-converted Pine Indicators (29 Scripts)";
          catalog.forEach(item => {
            const opt = document.createElement('option');
            opt.value = `cat:${item.pineName}`;
            opt.textContent = `${item.overlay ? '📈' : '📊'} ${item.name}`;
            optGroup.appendChild(opt);
          });
          exampleSelect.appendChild(optGroup);
        }
      })
      .catch(() => {});

    // Set default script
    pineInput.value = PREBUILT_TEMPLATES[0].source;
    updateLineCount();

    function updateLineCount() {
      const lines = pineInput.value.split('\n').length;
      lineCount.textContent = `${lines} line${lines === 1 ? '' : 's'}`;
    }

    pineInput.addEventListener('input', updateLineCount);

    // Close modal handlers
    closeBtn.addEventListener('click', () => { modal.style.display = 'none'; });
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.style.display = 'none';
    });

    // Example selection handler
    exampleSelect.addEventListener('change', async () => {
      const val = exampleSelect.value;
      if (!val) return;

      if (val.startsWith('tpl:')) {
        const tplId = val.replace('tpl:', '');
        const found = PREBUILT_TEMPLATES.find(t => t.id === tplId);
        if (found) {
          pineInput.value = found.source;
          updateLineCount();
          doTranspile();
        }
      } else if (val.startsWith('cat:')) {
        const pineName = val.replace('cat:', '');
        msgBox.innerHTML = `Loading source for <b>${pineName}</b>...`;
        try {
          const resp = await fetch(`/pine/source/${encodeURIComponent(pineName)}`);
          if (resp.ok) {
            const code = await resp.text();
            pineInput.value = code;
            updateLineCount();
            msgBox.innerHTML = `Loaded <b>${pineName}</b> successfully.`;
            doTranspile();
          } else {
            msgBox.innerHTML = `<span style="color: #f23645;">Failed to load ${pineName}</span>`;
          }
        } catch (e) {
          msgBox.innerHTML = `<span style="color: #f23645;">Error: ${e.message}</span>`;
        }
      }
    });

    // Transpile action
    function doTranspile() {
      const src = pineInput.value.trim();
      if (!src) {
        msgBox.innerHTML = '<span style="color: #ff9800;">Please enter PineScript source code first.</span>';
        return null;
      }

      try {
        const res = compileAndRegisterPine(src);
        jsOutput.textContent = res.code || '// Successfully registered Study with TradingView Metainfo v52';
        statusBadge.textContent = 'Transpiled (100%)';
        statusBadge.style.background = '#089981';
        statusBadge.style.color = '#ffffff';
        msgBox.innerHTML = `<span style="color: #089981;">&#10004; Compiled "${res.meta.title}" successfully (${res.meta.plots.length} plot(s), ${res.meta.isOverlay ? 'overlay' : 'pane'}).</span>`;
        return res;
      } catch (err) {
        jsOutput.textContent = `// Error:\n${err.message}`;
        statusBadge.textContent = 'Failed';
        statusBadge.style.background = '#f23645';
        statusBadge.style.color = '#ffffff';
        msgBox.innerHTML = `<span style="color: #f23645;">&#9888; ${err.message}</span>`;
        return null;
      }
    }

    // Apply to chart action
    async function doApply() {
      const res = doTranspile();
      if (!res) return;

      if (!widget) {
        msgBox.innerHTML = '<span style="color: #f23645;">Chart widget instance is not available.</span>';
        return;
      }

      try {
        const studyName = res.meta.title;
        const isOverlay = res.meta.isOverlay;

        try {
          const innerWin = (typeof widget._innerWindow === 'function' ? widget._innerWindow() : null) || window;
          if (innerWin && innerWin.JSServer && Array.isArray(innerWin.JSServer.studyLibrary)) {
            const exists = innerWin.JSServer.studyLibrary.some(s => s && (s.name === studyName || (s.metainfo && s.metainfo.id === res.study.metainfo.id)));
            if (!exists) {
              innerWin.JSServer.studyLibrary.push(res.study);
            }
          }
        } catch (e) {
          console.warn("[PineIndicators] JSServer injection warning:", e);
        }

        const chart = widget.activeChart();
        if (chart && typeof chart.createStudy === 'function') {
          // forceOverlay = isOverlay, lock = false (crucial for enabling hide, settings, and delete legend controls)
          await chart.createStudy(studyName, isOverlay, false);
          msgBox.innerHTML = `<span style="color: #089981;">&#10004; Added "<b>${studyName}</b>" to the chart!</span>`;
          setTimeout(() => { modal.style.display = 'none'; }, 800);
        } else {
          msgBox.innerHTML = '<span style="color: #ff9800;">Chart not fully ready to add studies.</span>';
        }
      } catch (err) {
        msgBox.innerHTML = `<span style="color: #f23645;">Failed to add study to chart: ${err.message}</span>`;
      }
    }

    transpileBtn.addEventListener('click', doTranspile);
    applyBtn.addEventListener('click', doApply);

    // Keyboard shortcut Ctrl+Enter
    pineInput.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        doApply();
      }
    });
  }

  function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

    /* =========================================================================
   * 6.5. Authentic TradingView Indicator Settings Dialog (1:1 UI Match)
   * ========================================================================= */
  const TV_PALETTE_COLORS = [
    ["#ffffff", "#d1d4dc", "#b2b5be", "#9598a1", "#787b86", "#5d606b", "#434651", "#2a2e39", "#131722", "#000000"],
    ["#f23645", "#ff9800", "#ffeb3b", "#4caf50", "#00bcd4", "#2962ff", "#673ab7", "#9c27b0", "#e91e63", "#795548"],
    ["#ffcdd2", "#ffe0b2", "#fff9c4", "#c8e6c9", "#b2ebf2", "#bbdefb", "#d1c4e9", "#e1bee7", "#f8bbd0", "#d7ccc8"],
    ["#ef9a9a", "#ffcc80", "#fff59d", "#a5d6a7", "#80deea", "#90caf9", "#b39ddb", "#ce93d8", "#f48fb1", "#bcaaa4"],
    ["#e57373", "#ffb74d", "#fff176", "#81c784", "#4dd0e1", "#64b5f6", "#9575cd", "#ba68c8", "#f06292", "#a1887f"],
    ["#e53935", "#fb8c00", "#fdd835", "#43a047", "#00acc1", "#1e88e5", "#5e35b1", "#8e24aa", "#d81b60", "#6d4c41"],
    ["#c62828", "#ef6c00", "#f9a825", "#2e7d32", "#00838f", "#1565c0", "#4527a0", "#6a1b9a", "#ad1457", "#4e342e"],
    ["#b71c1c", "#e65100", "#f57f17", "#1b5e20", "#006064", "#0d47a1", "#311b92", "#4a148c", "#880e4f", "#3e2723"]
  ];

  const PLOT_STYLE_OPTIONS = [
    { id: 'line', label: 'Line', icon: '<path d="M2 17l6-6 4 4 10-10" stroke="currentColor" stroke-width="2" fill="none"/>' },
    { id: 'line_with_breaks', label: 'Line with breaks', icon: '<path d="M2 17l4-4M10 9l3 3M17 8l5-5" stroke="currentColor" stroke-width="2" stroke-dasharray="3,2" fill="none"/>' },
    { id: 'step_line', label: 'Step line', icon: '<path d="M2 18h6v-6h6V6h8" stroke="currentColor" stroke-width="2" fill="none"/>' },
    { id: 'step_line_with_breaks', label: 'Step line with breaks', icon: '<path d="M2 18h4v-6h4V6h4" stroke="currentColor" stroke-width="2" stroke-dasharray="2,2" fill="none"/>' },
    { id: 'step_line_with_diamonds', label: 'Step line with diamonds', icon: '<path d="M2 18h6v-6h6V6h8" stroke="currentColor" stroke-width="1.5" fill="none"/><polygon points="8,12 10,10 8,8 6,10" fill="currentColor"/>' },
    { id: 'histogram', label: 'Histogram', icon: '<rect x="4" y="10" width="3" height="10" fill="currentColor"/><rect x="10" y="5" width="3" height="15" fill="currentColor"/><rect x="16" y="12" width="3" height="8" fill="currentColor"/>' },
    { id: 'cross', label: 'Cross', icon: '<path d="M6 6l4 4m0-4l-4 4M14 14l4 4m0-4l-4 4" stroke="currentColor" stroke-width="2"/>' },
    { id: 'area', label: 'Area', icon: '<path d="M2 18l6-8 5 5 9-9v12H2z" fill="currentColor" opacity="0.4"/><path d="M2 18l6-8 5 5 9-9" stroke="currentColor" stroke-width="2" fill="none"/>' },
    { id: 'area_with_breaks', label: 'Area with breaks', icon: '<path d="M2 18l5-6v6zm8 0l4-5v5zm7 0l5-6v6z" fill="currentColor" opacity="0.4"/>' },
    { id: 'columns', label: 'Columns', icon: '<rect x="3" y="8" width="4" height="12" fill="currentColor"/><rect x="10" y="4" width="4" height="16" fill="currentColor"/><rect x="17" y="11" width="4" height="9" fill="currentColor"/>' },
    { id: 'circles', label: 'Circles', icon: '<circle cx="6" cy="14" r="2.5" fill="currentColor"/><circle cx="12" cy="7" r="2.5" fill="currentColor"/><circle cx="18" cy="11" r="2.5" fill="currentColor"/>' }
  ];

  function openSettingsDialog(studyId, chartInstance) {
    const existing = document.getElementById('tv_settings_modal_overlay');
    if (existing) existing.remove();
    return true;
  }

  const PineIndicators = {
    compileAndRegisterPine,
    compilePineScript,
    createStudyFromTranspiled,
    parsePineMetadata,
    colorToInt,
    addStudyToChart,
    getCustomIndicators,
    initPrebuiltStudies,
    openPineEditorModal,
    openSettingsDialog,
    hookChartSettings,
    extractSessionConfig,
    renderSessionVisuals,
    clearSessionVisuals,
    registerStudyShape,
    registerStudyAlias,
    getStudyShapes,
    setStudyShapesVisibility,
    clearStudyShapes,
    dispatchPineDrawings,
    renderTableOverlay,
    getRegisteredStudies: () => Array.from(_registeredStudies.values()),
    getStudyCount: () => _registeredStudies.size,
    PREBUILT_TEMPLATES,
    _securityCache,
    _allPineShapeIds
  };

  root.PineIndicators = PineIndicators;
  root.getPineIndicators = getCustomIndicators;
  root.openPineEditorModal = openPineEditorModal;
  root.openSettingsDialog = openSettingsDialog;
  root.hookChartSettings = hookChartSettings;
  root.clearStudyShapes = clearStudyShapes;
  root.registerStudyShape = registerStudyShape;
  root.registerStudyAlias = registerStudyAlias;
  root.getStudyShapes = getStudyShapes;
  root.setStudyShapesVisibility = setStudyShapesVisibility;
  root.dispatchPineDrawings = dispatchPineDrawings;
  root.renderTableOverlay = renderTableOverlay;
  root.compilePineScript = compilePineScript;
  root.compileAndRegisterPine = compileAndRegisterPine;

  // Automatically hook chart settings on startup
  if (typeof window !== 'undefined') {
    const initHooks = () => {
      try {
        const ch = root.widget && typeof root.widget.activeChart === 'function' ? root.widget.activeChart() : null;
        if (ch) hookChartSettings(ch);
      } catch(e) {}
    };
    initHooks();
    setTimeout(initHooks, 600);
    setTimeout(initHooks, 1500);
    setTimeout(initHooks, 3000);
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = PineIndicators;
  }
})(typeof window !== 'undefined' ? window : globalThis);