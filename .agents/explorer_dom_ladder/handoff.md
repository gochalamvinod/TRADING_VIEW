# Handoff Report: DOM Ladder Dynamic Anchoring & Position Sync

**Agent**: `explorer_dom_ladder`  
**Working Directory**: `e:\TRADINGVIEW ADVANCED\.agents\explorer_dom_ladder`  
**Handoff Type**: Hard (Investigation Complete)  
**Date**: 2026-09-08  

---

## 1. Observation

### Observation 1: DOM Centering Math and Trigger in `dom-panel.81d8dd298ff835119bb5.js`
- File: `e:\TRADINGVIEW ADVANCED\charting_library\bundles\dom-panel.81d8dd298ff835119bb5.js`
- Lines 10–11:
  ```javascript
  // updateData(e)
  i && this._recalcDepthInfo();
  this._recalcMaxVolume();
  t ? (this.centerOnLast(), this._isPositionAlreadyUpdated = !0) : this.checkAutoCenter();
  this._dynamicModeState && this.centerOnLast();
  this.scheduleRepaint();
  ```
- Lines 13–14:
  ```javascript
  _getGapMiddleIndex() {
    let e = this._bestAskIndex, t = this._bestBidIndex;
    return isFinite(e) || (e = t), isFinite(t) || (t = e), Math.floor((t + e) / 2);
  }
  _autoCenterTargetTopIndex() {
    const e = Math.floor(this.height / 2);
    return this._showPricesWith.zeroVolume.value() && this._showPricesWith.spread.value()
      ? this._getCenterIndex() + e
      : this._getCorrectCenterIndex() + e;
  }
  ```
- Line 11 (`updateLast(e)`):
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
  `updateLast` does **not** call `centerOnLast()`. Centering in dynamic mode occurs **only** when `updateData(e)` is invoked with depth data.

### Observation 2: Broken AutoCenter Timer Logic in `dom-panel.81d8dd298ff835119bb5.js`
- File: `e:\TRADINGVIEW ADVANCED\charting_library\bundles\dom-panel.81d8dd298ff835119bb5.js`
- Line 12:
  ```javascript
  checkAutoCenter() {
    isFinite(this.topIndex) || this.centerOnLast();
    const e = this.topIndex, t = this.correctIndex(this.topIndex, 1 - this.height);
    let i;
    i = isFinite(this._bestBidIndex) ? this._bestBidIndex : ... ;
    let s = NaN;
    ...
    let r = !1;
    (s + 3 > e || i - 3 < t) && (this.topIndex, this._autoCenterTargetTopIndex()),
    this.autoCenterRequired.setValue(r);
  }
  ```
  Variable `r` is initialized to `false` and never assigned `true`.
- Line 26:
  ```javascript
  _mergeTimerLockState(e) {
    ...
    s && (!t.autoCenterRequired || t.scroll || t.drag || t.dialog
      ? this._timer.abort()
      : this._timer.run());
  }
  ```
  Because `autoCenterRequired` is always `false`, the 2-second fallback auto-centering timer `G` is permanently aborted.

### Observation 3: UI State Inversion in Dynamic Mode Toggle Button
- File: `e:\TRADINGVIEW ADVANCED\charting_library\bundles\dom-panel.81d8dd298ff835119bb5.js`
- Lines 19–20:
  ```javascript
  const Ke = { on: i(781957), off: i(943145) };
  function Ze(e) {
    const { onClick: t, toggleDynamicModeState: s, trackEvent: r, timer: o } = e,
          [l, d] = (0, a.useState)({
            icon: Ke.off,
            title: n.t(null, void 0, i(167785)) // "Enable dynamic mode"
          });
    ...
    onClick: () => {
      const e = s(); // Toggles _dynamicModeState
      d(e => e ? { icon: Ke.on, title: ... } : { icon: Ke.off, title: ... }(e));
      t();
    }
  }
  ```
  `Ze` initializes its icon state to `Ke.off` regardless of `_dynamicModeState`. When `_dynamicModeState` is initialized to `true` in `class $`, the button displays `Ke.off`, and clicking it turns dynamic mode **off** in the engine while displaying `Ke.on` in the UI.

### Observation 4: Smoking-Gun `plUpdate` ID Mismatch in `mt5_broker.js`
- File: `e:\TRADINGVIEW ADVANCED\mt5_broker.js`
- Line 1672:
  ```javascript
  self._host.plUpdate(pos.symbol, pos.profit);
  ```
  It passes `pos.symbol` (e.g. `"XAUUSD."`).
