/**
 * MT5Broker — TradingView Broker API Implementation
 * Connects TradingView's native trading UI to MetaTrader 5 via /trade/* REST endpoints.
 *
 * This replaces all custom HTML trading overlays with TradingView's built-in:
 *   - Account Manager (bottom panel with positions, orders, history)
 *   - Order Dialog (F9 or right-click trade)
 *   - Buy/Sell buttons on chart
 *   - Draggable SL/TP position lines on chart
 *   - Account summary bar (Balance, Equity, Margin, Free Margin, P&L)
 */
(function (root) {
  'use strict';

  // ─── TradingView Enum Constants ─────────────────────────────────────
  var OrderSide   = { Buy: 1, Sell: -1 };
  var OrderType   = { Limit: 1, Market: 2, Stop: 3, StopLimit: 4 };
  var OrderStatus = { Canceled: 1, Filled: 2, Inactive: 3, Placing: 4, Rejected: 5, Working: 6 };
  var OrderStatusFilter = { All: 0, Canceled: 1, Filled: 2, Inactive: 3, Rejected: 5, Working: 6 };
  var ParentType  = { Order: 1, Position: 2, IndividualPosition: 3 };
  var ConnectionStatus = { Connected: 1, Connecting: 2, Disconnected: 3, Error: 4 };
  var NotificationType = { Error: 0, Success: 1 };

  // ─── MT5 <-> TV Type Mapping ──────────────────────────────────────────
  function mt5SideToTV(mt5Type) {
    if (typeof mt5Type === 'number') {
      return mt5Type === 1 ? OrderSide.Sell : OrderSide.Buy;
    }
    if (!mt5Type) return OrderSide.Buy;
    var t = ('' + mt5Type).toUpperCase();
    return t.startsWith('SELL') ? OrderSide.Sell : OrderSide.Buy;
  }

  function mt5OrderTypeToTV(mt5Type) {
    if (!mt5Type) return OrderType.Market;
    var t = ('' + mt5Type).toUpperCase();
    if (t.includes('STOP') && t.includes('LIMIT')) return OrderType.StopLimit;
    if (t.includes('LIMIT')) return OrderType.Limit;
    if (t.includes('STOP'))  return OrderType.Stop;
    return OrderType.Market;
  }

  function tvSideToMT5(tvSide) {
    return tvSide === OrderSide.Sell ? 'SELL' : 'BUY';
  }

  function extractBracketPrice(val) {
    if (val === undefined || val === null) return undefined;
    if (typeof val === 'number') return val;
    if (typeof val === 'object') {
      if (typeof val.price === 'number') return val.price;
      if (val.price !== undefined) {
        var p = parseFloat(val.price);
        if (!isNaN(p)) return p;
      }
    }
    var parsed = parseFloat(val);
    return isNaN(parsed) ? undefined : parsed;
  }

  // ─── Timezone Normalization ───────────────────────────────────────────
  function normalizeBarTime(brokerEpochSec, serverNowSec) {
    if (!brokerEpochSec) return Math.floor(Date.now() / 1000);
    var nowSec = serverNowSec || Math.floor(Date.now() / 1000);
    var diff = brokerEpochSec - nowSec;
    // Quantized UTC offset formula: hours_offset = round((tick.time - time.time()) / 1800) * 1800
    var hoursOffset = Math.round(diff / 1800) * 1800;
    return brokerEpochSec - hoursOffset;
  }

  // ─── MT5Broker Class ────────────────────────────────────────────────
  function MT5Broker(host, backendUrl) {
    this._host = host;
    this._backendUrl = backendUrl.replace(/\/$/, '');

    // Internal state
    this._positionById = {};
    this._orderById = {};
    this._realtimeSymbols = {};
    this._contractSizes = {
      'XAUUSD.': 100.0,
      'XAUUSD': 100.0,
      'EURUSD.': 100000.0,
      'EURUSD': 100000.0,
      'GBPUSD.': 100000.0,
      'GBPUSD': 100000.0,
      'USDJPY.': 100000.0,
      'USDJPY': 100000.0,
      'AUDCAD.': 100000.0,
      'AUDCAD': 100000.0,
      'AUDUSD.': 100000.0,
      'AUDUSD': 100000.0,
      'USDCAD.': 100000.0,
      'USDCAD': 100000.0,
      'USDCHF.': 100000.0,
      'USDCHF': 100000.0,
      'BTCUSD.': 1.0,
      'BTCUSD': 1.0,
      'ETHUSD.': 1.0,
      'ETHUSD': 1.0,
      'NAS100.': 10.0,
      'NAS100': 10.0,
      'US30.': 1.0,
      'US30': 1.0,
      'SPX500.': 10.0,
      'SPX500': 10.0,
      'GER40.': 1.0,
      'GER40': 1.0,
      'XAGUSD.': 5000.0,
      'XAGUSD': 5000.0,
      'USOIL.': 100.0,
      'USOIL': 100.0,
      'UKOIL.': 100.0,
      'UKOIL': 100.0
    };
    this._positionPLLsteners = {};
    this._indivPLLsteners = {};
    this._accountData = {
      title: 'MT5 Demo',
      balance: 0,
      equity: 0,
      pl: 0,
      margin: 0,
      freeMargin: 0,
      marginLevel: 0
    };
    this._accountInfo = this._accountData;

    // Account Manager delegates
    this._amChangeDelegate = this._host.factory.createDelegate();
    this._balanceValue    = this._host.factory.createWatchedValue(0);
    this._equityValue     = this._host.factory.createWatchedValue(0);
    this._plValue         = this._host.factory.createWatchedValue(0);
    this._marginValue     = this._host.factory.createWatchedValue(0);
    this._freeMarginValue = this._host.factory.createWatchedValue(0);

    // Make sure buy/sell buttons are visible and draggable bracket modifications are instant
    try {
      var bb = this._host.sellBuyButtonsVisibility && this._host.sellBuyButtonsVisibility();
      if (bb && typeof bb.setValue === 'function' && !bb.value()) {
        bb.setValue(true);
      }
    } catch (e) {}

    try {
      var silent = this._host.silentOrdersPlacement && this._host.silentOrdersPlacement();
      if (silent && typeof silent.setValue === 'function' && !silent.value()) {
        silent.setValue(true);
      }
    } catch (e) {}

    // Seed initial state from Node.js dynamic HTML injection (instant local cache)
    var self = this;
    if (typeof window !== 'undefined' && window.__NODE_SERVER_STATE__) {
      var boot = window.__NODE_SERVER_STATE__;
      if (boot.positions && Array.isArray(boot.positions)) {
        boot.positions.forEach(function (pos) {
          var posId = '' + pos.ticket;
          var sideNum = (pos.type_name === 'SELL' || pos.type === 1 || pos.type === 'SELL') ? OrderSide.Sell : OrderSide.Buy;
          self._positionById[posId] = {
            id: posId,
            ticket: pos.ticket,
            _mt5Ticket: pos.ticket,
            symbol: pos.symbol,
            side: sideNum,
            qty: pos.volume,
            avgPrice: pos.price_open,
            price: pos.price_open,
            last: pos.price_current,
            profit: pos.profit,
            pl: pos.profit,
            swap: pos.swap || 0,
            contract_size: pos.contract_size,
            tick_size: pos.tick_size,
            tick_value: pos.tick_value,
            canBeClosed: true,
            stopLoss: pos.sl && pos.sl > 0 ? pos.sl : undefined,
            takeProfit: pos.tp && pos.tp > 0 ? pos.tp : undefined
          };
        });
      }
      if (boot.account) {
        self._accountData.balance = boot.account.balance || 0;
        self._accountData.equity = boot.account.equity || 0;
        self._accountData.pl = (boot.account.equity || 0) - (boot.account.balance || 0);
        self._accountData.margin = boot.account.margin || 0;
        self._accountData.freeMargin = boot.account.margin_free || boot.account.free_margin || 0;
        self._accountData.marginLevel = boot.account.margin_level || 0;
        try { self._balanceValue.setValue(self._accountData.balance); } catch (e) {}
        try { self._equityValue.setValue(self._accountData.equity); } catch (e) {}
        try { self._plValue.setValue(self._accountData.pl); } catch (e) {}
        try { self._marginValue.setValue(self._accountData.margin); } catch (e) {}
        try { self._freeMarginValue.setValue(self._accountData.freeMargin); } catch (e) {}
      }
    }

    // Start polling & ultra-low latency WebSocket push stream (deferred to allow TV to attach adapter)
    this._wsReconnectDelayMs = 500;
    this._pollIntervalMs = 1000;
    this._lastWsQuoteTime = 0;
    this._pollTimer = null;
    setTimeout(function () {
      self._startPolling();
      self._initWebSocket();
    }, 250);
  }

  MT5Broker.prototype = {

    _safeHost: function (method) {
      if (!this._host) return;
      var fn = this._host[method];
      if (typeof fn !== 'function') return;
      var args = Array.prototype.slice.call(arguments, 1);
      try {
        return fn.apply(this._host, args);
      } catch (e) {
        // Suppress benign adapter timing errors before TradingView finishes wiring its internal delegates
      }
    },

    getCustomFieldsModels: function () {
      return [];
    },

    customFieldsModels: function () {
      return [];
    },

    // ── Connection ──────────────────────────────────────────────────
    connectionStatus: function () {
      return ConnectionStatus.Connected;
    },

    metainfo: function () {
      return {
        id: 'mt5_broker',
        title: 'MetaTrader 5 Bridge',
        configFlags: {
          supportReversePosition: true,
          supportPositionReverse: true,
          supportStopLoss: true,
          supportClosePosition: true,
          supportPartialClosePosition: true,
          supportEditAmount: false,
          supportLevel2Data: true,
          supportDOM: true,
          supportMarketOrders: true,
          supportLimitOrders: true,
          supportStopOrders: true,
          supportStopLimitOrders: true,
          supportPositionBrackets: true,
          showQuantityInsteadOfAmount: true,
          supportOrderBrackets: true,
          supportModifyOrder: true,
          supportModifyOrderPrice: true,
          supportCancelOrder: true,
          supportModifyBrackets: true,
          supportModifyPositionBrackets: true,
          supportModifyOrderBrackets: true,
          supportAddBracketsToExistingOrder: true,
          supportPositions: true,
          supportOrdersHistory: true,
          supportExecutions: true,
          supportBalances: false,
          supportMarketBrackets: true,
          supportStopOrdersInBothDirections: true,
          supportStopLimitOrdersInBothDirections: true,
          supportTrailingStop: true,
          supportModifyTrailingStop: true,
          supportPLUpdate: true,
          showNotificationsLog: true,
          supportRiskControlsAndInfo: true
        }
      };
    },

    currentAccount: function () {
      if (typeof window !== 'undefined' && window.__NODE_SERVER_STATE__) {
        var isOanda = window.__NODE_SERVER_STATE__.brokerBackend === 'OANDA';
        if (window.__NODE_SERVER_STATE__.account && window.__NODE_SERVER_STATE__.account.login) {
          return String(window.__NODE_SERVER_STATE__.account.login);
        }
        return isOanda ? '101-001-40395350-001' : '70257567';
      }
      return '101-001-40395350-001';
    },

    accountsMetainfo: function () {
      var state = (typeof window !== 'undefined' && window.__NODE_SERVER_STATE__) || {};
      var acc = state.account || {};
      var isOanda = state.brokerBackend === 'OANDA' || (acc.server && acc.server.indexOf('oanda') !== -1);
      var pt = state.priceType || 'MID';
      var id = String(acc.login || (isOanda ? '101-001-40395350-001' : '70257567'));
      var baseName = acc.name || (isOanda ? 'OANDA Practice (101-001-40395350-001)' : 'MT5 Demo — Vinod (OrbexGlobal)');
      var name = baseName.indexOf('[') === -1 ? (baseName + ' [' + pt + ']') : baseName;
      var curr = acc.currency || 'USD';
      return Promise.resolve([{
        id: id,
        name: name,
        currency: curr
      }]);
    },

    accountManagerInfo: function () {
      var self = this;
      var state = (typeof window !== 'undefined' && window.__NODE_SERVER_STATE__) || {};
      var isOanda = state.brokerBackend === 'OANDA' || (state.account && state.account.server && state.account.server.indexOf('oanda') !== -1);
      var pt = state.priceType || 'MID';
      var title = isOanda ? ('OANDA Practice [' + pt + ']') : ('MT5 Demo [' + pt + ']');
      return {
        accountTitle: title,
        summary: [
          { text: 'Balance',     wValue: self._balanceValue,    formatter: 'fixed', isDefault: true },
          { text: 'Equity',      wValue: self._equityValue,     formatter: 'fixed', isDefault: true },
          { text: 'Open P&L',    wValue: self._plValue,         formatter: 'profit' },
          { text: 'Margin',      wValue: self._marginValue,     formatter: 'fixed' },
          { text: 'Free Margin', wValue: self._freeMarginValue, formatter: 'fixed' }
        ],
        orderColumns: [
          { label: 'Symbol',      id: 'symbol',     dataFields: ['symbol', 'symbol', 'message'], formatter: 'symbol' },
          { label: 'Side',        id: 'side',        dataFields: ['side'],        formatter: 'side' },
          { label: 'Type',        id: 'type',        dataFields: ['type', 'parentId', 'stopType'], formatter: 'type' },
          { label: 'Qty',         id: 'qty',         dataFields: ['qty'],         formatter: 'formatQuantity', alignment: 'right' },
          { label: 'Limit Price', id: 'limitPrice',  dataFields: ['limitPrice'],  formatter: 'formatPrice', alignment: 'right' },
          { label: 'Stop Price',  id: 'stopPrice',   dataFields: ['stopPrice'],   formatter: 'formatPrice', alignment: 'right' },
          { label: 'Last',        id: 'last',        dataFields: ['last'],        formatter: 'formatPriceForexSup', alignment: 'right', highlightDiff: true },
          { label: 'Status',      id: 'status',      dataFields: ['status'],      formatter: 'status', supportedStatusFilters: [OrderStatusFilter.All, OrderStatusFilter.Working, OrderStatusFilter.Filled, OrderStatusFilter.Canceled] },
          { label: 'Ticket',      id: 'id',          dataFields: ['id'] }
        ],
        positionColumns: [
          { label: 'Symbol',      id: 'symbol',     dataFields: ['symbol', 'symbol', 'message'], formatter: 'symbol' },
          { label: 'Side',        id: 'side',        dataFields: ['side'],        formatter: 'side' },
          { label: 'Qty',         id: 'qty',         dataFields: ['qty'],         formatter: 'formatQuantity', alignment: 'right' },
          { label: 'Avg Price',   id: 'avgPrice',    dataFields: ['avgPrice'],    formatter: 'formatPrice', alignment: 'right' },
          { label: 'Last',        id: 'last',        dataFields: ['last'],        formatter: 'formatPriceForexSup', alignment: 'right', highlightDiff: true },
          { label: 'Profit',      id: 'pl',          dataFields: ['pl'],          formatter: 'profit', alignment: 'right' },
          { label: 'Stop Loss',   id: 'stopLoss',    dataFields: ['stopLoss'],    formatter: 'formatPrice', alignment: 'right' },
          { label: 'Take Profit', id: 'takeProfit',  dataFields: ['takeProfit'],  formatter: 'formatPrice', alignment: 'right' }
        ],
        historyColumns: [
          { label: 'Symbol',      id: 'symbol',     dataFields: ['symbol', 'symbol', 'message'], formatter: 'symbol' },
          { label: 'Side',        id: 'side',        dataFields: ['side'],        formatter: 'side' },
          { label: 'Type',        id: 'type',        dataFields: ['type'],        formatter: 'type' },
          { label: 'Qty',         id: 'qty',         dataFields: ['qty'],         formatter: 'formatQuantity', alignment: 'right' },
          { label: 'Price',       id: 'price',       dataFields: ['price'],       formatter: 'formatPrice', alignment: 'right' },
          { label: 'Status',      id: 'status',      dataFields: ['status'],      formatter: 'status' },
          { label: 'Ticket',      id: 'id',          dataFields: ['id'] }
        ],
        pages: [
          {
            id: 'accountsummary',
            title: 'Account Summary',
            tables: [{
              id: 'accountsummary',
              columns: [
                { label: 'Title',       id: 'title',      dataFields: ['title'],      notSortable: true },
                { label: 'Balance',     id: 'balance',    dataFields: ['balance'],    formatter: 'fixed', alignment: 'right' },
                { label: 'Open P&L',    id: 'pl',         dataFields: ['pl'],         formatter: 'profit', alignment: 'right', notSortable: true },
                { label: 'Equity',      id: 'equity',     dataFields: ['equity'],     formatter: 'fixed', alignment: 'right', notSortable: true },
                { label: 'Margin',      id: 'margin',     dataFields: ['margin'],     formatter: 'fixed', alignment: 'right' },
                { label: 'Free Margin', id: 'freeMargin', dataFields: ['freeMargin'], formatter: 'fixed', alignment: 'right' }
              ],
              getData: function () {
                return Promise.resolve([self._accountData]);
              },
              initialSorting: { property: 'balance', asc: false },
              changeDelegate: self._amChangeDelegate
            }]
          }
        ],
        contextMenuActions: function (contextMenuEvent, activeOrdersIds) {
          return Promise.resolve(self._bottomContextMenuItems(activeOrdersIds));
        }
      };
    },

    // ── Symbol Info ──────────────────────────────────────────────────
    symbolInfo: function (symbol) {
      var self = this;
      return fetch(this._backendUrl + '/symbols?symbol=' + encodeURIComponent(symbol))
        .then(function (r) { return r.json(); })
        .then(function (info) {
          var minTick = (info.tick_size !== undefined && info.tick_size !== null) ? Number(info.tick_size) : (info.pricescale ? (1 / info.pricescale) : 0.01);
          var cSize = (info.pointvalue !== undefined && info.pointvalue !== null) ? Number(info.pointvalue) : (symbol.includes('XAU') ? 100.0 : (symbol.includes('BTC') || symbol.includes('ETH') ? 1.0 : 100000.0));
          self._contractSizes = self._contractSizes || {};
          self._contractSizes[symbol] = cSize;
          self._contractSizes[symbol.replace(/\.$/, '')] = cSize;

          var pipSize = Number(info.pip_size) || (info.digits === 3 || info.digits === 5 ? (minTick * 10) : minTick) || 0.01;
          var pipVal = (info.pip_value !== undefined && info.pip_value !== null) ? Number(info.pip_value) : ((cSize * pipSize) || (minTick * 100) || 1);

          var minQ = (info.minqty !== undefined && info.minqty !== null) ? Number(info.minqty) : 0.01;
          var maxQ = (info.maxqty !== undefined && info.maxqty !== null) ? Number(info.maxqty) : 100.0;
          var stepQ = (info.qtystep !== undefined && info.qtystep !== null) ? Number(info.qtystep) : 0.01;

          var digits = (info.digits !== undefined && info.digits !== null) ? Number(info.digits) : (info.pricescale ? Math.round(Math.log10(info.pricescale)) : 2);

          return {
            qty: { min: minQ, max: maxQ, step: stepQ, default: minQ },
            pipValue: pipVal,
            pipSize: pipSize,
            pointvalue: cSize,
            minTick: minTick,
            digits: digits,
            precision: digits,
            description: info.description || symbol,
            type: info.type || 'forex',
            exchange: info.exchange || 'MT5',
            baseCurrency: info.base_currency || '',
            quoteCurrency: info.quote_currency || 'USD',
            currency: info.currency_code || 'USD',
            allowedOrderTypes: [1, 2, 3, 4],
            limitPriceStep: minTick,
            stopPriceStep: minTick,
            allowedDurations: [
              { name: 'GTC', value: 'GTC' },
              { name: 'DAY', value: 'DAY' }
            ]
          };
        })
        .catch(function () {
          return {
            qty: { min: 0.01, max: 100, step: 0.01, default: 0.01 },
            pipValue: 1,
            pipSize: 0.1,
            minTick: 0.01,
            digits: 2,
            precision: 2,
            description: symbol,
            type: 'forex',
            exchange: 'MT5',
            baseCurrency: '',
            quoteCurrency: 'USD',
            allowedOrderTypes: [1, 2, 3, 4],
            limitPriceStep: 0.01,
            stopPriceStep: 0.01,
            allowedDurations: [
              { name: 'GTC', value: 'GTC' },
              { name: 'DAY', value: 'DAY' }
            ]
          };
        });
    },

    // ── Tradability ─────────────────────────────────────────────────
    isTradable: function (symbol) {
      return Promise.resolve(true);
    },

    // ── Formatters ──────────────────────────────────────────────────
    formatter: function (symbol, isForexSup) {
      if (this._host && typeof this._host.defaultFormatter === 'function') {
        return this._host.defaultFormatter(symbol, isForexSup);
      }
      var s = (symbol || '').toUpperCase();
      var digits = s.includes('JPY') ? 3 : (s.includes('XAU') ? 2 : (s.includes('BTC') || s.includes('ETH') ? 2 : 5));
      return Promise.resolve({
        format: function (val) { return typeof val === 'number' ? val.toFixed(digits) : '' + val; }
      });
    },

    quantityFormatter: function (symbol) {
      if (this._host && typeof this._host.quantityFormatter === 'function') {
        return this._host.quantityFormatter();
      }
      return Promise.resolve({
        format: function (qty) { return typeof qty === 'number' ? qty.toFixed(2) : '' + qty; }
      });
    },

    spreadFormatter: function (symbol) {
      if (this._host && typeof this._host.defaultFormatter === 'function') {
        return this._host.defaultFormatter(symbol, false);
      }
      return Promise.resolve({
        format: function (val) { return typeof val === 'number' ? val.toFixed(1) : '' + val; }
      });
    },

    chartContextMenuActions: function (context, options) {
      return this._host.defaultContextMenuActions(context);
    },

    // ── Order Dialog Options (required for PreOrderItem) ────────────
    getOrderDialogOptions: function (symbol) {
      return Promise.resolve({
        customFields: [],
        links: [],
        flags: {
          supportPlaceOrderPreview: true,
          supportModifyOrderPreview: true,
          supportOrderBrackets: true,
          supportPositionBrackets: true,
          supportStopLimitOrders: true,
          supportMarketBrackets: true,
          supportModifyBrackets: true,
          supportAddBracketsToExistingOrder: true,
          supportStopOrdersInBothDirections: true,
          supportStopLimitOrdersInBothDirections: true
        }
      });
    },

    // ── Position Dialog Options ─────────────────────────────────────
    getPositionDialogOptions: function (symbol) {
      return Promise.resolve({
        customFields: [],
        flags: {
          supportPositionBrackets: true,
          supportModifyPositionBrackets: true
        }
      });
    },

    // ── Symbol-Specific Trading Options ─────────────────────────────
    getSymbolSpecificTradingOptions: function (symbol) {
      return this.symbolInfo(symbol).then(function (info) {
        return {
          allowedOrderTypes: info.allowedOrderTypes || [1, 2, 3, 4],
          limitPriceStep: info.limitPriceStep || info.minTick || 0.01,
          stopPriceStep: info.stopPriceStep || info.minTick || 0.01,
          defaultExpiration: 'GTC',
          allowedDurations: info.allowedDurations || [
            { name: 'GTC', value: 'GTC' },
            { name: 'DAY', value: 'DAY' }
          ],
          supportPositionBrackets: true,
          supportIndividualPositionBrackets: true,
          supportModifyPositionBrackets: true,
          supportOrderBrackets: true,
          supportModifyOrderBrackets: true,
          supportModifyBrackets: true,
          supportAddBracketsToExistingOrder: true,
          supportPositionReverse: true,
          supportReversePosition: true,
          supportStopLoss: true
        };
      });
    },

    // ── Order Preview (for order confirmation dialog) ───────────────
    orderPreview: function (order) {
      var self = this;
      var volume = typeof order.qty === 'number' ? order.qty : (parseFloat(order.qty) || 0.01);
      var side = order.side === OrderSide.Buy ? 'BUY' : 'SELL';
      var symbol = order.symbol || '';
      var price = order.limitPrice || order.stopPrice || order.price || 0;

      return this.symbolInfo(symbol).then(function (info) {
        var minTick = info.minTick || 0.01;
        var pipValue = info.pipValue || 1;

        // Compute estimated margin (rough: volume * 1000 for forex leverage)
        var estimatedMargin = volume * 1000;
        var sections = [
          {
            header: 'Order Summary',
            rows: [
              { title: 'Symbol', value: symbol },
              { title: 'Side', value: side },
              { title: 'Type', value: order.type === OrderType.Limit ? 'Limit' : (order.type === OrderType.Stop ? 'Stop' : (order.type === OrderType.StopLimit ? 'Stop Limit' : 'Market')) },
              { title: 'Volume', value: volume.toFixed(2) + ' lots' }
            ]
          }
        ];

        if (price > 0) {
          sections[0].rows.push({ title: 'Price', value: price.toFixed(info.minTick < 0.01 ? 5 : 2) });
        }

        if (order.stopLoss) {
          var slPrice = extractBracketPrice(order.stopLoss);
          if (slPrice) sections[0].rows.push({ title: 'Stop Loss', value: slPrice.toFixed(info.minTick < 0.01 ? 5 : 2) });
        }
        if (order.takeProfit) {
          var tpPrice = extractBracketPrice(order.takeProfit);
          if (tpPrice) sections[0].rows.push({ title: 'Take Profit', value: tpPrice.toFixed(info.minTick < 0.01 ? 5 : 2) });
        }

        sections.push({
          header: 'Estimated Costs',
          rows: [
            { title: 'Estimated Margin', value: '$' + estimatedMargin.toFixed(2) },
            { title: 'Commission', value: '$0.00' }
          ]
        });

        return {
          sections: sections,
          confirmId: 'mt5_order_' + Date.now(),
          warnings: [],
          errors: []
        };
      });
    },

    // ── Validation Rules ────────────────────────────────────────────
    getValidationRules: function (symbol) {
      return Promise.resolve([]);
    },

    // ── Place Order ─────────────────────────────────────────────────
    placeOrder: function (order) {
      var self = this;
      var side = tvSideToMT5(order.side);
      var volume = typeof order.qty === 'number' ? order.qty : (parseFloat(order.qty) || 0.01);
      volume = Math.round(volume * 100) / 100;
      var sl = extractBracketPrice(order.stopLoss);
      var tp = extractBracketPrice(order.takeProfit);

      // Show Account Manager when first trade happens
      this._host.setAccountManagerVisibilityMode('normal');

      if (order.type === OrderType.Market || order.type === undefined) {
        // Market order
        var marketBody = {
          symbol: order.symbol,
          action: side,
          side: side,
          order_type: side,
          volume: volume
        };
        if (sl !== undefined && sl > 0) marketBody.sl = sl;
        if (tp !== undefined && tp > 0) marketBody.tp = tp;

        return fetch(this._backendUrl + '/trade/order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(marketBody)
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.retcode === 10009 || data.retcode === 10008 || data.success === true) {
            var tkt = data.ticket || data.order || data.deal || '';
            self._host.showNotification('Order Executed',
              side + ' ' + volume + ' ' + order.symbol + (tkt ? ' — Ticket #' + tkt : ''),
              NotificationType.Success);
            // Refresh immediately
            setTimeout(function () { self._syncAll(); }, 200);
            return { id: String(tkt) };
          } else {
            var errMsg = (data.comment || data.error || data.message || 'Unknown error') + ' (code: ' + data.retcode + ')';
            self._host.showNotification('Order Failed', errMsg, NotificationType.Error);
            return Promise.reject(new Error(errMsg));
          }
        })
        .catch(function (err) {
          self._host.showNotification('Order Error', err.message, NotificationType.Error);
          return Promise.reject(err);
        });

      } else {
        // Pending order (Limit / Stop / StopLimit)
        var orderType;
        if (order.type === OrderType.StopLimit) {
          orderType = side === 'BUY' ? 'BUY_STOP_LIMIT' : 'SELL_STOP_LIMIT';
        } else if (order.type === OrderType.Limit) {
          orderType = side === 'BUY' ? 'BUY_LIMIT' : 'SELL_LIMIT';
        } else {
          orderType = side === 'BUY' ? 'BUY_STOP' : 'SELL_STOP';
        }

        var price = extractBracketPrice(order.limitPrice !== undefined ? order.limitPrice : (order.stopPrice !== undefined ? order.stopPrice : order.price)) || 0;
        var pendingBody = {
          symbol: order.symbol,
          order_type: orderType,
          volume: volume,
          price: price
        };
        // StopLimit orders need both stop_price (trigger) and price (limit execution)
        if (order.type === OrderType.StopLimit) {
          var stopTrigger = extractBracketPrice(order.stopPrice);
          if (stopTrigger !== undefined && stopTrigger > 0) pendingBody.stop_price = stopTrigger;
          var limitExec = extractBracketPrice(order.limitPrice);
          if (limitExec !== undefined && limitExec > 0) pendingBody.price = limitExec;
        }
        if (sl !== undefined && sl > 0) pendingBody.sl = sl;
        if (tp !== undefined && tp > 0) pendingBody.tp = tp;

        return fetch(this._backendUrl + '/trade/pending', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(pendingBody)
        })
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data.retcode === 10009 || data.retcode === 10008 || data.success === true) {
            var tkt = data.ticket || data.order || '';
            self._host.showNotification('Pending Order Placed',
              orderType + ' ' + volume + ' ' + order.symbol + ' @ ' + price,
              NotificationType.Success);
            setTimeout(function () { self._syncAll(); }, 200);
            return { id: String(tkt) };
          } else {
            var errMsg = (data.comment || data.error || data.message || 'Unknown error');
            self._host.showNotification('Pending Order Failed', errMsg, NotificationType.Error);
            return Promise.reject(new Error(errMsg));
          }
        })
        .catch(function (err) {
          self._host.showNotification('Order Error', err.message, NotificationType.Error);
          return Promise.reject(err);
        });
      }
    },

    // ── Order Preview (Fixes "Order preview is not supported" Toast) ──
    previewOrder: function (order) {
      if (!order) return Promise.resolve({ sections: [] });
      var sym = order.symbol || 'XAUUSD.';
      var sideStr = order.side === OrderSide.Sell ? 'Sell' : 'Buy';
      var qtyStr = String(order.qty || 0.01);
      var priceStr = String(order.limitPrice !== undefined ? order.limitPrice : (order.stopPrice !== undefined ? order.stopPrice : (order.price !== undefined ? order.price : 'Market')));
      return Promise.resolve({
        sections: [
          {
            rows: [
              { title: 'Symbol', value: sym },
              { title: 'Side', value: sideStr },
              { title: 'Volume', value: qtyStr },
              { title: 'Price', value: priceStr }
            ]
          }
        ]
      });
    },
    placeOrderPreview: function (order) {
      return this.previewOrder(order);
    },
    modifyOrderPreview: function (order) {
      return this.previewOrder(order);
    },

    // ── Modify Order ────────────────────────────────────────────────
    modifyOrder: function (order) {
      var self = this;
      if (!order) return Promise.resolve({});

      // 1. Check if this is a position bracket order (SL or TP drag on chart canvas)
      var isBracket = (order.parentType === ParentType.Position ||
                       (typeof order.id === 'string' && (order.id.endsWith('_sl') || order.id.endsWith('_tp'))) ||
                       (order.parentId && self.findPosition(order.parentId)) ||
                       isNaN(parseInt(order.id, 10)));

      if (isBracket) {
        var parentPosId = order.parentId || (typeof order.id === 'string' ? order.id.replace(/_(sl|tp)$/, '') : undefined);
        var pos = parentPosId ? self.findPosition(parentPosId) : null;
        if (!pos && order.symbol) {
          pos = self.findPosition(order.symbol);
        }
        if (!pos) {
          var allList = self._getPositionsList();
          if (allList.length > 0) pos = allList[0];
        }

        if (pos) {
          var brackets = {};
          var pVal = extractBracketPrice(order.price !== undefined ? order.price : (order.stopPrice !== undefined ? order.stopPrice : order.limitPrice));
          var slVal = extractBracketPrice(order.stopLoss !== undefined ? order.stopLoss : order.stopPrice);
          var tpVal = extractBracketPrice(order.takeProfit !== undefined ? order.takeProfit : order.limitPrice);

          if (slVal !== undefined) brackets.stopLoss = slVal;
          if (tpVal !== undefined) brackets.takeProfit = tpVal;

          if (typeof order.id === 'string' && order.id.endsWith('_sl')) {
            brackets.stopLoss = pVal !== undefined ? pVal : slVal;
          } else if (typeof order.id === 'string' && order.id.endsWith('_tp')) {
            brackets.takeProfit = pVal !== undefined ? pVal : tpVal;
          } else if (order.type === OrderType.Stop) {
            brackets.stopLoss = pVal !== undefined ? pVal : slVal;
          } else if (order.type === OrderType.Limit) {
            brackets.takeProfit = pVal !== undefined ? pVal : tpVal;
          }

          return self.editPositionBrackets(pos.id, brackets);
        }
      }

      // 2. Pending order modification
      var ticket = parseInt(order.id, 10);
      if (isNaN(ticket) || ticket <= 0) {
        self._host.showNotification('Modify Failed', 'Invalid order ticket: ' + order.id, NotificationType.Error);
        return Promise.reject(new Error('Invalid order ticket: ' + order.id));
      }

      var body = { ticket: ticket };
      if (order.limitPrice !== undefined) body.price = order.limitPrice;
      if (order.stopPrice !== undefined)  body.price = order.stopPrice;
      if (order.price !== undefined && body.price === undefined) body.price = order.price;
      if (order.stopLoss !== undefined)   body.sl = order.stopLoss;
      if (order.takeProfit !== undefined) body.tp = order.takeProfit;

      return fetch(this._backendUrl + '/trade/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function (res) {
        var data = res.data || {};
        var isSuccess = res.ok && (data.retcode === 10009 || data.retcode === 10008 || data.success === true);
        if (isSuccess) {
          self._host.showNotification('Order Modified', 'Ticket #' + ticket, NotificationType.Success);
          setTimeout(function () { self._syncOrders(); }, 300);
          return {};
        } else {
          var errorMsg = data.comment || data.error || (data.detail && data.detail[0] ? data.detail[0].msg : null) || data.message || ('Error code: ' + (data.retcode || res.status));
          self._host.showNotification('Modify Failed', errorMsg, NotificationType.Error);
          return Promise.reject(new Error(errorMsg));
        }
      })
      .catch(function (err) {
        var errorMsg = (err && err.message) ? err.message : 'Network Error';
        self._host.showNotification('Modify Error', errorMsg, NotificationType.Error);
        return Promise.reject(err);
      });
    },

    // ── Cancel Order ────────────────────────────────────────────────
    cancelOrder: function (orderId) {
      var self = this;
      return fetch(this._backendUrl + '/trade/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ticket: parseInt(orderId, 10) })
      })
      .then(function (r) { return r.json(); })
      .then(function () {
        if (self._orderById[orderId]) {
          self._orderById[orderId].status = OrderStatus.Canceled;
          self._host.orderUpdate(self._orderById[orderId]);
          delete self._orderById[orderId];
        }
        setTimeout(function () { self._syncOrders(); }, 300);
        return {};
      });
    },

    cancelOrders: function (symbol, side, orderIds) {
      var self = this;
      return Promise.all(orderIds.map(function (id) { return self.cancelOrder(id); }))
        .then(function () {});
    },

    // ── Helper Lookup Methods ─────────────────────────────────────────
    findPosition: function (positionId) {
      if (!positionId) return null;
      var sId = '' + positionId;
      if (this._positionById[sId]) return this._positionById[sId];
      var cleanId = sId.replace(/\.$/, '');
      var dotId = cleanId + '.';
      if (this._positionById[cleanId]) return this._positionById[cleanId];
      if (this._positionById[dotId]) return this._positionById[dotId];
      var keys = Object.keys(this._positionById);
      for (var i = 0; i < keys.length; i++) {
        var p = this._positionById[keys[i]];
        if (p && ('' + p.ticket === sId || '' + p._mt5Ticket === sId || '' + p.id === sId || p.symbol === sId || p.symbol === dotId || p.symbol === cleanId)) {
          return p;
        }
      }
      return null;
    },

    positionById: function (positionId) {
      var pos = this.findPosition(positionId);
      return pos ? Promise.resolve(pos) : Promise.reject(new Error('Position not found: ' + positionId));
    },

    individualPositionById: function (positionId) {
      return this.positionById(positionId);
    },

    findOrder: function (orderId) {
      if (!orderId) return null;
      var sId = '' + orderId;
      if (this._orderById[sId]) return this._orderById[sId];
      var keys = Object.keys(this._orderById);
      for (var i = 0; i < keys.length; i++) {
        var ord = this._orderById[keys[i]];
        if (ord && ('' + ord.id === sId || '' + ord.ticket === sId)) return ord;
      }
      return null;
    },

    orderById: function (orderId) {
      var ord = this.findOrder(orderId);
      return ord ? Promise.resolve(ord) : Promise.reject(new Error('Order not found: ' + orderId));
    },

    _getPositionsList: function () {
      var self = this;
      return Object.keys(self._positionById).map(function (k) { return self._positionById[k]; });
    },

    _getOrdersList: function () {
      var self = this;
      return Object.keys(self._orderById).map(function (k) { return self._orderById[k]; });
    },

    // ── Edit Position Brackets (SL/TP) ──────────────────────────────
    editPositionBrackets: function (positionId, brackets, customFields) {
      var self = this;
      var position = this.findPosition(positionId);
      if (!position) {
        var allPos = this._getPositionsList();
        if (allPos.length > 0) position = allPos[0];
      }
      if (!position) {
        self._host.showNotification('Modify Failed', 'Position not found: ' + positionId, NotificationType.Error);
        return Promise.reject(new Error('Position not found: ' + positionId));
      }

      var ticket = parseInt(position.ticket || position._mt5Ticket || '', 10);
      if (isNaN(ticket) || ticket <= 0) {
        ticket = parseInt(position.id, 10);
      }
      if (isNaN(ticket) || ticket <= 0) {
        ticket = parseInt(positionId, 10);
      }

      var sl = extractBracketPrice(brackets.stopLoss !== undefined ? brackets.stopLoss : brackets.stopPrice);
      var tp = extractBracketPrice(brackets.takeProfit !== undefined ? brackets.takeProfit : brackets.limitPrice);

      if (isNaN(ticket) || ticket <= 0) {
        return fetch(this._backendUrl + '/trade/positions')
          .then(function (r) { return r.json(); })
          .then(function (data) {
            var list = Array.isArray(data) ? data : (data && data.positions ? data.positions : []);
            var matched = list.find(function (p) {
              return p.symbol === position.symbol ||
                     p.symbol.replace(/\.$/, '') === position.symbol.replace(/\.$/, '');
            });
            if (matched && matched.ticket) {
              position.ticket = matched.ticket;
              position._mt5Ticket = matched.ticket;
              return self._sendModifyPosition(matched.ticket, sl, tp, position);
            }
            throw new Error('No open MT5 ticket found for position ' + position.symbol);
          })
          .catch(function (err) {
            var msg = err.message || 'Error resolving position ticket';
            self._host.showNotification('Modify Failed', msg, NotificationType.Error);
            return Promise.reject(err);
          });
      }

      return this._sendModifyPosition(ticket, sl, tp, position);
    },

    _sendModifyPosition: function (ticket, sl, tp, position) {
      var self = this;
      var body = { ticket: ticket };
      if (sl !== undefined && !isNaN(sl)) body.sl = sl;
      if (tp !== undefined && !isNaN(tp)) body.tp = tp;
      if (position && position.symbol) body.symbol = position.symbol;

      return fetch(this._backendUrl + '/trade/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function (r) {
        return r.json().then(function (data) {
          return { ok: r.ok, status: r.status, data: data };
        });
      })
      .then(function (res) {
        var data = res.data || {};
        var isSuccess = res.ok && (data.retcode === 10009 || data.retcode === 10008 || data.success === true || data.status === 'ok');
        if (isSuccess) {
          if (sl !== undefined && !isNaN(sl)) position.stopLoss = sl;
          if (tp !== undefined && !isNaN(tp)) position.takeProfit = tp;
          self._host.positionUpdate(position);

          var posId = position.id;
          var slId = posId + '_sl';
          var tpId = posId + '_tp';
          if (sl !== undefined && !isNaN(sl)) {
            if (sl > 0) {
              var slOrd = self._orderById[slId] || {
                id: slId,
                symbol: position.symbol,
                side: position.side === OrderSide.Buy ? OrderSide.Sell : OrderSide.Buy,
                type: OrderType.Stop,
                qty: position.qty,
                parentId: posId,
                parentType: ParentType.Position,
                isPositionBracket: true
              };
              slOrd.stopPrice = sl;
              slOrd.price = sl;
              slOrd.status = OrderStatus.Working;
              self._orderById[slId] = slOrd;
              self._host.orderUpdate(slOrd);
            } else if (self._orderById[slId]) {
              self._orderById[slId].status = OrderStatus.Canceled;
              self._host.orderUpdate(self._orderById[slId]);
              delete self._orderById[slId];
            }
          }
          if (tp !== undefined && !isNaN(tp)) {
            if (tp > 0) {
              var tpOrd = self._orderById[tpId] || {
                id: tpId,
                symbol: position.symbol,
                side: position.side === OrderSide.Buy ? OrderSide.Sell : OrderSide.Buy,
                type: OrderType.Limit,
                qty: position.qty,
                parentId: posId,
                parentType: ParentType.Position,
                isPositionBracket: true
              };
              tpOrd.limitPrice = tp;
              tpOrd.price = tp;
              tpOrd.status = OrderStatus.Working;
              self._orderById[tpId] = tpOrd;
              self._host.orderUpdate(tpOrd);
            } else if (self._orderById[tpId]) {
              self._orderById[tpId].status = OrderStatus.Canceled;
              self._host.orderUpdate(self._orderById[tpId]);
              delete self._orderById[tpId];
            }
          }

          var msg = 'Ticket #' + ticket + (sl !== undefined && !isNaN(sl) ? ' SL: ' + sl : '') + (tp !== undefined && !isNaN(tp) ? ' TP: ' + tp : '');
          self._host.showNotification('SL/TP Modified', msg, NotificationType.Success);
          setTimeout(function () { self._syncPositions(); }, 300);
          return {};
        } else {
          var errorMsg = data.comment || data.error || (data.detail && data.detail[0] ? data.detail[0].msg : null) || data.message || ('Error code: ' + (data.retcode || res.status));
          self._host.showNotification('Modify Failed', errorMsg, NotificationType.Error);
          return Promise.reject(new Error(errorMsg));
        }
      })
      .catch(function (err) {
        var errorMsg = (err && err.message) ? err.message : 'Network Error';
        self._host.showNotification('Modify Error', errorMsg, NotificationType.Error);
        return Promise.reject(err);
      });
    },

    editIndividualPositionBrackets: function (positionId, brackets, customFields) {
      return this.editPositionBrackets(positionId, brackets, customFields);
    },

    // ── Close Position ──────────────────────────────────────────────
    closePosition: function (positionId, qty) {
      var self = this;
      var position = this.findPosition(positionId);
      if (!position) return Promise.resolve();

      var ticket = parseInt(position._mt5Ticket || position.id || positionId, 10);
      var body = { ticket: ticket };
      if (qty && qty > 0) body.volume = qty;

      return fetch(this._backendUrl + '/trade/close', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.retcode === 10009 || data.status === 'ok' || data.success === true) {
          position.qty = 0;
          self._host.positionUpdate(position);
          delete self._positionById[position.id];

          var slId = position.id + '_sl';
          var tpId = position.id + '_tp';
          if (self._orderById[slId]) {
            self._orderById[slId].status = OrderStatus.Canceled;
            self._host.orderUpdate(self._orderById[slId]);
            delete self._orderById[slId];
          }
          if (self._orderById[tpId]) {
            self._orderById[tpId].status = OrderStatus.Canceled;
            self._host.orderUpdate(self._orderById[tpId]);
            delete self._orderById[tpId];
          }

          self._host.showNotification('Position Closed', 'Ticket #' + ticket, NotificationType.Success);
          setTimeout(function () { self._syncAll(); }, 300);
          return {};
        } else {
          self._host.showNotification('Close Failed', data.comment || 'Error', NotificationType.Error);
          return Promise.reject(new Error(data.comment || 'Error'));
        }
      });
    },

    closeIndividualPosition: function (positionId, qty) {
      return this.closePosition(positionId, qty);
    },

    // ── Reverse Position ────────────────────────────────────────────
    reversePosition: function (positionId) {
      var self = this;
      var position = this.findPosition(positionId);
      if (!position) return Promise.resolve();

      return this.closePosition(positionId).then(function () {
        return self.placeOrder({
          symbol: position.symbol,
          side: position.side === OrderSide.Buy ? OrderSide.Sell : OrderSide.Buy,
          type: OrderType.Market,
          qty: position.qty
        });
      });
    },

    // ── Data Retrieval ──────────────────────────────────────────────
    orders: function () {
      var self = this;
      var cached = this._getOrdersList();
      if (cached.length > 0) {
        return Promise.resolve(cached);
      }
      return fetch(this._backendUrl + '/trade/orders')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var ordersList = Array.isArray(data) ? data : (data && data.orders ? data.orders : []);
          ordersList.forEach(function (ord) {
            var id = '' + ord.ticket;
            var rawType = ord.type_name !== undefined ? ('' + ord.type_name) : ('' + ord.type);
            var sideNum = (rawType.startsWith('SELL') || ord.type === 1 || ord.type === 'SELL') ? OrderSide.Sell : OrderSide.Buy;
            var tvOrder = {
              id: id,
              symbol: ord.symbol,
              side: sideNum,
              type: mt5OrderTypeToTV(ord.type_name !== undefined ? ord.type_name : ord.type),
              qty: ord.volume_current || ord.volume,
              status: OrderStatus.Working,
              price: ord.price_open,
              limitPrice: rawType.includes('LIMIT') ? ord.price_open : undefined,
              stopPrice: (rawType.includes('STOP') && !rawType.includes('LIMIT')) ? ord.price_open : undefined,
              stopLoss: ord.sl && ord.sl > 0 ? ord.sl : undefined,
              takeProfit: ord.tp && ord.tp > 0 ? ord.tp : undefined
            };
            self._orderById[id] = tvOrder;
          });
          return self._getOrdersList();
        })
        .catch(function () {
          return self._getOrdersList();
        });
    },

    ordersHistory: function () {
      var self = this;
      return fetch(this._backendUrl + '/trade/history?type=orders')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var ordersList = Array.isArray(data) ? data : (data && data.orders ? data.orders : []);
          var tvOrders = ordersList.map(function (ord) {
            var id = '' + ord.ticket;
            var rawType = ord.type_name !== undefined ? ('' + ord.type_name) : ('' + ord.type);
            var sideNum = (rawType.startsWith('SELL') || ord.type === 1 || ord.type === 'SELL') ? OrderSide.Sell : OrderSide.Buy;
            var status = (ord.state === 4 || ord.state === 'FILLED' || (ord.state_name && ord.state_name.includes('FILLED'))) ? OrderStatus.Filled : OrderStatus.Canceled;
            return {
              id: id,
              symbol: ord.symbol,
              side: sideNum,
              type: mt5OrderTypeToTV(ord.type_name !== undefined ? ord.type_name : ord.type),
              qty: ord.volume_initial || ord.volume,
              status: status,
              price: ord.price_open,
              limitPrice: rawType.includes('LIMIT') ? ord.price_open : undefined,
              stopPrice: (rawType.includes('STOP') && !rawType.includes('LIMIT')) ? ord.price_open : undefined,
              stopLoss: ord.sl && ord.sl > 0 ? ord.sl : undefined,
              takeProfit: ord.tp && ord.tp > 0 ? ord.tp : undefined
            };
          });
          return tvOrders;
        })
        .catch(function () {
          return [];
        });
    },

    positions: function () {
      var self = this;
      var cached = this._getPositionsList();
      if (cached.length > 0) {
        return Promise.resolve(cached);
      }
      return fetch(this._backendUrl + '/trade/positions')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var positionsList = Array.isArray(data) ? data : (data && data.positions ? data.positions : []);
          positionsList.forEach(function (pos) {
            var posId = '' + pos.ticket;
            var sideNum = (pos.type_name === 'SELL' || pos.type === 1 || pos.type === 'SELL') ? OrderSide.Sell : OrderSide.Buy;
            var tvPos = {
              id: posId,
              ticket: pos.ticket,
              _mt5Ticket: pos.ticket,
              symbol: pos.symbol,
              side: sideNum,
              qty: pos.volume,
              avgPrice: pos.price_open,
              price: pos.price_open,
              last: pos.price_current,
              profit: pos.profit,
              pl: pos.profit,
              contract_size: pos.contract_size,
              tick_size: pos.tick_size,
              tick_value: pos.tick_value,
              canBeClosed: true,
              stopLoss: pos.sl && pos.sl > 0 ? pos.sl : undefined,
              takeProfit: pos.tp && pos.tp > 0 ? pos.tp : undefined
            };
            self._positionById[posId] = tvPos;
          });
          return self._getPositionsList();
        })
        .catch(function () {
          return self._getPositionsList();
        });
    },

    individualPositions: function () {
      return this.positions();
    },

    executions: function (symbol) {
      return Promise.resolve([]);
    },

    subscribeRealtime: function (symbol, callback) {
      this._realtimeSymbols = this._realtimeSymbols || {};
      this._realtimeListeners = this._realtimeListeners || {};
      this._realtimeSymbols[symbol] = true;
      if (typeof callback === 'function') {
        this._realtimeListeners[symbol] = this._realtimeListeners[symbol] || [];
        if (!this._realtimeListeners[symbol].includes(callback)) {
          this._realtimeListeners[symbol].push(callback);
        }
      }
      var clean = ('' + symbol).replace(/\.$/, '');
      var dot = clean + '.';
      var q = (this._lastQuotes && (this._lastQuotes[symbol] || this._lastQuotes[clean] || this._lastQuotes[dot]));
      if (q) {
        try {
          this._host.realtimeUpdate(symbol, q);
          if (clean !== symbol) {
            this._host.realtimeUpdate(clean, q);
          } else {
            this._host.realtimeUpdate(dot, q);
          }
          if (typeof callback === 'function') callback(symbol, q);
        } catch (e) {}
      }
      if (this._ws && this._ws.readyState === 1) {
        try {
          this._ws.send(JSON.stringify({ action: 'subscribe', symbol: symbol }));
          if (clean !== symbol) this._ws.send(JSON.stringify({ action: 'subscribe', symbol: clean }));
          this._ws.send(JSON.stringify({ action: 'subscribe', symbol: dot }));
        } catch (e) {}
      }
      this._pollQuotes();
    },

    unsubscribeRealtime: function (symbol, callback) {
      if (this._realtimeListeners && this._realtimeListeners[symbol]) {
        if (typeof callback === 'function') {
          var idx = this._realtimeListeners[symbol].indexOf(callback);
          if (idx !== -1) this._realtimeListeners[symbol].splice(idx, 1);
        } else {
          delete this._realtimeListeners[symbol];
        }
      }
      if (this._realtimeSymbols && (!this._realtimeListeners || !this._realtimeListeners[symbol] || this._realtimeListeners[symbol].length === 0)) {
        delete this._realtimeSymbols[symbol];
      }
    },

    quotesSnapshot: function (symbol) {
      var self = this;
      if (this._lastQuotes && this._lastQuotes[symbol]) {
        return Promise.resolve(this._lastQuotes[symbol]);
      }
      var clean = ('' + symbol).replace(/\.$/, '');
      if (this._lastQuotes && this._lastQuotes[clean]) {
        return Promise.resolve(this._lastQuotes[clean]);
      }
      return fetch(this._backendUrl + '/quotes?symbols=' + encodeURIComponent(symbol))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.s === 'ok' && Array.isArray(data.d) && data.d.length > 0) {
            var item = data.d[0];
            if (item && item.v) {
              var q = {
                ask: item.v.ask,
                bid: item.v.bid,
                spread: item.v.spread,
                trade: item.v.lp,
                last_price: item.v.lp
              };
              self._lastQuotes = self._lastQuotes || {};
              self._lastQuotes[symbol] = q;
              self._lastQuotes[clean] = q;
              return q;
            }
          }
          return { ask: 0, bid: 0, spread: 0, trade: 0 };
        })
        .catch(function () {
          return { ask: 0, bid: 0, spread: 0, trade: 0 };
        });
    },

    // ── Additional Subscriptions for OrderViewModel & PreOrderItem ───
    subscribePipValue: function (symbol, callback) {
      this._pipListeners = this._pipListeners || {};
      this._pipListeners[symbol] = this._pipListeners[symbol] || [];
      if (typeof callback === 'function') {
        this._pipListeners[symbol].push(callback);
        this.symbolInfo(symbol).then(function (info) {
          var pv = (info && info.pipValue) || 1;
          try { callback({ buyPipValue: pv, sellPipValue: pv }); } catch (e) {}
        });
      }
    },

    unsubscribePipValue: function (symbol, callback) {
      if (this._pipListeners && this._pipListeners[symbol]) {
        var idx = this._pipListeners[symbol].indexOf(callback);
        if (idx !== -1) this._pipListeners[symbol].splice(idx, 1);
      }
    },

    subscribeEquity: function (callback) {
      this._equityListeners = this._equityListeners || [];
      if (typeof callback === 'function') {
        this._equityListeners.push(callback);
        var equityVal = (this._accountInfo && (this._accountInfo.equity || this._accountInfo.balance)) ||
                        (this._accountData && (this._accountData.equity || this._accountData.balance)) || 0;
        try { callback(equityVal); } catch (e) {}
      }
    },

    unsubscribeEquity: function (callback) {
      if (this._equityListeners) {
        var idx = this._equityListeners.indexOf(callback);
        if (idx !== -1) this._equityListeners.splice(idx, 1);
      }
    },

    subscribeMarginAvailable: function (callback) {
      this._marginListeners = this._marginListeners || [];
      if (typeof callback === 'function') {
        this._marginListeners.push(callback);
        try { callback(this._accountData.freeMargin || this._accountData.balance || 0); } catch (e) {}
      }
    },

    unsubscribeMarginAvailable: function (callback) {
      if (this._marginListeners) {
        var idx = this._marginListeners.indexOf(callback);
        if (idx !== -1) this._marginListeners.splice(idx, 1);
      }
    },

    subscribeCryptoBalance: function (symbol, callback) {
      this._cryptoBalanceListeners = this._cryptoBalanceListeners || {};
      this._cryptoBalanceListeners[symbol] = this._cryptoBalanceListeners[symbol] || [];
      if (typeof callback === 'function') {
        this._cryptoBalanceListeners[symbol].push(callback);
        try { callback({ symbol: symbol, total: 0, available: 0 }); } catch (e) {}
      }
    },

    unsubscribeCryptoBalance: function (symbol, callback) {
      if (this._cryptoBalanceListeners && this._cryptoBalanceListeners[symbol]) {
        var idx = this._cryptoBalanceListeners[symbol].indexOf(callback);
        if (idx !== -1) this._cryptoBalanceListeners[symbol].splice(idx, 1);
      }
    },

    subscribePL: function (arg1, arg2) {
      if (typeof arg1 === 'function') {
        // Signature 1: subscribePL(callback) -> Account total P&L
        this._plListeners = this._plListeners || [];
        if (this._plListeners.indexOf(arg1) === -1) {
          this._plListeners.push(arg1);
        }
        try { arg1(this._accountData.pl || 0); } catch (e) {}
      } else {
        // Signature 2: subscribePL(positionIdOrSymbol, callback) -> TV Position line P&L listener
        var key = '' + arg1;
        this._positionPLLsteners = this._positionPLLsteners || {};
        this._positionPLLsteners[key] = this._positionPLLsteners[key] || [];
        if (typeof arg2 === 'function') {
          if (this._positionPLLsteners[key].indexOf(arg2) === -1) {
            this._positionPLLsteners[key].push(arg2);
          }
        }
        var pos = this.findPosition(key);
        var pl = (pos && pos.profit !== undefined) ? pos.profit : (this._accountData.pl || 0);
        if (typeof arg2 === 'function') {
          try { arg2(key, pl); } catch (e) {}
        }
        if (pos && this._host) {
          if (typeof this._host.plUpdate === 'function') {
            this._host.plUpdate(pos.id, pl);
            if (pos.symbol) this._host.plUpdate(pos.symbol, pl);
          }
          if (typeof this._host.positionPartialUpdate === 'function') {
            this._host.positionPartialUpdate(pos.id, { last: pos.last, profit: pl, pl: pl });
          }
        }
      }
    },

    unsubscribePL: function (arg1, arg2) {
      if (typeof arg1 === 'function') {
        if (this._plListeners) {
          var idx = this._plListeners.indexOf(arg1);
          if (idx !== -1) this._plListeners.splice(idx, 1);
        }
      } else {
        var key = '' + arg1;
        if (this._positionPLLsteners && this._positionPLLsteners[key]) {
          if (typeof arg2 === 'function') {
            var idx2 = this._positionPLLsteners[key].indexOf(arg2);
            if (idx2 !== -1) this._positionPLLsteners[key].splice(idx2, 1);
            if (this._positionPLLsteners[key].length === 0) delete this._positionPLLsteners[key];
          } else {
            delete this._positionPLLsteners[key];
          }
        }
      }
    },

    subscribeIndividualPositionPL: function (positionId, callback) {
      var key = '' + positionId;
      this._indivPLLsteners = this._indivPLLsteners || {};
      this._indivPLLsteners[key] = this._indivPLLsteners[key] || [];
      if (typeof callback === 'function') {
        if (this._indivPLLsteners[key].indexOf(callback) === -1) {
          this._indivPLLsteners[key].push(callback);
        }
      }
      var pos = this.findPosition(key);
      var pl = (pos && pos.profit !== undefined) ? pos.profit : (this._accountData.pl || 0);
      if (typeof callback === 'function') {
        try { callback(key, pl); } catch (e) {}
      }
      if (pos && this._host && typeof this._host.individualPositionPLUpdate === 'function') {
        this._host.individualPositionPLUpdate(pos.id, pl);
        if (pos.symbol) this._host.individualPositionPLUpdate(pos.symbol, pl);
      }
    },

    unsubscribeIndividualPositionPL: function (positionId, callback) {
      var key = '' + positionId;
      if (this._indivPLLsteners && this._indivPLLsteners[key]) {
        if (typeof callback === 'function') {
          var idx = this._indivPLLsteners[key].indexOf(callback);
          if (idx !== -1) this._indivPLLsteners[key].splice(idx, 1);
          if (this._indivPLLsteners[key].length === 0) delete this._indivPLLsteners[key];
        } else {
          delete this._indivPLLsteners[key];
        }
      }
    },

    _updatePositionProfits: function (symbol, quote) {
      var self = this;
      if (!quote || quote.bid === undefined || quote.ask === undefined) return;
      var cleanSym = ('' + symbol).replace(/\.$/, '').toUpperCase();
      var posList = self._getPositionsList();
      if (!posList || posList.length === 0) {
        if (self._accountData.pl !== 0) {
          self._accountData.pl = 0;
          self._accountData.equity = self._accountData.balance;
          self._plValue.setValue(0);
          self._equityValue.setValue(self._accountData.balance);
          self._amChangeDelegate.fire(self._accountData);
        }
        return;
      }

      var totalPl = 0;
      var hasUpdates = false;

      posList.forEach(function (pos) {
        if (!pos || !pos.qty) return;
        var pSym = (pos.symbol || '').replace(/\.$/, '').toUpperCase();
        if (pSym === cleanSym) {
          var isBuy = (pos.side === OrderSide.Buy);
          var curPrice = isBuy ? Number(quote.bid) : Number(quote.ask);
          var openPrice = Number(pos.avgPrice || pos.price || curPrice);
          var volume = Number(pos.qty || 0);

          var profit;
          if (pos.tick_size && pos.tick_value && Number(pos.tick_size) > 0) {
            var diff = isBuy ? (curPrice - openPrice) : (openPrice - curPrice);
            profit = (diff / Number(pos.tick_size)) * Number(pos.tick_value) * volume;
            if (pos.swap) profit += Number(pos.swap);
          } else {
            var cSize = (self._contractSizes && (self._contractSizes[pos.symbol] || self._contractSizes[pSym] || self._contractSizes[cleanSym])) ||
                        (pos.contract_size ? Number(pos.contract_size) : null);
            if (cSize && cSize > 0) {
              var diff = isBuy ? (curPrice - openPrice) : (openPrice - curPrice);
              profit = diff * cSize * volume;
              if (pos.swap) profit += Number(pos.swap);
            } else {
              // Never guess 100,000! Keep the exact native MT5 broker profit!
              profit = pos.profit !== undefined ? pos.profit : 0;
            }
          }
          profit = Math.round(profit * 100) / 100;

          pos.last = curPrice;
          pos.profit = profit;
          pos.pl = profit;

          // 1. Dispatch to TradingView host delegates
          if (self._host) {
            if (typeof self._host.individualPositionPLUpdate === 'function') {
              self._host.individualPositionPLUpdate(pos.id, profit);
            }
            if (typeof self._host.plUpdate === 'function') {
              self._host.plUpdate(pos.id, profit);
              self._host.plUpdate(pos.symbol, profit);
            }
            if (typeof self._host.positionPartialUpdate === 'function') {
              self._host.positionPartialUpdate(pos.id, { last: curPrice, profit: profit, pl: profit });
            }
          }

          // 2. Dispatch to position P&L listeners across all potential lookup keys
          var keysToNotify = [
            '' + pos.id,
            pos.symbol,
            pSym,
            cleanSym,
            cleanSym + '.',
            pos.ticket ? ('' + pos.ticket) : null
          ];
          var notifiedFns = new Set();
          keysToNotify.forEach(function (k) {
            if (!k) return;
            if (self._positionPLLsteners && self._positionPLLsteners[k]) {
              self._positionPLLsteners[k].forEach(function (fn) {
                if (!notifiedFns.has(fn)) {
                  notifiedFns.add(fn);
                  try { fn(k, profit); } catch (e) {}
                }
              });
            }
            if (self._indivPLLsteners && self._indivPLLsteners[k]) {
              self._indivPLLsteners[k].forEach(function (fn) {
                try { fn(k, profit); } catch (e) {}
              });
            }
          });
          hasUpdates = true;
        }
        totalPl += (pos.profit || 0);
      });

      if (hasUpdates) {
        totalPl = Math.round(totalPl * 100) / 100;
        self._accountData.pl = totalPl;
        self._accountData.equity = Math.round((self._accountData.balance + totalPl) * 100) / 100;
        self._plValue.setValue(totalPl);
        self._equityValue.setValue(self._accountData.equity);

        if (self._host && typeof self._host.equityUpdate === 'function') {
          self._host.equityUpdate(self._accountData.equity);
        }
        if (self._plListeners) {
          self._plListeners.forEach(function (fn) {
            try { fn(totalPl); } catch (e) {}
          });
        }
        if (self._equityListeners) {
          self._equityListeners.forEach(function (fn) {
            try { fn(self._accountData.equity); } catch (e) {}
          });
        }
        self._amChangeDelegate.fire(self._accountData);
      }
    },

    subscribeDOM: function (symbol, callback) {
      this._domSubscriptions = this._domSubscriptions || {};
      this._domSubscriptions[symbol] = this._domSubscriptions[symbol] || [];
      if (typeof callback === 'function' && this._domSubscriptions[symbol].indexOf(callback) === -1) {
        this._domSubscriptions[symbol].push(callback);
      }
      this._realtimeSymbols = this._realtimeSymbols || {};
      this._realtimeSymbols[symbol] = true;
      var clean = symbol.replace(/\.$/, '');
      this._realtimeSymbols[clean] = true;
      this._realtimeSymbols[clean + '.'] = true;

      var self = this;
      // Start periodic DOM depth push if not running
      if (!this._domInterval) {
        this._domInterval = setInterval(function () {
          if (!self._domSubscriptions) return;
          var activeSyms = Object.keys(self._domSubscriptions);
          if (activeSyms.length === 0) return;
          activeSyms.forEach(function (s) {
            self._emitDOMUpdate(s, false);
          });
        }, 350);
      }

      // Immediately emit snapshot
      this._emitDOMUpdate(symbol, true);
      // Secondary snapshots to ensure ladder pins to Ask/Bid once UI mount finishes
      setTimeout(function () { self._emitDOMUpdate(symbol, true); }, 150);
      setTimeout(function () { self._emitDOMUpdate(symbol, true); }, 500);
    },

    unsubscribeDOM: function (symbol, callback) {
      if (this._domSubscriptions && this._domSubscriptions[symbol]) {
        if (typeof callback === 'function') {
          var idx = this._domSubscriptions[symbol].indexOf(callback);
          if (idx !== -1) this._domSubscriptions[symbol].splice(idx, 1);
          if (this._domSubscriptions[symbol].length === 0) delete this._domSubscriptions[symbol];
        } else {
          delete this._domSubscriptions[symbol];
        }
      }
      if (this._domSubscriptions && Object.keys(this._domSubscriptions).length === 0 && this._domInterval) {
        clearInterval(this._domInterval);
        this._domInterval = null;
      }
    },

    _emitDOMUpdate: function (symbol, isSnapshot) {
      var self = this;
      var clean = symbol.replace(/\.$/, '');
      var dot = clean + '.';
      var q = (self._lastQuotes && (self._lastQuotes[symbol] || self._lastQuotes[clean] || self._lastQuotes[dot])) || null;

      if (!q || !q.ask || !q.bid) {
        if (self._backendUrl) {
          fetch(self._backendUrl + '/quotes?symbols=' + encodeURIComponent(symbol))
            .then(function (r) { return r.json(); })
            .then(function (data) {
              if (data && data.s === 'ok' && Array.isArray(data.d) && data.d[0] && data.d[0].v) {
                var item = data.d[0];
                var quote = {
                  ask: Number(item.v.ask),
                  bid: Number(item.v.bid),
                  spread: Number(item.v.spread),
                  trade: Number(item.v.lp || item.v.last_price || item.v.bid),
                  pricescale: Number(item.v.pricescale || 100),
                  minmov: Number(item.v.minmov || 1)
                };
                self._lastQuotes = self._lastQuotes || {};
                self._lastQuotes[symbol] = quote;
                self._lastQuotes[clean] = quote;
                self._lastQuotes[dot] = quote;
                self._emitDOMUpdate(symbol, isSnapshot);
              }
            }).catch(function () {});
        }
        return;
      }

      var ask = Number(q.ask);
      var bid = Number(q.bid);
      if (!ask || !bid || isNaN(ask) || isNaN(bid)) return;

      var step = 0.01;
      if (q.pricescale) {
        step = (q.minmov || 1) / q.pricescale;
      } else if (symbol.indexOf('JPY') !== -1) {
        step = 0.001;
      } else if (symbol.indexOf('XAU') !== -1) {
        step = 0.01;
      } else if (symbol.indexOf('BTC') !== -1) {
        step = 0.1;
      } else {
        step = 0.0001;
      }

      var decimals = Math.max(0, Math.min(6, Math.round(-Math.log10(step))));
      var bestAsk = Number(ask.toFixed(decimals));
      var bestBid = Number(bid.toFixed(decimals));
      if (bestBid >= bestAsk) {
        bestBid = Number((bestAsk - step).toFixed(decimals));
      }

      var levels = 30;
      var asks = [];
      var bids = [];
      var baseVol = (symbol.indexOf('XAU') !== -1) ? 6 : (symbol.indexOf('BTC') !== -1 ? 1 : 12);

      for (var i = 0; i < levels; i++) {
        var pAsk = Number((bestAsk + i * step).toFixed(decimals));
        var curveAsk = Math.round(baseVol * (1 + i * 0.65));
        var hashAsk = Math.abs(Math.sin(pAsk * 12.9898 + i * 78.233) * 43758.5453);
        var jitterAsk = Math.floor((hashAsk % 1) * (baseVol * 0.6));
        var volAsk = Math.max(1, curveAsk + jitterAsk);
        asks.push({ price: pAsk, volume: volAsk });

        var pBid = Number((bestBid - i * step).toFixed(decimals));
        var curveBid = Math.round(baseVol * (1 + i * 0.65));
        var hashBid = Math.abs(Math.sin(pBid * 12.9898 + i * 78.233) * 43758.5453);
        var jitterBid = Math.floor((hashBid % 1) * (baseVol * 0.6));
        var volBid = Math.max(1, curveBid + jitterBid);
        bids.push({ price: pBid, volume: volBid });
      }

      var domPayload = {
        snapshot: !!isSnapshot,
        asks: asks,
        bids: bids
      };

      if (self._host && typeof self._host.domUpdate === 'function') {
        self._host.domUpdate(symbol, domPayload);
        if (clean !== symbol) {
          self._host.domUpdate(clean, domPayload);
        } else {
          self._host.domUpdate(dot, domPayload);
        }
      }

      var listeners = [];
      if (self._domSubscriptions) {
        if (self._domSubscriptions[symbol]) listeners = listeners.concat(self._domSubscriptions[symbol]);
        if (clean !== symbol && self._domSubscriptions[clean]) listeners = listeners.concat(self._domSubscriptions[clean]);
        if (dot !== symbol && self._domSubscriptions[dot]) listeners = listeners.concat(self._domSubscriptions[dot]);
      }
      listeners.forEach(function (fn) {
        try { fn(symbol, domPayload); } catch (e) {}
      });
    },


    _pollQuotes: function () {
      var self = this;
      if (typeof document !== 'undefined' && document.hidden) return;

      var wsIsActive = self._ws &&
                       self._ws.readyState === 1 &&
                       (self._lastWsQuoteTime ? (Date.now() - self._lastWsQuoteTime < 5000) : true);
      if (wsIsActive) return;

      if (self._lastQuotePollTime && Date.now() - self._lastQuotePollTime < 2500) return;
      self._lastQuotePollTime = Date.now();

      var syms = Object.keys(self._realtimeSymbols || {});
      var posList = self._getPositionsList();
      posList.forEach(function (p) {
        if (p && p.symbol && !syms.includes(p.symbol)) syms.push(p.symbol);
      });
      if (syms.length === 0) {
        syms = ['XAUUSD.', 'AUDCAD.', 'EURUSD.', 'GBPUSD.', 'USDJPY.'];
      }

      fetch(this._backendUrl + '/quotes?symbols=' + encodeURIComponent(syms.join(',')))
        .then(function (r) { return r.json(); })
        .then(function (data) {
          if (data && data.s === 'ok' && Array.isArray(data.d)) {
            self._lastQuotes = self._lastQuotes || {};
            data.d.forEach(function (item) {
              if (item && item.s === 'ok' && item.v) {
                var sym = item.n;
                var clean = sym.replace(/\.$/, '');
                var dot = clean + '.';
                var ask = item.v.ask;
                var bid = item.v.bid;
                var spread = item.v.spread;
                var trade = item.v.lp;

                var quote = {
                  ask: ask,
                  bid: bid,
                  spread: spread,
                  trade: trade,
                  last_price: trade
                };

                self._lastQuotes[sym] = quote;
                self._lastQuotes[clean] = quote;
                self._lastQuotes[dot] = quote;

                self._host.realtimeUpdate(sym, quote);
                if (clean !== sym) {
                  self._host.realtimeUpdate(clean, quote);
                } else {
                  self._host.realtimeUpdate(dot, quote);
                }

                // Update live floating position P&L in real time
                self._updatePositionProfits(sym, quote);
                if (clean !== sym) self._updatePositionProfits(clean, quote);

                // Dispatch to registered listener callbacks (signature: cb(symbol, quote))
                var targetListeners = [];
                if (self._realtimeListeners) {
                  if (self._realtimeListeners[sym]) targetListeners = targetListeners.concat(self._realtimeListeners[sym]);
                  if (clean !== sym && self._realtimeListeners[clean]) targetListeners = targetListeners.concat(self._realtimeListeners[clean]);
                  if (dot !== sym && self._realtimeListeners[dot]) targetListeners = targetListeners.concat(self._realtimeListeners[dot]);
                }
                targetListeners.forEach(function (cb) {
                  try { cb(sym, quote); } catch (e) {}
                });

                if (self._domSubscriptions && (self._domSubscriptions[sym] || self._domSubscriptions[clean] || self._domSubscriptions[dot])) {
                  self._emitDOMUpdate(sym, false);
                }
              }
            });
          }
        })
        .catch(function () {});
    },

    _initWebSocket: function () {
      var self = this;
      var wsProto = (this._backendUrl && this._backendUrl.startsWith('https')) ? 'wss:' : 'ws:';
      var wsHost;
      if (typeof window !== 'undefined' && window.location && window.location.host) {
        wsHost = window.location.host;
      } else if (this._backendUrl) {
        wsHost = this._backendUrl.replace(/^https?:\/\//, '');
      } else if (typeof window !== 'undefined' && window.location) {
        wsHost = window.location.host || ((window.location.hostname || '127.0.0.1') + ':9000');
      } else {
        wsHost = '127.0.0.1:9000';
      }
      if (wsHost.includes(':8080') || wsHost.includes(':8081')) {
        wsHost = wsHost.split(':')[0] + ':9000';
      } else if (!wsHost.includes(':')) {
        wsHost = wsHost + ':9000';
      }
      var wsUrl = wsProto + '//' + wsHost + '/ws/quotes';
      try {
        var ws = new WebSocket(wsUrl);
        self._ws = ws;

        ws.onopen = function () {
          console.log('[HFT WS] Connected to MT5 ultra-low latency push stream at ' + wsUrl);
          var syms = Object.keys(self._realtimeSymbols || {});
          if (syms.length === 0) {
            syms = ['XAUUSD.', 'AUDCAD.', 'EURUSD.', 'GBPUSD.', 'USDJPY.'];
          }
          try {
            ws.send(JSON.stringify({ action: 'subscribe', type: 'subscribe', symbols: syms }));
          } catch (e) {}
          syms.forEach(function (s) {
            try { ws.send(JSON.stringify({ action: 'subscribe', symbol: s })); } catch (e) {}
          });
        };

        ws.onmessage = function (event) {
          try {
            var msg = JSON.parse(event.data);
            if (msg && msg.type === 'quote' && msg.data && msg.data.v) {
              self._lastWsQuoteTime = Date.now();
              var item = msg.data;
              var sym = item.n;
              var clean = sym.replace(/\.$/, '');
              var dot = clean + '.';
              var ask = Number(item.v.ask);
              var bid = Number(item.v.bid);
              var spread = Number(item.v.spread);
              var trade = Number(item.v.lp || item.v.last_price || bid);

              var quote = {
                ask: ask,
                bid: bid,
                spread: spread,
                trade: trade,
                last_price: trade
              };

              self._lastQuotes = self._lastQuotes || {};
              self._lastQuotes[sym] = quote;
              self._lastQuotes[clean] = quote;
              self._lastQuotes[dot] = quote;

              // Immediately push realtime quotes to chart Buy/Sell buttons without delay
              self._host.realtimeUpdate(sym, quote);
              if (clean !== sym) {
                self._host.realtimeUpdate(clean, quote);
              } else {
                self._host.realtimeUpdate(dot, quote);
              }

              // Update live floating position P&L with 0ms WebSocket latency
              self._updatePositionProfits(sym, quote);
              if (clean !== sym) self._updatePositionProfits(clean, quote);

              var targetListeners = [];
              if (self._realtimeListeners) {
                if (self._realtimeListeners[sym]) targetListeners = targetListeners.concat(self._realtimeListeners[sym]);
                if (clean !== sym && self._realtimeListeners[clean]) targetListeners = targetListeners.concat(self._realtimeListeners[clean]);
                if (dot !== sym && self._realtimeListeners[dot]) targetListeners = targetListeners.concat(self._realtimeListeners[dot]);
              }
              targetListeners.forEach(function (cb) {
                try { cb(sym, quote); } catch (e) {}
              });

              if (self._domSubscriptions && (self._domSubscriptions[sym] || self._domSubscriptions[clean] || self._domSubscriptions[dot])) {
                self._emitDOMUpdate(sym, false);
              }

              if (typeof window !== 'undefined' && typeof window._onRealtimeTick === 'function') {
                try { window._onRealtimeTick(sym, quote); } catch (e) {}
              }
            }
          } catch (e) {}
        };

        ws.onclose = function () {
          var delay = self._wsReconnectDelayMs || 500;
          setTimeout(function () {
            self._initWebSocket();
          }, delay);
        };

        ws.onerror = function () {
          try { ws.close(); } catch (e) {}
        };
      } catch (e) {}
    },

    setAdaptiveResolution: function (resolution) {
      var raw = String(resolution || '1').trim();
      var res = raw.toUpperCase();
      // WebSocket handles sub-second tick streaming with zero overhead.
      // In-memory trade state sync polls /trade/bundle in <1ms from Node RAM.
      if (/^\d+T$/.test(res) || /^\d+S$/.test(res)) {
        this._pollIntervalMs = 800;
        this._wsReconnectDelayMs = 500;
      } else {
        var isMonth = raw.endsWith('M') && !res.endsWith('MIN');
        var mins = parseInt(res.replace(/[^0-9]/g, ''), 10);
        if (!isMonth && !res.includes('D') && !res.includes('W') && !isNaN(mins) && mins < 5 && mins > 0) {
          this._pollIntervalMs = 1000;
          this._wsReconnectDelayMs = 1000;
        } else {
          this._pollIntervalMs = 1500;
          this._wsReconnectDelayMs = 2000;
        }
      }
      if (this._pollTimer) {
        clearInterval(this._pollTimer);
        var self = this;
        this._pollTimer = setInterval(function () {
          self._syncAll();
          self._pollQuotes();
        }, this._pollIntervalMs);
      }
    },

    // ── Internal: Sync from MT5 Backend via High-Performance Node Engine ───
    _startPolling: function () {
      var self = this;

      // Bootstrap state instantly from Node.js Dynamic HTML injection (0ms client boot)
      if (typeof window !== 'undefined' && window.__NODE_SERVER_STATE__) {
        var boot = window.__NODE_SERVER_STATE__;
        if (boot.positions && boot.positions.length > 0) {
          self._processPositions(boot.positions);
        }
        if (boot.orders && boot.orders.length > 0) {
          self._processOrders(boot.orders);
        }
        if (boot.account) {
          self._processAccount(boot.account);
        }
        self._lastBundleVersion = boot.version;
      }

      this._syncAll(true);
      this._pollQuotes();

      // Page visibility & focus hooks: pause polling when tab is inactive, resume immediately on focus
      if (typeof document !== 'undefined' && !self._visibilityBound) {
        self._visibilityBound = true;
        document.addEventListener('visibilitychange', function () {
          if (!document.hidden) {
            self._syncAll(true);
            self._pollQuotes();
          }
        });
        window.addEventListener('focus', function () {
          self._syncAll(true);
        });
      }

      var interval = this._pollIntervalMs || 1000;
      if (this._pollTimer) clearInterval(this._pollTimer);
      this._pollTimer = setInterval(function () {
        self._syncAll();
        self._pollQuotes();
      }, interval);
    },

    _syncAll: function (force) {
      var self = this;
      // Completely idle when tab is in background to save 100% CPU/GPU resources
      if (typeof document !== 'undefined' && document.hidden && !force) return;

      var headers = {};
      if (!force && self._lastBundleVersion) {
        headers['If-None-Match'] = '' + self._lastBundleVersion;
      }

      fetch(this._backendUrl + '/trade/bundle', { headers: headers })
        .then(function (r) {
          if (r.status === 304) {
            // State is unchanged in Node RAM: 0ms processing, zero CPU work
            return null;
          }
          return r.json();
        })
        .then(function (bundle) {
          if (!bundle || bundle.s !== 'ok') return;
          if (!force && bundle.version === self._lastBundleVersion && bundle.hash === self._lastBundleHash) {
            return;
          }
          self._lastBundleVersion = bundle.version;
          self._lastBundleHash = bundle.hash;

          self._processPositions(bundle.positions || []);
          self._processOrders(bundle.orders || []);
          self._processAccount(bundle.account || {});
        })
        .catch(function () {
          // Resilient fallback to individual in-memory endpoints
          self._syncPositions();
          self._syncOrders();
          self._syncAccount();
        });
    },

    _processPositions: function (positionsList) {
      var self = this;
      var activeIds = {};

      positionsList.forEach(function (pos) {
        var posId = '' + pos.ticket;  // Unique MT5 position ticket ID
        activeIds[posId] = true;

        var sideNum = (pos.type_name === 'SELL' || pos.type === 1 || pos.type === 'SELL') ? OrderSide.Sell : OrderSide.Buy;
        var tvPos = {
          id: posId,
          ticket: pos.ticket,
          _mt5Ticket: pos.ticket,
          symbol: pos.symbol,
          side: sideNum,
          qty: pos.volume,
          avgPrice: pos.price_open,
          price: pos.price_open,
          last: pos.price_current,
          profit: pos.profit,
          pl: pos.profit,
          swap: pos.swap || 0,
          contract_size: pos.contract_size,
          tick_size: pos.tick_size,
          tick_value: pos.tick_value,
          canBeClosed: true,
          stopLoss: pos.sl && pos.sl > 0 ? pos.sl : undefined,
          takeProfit: pos.tp && pos.tp > 0 ? pos.tp : undefined
        };

        var existing = self._positionById[posId];
        var posChanged = !existing ||
                         existing.profit !== tvPos.profit ||
                         existing.price !== tvPos.price ||
                         existing.last !== tvPos.last ||
                         existing.qty !== tvPos.qty ||
                         existing.stopLoss !== tvPos.stopLoss ||
                         existing.takeProfit !== tvPos.takeProfit;

        if (existing) {
          if (posChanged) {
            Object.assign(existing, tvPos);
            self._safeHost('positionPartialUpdate', posId, tvPos);
          }
        } else {
          self._positionById[posId] = tvPos;
          self._safeHost('positionUpdate', tvPos);
        }

        // Sync visual SL & TP bracket lines on the chart canvas
        var slId = posId + '_sl';
        var tpId = posId + '_tp';
        var oppSide = sideNum === OrderSide.Buy ? OrderSide.Sell : OrderSide.Buy;

        if (pos.sl && pos.sl > 0) {
          var slOrd = self._orderById[slId];
          var slChanged = !slOrd || slOrd.stopPrice !== pos.sl || slOrd.status !== OrderStatus.Working;
          if (slChanged) {
            slOrd = slOrd || {
              id: slId,
              symbol: pos.symbol,
              side: oppSide,
              type: OrderType.Stop,
              qty: pos.volume,
              parentId: posId,
              parentType: ParentType.Position,
              isPositionBracket: true
            };
            slOrd.stopPrice = pos.sl;
            slOrd.price = pos.sl;
            slOrd.status = OrderStatus.Working;
            self._orderById[slId] = slOrd;
            self._safeHost('orderUpdate', slOrd);
          }
        } else if (self._orderById[slId]) {
          self._orderById[slId].status = OrderStatus.Canceled;
          self._safeHost('orderUpdate', self._orderById[slId]);
          delete self._orderById[slId];
        }

        if (pos.tp && pos.tp > 0) {
          var tpOrd = self._orderById[tpId];
          var tpChanged = !tpOrd || tpOrd.limitPrice !== pos.tp || tpOrd.status !== OrderStatus.Working;
          if (tpChanged) {
            tpOrd = tpOrd || {
              id: tpId,
              symbol: pos.symbol,
              side: oppSide,
              type: OrderType.Limit,
              qty: pos.volume,
              parentId: posId,
              parentType: ParentType.Position,
              isPositionBracket: true
            };
            tpOrd.limitPrice = pos.tp;
            tpOrd.price = pos.tp;
            tpOrd.status = OrderStatus.Working;
            self._orderById[tpId] = tpOrd;
            self._safeHost('orderUpdate', tpOrd);
          }
        } else if (self._orderById[tpId]) {
          self._orderById[tpId].status = OrderStatus.Canceled;
          self._safeHost('orderUpdate', self._orderById[tpId]);
          delete self._orderById[tpId];
        }

        if (posChanged) {
          self._safeHost('individualPositionPLUpdate', posId, pos.profit);
          self._safeHost('plUpdate', posId, pos.profit);
          if (pos.symbol) {
            self._safeHost('plUpdate', pos.symbol, pos.profit);
          }

          if (self._positionPLLsteners && self._positionPLLsteners[posId]) {
            self._positionPLLsteners[posId].forEach(function (fn) { try { fn(posId, pos.profit); } catch (e) {} });
          }
          if (self._positionPLLsteners && self._positionPLLsteners[pos.symbol]) {
            self._positionPLLsteners[pos.symbol].forEach(function (fn) { try { fn(pos.symbol, pos.profit); } catch (e) {} });
          }
          if (self._indivPLLsteners && self._indivPLLsteners[posId]) {
            self._indivPLLsteners[posId].forEach(function (fn) { try { fn(posId, pos.profit); } catch (e) {} });
          }
        }
      });

      // Remove closed positions & their bracket orders
      Object.keys(self._positionById).forEach(function (id) {
        if (!activeIds[id]) {
          var closedPos = self._positionById[id];
          if (closedPos) {
            closedPos.qty = 0;
            self._safeHost('positionUpdate', closedPos);
          }
          delete self._positionById[id];

          var slId = id + '_sl';
          var tpId = id + '_tp';
          if (self._orderById[slId]) {
            self._orderById[slId].status = OrderStatus.Canceled;
            self._safeHost('orderUpdate', self._orderById[slId]);
            delete self._orderById[slId];
          }
          if (self._orderById[tpId]) {
            self._orderById[tpId].status = OrderStatus.Canceled;
            self._safeHost('orderUpdate', self._orderById[tpId]);
            delete self._orderById[tpId];
          }
        }
      });
    },

    _processOrders: function (ordersList) {
      var self = this;
      var activeIds = {};

      ordersList.forEach(function (ord) {
        var id = '' + ord.ticket;
        activeIds[id] = true;

        var rawType = ord.type_name !== undefined ? ('' + ord.type_name) : ('' + ord.type);

        var existing = self._orderById[id];
        var ordChanged = !existing ||
                         existing.price !== ord.price_open ||
                         existing.qty !== (ord.volume_current || ord.volume) ||
                         existing.stopLoss !== (ord.sl && ord.sl > 0 ? ord.sl : undefined) ||
                         existing.takeProfit !== (ord.tp && ord.tp > 0 ? ord.tp : undefined);

        if (ordChanged) {
          var tvOrder = {
            id: id,
            symbol: ord.symbol,
            side: mt5SideToTV(ord.type_name !== undefined ? ord.type_name : ord.type),
            type: mt5OrderTypeToTV(ord.type_name !== undefined ? ord.type_name : ord.type),
            qty: ord.volume_current || ord.volume,
            status: OrderStatus.Working,
            price: ord.price_open,
            limitPrice: rawType.includes('LIMIT') ? ord.price_open : undefined,
            stopPrice: (rawType.includes('STOP') && !rawType.includes('LIMIT')) ? ord.price_open : undefined,
            stopLoss: ord.sl && ord.sl > 0 ? ord.sl : undefined,
            takeProfit: ord.tp && ord.tp > 0 ? ord.tp : undefined
          };

          self._orderById[id] = tvOrder;
          self._safeHost('orderUpdate', tvOrder);
        }
      });

      // Cancel disappeared orders (preserve position bracket orders)
      Object.keys(self._orderById).forEach(function (id) {
        if (!activeIds[id] && !self._orderById[id].isPositionBracket) {
          self._orderById[id].status = OrderStatus.Canceled;
          self._safeHost('orderUpdate', self._orderById[id]);
          delete self._orderById[id];
        }
      });
    },

    _processAccount: function (data) {
      var self = this;
      if (!data) return;

      var newBalance = data.balance !== undefined ? data.balance : (self._accountData.balance || 0);
      var newEquity = data.equity !== undefined ? data.equity : (self._accountData.equity || 0);
      var newMargin = data.margin !== undefined ? data.margin : (self._accountData.margin || 0);
      var newFreeMargin = data.margin_free !== undefined ? data.margin_free : (data.free_margin !== undefined ? data.free_margin : (self._accountData.freeMargin || 0));
      var newMarginLevel = data.margin_level !== undefined ? data.margin_level : (self._accountData.marginLevel || 0);
      var newPL = data.profit !== undefined ? data.profit : ((data.equity || 0) - (data.balance || 0));

      var accChanged = !self._accountInitialized ||
                       self._accountData.balance !== newBalance ||
                       self._accountData.equity !== newEquity ||
                       self._accountData.pl !== newPL ||
                       self._accountData.margin !== newMargin ||
                       self._accountData.freeMargin !== newFreeMargin;

      self._accountData.balance    = newBalance;
      self._accountData.equity     = newEquity;
      self._accountData.pl         = newPL;
      self._accountData.margin     = newMargin;
      self._accountData.freeMargin = newFreeMargin;
      self._accountData.marginLevel = newMarginLevel;

      if (!accChanged) return;
      self._accountInitialized = true;

      if (self._balanceValue && typeof self._balanceValue.setValue === 'function') {
        self._balanceValue.setValue(self._accountData.balance);
      }
      if (self._equityValue && typeof self._equityValue.setValue === 'function') {
        self._equityValue.setValue(self._accountData.equity);
      }
      if (self._plValue && typeof self._plValue.setValue === 'function') {
        self._plValue.setValue(self._accountData.pl);
      }
      if (self._marginValue && typeof self._marginValue.setValue === 'function') {
        self._marginValue.setValue(self._accountData.margin);
      }
      if (self._freeMarginValue && typeof self._freeMarginValue.setValue === 'function') {
        self._freeMarginValue.setValue(self._accountData.freeMargin);
      }

      self._accountInfo = self._accountData;

      if (self._amChangeDelegate && typeof self._amChangeDelegate.fire === 'function') {
        self._amChangeDelegate.fire(self._accountData);
      }
      self._safeHost('equityUpdate', self._accountData.equity);

      if (self._equityListeners) {
        self._equityListeners.forEach(function (cb) {
          try { cb(self._accountData.equity); } catch (e) {}
        });
      }
      if (self._marginListeners) {
        self._marginListeners.forEach(function (cb) {
          try { cb(self._accountData.freeMargin); } catch (e) {}
        });
      }
    },

    _syncPositions: function () {
      var self = this;
      fetch(this._backendUrl + '/trade/positions')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var positionsList = Array.isArray(data) ? data : (data && data.positions ? data.positions : []);
          self._processPositions(positionsList);
        })
        .catch(function (err) {
          console.warn('[MT5Broker] Position sync error:', err);
        });
    },

    _syncOrders: function () {
      var self = this;
      fetch(this._backendUrl + '/trade/orders')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          var ordersList = Array.isArray(data) ? data : (data && data.orders ? data.orders : []);
          self._processOrders(ordersList);
        })
        .catch(function (err) {
          console.warn('[MT5Broker] Order sync error:', err);
        });
    },

    _syncAccount: function () {
      var self = this;
      fetch(this._backendUrl + '/trade/account')
        .then(function (r) { return r.json(); })
        .then(function (data) {
          self._processAccount(data);
        })
        .catch(function (err) {
          console.warn('[MT5Broker] Account sync error:', err);
        });
    },

    _bottomContextMenuItems: function (activeOrdersIds) {
      var self = this;
      var items = [];
      var vis = this._host.sellBuyButtonsVisibility();

      if (activeOrdersIds && activeOrdersIds.length) {
        items.push({ separator: true });
      }

      items.push({
        text: 'Show Buy/Sell Buttons',
        action: function () {
          if (vis) vis.setValue(!vis.value());
        },
        checkable: true,
        checked: vis ? vis.value() : false
      });

      items.push({
        text: 'Close All Positions',
        action: function () {
          fetch(self._backendUrl + '/trade/close_all', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: '{}'
          }).then(function () {
            setTimeout(function () { self._syncAll(); }, 300);
            self._host.showNotification('All Positions Closed', '', NotificationType.Success);
          });
        }
      });

      items.push({
        text: 'Trading Settings...',
        action: function () {
          self._host.showTradingProperties();
        }
      });

      return items;
    },

    destroy: function () {
      if (this._pollTimer) {
        clearInterval(this._pollTimer);
        this._pollTimer = null;
      }
    }
  };

  // ── Export ─────────────────────────────────────────────────────────
  root.MT5Broker = MT5Broker;

})(window);
