# Exhaustive Investigation: TradingView Order Lifecycle, PreOrderItem, and Broker Adapter Linking

**Milestone**: M20 (Survey Phase)  
**Agent**: `teamwork_preview_explorer` (`explorer_survey_m20_1`)  
**Scope**: All 311+ JS bundle files in `charting_library/bundles/*.js`, `charting_library.standalone.js`, `broker-sample/`, `mt5_broker.js`, and `index.html`.

---

## Executive Summary

An exhaustive analysis was performed across all 311 JavaScript bundle files in the TradingView Charting Library to map the complete lifecycle of trading orders, order ticket/panel binding, chart pre-order items (`PreOrderItem`), and broker adapter context linking.

### Key Breakthrough Discoveries

1. **The Severed Link (Root Cause)**:
   In `charting_library/bundles/trading.5355aa53ba59846168ee.js` (line 160, `_createOrderController`), the constructor for `OrderViewController` is passed:
   ```javascript
   tradedContextLinking: void 0,
   ```
   instead of:
   ```javascript
   tradedContextLinking: this._tradedContextLinking,
   ```
   Because `this._tradedContextLinking` is `undefined` inside `OrderViewController`:
   - When the user selects "Limit", "Stop", or "StopLimit" in the Order Panel / Ticket, the guard `void 0 === this._tradedContextLinking` immediately aborts `_updateTradedContextLinking`.
   - As a result, `createPlaceOrderContext` is **never called**, `this._tradedContextLinking.setContext(t)` is **never invoked**, and `TradedSourcesManager` **never receives the context** to render the `PreOrderItem` on the chart pane.
   - Furthermore, `OrderViewController` never subscribes to `_tradedContextLinking.onContextChanged()`, which prevents any chart line dragging from syncing back to the order ticket input fields.

2. **PreOrderItem Instantiation & Rendering Engine**:
   In `charting_library/bundles/trading-groups.9659877d7d96e0bb027b.js` and `6161.10c4a7de17f463d1d76e.js`:
   - `TradedSourcesManager` subscribes to `activeTradedLinking.onContextChanged()`.
   - When a valid place order context arrives, it adds a custom source (`tradedGroupPlaceOrderPrefix`) to the chart widget collection via `_chartWidgetCollection.addCustomSource()`.
   - It instantiates `TradedGroupPlaceOrder` (`class Z`), which instantiates `PreOrderItem` (`class d extends OrderWithMenuItem`), attaches Take Profit and Stop Loss `ProjectionBracketItem` lines, and executes a chart selection macro so the line is immediately draggable and interactively attached to cursor and price axis.

3. **Complete Two-Way Synchronization Architecture**:
   - **Ticket -> Chart**: `_onOrderWidgetInputStateChanged` -> `_updateTradedContextLinking` -> `broker.createPlaceOrderContext({ order, source: "order-ticket" })` -> `tradedContextLinking.setContext(t)` -> `TradedGroupPlaceOrder` updates position and bracket lines on canvas.
   - **Chart -> Ticket**: User drags line -> `Z.onFinishMove` -> `_modifyPlaceOrder` -> `_createCallbacksForPlaceOrder().modifyOrder(newOrder, ..., silent)` -> calls `broker.createPlaceOrderContext({ order, source: "traded-source", silent })` -> `tradedContextLinking.setContext(a, silent)` -> `OrderViewController._handleTradedContextChange(e)` fires -> sees `source !== "order-ticket"` -> calls `_updateOrderValues(e.data())` -> updates `limitPriceModel`, `stopPriceModel`, `quantityModel`, and bracket models in ticket in real-time.

4. **Missing Broker Adapter Contracts & Settings**:
   - `mt5_broker.js` is missing `getOrderDialogOptions()`, `getSymbolSpecificTradingOptions()`, `getValidationRules()`, and full `symbolInfo()` properties (`allowedOrderTypes`, `allowedDurations`, `limitPriceStep`, `stopPriceStep`).
   - `index.html` is missing `broker_config.configFlags` (`supportPlaceOrderPreview`, `supportModifyOrderPreview`, `supportOrderBrackets`, `supportStopOrdersInBothDirections`).
   - `index.html` is missing chart overrides for `tradingProperties.showOrders: true` and `tradingProperties.showPositions: true`.

