# Deep Investigation Report: DOM Ladder Dynamic Anchoring & Position Sync

**Investigator**: explorer_dom_ladder  
**Date**: 2026-09-08  
**Scope**: TradingView Advanced Charts DOM Price Ladder (`dom_widget`), Dynamic Anchoring (`dynamicModeState`), and DOM Position/P&L Synchronization with MetaTrader 5 Broker Adapter (`mt5_broker.js`).

---

## Executive Summary

This investigation analyzed the complete lifecycle, architecture, and runtime mechanics of the TradingView Depth of Market (DOM) price ladder and its associated Position/P&L widgets across:
1. `charting_library/bundles/dom-panel.81d8dd298ff835119bb5.js` (DOM panel UI, virtualized row pool, and calculation models)
2. `charting_library/bundles/trading.5355aa53ba59846168ee.js` (Trading Host, Broker Connection Adapter, subscription routing)
3. `charting_library/bundles/library.e8d44337c84d65489d2c.js` (Core layout, right toolbar tabs, fallback depth adapter)
4. `e:\TRADINGVIEW ADVANCED\broker-sample\dist\bundle.js` (Official TradingView Broker Sample reference implementation)
5. `e:\TRADINGVIEW ADVANCED\mt5_broker.js` (Local MetaTrader 5 Broker API implementation)
6. `e:\TRADINGVIEW ADVANCED\index.html` (Widget initialization, featuresets, and broker configuration)

### Key Discoveries
- **DOM Centering Mechanism**: The DOM price ladder centers based on `_autoCenterTargetTopIndex() = Math.floor((bestBid + bestAsk) / 2) + Math.floor(height / 2)`. In dynamic mode (`_dynamicModeState = true`), automatic centering is triggered **exclusively within `updateData(depthPayload)`**. Price ticks passing through `updateLast(price)` **do NOT** trigger `centerOnLast()`.
- **Root Cause of Centering Loss**:
  1. `mt5_broker.js` previously emitted depth updates on a 350ms interval rather than synchronously with live WebSocket quote ticks, and only dispatched depth updates to internal callbacks rather than directly ensuring `host.domUpdate(symbol, payload)` is fired with exact MT5 quote prices.
  2. The Dynamic Mode toggle button in the DOM controls bar (`Ze` in `dom-panel.81d8dd298ff835119bb5.js`) hardcodes its initial React component state to `icon: off` (`Ke.off`). Toggling it inverts `_dynamicModeState` out of phase with the UI button state.
  3. When `_dynamicModeState` is `false`, the 2000ms auto-center timer `G` is permanently blocked because `checkAutoCenter()` contains a logic defect (`let r = !1; ... setValue(r)`) that always sets `autoCenterRequired` to `false`, causing the timer to abort immediately.
- **Root Cause of DOM Position & P&L Widget Sync Failure**:
  1. **Smoking-Gun ID Mismatch**: In `mt5_broker.js` (line 1672), `self._host.plUpdate(pos.symbol, pos.profit)` was passing `pos.symbol` (e.g. `"XAUUSD."`) instead of `posId` (`pos.ticket`, e.g. `"70257567"`). The DOM panel subscribes using `broker.subscribePL(position.id, handler)`. Consequently, TradingView looked up subscriptions under `pos.id`, found none, and **never dispatched P&L updates to the DOM widget**.
  2. **`subscribePL` Signature Error**: In `mt5_broker.js` (line 1190), `subscribePL: function(callback)` expected a single callback argument, whereas TradingView's Broker API passes `subscribePL(positionId)`.
  3. **Event Subscription Blindspot**: `DOMPanel` subscribes only to `broker.positionUpdate` (`_positionsCache.updateDelegate`), **NOT** `broker.positionPartialUpdate`. When `mt5_broker.js` updated existing positions via `host.positionPartialUpdate(posId, tvPos)`, the DOM panel ignored the updates.
  4. **Stale Memory Cache in `broker.positions()`**: `positions()` returned `Promise.resolve(cached)` if `cached.length > 0`, preventing fresh positions from being queried upon DOM mount.