- File: `e:\TRADINGVIEW ADVANCED\charting_library\bundles\dom-panel.81d8dd298ff835119bb5.js`
- Line 26:
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
  The DOM panel subscribes using `position.id` (`s.id`, the ticket ID, e.g. `"70257567"`).
- File: `e:\TRADINGVIEW ADVANCED\charting_library\bundles\trading.5355aa53ba59846168ee.js`
- Line 43:
  ```javascript
  plUpdate(e, t) {
    this._adapter.fireSubscription("PL", e, t);
  }
  ```
  `fireSubscription` looks up `this._subscriptions[e]["PL"]`. Since `e` was passed as `pos.symbol`, the DOM panel's subscription under `pos.id` was never invoked, leaving `this._pl` undefined and the badge rendering `"—"`.

### Observation 5: Broker `subscribePL` Method Signature Mismatch
- File: `e:\TRADINGVIEW ADVANCED\mt5_broker.js`
- Line 1190:
  ```javascript
  subscribePL: function (callback) {
    this._plListeners = this._plListeners || [];
    if (typeof callback === 'function') {
      this._plListeners.push(callback);
      try { callback(this._accountData.pl || 0); } catch (e) {}
    }
  }
  ```
  TradingView calls `subscribePL(positionId)`. The argument is a position ID string, not a callback function. `typeof callback === 'function'` evaluated to `false`.

### Observation 6: `positionPartialUpdate` Blindspot in DOM Panel
- File: `e:\TRADINGVIEW ADVANCED\mt5_broker.js`
- Lines 1617–1620:
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
- File: `e:\TRADINGVIEW ADVANCED\charting_library\bundles\dom-panel.81d8dd298ff835119bb5.js`
- Line 28:
  ```javascript
  t.orderUpdate.subscribe(null, o.orderHandler);
  t.positionUpdate.subscribe(null, o.positionHandler);
  t.currentAccountUpdate.subscribe(null, o.fullUpdateOrders);
  t.currentAccountUpdate.subscribe(null, o.fullUpdatePosition);
  ```
  `DOMPanel` only subscribes to `t.positionUpdate`. It does not listen to `t.positionPartialUpdate`. Any updates dispatched via `positionPartialUpdate` were invisible to the DOM widget.

---

## 2. Logic Chain

1. **Premise 1 (From Obs 1)**: Centering in dynamic mode (`_dynamicModeState = true`) only executes when `updateData(depthPayload)` is called. It does not execute on `updateLast(price)`.
2. **Premise 2 (From Obs 2 & 3)**: In `dom-panel.81d8dd298ff835119bb5.js`, `checkAutoCenter()` has a bug where `r = false` is always written to `autoCenterRequired`, permanently killing the 2-second fallback timer. Concurrently, the UI button `Ze` starts with `icon: off`, inverting user expectations when clicked.
3. **Inference A**: For the DOM ladder to stay dynamically centered on live price action, every incoming price tick must trigger `_emitDOMUpdate` $\rightarrow$ `host.domUpdate(symbol, depthPayload)` synchronously, recalculating `_bestBidIndex` and `_bestAskIndex` and calling `centerOnLast()`.
4. **Premise 3 (From Obs 4 & 5)**: In `mt5_broker.js`, `self._host.plUpdate(pos.symbol, pos.profit)` passes `pos.symbol` rather than `posId`. TradingView's DOM panel registers its P&L callback under `position.id`.
5. **Inference B**: Because the key provided to `host.plUpdate` was `"XAUUSD."` while the DOM listener was keyed on `"70257567"`, the DOM panel never received any P&L updates. In `class U`, `this._pl` remained `undefined`, causing `_makePlText()` to return `null`, leaving the P&L button displaying `"—"`.
6. **Premise 4 (From Obs 6)**: `DOMPanel` subscribes only to `broker.positionUpdate`, not `broker.positionPartialUpdate`.
7. **Inference C**: When `mt5_broker.js` updated existing positions with `self._host.positionPartialUpdate(posId, tvPos)`, the DOM panel was never notified of volume, entry price, or profit changes.
8. **Premise 5**: When positions are flat, `_processPositions` receives an empty list (`qty === 0`), resetting `defaultPositionState` (`positionText: null`) and `defaultPLState` (`plText: null`).
9. **Inference D**: The DOM Position and P&L widgets will cleanly show `—` when flat and accurately update to `${qty} @ ${avgPrice}` and `${pl} USD` when open, provided `host.positionUpdate(tvPos)` is called on every position sync and `host.plUpdate(posId, pos.profit)` is called with `posId`.

---