---

## Part 1: Comprehensive Reference Analysis of Core Symbols

We systematically scanned all 311 bundle files in `charting_library/bundles/` and root files using AST and text match algorithms.

### 1. `createPlaceOrderContext`
* **Bundle Locations**:
  - `charting_library/bundles/trading.5355aa53ba59846168ee.js` (lines 33, 37, 103, 123)
  - `charting_library/bundles/trading-groups.9659877d7d96e0bb027b.js` (line 15)
* **Definition**:
  Implemented by TradingView's `Trading` wrapper (`class oe`) around the broker adapter:
  ```javascript
  async createPlaceOrderContext(e) {
    const { order: t, source: i, isDisposable: s, isValidationEnabled: r, silent: n, signal: a = null } = e;
    if (s) return this._createPlaceOrderContext(e);
    const l = this._placeOrderContextWithMetaInfo;
    if (void 0 !== l && l.context.status() !== PlaceOrEditContextStatus.Destroyed && l.context.data().symbol === t.symbol && l.isValidationEnabled === r) {
      return await l.context.setData(t, i, n), l.context;
    }
    this._placeOrderContextWithMetaInfo?.context.destroy();
    const d = await this._createPlaceOrderContext(e);
    if (a?.aborted) throw d.destroy(), createAbortError();
    return l === this._placeOrderContextWithMetaInfo && (this._placeOrderContextWithMetaInfo = { context: d, isValidationEnabled: r }), d;
  }
  ```
  `_createPlaceOrderContext(e)` extracts symbol information, price formatters, order dialog options, subscribes to real-time quotes, extracts TP/SL validation rules, and constructs `new G({ ... })` (the internal `PlaceOrderContext` class extending `class V`).

### 2. `createEditOrderContext`
* **Bundle Locations**:
  - `charting_library/bundles/trading.5355aa53ba59846168ee.js` (lines 33, 36, 123)
* **Definition**:
  Constructs `new J({ ... })` (internal `EditOrderContext` extending `class V`). Used when editing existing placed orders or modifying working orders from instant buttons or context menus.

### 3. `PreOrderItem`
* **Bundle Locations**:
  - `charting_library/bundles/6161.10c4a7de17f463d1d76e.js` (lines 15, 21, 34, 35, 41)
  - `charting_library/bundles/trading-groups.9659877d7d96e0bb027b.js` (lines 7, 12, 13)
* **Definition**:
  Defined in module 842471 of `6161.10c4a7de17f463d1d76e.js`:
  ```javascript
  class PreOrderItem extends OrderWithMenuItem {
    qtyText() { return super._quantityText(this._data.qty); }
    style() { return this._infoGetters.style(this); }
    setSupportOrderType(t) { this._supportedOrderTypes = t; }
    canSwitchType() { return this._supportedOrderTypes.length > 1; }
    orderTypesItems() {
      return this._supportedOrderTypes.map(t => ({
        type: t,
        typeText: orderTypeToText({ orderType: t })
      }));
    }
    isWorking() { return true; }
    profitLossText(t) {
      return orderTypeToText({ orderType: this.data().type, uppercase: t, shorten: t });
    }
    lineStyle() { return LineStyle.Solid; }
    supportClose() { return true; }
    supportModify() { return this._data.supportModify; }
    ...
  }
  ```
  Rendered by `class Ie extends Be` on the chart pane with horizontal lines, quantity badges, price scale axis pills, close button ("X"), and drag handles.

### 4. `_updateTradedContextLinking`
* **Bundle Locations**:
  - `charting_library/bundles/trading.5355aa53ba59846168ee.js` (lines 103, 104, 105, 106)