---

## 1. DOM Price Ladder Initialization & Rendering Architecture

### 1.1 Configuration & Mounting
The DOM widget is enabled in `index.html` via the following feature flags:
```javascript
enabled_features: [
  "dom_widget",                           // Activates DOM widget capability
  "show_dom_first_time",                  // Opens DOM tab automatically on start
  "enable_dom_data_for_untradable_symbols",// Allows Level 2 data display
  "right_toolbar",                        // Required sidebar container
  "widgetbar_tabs"                        // Enables tab switcher in right sidebar
]
```

In `library.e8d44337c84d65489d2c.js` (line 890), the right toolbar determines whether to include the DOM tab:
```javascript
cS = l.enabled("right_toolbar") && (
  lS.watchlist || lS.details || lS.news || lS.datawindow ||
  l.enabled("dom_widget") || l.enabled("order_panel") ||
  l.enabled("show_object_tree") || l.enabled("bugreport_button")
);
```

When selected, TradingView instantiates `class at` (`DOMPanel`) from `bundles/dom-panel.81d8dd298ff835119bb5.js`.
`DOMPanel` checks `activeBroker().metainfo().configFlags.supportDOM`. If `supportDOM` is true, it creates the layout and initializes `class nt`.

### 1.2 Component Hierarchy & Responsibilities

```
DOMPanel (class at)
  └── nt (DOM Controller)
        ├── class $ (Price Ladder Engine)
        │     ├── class B (Row View Pool)
        │     │     └── class L (DOM Row: Buy meter, Buy price, Price cell, Sell price, Sell meter, Orders)
        │     └── class V (Order View Pool)
        │           └── class N (DOM Order Badge: Qty, Cancel 'X', Type text, Modifiers)
        ├── class U (Position & P&L Calculation Model)
        │     ├── positionState$ (Subject: { positionText, side })
        │     ├── plState$ (Subject: { plText, tradeDirection, plTooltipText })
        │     └── qty (WatchedValue for Order Placement)
        ├── ResizeObserver (Observes clientHeight, sets ladder height = ceil(clientHeight / 20))
        ├── Controls Block (class Je / class Ye)
        │     ├── Buy Orders Cancel button (class qe)
        │     ├── Centering / Dynamic Mode toggle button (class Ze / class ze)
        │     │     └── SVG Progress Arc Timer (class Ue)
        │     ├── Total Bid & Ask Volume Badges (class Ye)
        │     └── Sell Orders Cancel button (class qe)
        └── Bottom Widget Block (class Ve)
              ├── Position Badge & P&L Badge (class Pe)
              ├── Trading Actions: Flatten, Clear, Reverse (class Be)
              ├── Quick Market Buy / Qty / Market Sell (class xe / class ve)
              └── Order Duration Dropdown (class ce / class oe)
```

### 1.3 Ladder Math & Row Price Calculation
- The DOM price ladder converts prices to discrete indices using:
  $$\text{priceToIndex}(P) = \text{round}\left(\frac{P}{\text{minTick}}\right)$$
  $$\text{indexToPrice}(I) = I \times \text{minTick}$$
- The height of the DOM ladder $H$ is calculated in rows (20px per row) via `ResizeObserver`:
  $$H = \left\lceil \frac{\text{container.clientHeight}}{20} \right\rceil$$
- The table displays rows from top index $T$ downward:
  $$\text{Row}_k = \text{correctIndex}(T, -k), \quad k \in [0, H-1]$$
- Row 0 (top of DOM) corresponds to the highest price; row $H-1$ (bottom) corresponds to the lowest price.

---

## 2. Dynamic Anchoring (`dynamicModeState: true`) Mechanics & Centering Failures