## 3. Caveats

- **No Source Code Changes Made**: This exploration was strictly read-only.
- **WebSocket Feed Availability**: Dynamic centering requires a continuous stream of quotes from either `/ws/quotes` or polling `/quotes`. If MT5 is disconnected or markets are closed (weekend), DOM centering will remain on the last known tick.
- **Level 2 Depth Simulation vs True MT5 Market Depth**: In OTC Forex/CFD on MT5, broker depth is synthetic or Level 1 spread quotes. The synthetic depth ladder in `mt5_broker.js` provides 30 levels above Ask and below Bid, which TradingView renders seamlessly.

---

## 4. Conclusion

1. **DOM Price Ladder Dynamic Anchoring**:
   - The DOM price ladder is rendered by `DOMPanel` (`class at`) using a pooled row model (`class $` and `class L`).
   - `dynamicModeState: true` pins the ladder to `Math.floor((bestBid + bestAsk) / 2) + Math.floor(height / 2)` every time `updateData()` is called.
   - It lost focus/centering because: (a) DOM updates were throttled on a 350ms timer rather than pushed on every WebSocket tick, (b) the `Ze` button UI was inverted relative to `_dynamicModeState`, and (c) `checkAutoCenter()` had a hardcoded `false` bug killing the fallback timer.
2. **DOM Position & P&L Widget Synchronization**:
   - The widgets failed to display live position volume, entry price, and P&L primarily because `mt5_broker.js` called `self._host.plUpdate(pos.symbol, pos.profit)` with the symbol string rather than the ticket ID string `posId`.
   - Furthermore, `mt5_broker.js` called `self._host.positionPartialUpdate` which `DOMPanel` does not listen to, and `subscribePL` ignored position IDs.
3. **Actionable Implementation Blueprint**:
   - In `mt5_broker.js`, emit both:
     ```javascript
     self._host.plUpdate(posId, pos.profit);
     self._host.plUpdate(pos.symbol, pos.profit);
     ```
   - In `mt5_broker.js`, call `self._host.positionUpdate(tvPos)` on all position updates (not `positionPartialUpdate`).
   - In `mt5_broker.js`, immediately trigger `_emitDOMUpdate(sym, false)` on every WebSocket quote in `ws.onmessage`.
   - In `dom-panel.81d8dd298ff835119bb5.js`, align `Ze` component initial state with `_dynamicModeState: true` (`icon: Ke.on`).

---

## 5. Verification Method

To independently verify these findings:

1. **Verify `plUpdate` Keying**:
   Inspect `charting_library/bundles/trading.5355aa53ba59846168ee.js` line 43:
   ```powershell
   Get-Content "e:\TRADINGVIEW ADVANCED\charting_library\bundles\trading.5355aa53ba59846168ee.js" | Select-String "plUpdate\(e,t\)" -Context 0,2
   ```
   Confirm `plUpdate(e, t)` calls `this._adapter.fireSubscription("PL", e, t)`.
2. **Verify DOM Panel PL Subscription**:
   Inspect `charting_library/bundles/dom-panel.81d8dd298ff835119bb5.js` line 26:
   ```powershell
   Get-Content "e:\TRADINGVIEW ADVANCED\charting_library\bundles\dom-panel.81d8dd298ff835119bb5.js" | Select-String "subscribePL\(t\.plPositionId" -Context 0,2
   ```
   Confirm `t.plPositionId = s.id` and `e.subscribePL(t.plPositionId, t.plHandler)`.
3. **Verify DOM Panel PositionUpdate Delegate**:
   Inspect `charting_library/bundles/dom-panel.81d8dd298ff835119bb5.js` line 28:
   ```powershell
   Get-Content "e:\TRADINGVIEW ADVANCED\charting_library\bundles\dom-panel.81d8dd298ff835119bb5.js" | Select-String "positionUpdate\.subscribe" -Context 0,2
   ```
   Confirm `t.positionUpdate.subscribe(null, o.positionHandler)` is subscribed while `positionPartialUpdate` is absent.
4. **Verify Dynamic Mode Trigger in `updateData`**:
   Inspect `charting_library/bundles/dom-panel.81d8dd298ff835119bb5.js` line 11:
   ```powershell
   Get-Content "e:\TRADINGVIEW ADVANCED\charting_library\bundles\dom-panel.81d8dd298ff835119bb5.js" | Select-String "_dynamicModeState&&this\.centerOnLast\(\)" -Context 0,2
   ```
   Confirm `this._dynamicModeState && this.centerOnLast()` is in `updateData` and absent in `updateLast`.