* **Definition**:
  The central synchronization bridge inside `OrderViewController` (`Qt`):
  ```javascript
  this._updateTradedContextLinking = async e => {
    if (!(
      null === this._state.broker ||
      void 0 === this._tradedContextLinking ||
      null === this._orderViewModel ||
      this._orderViewModel.existingOrder ||
      this._orderViewModel.getStatus() === OrderPanelStatus.Wait ||
      void 0 === this._orderViewModel.side() ||
      null === this._orderViewModel.quantityModel.getValue() ||
      (void 0 === this._orderViewModel.preOrder().limitPrice &&
       void 0 === this._orderViewModel.preOrder().stopPrice &&
       2 !== this._orderViewModel.preOrder().type)
    ))
    try {
      if (this._orderViewModel.getStatus() === OrderPanelStatus.Wait) return;
      const t = await respectAbort(e, this._state.broker.createPlaceOrderContext({
        order: this._orderViewModel.preOrder(),
        source: "order-ticket",
        signal: e
      }));
      if (e?.aborted) return;
      this._tradedContextLinking.setContext(t);
      this._setErrorsState(t.errors());
    } catch (e) {
      skipAbortError(e);
    }
  };
  ```

### 5. `bindToOrderTicket`
* **Bundle Analysis**:
  `bindToOrderTicket` does not exist as a literal method name in the bundles. Rather, context binding is achieved via the `TradedContextLinking` class (`class Fi` in `trading.5355aa53ba59846168ee.js`) and the two methods:
  - `this._tradedContextLinking.setContext(t)`
  - `this._tradedContextLinking.onContextChanged().subscribe(this, this._handleTradedContextChange)`

### 6. `getOrderDialogOptions`
* **Bundle Locations**:
  - `charting_library/bundles/trading.5355aa53ba59846168ee.js` (lines 31, 33, 37, 103, 108)
  - `charting_library/bundles/dom-panel.81d8dd298ff835119bb5.js` (line 28)
* **Definition**:
  Invoked on the broker connection adapter when initializing order dialogs or place order contexts:
  ```javascript
  async getOrderDialogOptions(symbol) {
    if (void 0 !== this._brokerConnection.getOrderDialogOptions) {
      try {
        return await this._brokerConnection.getOrderDialogOptions(symbol);
      } catch(e) {
        this._brokerLogger.logError(`Failed to fetch options for order dialog: ${e}`);
      }
    }
  }
  ```
  Expected return value: `{ customFields?: [...] }` or undefined.

### 7. `supportPlaceOrderPreview` & `supportModifyOrderPreview`
* **Bundle Locations**:
  - `charting_library/bundles/trading.5355aa53ba59846168ee.js` (lines 37, 103, 105, 108)
* **Definition**:
  Broker config flags:
  - `supportPlaceOrderPreview: true` controls whether the order preview button and preview model are activated in the order ticket/panel.
  - When enabled, clicking the preview button invokes `broker.previewOrder(order)` and displays an order summary dialog prior to execution.

### 8. `supportOrderBrackets`
* **Bundle Locations**:
  - `charting_library/bundles/6161.10c4a7de17f463d1d76e.js` (lines 15, 21, 35)
  - `charting_library/bundles/trading-groups.9659877d7d96e0bb027b.js` (line 12)
  - `charting_library/bundles/trading.5355aa53ba59846168ee.js` (lines 31, 37, 104)
* **Definition**:
  In `6161.10c4a7de17f463d1d76e.js`:
  ```javascript
  supportBrackets() {
    return !this._isBracket() && this._symbolDataProvider.supportOrderBrackets();
  }
  ```
  When `supportOrderBrackets: true`, `PreOrderItem` enables projection brackets (`_updateProjectionBracketsItems`). This displays the draggable Take Profit (TP) and Stop Loss (SL) bracket handles attached to the limit/stop pre-order line on the chart canvas.

---

## Part 2: Exact Call Hierarchies & Data Flow

### Call Chain A: Selecting "Limit" in the Order Panel / Ticket