### 2.1 Centering Mathematics
In `class $` (`dom-panel.81d8dd298ff835119bb5.js` lines 13-14):
```javascript
_getGapMiddleIndex() {
  let e = this._bestAskIndex, t = this._bestBidIndex;
  return isFinite(e) || (e = t), isFinite(t) || (t = e), Math.floor((t + e) / 2);
}

_getCenterIndex() {
  const e = this._getGapMiddleIndex();
  return isFinite(e) ? e
    : isFinite(this._bestBidIndex) ? this._bestBidIndex
    : isFinite(this._bestAskIndex) ? this._bestAskIndex
    : isFinite(this._lastPriceIndex) ? this._lastPriceIndex
    : NaN;
}

_autoCenterTargetTopIndex() {
  const e = Math.floor(this.height / 2);
  return this._showPricesWith.zeroVolume.value() && this._showPricesWith.spread.value()
    ? this._getCenterIndex() + e
    : this._getCorrectCenterIndex() + e;
}
```

When `bestAsk` and `bestBid` are known:
$$\text{centerIndex} = \left\lfloor \frac{\text{bestBidIndex} + \text{bestAskIndex}}{2} \right\rfloor$$
$$\text{topIndex} = \text{centerIndex} + \left\lfloor \frac{H}{2} \right\rfloor$$
Because the row at index $\text{topIndex} - \lfloor H/2 \rfloor = \text{centerIndex}$ sits exactly at row index $\lfloor H/2 \rfloor$, the midpoint of the Ask/Bid spread is positioned dead-center vertically.

### 2.2 Dynamic Mode vs. Real-Time Quotes (`updateLast` vs `updateData`)

In `dom-panel.81d8dd298ff835119bb5.js` line 10-11:
```javascript
updateData(e) {
  // Recalculate asks, bids, _bestAskIndex, _bestBidIndex, _currentVolumeMax...
  i && this._recalcDepthInfo();
  this._recalcMaxVolume();
  t ? (this.centerOnLast(), this._isPositionAlreadyUpdated = !0) : this.checkAutoCenter();
  this._dynamicModeState && this.centerOnLast();
  this.scheduleRepaint();
}
```
**Notice**: `this._dynamicModeState && this.centerOnLast()` is executed **only in `updateData`**.

Now contrast this with `updateLast(e)`:
```javascript
updateLast(e) {
  const t = this.priceToIndex(e);
  t !== this._lastPriceIndex && (
    this._invalidatedPriceHighlight[this._lastPriceIndex] = !0,
    this._invalidatedPriceHighlight[t] = !0,
    this._lastPriceIndex = t,
    this.checkAutoCenter(),
    this.scheduleRepaint()
  );
}
```
`updateLast(e)` is called on every incoming quote tick by `o.realtimeHandler`. **`updateLast` does NOT call `centerOnLast()`**. It only updates the highlight cell on the price scale and calls `checkAutoCenter()`.

### 2.3 Why Dynamic Centering Lost Focus or Failed to Stay Centered

#### Defect 1: The Broken `checkAutoCenter()` Timer Flag in TradingView Bundle
In `dom-panel.81d8dd298ff835119bb5.js` (line 12):
```javascript
checkAutoCenter() {
  isFinite(this.topIndex) || this.centerOnLast();
  const e = this.topIndex, t = this.correctIndex(this.topIndex, 1 - this.height);
  let i = isFinite(this._bestBidIndex) ? this._bestBidIndex : ... ;
  let s = NaN;
  ...
  let r = !1;
  (s + 3 > e || i - 3 < t) && (this.topIndex, this._autoCenterTargetTopIndex()),
  this.autoCenterRequired.setValue(r);
}
```
`r` is initialized to `false` and **never assigned `true`** even if the spread moved out of bounds (`s + 3 > e || i - 3 < t`).
Consequently, `this.autoCenterRequired.setValue(false)` is always called with `false`.
In `nt._mergeTimerLockState`:
```javascript
!t.autoCenterRequired || t.scroll || t.drag || t.dialog
  ? this._timer.abort()
  : this._timer.run();
```
Because `autoCenterRequired` is always `false`, `this._timer.abort()` is called constantly! The 2-second fallback timer never runs. If the user scrolls or the ladder moves, it never centers back unless `centerOnLast()` is called explicitly by `updateData`.