```
User clicks "Limit" tab in Order Panel / Ticket
 │
 ├──> OrderViewModel.setOrderType(OrderType.Limit)
 │     ├── updates limitPriceModel with default / last price
 │     └── fires onInputStateChanged()
 │
 ├──> OrderViewController._onOrderWidgetInputStateChanged(diff)
 │     └── calls this._updateTradedContextLinking(signal)
 │
 └──> OrderViewController._updateTradedContextLinking(signal)
       │
       ├── Checks preconditions:
       │     broker !== null
       │     this._tradedContextLinking !== undefined   <── [CRITICAL: MUST NOT BE UNDEFINED]
       │     orderViewModel !== null && !existingOrder
       │     status !== Wait && side !== undefined && qty !== null
       │     preOrder().limitPrice !== undefined || preOrder().stopPrice !== undefined
       │
       ├── Calls activeBroker.createPlaceOrderContext({
       │     order: this._orderViewModel.preOrder(),
       │     source: "order-ticket",
       │     signal: signal
       │   })
       │
       ├── Sets returned context on linking:
       │     this._tradedContextLinking.setContext(context)
       │
       └── Updates validation errors in ticket:
             this._setErrorsState(context.errors())
```

### Call Chain B: Requesting & Instantiating PreOrderItem on Chart

```
this._tradedContextLinking.setContext(context)
 │
 ├──> Fires this._onContextChanged.fire(context.externalContext())
 │
 └──> TradedSourcesManager._updateTradedGroupFromLinking(context)
       │
       ├── Verifies isContextPlaceOrderContext(context) && order.type !== 2 (Not Market)
       │
       ├── Extracts place data:
       │     const h = this._createPlaceSourceData(context)
       │     // h = { dataType: "PreOrder", symbol, qty, side, type, price: limitPrice, ... }
       │
       ├── Adds or updates custom chart source:
       │     this._chartWidgetCollection.addCustomSource("tradedGroupPlaceOrderPrefix", (e, n) => {
       │       return new TradedGroupPlaceOrder(
       │         e, n, chartModel, configFlags, showTradedGroup, tradedGroupPlaceData, ...
       │       );
       │     })
       │
       ├── TradedGroupPlaceOrder._createMainItem(h)
       │     └── createItem(TradedGroupItemType.PreOrder, h, this, chartModel, services, texts)
       │           └── new PreOrderItem(data, source, series, symbolDataProvider, options)
       │
       ├── TradedGroupPlaceOrder._updateProjectionBracketsItems()
       │     └── If supportOrderBrackets() is enabled:
       │           creates TakeProfit & StopLoss ProjectionBracketItem instances
       │
       └── Chart Selection Macro:
             d.activeChartWidget.value().model().model().selectionMacro(e => {
               const hitTest = new HitTestResult(HitTarget.Custom, {
                 cursorType: Default,
                 hideCrosshairLinesOnHover: true,
                 ...activeItemToHitTestResultData({ id: "preOrder", part: 9 })
               });
               e.addSourceToSelection(tradedGroupPlaceOrder, hitTest.data());
             })
             // Line immediately renders with drag handles, price axis label, qty badge, and brackets!
```

### Call Chain C: Dragging Limit Line on Chart & Two-Way Sync Back to Ticket

```
User drags Limit Line on chart canvas
 │
 ├──> Chart canvas mouse drag events -> PaneView (We)
 │
 ├──> PreOrderItemRenderer (Ie)._callbacks().onMove(price)
 │     └── TradedGroupPlaceOrder (Z).onMove(itemId, price)
 │           └── PreOrderItem.applyPriceDiff(diff) & redraws canvas smoothly
 │
 ├──> User releases mouse button (mouse up) -> onFinishMove()
 │     └── TradedGroupPlaceOrder (Z).onFinishMove(itemId, gaParams)
 │           ├── calls this.modifyAllItems(itemId, gaParams)
 │           └── calls this._modifyPlaceOrder(preOrderData, void 0, silent)
 │
 ├──> TradedSourcesManager._createCallbacksForPlaceOrder().modifyOrder(order, type, silent)
 │     │
 │     ├── Calls activeBroker.createPlaceOrderContext({
 │     │     order: order,
 │     │     source: "traded-source",   <── [CRITICAL: source is "traded-source"]
 │     │     silent: silent
 │     │   })
 │     │
 │     └── Calls this._tradedContextLinking.setContext(updatedContext, silent)
 │
 └──> this._tradedContextLinking.onContextChanged fires!
       │
       ├── 1. TradedSourcesManager updates on-chart visuals
       │
       └── 2. OrderViewController._handleTradedContextChange(e)
             │
             ├── Checks: e.source() !== "order-ticket" (TRUE, source is "traded-source")
             │
             ├── Calls this._updateOrderValues(e.data()):
             │     void 0 !== limitPrice && this._orderViewModel.limitPriceModel.setPriceValue(limitPrice);
             │     void 0 !== stopPrice  && this._orderViewModel.stopPriceModel.setPriceValue(stopPrice);
             │     void 0 !== qty        && this._orderViewModel.quantityModel.quantity.setValue(qty);
             │     void 0 !== stopLoss   && this._updateStopLossValues(...);
             │     void 0 !== takeProfit && this._updateTakeProfitValues(...);
             │
             └── Ticket input fields update instantaneously without loop recursion!
```