#### Defect 2: UI State Inversion in Dynamic Mode Toggle Button
In `dom-panel.81d8dd298ff835119bb5.js` lines 19-20:
```javascript
function Ze(e) {
  const { onClick: t, toggleDynamicModeState: s, trackEvent: r, timer: o } = e,
        [l, d] = (0, a.useState)({
          icon: Ke.off,
          title: n.t(null, void 0, i(167785)) // "Enable dynamic mode"
        });
  ...
  onClick: () => {
    const e = s(); // Inverts _dynamicModeState
    d(e => e ? { icon: Ke.on, ... } : { icon: Ke.off, ... }(e));
    t();
  }
}
```
When `_dynamicModeState` was initialized to `true` in `class $`, the React component `Ze` still mounted with `icon: Ke.off`. Clicking the button inverted `_dynamicModeState` from `true` to `false` while updating the UI icon to `Ke.on`. The UI and engine were inverted.

#### Defect 3: Decoupled DOM Updates from Live Quotes in `mt5_broker.js`
In `mt5_broker.js`:
- `_emitDOMUpdate` was originally driven by a 350ms `setInterval` timer (`this._domInterval`).
- When ticks arrived over WebSocket (`ws.onmessage`), `mt5_broker.js` called `self._host.realtimeUpdate(sym, quote)` but only conditionally called `_emitDOMUpdate` if `self._domSubscriptions` contained internal listener functions.
- Because TradingView's `BrokerConnectionAdapter` invokes `broker.subscribeDOM(symbol)` without passing a callback, `self._domSubscriptions[symbol]` had length 0, causing WebSocket ticks to skip `_emitDOMUpdate`.
- Without `domUpdate` being emitted on every WebSocket tick, `this._content.updateData()` was not called synchronously with live price ticks, causing the DOM ladder to lose centering lock under fast market movement.

#### Defect 4: Synthetic DOM Step & Pricescale Mismatch
In `mt5_broker.js` lines 1289-1300:
`quote` objects created from WebSocket messages in `mt5_broker.js` had:
```javascript
{ ask, bid, spread, trade, last_price }
```
They lacked `pricescale` and `minmov`. Therefore, `_emitDOMUpdate` fell back to hardcoded step heuristics:
```javascript
} else if (symbol.indexOf('JPY') !== -1) { step = 0.001; }
...
} else { step = 0.0001; }
```
For 5-digit Forex pairs (`EURUSD.`, `GBPUSD.`, `USDCAD.`), MT5's actual `minTick` is `0.00001`. Dividing prices generated with step `0.0001` by `minTick` `0.00001` yielded index spacing of 10 rows per level, corrupting the spread calculation and breaking the midpoint anchor.

---

## 3. DOM Position & P&L Widget Synchronization

### 3.1 Data Flow Pipeline
The DOM bottom widget renders two primary indicators in `class Pe`:
1. **Position Badge**: Displays `${qty} @ ${avgPrice}` (e.g. `0.01 @ 2500.50`), colored blue for Long (`OrderSide.Buy`) and red for Short (`OrderSide.Sell`). When flat, displays `—` and is disabled.
2. **Floating P&L Badge**: In default currency mode, displays `${profit} ${currency}` (e.g. `+5.20 USD`), colored green for profit and red for loss. When flat, displays `—` and is disabled.

### 3.2 Root Causes of Position & P&L Widget Breakdown

#### Bug A: The Symbol vs. Position ID Mismatch in `plUpdate` (CRITICAL SMOKING GUN)
In `dom-panel.81d8dd298ff835119bb5.js` line 26:
```javascript
_processPositions(e, t, i) {
  const s = i.find((e => 0 !== e.qty));
  ...
  t.plHandler = (e, i) => {
    this._subscription === t && this._calcData.updatePL(i);
  };
  t.plPositionId = s.id;
  e.subscribePL(t.plPositionId, t.plHandler);
}
```
**Evidence**: The DOM panel subscribes to P&L using the position's unique identifier:
`e.subscribePL(s.id, t.plHandler)`.
In `trading.5355aa53ba59846168ee.js` (line 32 & 43):
```javascript
plUpdate(e, t) {
  this._adapter.fireSubscription("PL", e, t); // e is positionId, t is profit
}
```
This looks up subscriptions registered under `this._subscriptions[positionId]["PL"]`.