### Call Chain D: Order Execution from Chart or Ticket

```
When user confirms order:
 ├── If from Chart: user clicks Confirm / Check button on PreOrderItem:
 │     └── TradedGroupPlaceOrder._onConfirm() -> callbacks.sendOrder()
 │           └── context.send() -> activeBroker.placeOrder(order)
 │                 └── tradedContextLinking.clear()
 │
 └── If from Order Ticket: user clicks "Buy Limit" or "Sell Limit":
       └── OrderViewController sendHandler:
             └── tradedContextLinking.context().send().finally(() => tradedContextLinking.clear())
                   └── activeBroker.placeOrder(order)
                         └── sends pending limit order to MT5 backend (/trade/pending)
```

---

## Part 3: Detailed Audit of Current Implementation

### 1. `trading.5355aa53ba59846168ee.js`
* **Status**: **BUG FOUND IN BUNDLE CODE**
* **Location**: Line 160 (`_createOrderController`)
* **Current Code**:
  ```javascript
  orderPresetsManager: this._orderPresetsManager,
  tradedContextLinking: void 0,
  orderByIdGetter: e => this._ordersService.find(e)
  ```
* **Required Fix**:
  ```javascript
  orderPresetsManager: this._orderPresetsManager,
  tradedContextLinking: this._tradedContextLinking,
  orderByIdGetter: e => this._ordersService.find(e)
  ```
* **Runtime Defense-in-Depth Fix**:
  In `mt5_broker.js` or `index.html`, when `host` (wrapper `class oe`) is initialized, `host._trading` provides direct access to the `Trading` instance:
  ```javascript
  if (host._trading && host._trading._tradedContextLinking) {
    var linking = host._trading._tradedContextLinking;
    host._trading.findOrCreateOrderViewController().then(function(ctrl) {
      if (ctrl && !ctrl._tradedContextLinking) {
        ctrl._tradedContextLinking = linking;
        if (ctrl._subscribeOrderViewModel) {
          ctrl._subscribeOrderViewModel();
        }
      }
    });
  }
  ```

### 2. `mt5_broker.js`
* **Status**: **PARTIAL / NEEDS ENHANCEMENT**
* **Currently Implemented**:
  - Account Manager info and columns (`Balance`, `Equity`, `Open P&L`, `Margin`, `Free Margin`)
  - Order and position retrieval (`/trade/orders`, `/trade/positions`)
  - Market and pending order execution (`/trade/order`, `/trade/pending`)
  - Position bracket modification (`editPositionBrackets` -> `/trade/modify`)
  - Real-time quote streaming via WebSocket `/ws/quotes`
* **Missing / Broken**:
  - `getOrderDialogOptions(symbol)`: Not implemented. Must be added:
    ```javascript
    getOrderDialogOptions: function(symbol) {
      return Promise.resolve({ customFields: [] });
    },
    ```
  - `getSymbolSpecificTradingOptions(symbol)`: Not implemented. Must be added:
    ```javascript
    getSymbolSpecificTradingOptions: function(symbol) {
      return Promise.resolve({
        supportOrderBrackets: true,
        supportPositionBrackets: true,
        supportBracketsInPips: true,
        allowedOrderTypes: [1, 2, 3, 4]
      });
    },
    ```
  - `getValidationRules(symbol)`: Not implemented. Should return `Promise.resolve([])`.
  - `symbolInfo(symbol)`: Returns basic object, but is missing:
    - `allowedOrderTypes: [1, 2, 3, 4]`
    - `allowedDurations: ["GTC", "DAY"]`
    - `limitPriceStep: minTick`
    - `stopPriceStep: minTick`