Now inspect `mt5_broker.js` line 1672:
```javascript
self._host.plUpdate(pos.symbol, pos.profit); // BUG: pos.symbol passed instead of pos.id!
```
**Result**: `mt5_broker.js` fired `plUpdate` with `pos.symbol` (e.g. `"XAUUSD."`). TradingView looked for listeners registered under `"XAUUSD."` and found none. The listener registered under ticket ID (e.g. `"70257567"`) was **never invoked**.
In `class U` (`dom-panel.81d8dd298ff835119bb5.js` line 15):
```javascript
_makePlText() {
  if (void 0 === this._pl) return null;
  const e = this._twoDecimalFormatter.format(this._pl);
  return void 0 !== this._symbolData?.positionCurrency ? `${e} ${this._symbolData.positionCurrency}` : e;
}
```
Because `this._pl` was never updated, `_makePlText()` returned `null`, and `Pe` displayed `l ?? "—"` (`"—"`). The P&L badge was permanently stuck on `"—"`.

#### Bug B: `subscribePL` Method Implementation in `mt5_broker.js`
In `mt5_broker.js` line 1190:
```javascript
subscribePL: function (callback) {
  this._plListeners = this._plListeners || [];
  if (typeof callback === 'function') {
    this._plListeners.push(callback);
    try { callback(this._accountData.pl || 0); } catch (e) {}
  }
}
```
**Evidence**: TradingView calls `broker.subscribePL(positionId)` where the argument is a string/number ID.
`typeof callback === 'function'` evaluated to `false`, and the call was discarded without registering the position ID.

#### Bug C: `positionPartialUpdate` Ignored by DOM Panel
In `mt5_broker.js` line 1617:
```javascript
var existing = self._positionById[posId];
if (existing) {
  Object.assign(existing, tvPos);
  self._host.positionPartialUpdate(posId, tvPos);
} else {
  self._positionById[posId] = tvPos;
  self._host.positionUpdate(tvPos);
}
```
**Evidence**: In `dom-panel.81d8dd298ff835119bb5.js` line 28:
```javascript
t.positionUpdate.subscribe(null, o.positionHandler);
// Notice: t.positionPartialUpdate is NOT subscribed!
```
When `self._host.positionPartialUpdate` was called, TradingView fired `_positionsCache.partialUpdateDelegate`. The DOM panel does not listen to `partialUpdateDelegate`; it only listens to `updateDelegate`.
Thus, whenever an existing position had its volume, profit, or SL/TP updated, the DOM panel received **no event whatsoever**.

#### Bug D: Stale Positions Cache in `broker.positions()`
In `mt5_broker.js` line 995:
```javascript
positions: function () {
  var self = this;
  var cached = this._getPositionsList();
  if (cached.length > 0) {
    return Promise.resolve(cached);
  }
```
When the DOM panel was mounted or re-created, it called `o.fullUpdatePosition()`, which invoked `broker.positions(symbol)`. If `_positionById` already had cached records, it returned the stale objects without re-querying MT5, freezing initial volume and entry price.

#### Bug E: Clean Neutral Transition on Position Close (Flat)
In `_syncPositions`:
```javascript
Object.keys(self._positionById).forEach(function (id) {
  if (!activeIds[id]) {
    var closedPos = self._positionById[id];
    if (closedPos) {
      closedPos.qty = 0;
      self._host.positionUpdate(closedPos);
    }
    delete self._positionById[id];
```
When a position is closed, `closedPos.qty = 0` correctly triggers `s = undefined` in `_processPositions`.
`_processPositions` then calls:
- `this._content.updatePosition(undefined)` $\rightarrow$ resets ladder entry line highlights.
- `this._calcData.updatePosition(undefined)` $\rightarrow$ sets `defaultPositionState: { positionText: null, side: null }`.
- `this._calcData.updatePL()` $\rightarrow$ sets `defaultPLState: { plText: null, tradeDirection: null }`.
- `Pe` renders `u ?? "—"` $\rightarrow$ `"—"`, `l ?? "—"` $\rightarrow$ `"—"`, and disables the badges.
However, if `self._host.plUpdate(id, 0)` is not emitted upon position closure, stale P&L could persist in `_lastFireResult[id]`.

---

## 4. Broker Adapter & Widget Configuration APIs Matrix

### 4.1 Broker Config Flags (`broker_config.configFlags` / `metainfo.configFlags`)

| Config Flag | Type | Required Value | Role in DOM & TradingView Operations |
|---|---|---|---|
| `supportDOM` | boolean | `true` | Enables the DOM panel in TradingView. If `false`, displays empty state. |
| `supportLevel2Data` | boolean | `true` | Dictates depth routing. If `true`, TV delegates to `broker.subscribeDOM(symbol)`. If `false`, TV activates `_fakeSubscribeDOM` which maps L1 quotes to synthetic depth. |
| `supportPositions` | boolean | `true` | Activates positions cache, position lines on chart, and DOM position tracking. |
| `supportPLUpdate` | boolean | `true` | Enables `broker.subscribePL(positionId)` and `host.plUpdate(positionId, pl)`. |
| `calculatePLUsingLast` | boolean | `false` | When `false` (standard Forex/CFD), Long P&L evaluates against `bid` and Short against `ask`. When `true`, uses `lastPrice`. |
| `positionPLInInstrumentCurrency`| boolean | `false` | Determines whether P&L is expressed in quote/instrument currency or account currency (`USD`). |
| `supportReversePosition` | boolean | `true` | Enables the "Reverse" button in the DOM actions block (`Be`). |
| `supportClosePosition` | boolean | `true` | Enables the "Close Position" ("Flatten") button in the DOM actions block (`Be`). |
| `supportPartialClosePosition` | boolean | `true` | Allows closing partial volume from DOM. |
| `supportMultiposition` | boolean | `false` | If `false` (netting account), DOM sets `hasFlatten: true`, unlocking the Flatten button. |
| `supportMarketOrders` | boolean | `true` | Enables Buy Market and Sell Market buttons in DOM (`xe`). |
| `supportLimitOrders` | boolean | `true` | Enables Limit orders on cell click / context menu in DOM ladder. |
| `supportStopOrders` | boolean | `true` | Enables Stop orders on Ctrl/Mod + cell click in DOM ladder. |
| `supportStopLimitOrders` | boolean | `true` | Enables StopLimit orders in DOM context menu. |
| `showQuantityInsteadOfAmount` | boolean | `true` | Sets quantity input to units/lots rather than monetary amounts. |

### 4.2 TradingView Widget Featuresets (`enabled_features`)

| Featureset | Purpose for DOM & Sync |
|---|---|
| `"dom_widget"` | Injects the DOM widget into the charting environment. |
| `"show_dom_first_time"` | Opens the DOM panel automatically upon chart launch. |
| `"enable_dom_data_for_untradable_symbols"` | Allows DOM ladder display even if a symbol is marked read-only. |
| `"right_toolbar"` | Hosts the widget tabs container. |
| `"widgetbar_tabs"` | Enables switching between Watchlist, Details, DOM, and Order Panel. |
| `"chart_property_page_trading"` | Exposes trading properties in chart settings. |

### 4.3 Broker Adapter Interface Methods (`MT5Broker.prototype`)