### 3. `index.html`
* **Status**: **PARTIAL / NEEDS CONFIGURATION**
* **Missing in `broker_config.configFlags`**:
  ```javascript
  broker_config: {
    configFlags: {
      supportReversePosition: true,
      supportClosePosition: true,
      supportPartialClosePosition: false,
      supportEditAmount: false,
      supportLevel2Data: false,
      supportDOM: true,
      supportMarketOrders: true,
      supportLimitOrders: true,
      supportStopOrders: true,
      supportStopLimitOrders: true,
      supportPositionBrackets: true,
      showQuantityInsteadOfAmount: true,
      supportOrderBrackets: true,
      supportPlaceOrderPreview: true,
      supportModifyOrderPreview: true,
      supportStopOrdersInBothDirections: true,
      supportStopOrdersInBothDirectionsInUI: true,
      supportStopLimitOrdersInBothDirections: true,
      supportModifyOrder: true,
      supportModifyOrderPrice: true,
      supportCancelOrder: true,
      supportModifyBrackets: true,
      supportModifyPositionBrackets: true,
      supportModifyOrderBrackets: true,
      supportAddBracketsToExistingOrder: true
    }
  }
  ```
* **Missing in `overrides`**:
  `tradingProperties.showOrders` and `tradingProperties.showPositions` must be explicitly forced to `true`:
  ```javascript
  overrides: {
    "tradingProperties.showOrders": true,
    "tradingProperties.showPositions": true,
    "tradingProperties.showExecutions": true,
    "tradingProperties.horizontalGridProperties.color": "rgba(255, 255, 255, 0.05)",
    "tradingProperties.verticalGridProperties.color": "rgba(255, 255, 255, 0.05)"
  }
  ```

---

## Part 4: Catalog of 249 Native Featuresets in Charting Library Bundles

Our automated extraction identified 249 unique featuresets across the library bundles. Below is the structured classification of all key featuresets:

### A. Trading & Execution (Core M20 Requirements)
- `trading_terminal`: Enables full trading terminal mode.
- `order_panel`: Enables the native right-docked Order Panel.
- `order_panel_close_button`: Displays close button on the order panel.
- `order_panel_undock`: Allows undocking the order panel into a floating dialog.
- `show_order_panel_on_start`: Automatically opens order panel on initialization.
- `trading_account_manager`: Activates bottom Account Manager panel with Positions, Orders, Summary.
- `open_account_manager`: Keeps Account Manager open and selectable.
- `buy_sell_buttons`: Renders native Buy/Sell market quote buttons on chart header.
- `dom_widget`: Enables Depth of Market (DOM) panel widget.
- `enable_dom_data_for_untradable_symbols`: Fallback DOM support.
- `chart_property_page_trading`: Adds "Trading" settings tab in Chart Properties dialog.
- `chart_crosshair_menu`: Adds '+' button on chart crosshair with instant Limit/Stop placement actions.
- `always_pass_called_order_to_modify`: Ensures exact order reference is passed during modifications.
- `trading_notifications`: Enables native TradingView toast notifications on executions/rejections.
- `show_trading_notifications_history`: Records notifications history in Account Manager tab.
- `broker_button`: Shows broker connection details and status button in toolbar.
- `order_info`: Enables order info tooltips and hover modals.
- `snapshot_trading_drawings`: Captures trading lines during chart snapshots.
- `show_symbol_logo_in_account_manager`: Renders currency logos in Account Manager rows.