| Method | Parameters | Signature & Implementation Contract |
|---|---|---|
| `subscribeDOM` | `(symbol, [callback])` | Invoked when DOM panel opens. Must stream depth data to `this._host.domUpdate(symbol, { snapshot: boolean, asks: [{price, volume}], bids: [{price, volume}] })`. |
| `unsubscribeDOM` | `(symbol, [callback])` | Invoked when DOM panel is hidden or symbol changes. Must clean up subscriptions. |
| `subscribePL` | `(positionId, [callback])` | Invoked when an open position exists. Must register `positionId` and stream floating P&L to `this._host.plUpdate(positionId, profit)`. |
| `unsubscribePL` | `(positionId, [callback])` | Invoked when position closes. Cleans up P&L listener. |
| `positions` | `()` | Must return `Promise<Position[]>` with `{ id: string, symbol: string, qty: number, avgPrice: number, side: 1 \| -1, profit: number }`. |
| `symbolInfo` | `(symbol)` | Must return `Promise<SymbolInfo>` containing exact `minTick`, `pipSize`, `pipValue`, `qty: { min, max, step }`, `description`, `currency`. |

### 4.4 Trading Host Push Methods (`this._host.*`)

| Host Method | Parameters | Exact Destination & Effect |
|---|---|---|
| `this._host.domUpdate` | `(symbol, depthPayload)` | Pushes `{ snapshot, asks, bids }` to `nt._content.updateData(depthPayload)`, triggering dynamic centering and volume meter recalculation. |
| `this._host.plUpdate` | `(positionId, profit)` | Pushes numeric floating P&L to `nt._calcData.updatePL(profit)`, updating the DOM P&L badge text and color (`profit` vs `loss`). **Must be called with `positionId` (ticket ID), NOT symbol.** |
| `this._host.positionUpdate` | `(tvPosition)` | Pushes full position snapshot to `_positionsCache.updateDelegate`, updating chart position line, Account Manager table, and DOM Position badge. |
| `this._host.positionPartialUpdate` | `(positionId, partialPos)` | Updates fields in `_positionsCache`. Note: Does NOT trigger DOM panel's `positionHandler`. Full updates must be emitted via `positionUpdate`. |

---

## 5. Architectural Synthesis: How to Fix & Verify

To achieve 100% stable dynamic anchoring and real-time Position/P&L syncing, the following architectural rules must be followed:

1. **Dual-Key `plUpdate` Dispatch in `mt5_broker.js`**:
   In `_syncPositions` and realtime quote evaluations, dispatch `plUpdate` using both `posId` (`pos.ticket`) and `pos.symbol`:
   ```javascript
   self._host.plUpdate(posId, pos.profit);
   self._host.plUpdate(pos.symbol, pos.profit);
   ```
   This ensures that whether a component subscribes via `pos.id` (DOM Panel) or `pos.symbol` (Chart Position Line / Custom Sources), both receive synchronous P&L updates.

2. **Full `positionUpdate` on Every Tick**:
   Replace `self._host.positionPartialUpdate(posId, tvPos)` with `self._host.positionUpdate(tvPos)` in `_syncPositions` so that `DOMPanel`'s `positionUpdate` delegate fires on every quote tick and position modification.

3. **Direct Zero-Latency DOM Push from WebSocket**:
   In `ws.onmessage` inside `mt5_broker.js`, emit `_emitDOMUpdate(sym, false)` immediately on every incoming quote tick.
   In `_emitDOMUpdate`, ensure `step` and decimals are resolved directly from `minTick` (e.g. `0.01` for Gold, `0.00001` for EURUSD) and push to `self._host.domUpdate(symbol, domPayload)`.

4. **Dynamic Mode State Synchronization**:
   In `dom-panel.81d8dd298ff835119bb5.js`, ensure `class $` initializes `this._dynamicModeState = true`, and the React component `Ze` initializes with `{ icon: Ke.on, title: "Disable dynamic mode" }` so that UI state and engine state match on start.

5. **Clean Neutral State on Position Close**:
   When MT5 reports 0 open positions, emit `self._host.positionUpdate(closedPos)` with `qty = 0`, and `self._host.plUpdate(id, 0)`. The DOM panel will cleanly display `—` for Position and `—` / `0.00` for P&L.