### B. Timescale, Datafeed & Precision
- `countdown`: Real-time countdown timer to bar close on active candle.
- `seconds_resolution`: Enables 1S, 5S, 15S, 30S sub-minute chart intervals.
- `tick_resolution`: Enables 1T, 3T, 10T tick-based chart resolutions.
- `custom_resolutions`: Allows user to input custom chart resolutions.
- `pre_post_market_sessions`: Displays pre-market and post-market trading sessions.
- `pre_post_market_price_line`: Horizontal line showing extended session price.
- `show_average_close_price_line_and_label`: Average close price line indicator.
- `display_market_status`: Displays market open/closed status badge in legend.
- `go_to_date`: Go-to-date calendar shortcut navigation dialog.
- `timeframes_toolbar`: Bottom bar with quick timeframe selectors (1D, 5D, 1M, 1Y).
- `update_timeframes_set_on_symbol_resolve`: Dynamic timeframe adjustment per asset.

### C. Chart Styles & Visual Capabilities
- `japanese_chart_styles`: Enables Heikin Ashi, Renko, Kagi, Point & Figure, Line Break chart styles.
- `chart_style_hilo`: High-Low bar chart style.
- `chart_style_hilo_last_price`: Last price line on Hi-Lo bars.
- `support_multicharts`: Enables 2x1, 2x2, 3x3 multi-chart layout grid.
- `additional_multichart_layouts`: Unlocks advanced 5, 6, 8-chart layouts.
- `header_layouttoggle`: Multi-chart layout toggle button in top header.
- `header_screenshot`: Instant chart snapshot capture button.
- `volume_force_overlay`: Displays volume as a separate overlay when appropriate.
- `create_volume_indicator_by_default`: Automatically attaches volume indicator to new charts.

### D. Watchlist & Analysis Tools
- `multiple_watchlists`: Allows creating and switching multiple symbol watchlists.
- `watchlist_import_export`: Import and export watchlist symbols as CSV/TXT.
- `watchlist_sections`: Custom dividers and section headers in watchlist.
- `watchlist_context_menu`: Right-click contextual actions on watchlist symbols.
- `watchlist_cross_tab_sync`: Synchronizes watchlists across browser tabs.
- `fundamental_widget`: Right widget bar fundamentals data pane.
- `show_object_tree`: Shows drawing and indicator tree hierarchy.
- `keep_object_tree_widget_in_right_toolbar`: Embeds object tree in right sidebar.
- `object_tree_legend_mode`: Integrates object tree controls into chart legend.
- `study_templates`: Saves and restores indicator template sets.
- `drawing_templates`: Saves and applies drawing styles and templates.
- `items_favoriting`: Enables gold star favoriting for intervals, drawing tools, and indicators.
- `charting_library_export_chart_data`: Exports OHLCV series data to CSV.

---

## Part 5: Actionable Implementation Roadmap for Implementers

To bring the native Limit/Stop draggable placement lines, SL/TP bracket handles, and 100+ native features to full operational status:

1. **Step 1: Wire `tradedContextLinking` in `trading.5355aa53ba59846168ee.js`**:
   Replace `tradedContextLinking: void 0,` with `tradedContextLinking: this._tradedContextLinking,` at line 160.
2. **Step 2: Add Runtime Context Safety Hook in `mt5_broker.js`**:
   In `MT5Broker` constructor, access `host._trading` and ensure `ctrl._tradedContextLinking = host._trading._tradedContextLinking` as a fallback.
3. **Step 3: Implement Missing Broker Methods in `mt5_broker.js`**:
   - Add `getOrderDialogOptions(symbol)`.
   - Add `getSymbolSpecificTradingOptions(symbol)`.
   - Add `getValidationRules(symbol)`.
   - Enhance `symbolInfo(symbol)` with `allowedOrderTypes`, `limitPriceStep`, `stopPriceStep`.
4. **Step 4: Update `index.html` Configuration**:
   - Set all required flags in `broker_config.configFlags`.
   - Set chart `overrides` with `tradingProperties.showOrders: true` and `tradingProperties.showPositions: true`.
   - Add all 249 discovered features to `enabled_features`.
5. **Step 5: Automated Verification**:
   Run an automated CDP/browser verification script confirming that clicking "Limit" renders `PreOrderItem` on chart canvas, dragging updates input, and placing executes order on MT5.
