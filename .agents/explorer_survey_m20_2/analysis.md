# Comprehensive Technical Analysis: Line Tools, Canvas Rendering, Drag Handles, and Trading Group Architecture

**Milestone**: M20 (Survey Phase)  
**Agent**: `teamwork_preview_explorer` (`explorer_survey_m20_2`)  
**Target Codebase**: `charting_library/bundles/*.js`, `charting_library.standalone.js`, `mt5_broker.js`, `index.html`, `broker-sample/`  
**Date**: 2026-09-08  

---

## Executive Summary

TradingView Advanced Charts implements **two distinct, parallel architectures** for visualizing and interacting with orders, positions, and brackets on the chart canvas:

1. **Chart Primitives Architecture (`LineToolOrder`, `LineToolPosition`, `LineToolExecution`)**:
   - Exposed directly to developers via the Chart API: `chart.createOrderLine()`, `chart.createPositionLine()`, `chart.createExecutionShape()`.
   - Managed as drawing tools (`LineDataSource`) living in the chart model data source list.
   - Rendered onto the chart canvas via `OrderPaneView` / `PositionPaneView` in bundle `lt-pane-views.0e3618964c1d64330263.js` using `MediaCoordinatesPaneRenderer`.
   - Dedicated z-order stacking layers (`ORDER_LAYER = 10000011`, `POSITION_LAYER = 10000012`, `EXECUTION_LAYER = 10000013`).
   - Price pills on the right-hand price scale rendered by `LineToolTradingPriceAxisView` (module `462541` in `library.e8d44337c84d65489d2c.js`).
   - Controlled by chart properties: `tradingProperties.showOrders`, `tradingProperties.showPositions`, `tradingProperties.showExecutions`, `tradingProperties.extendLeft`, `tradingProperties.horizontalAlignment`.

2. **Native Traded Groups Architecture (`TradedSourcesManager`, `TradedGroupPlace`, `PreOrderItem`, `ProjectionBracketItem`)**:
   - Used natively by the TradingView Trading Platform / Order Panel / Order Ticket for real-time order placement, limit/stop dragging, bracket manipulation, and live broker position tracking.
   - Managed by `TradedSourcesManager` (module `751792` in `trading-groups.9659877d7d96e0bb027b.js`) and attached as a topmost custom source (`CustomSourceLayer.Topmost`).
   - The active pre-order line is an instance of `TradedGroupPlace` (`class Z extends Ke`), composed of a `PreOrderItem` (`TradedGroupItemType.PreOrder`) and attached `ProjectionBracketItem`s (`TradedGroupItemType.Bracket`).
   - Renders interactive canvas badges, quantity pills, cancel buttons, and `+TP` / `+SL` drag handles using `ItemRenderer` (module `376161` and `260449` in `6161.10c4a7de17f463d1d76e.js`).
   - Drag events on handles (part `8` = line, part `9` = price pill, parts `11`/`12` = bracket buttons) route through hit testing (`A` in module `376161`), emit coordinate changes via `_onDragMove`, and update price values bidirectionally with `PlaceOrderContext` via `_tradedContextLinking`.

Crucially, in the current project deployment:
- `index.html` lacks necessary `tradingProperties.*` overrides and preview configuration flags.
- `mt5_broker.js` is missing broker adapter methods (`getOrderDialogOptions`, `getSymbolSpecificTradingOptions`) and config flags (`supportPlaceOrderPreview`, `supportModifyOrderPreview`), which prevents bracket handles (`+TP`, `+SL`) from mounting on order placement lines.

---

## 1. Architectural Blueprint: Dual-Model Comparison

| Feature / Aspect | Chart Primitives Architecture (`LineTool*`) | Native Traded Groups Architecture (`TradedGroup*`) |
| :--- | :--- | :--- |
| **Primary Classes** | `LineToolOrder`, `LineToolPosition`, `LineToolExecution` | `TradedSourcesManager`, `TradedGroupPlace`, `TradedGroupPosition`, `TradedGroupOrder` |
| **Bundle Locations** | `bundles/library.*.js` (modules 298602, 649675, 937829) | `bundles/trading-groups.*.js` (module 751792), `bundles/6161.*.js` (modules 376161, 112232, 260449) |
| **API Entry Point** | `chart.createOrderLine(options)`, `chart.createPositionLine(options)` | Instantiated automatically when `brokerFactory` connects and Order Panel opens, or via `BrokerWrapper.createPlaceOrderContext()` |
| **Pane Views** | `OrderPaneView` (module 330085), `PositionPaneView` (module 735468) | `TradedGroupPaneView` -> delegating to `ItemRenderer` (`W`, `H`, `N`) |
| **Price Axis View** | `LineToolTradingPriceAxisView` (module 462541) | `TradedPriceAxisView` (part of traded item state) |
| **Z-Order Layer** | `ORDER_LAYER` (10000011), `POSITION_LAYER` (10000012) | `CustomSourceLayer.Topmost` |
| **Interactive Drag Handles** | Line drag handle via line anchor hit tests | Dedicated hit test parts: line (8), price pill (9), close (10), TP button (11), SL button (12) |
| **Bracket Handles (+TP, +SL)**| Must be created as separate child `LineToolOrder` lines linked manually | Built directly into `ItemRenderer` (`W`) with native projection brackets (`H`) |
| **Broker Synchronization** | Developer must hook event listeners (`onMove`, `onModify`) and call broker API | Bidirectional sync via `_tradedContextLinking` and `PlaceOrderContext` (`BrokerWrapper`) |
| **Configuration Guard** | `tradingProperties.showOrders`, `tradingProperties.showPositions` | `broker_config.configFlags.supportOrderBrackets`, `supportPlaceOrderPreview` |

---

## 2. Deep Dive: Bundle Files & Modules

### 2.1. `charting_library/bundles/library.e8d44337c84d65489d2c.js`

#### A. Module `298602` — `LineToolOrder`
- **Inheritance**: Extends `LineToolTradingLine` (which extends `LineDataSource`).
- **Constructor signature**: `constructor(e, t, i, s)` where `e` is model, `t` is properties, `i` is line options.
- **Views**:
  - `this._paneViews = [new OrderPaneView(this, this._model)]`
  - `this._priceAxisViews = [new LineToolTradingPriceAxisView(this)]`
- **Exposed Methods**:
  - `price()`: Returns current order line price.
  - `setPrice(price)`: Updates price, normalizes to min tick, updates price axis view, requests chart repaint.
  - `quantity()` / `setQuantity(qty)`: Formats and displays quantity badge.
  - `text()` / `setText(text)`: Displays order label (e.g., "Limit Buy", "Stop Sell").
  - `onMove()`: Emits event when line is dragged on canvas.
  - `onModify()`: Emits event when modify button is clicked.
  - `onCancel()`: Emits event when "X" button is clicked.

#### B. Module `649675` — `LineToolPosition`
- **Inheritance**: Extends `LineToolTradingLine`.
- **Views**:
  - `this._paneViews = [new PositionPaneView(this, this._model)]`
  - `this._priceAxisViews = [new LineToolTradingPriceAxisView(this)]`
- **Exposed Methods**:
  - `price()` / `setPrice(price)`: Entry price level.
  - `quantity()` / `setQuantity(qty)`: Position size.
  - `profit()` / `setProfit(profit)`: Formatted PnL with green/red pill background.
  - `onClose()`: Triggered by clicking "X" button.
  - `onReverse()`: Triggered by clicking reverse arrow button.

#### C. Module `937829` — `LineToolExecution`
- **Inheritance**: Extends `LineToolExecutionShape`.
- **Views**: Renders marker arrows (buy=blue upward, sell=red downward) at specific time and price coordinates.
- **Methods**: `time()`, `setTime()`, `price()`, `setPrice()`, `text()`, `setText()`.

#### D. Module `462541` — `LineToolTradingPriceAxisView`
- **Implementation**: Implements `IPriceAxisView`.
- **Functionality**:
  - Computes y-coordinate on the price scale using `priceScale.priceToCoordinate(this._source.price(), firstValue)`.
  - Formats price text using symbol price formatter.
  - Provides background color (matching order side: blue for buy, red for sell, grey for neutral).
  - Handles coordinate clipping and collisions with other price axis labels.

#### E. Module `994790` — Layer Constants
```javascript
// Z-order constants governing pane rendering order
const ORDER_LAYER = 10000011;
const POSITION_LAYER = 10000012;
const EXECUTION_LAYER = 10000013;
```

---

### 2.2. `charting_library/bundles/lt-pane-views.0e3618964c1d64330263.js`

#### A. Module `330085` — `OrderPaneView` & `MediaCoordinatesPaneRenderer`
This module contains the canvas rendering logic for `LineToolOrder`.

- **Renderer Execution (`MediaCoordinatesPaneRenderer._draw()`)**:
  1. Retrieves canvas 2D rendering context: `const ctx = e.context;`
  2. Applies device pixel ratio scaling: `ctx.scale(pixelRatio, pixelRatio)` for high-DPI crispness.
  3. Obtains screen y-coordinate: `const y = priceScale.priceToCoordinate(order.price(), firstValue)`.
  4. Computes line extents using `orderLineLocation()`:
     - Check `tradingProperties.extendLeft.value()`: if true, line starts at `x = 0`; otherwise starts at chart bar origin or right offset.
     - Line ends at right edge of price pane `x = width`.
  5. Paints horizontal line:
     ```javascript
     ctx.beginPath();
     ctx.strokeStyle = order.lineColor();
     ctx.lineWidth = order.lineWidth();
     ctx.setLineDash(order.lineStyle());
     ctx.moveTo(startX, y);
     ctx.lineTo(endX, y);
     ctx.stroke();
     ```
  6. Paints Order Pill / Button Container:
     - Positioned based on `tradingProperties.horizontalAlignment.value()` (`"Left"` or `"Right"`).
     - Draws rounded rectangle for side/quantity badge.
     - Draws text: side ("BUY" / "SELL"), quantity, order type.
     - Draws Cancel button ("X"): circular hit target with hover state.
     - Draws Drag Anchor: circular handle when selected/hovered (`ctx.arc(anchorX, y, 4, 0, 2 * Math.PI)`).

#### B. Module `735468` — `PositionPaneView`
- Computes position line horizontal stroke.
- Renders PnL Badge:
  - If profit > 0: background green (`#26a69a`).
  - If profit < 0: background red (`#ef5350`).
  - Displays formatted profit (currency or pips/percentage).
- Renders Reverse Button (`⇄`) and Close Button (`✕`).

#### C. Module `87894` — `orderLineLocation`
Calculates alignment offsets and coordinates based on chart settings:
```javascript
function orderLineLocation(paneWidth, alignment, padding) {
    // Computes layout bounds for pills and buttons relative to the pane canvas
}
```

---

### 2.3. `charting_library/bundles/trading-groups.9659877d7d96e0bb027b.js`

#### Module `751792` — `TradedSourcesManager` & `TradedGroupPlace`

This is the control center for the interactive trading overlay on the canvas.

- **`TradedSourcesManager` Class**:
  - Attached to the chart via `chartWidgetCollection.addCustomSource("tradedGroupPlaceOrder", source, CustomSourceLayer.Topmost)`.
  - Manages life cycle of:
    - Active pre-order line (`_tradedGroupPlace`): shown when placing a limit/stop order or dragging on the chart.
    - Active position groups (`_tradedGroupPositions`): live positions synced with broker.
    - Active working order groups (`_tradedGroupOrders`): placed limit/stop orders synced with broker.
  - Maintains `_tradedContextLinking`: binds canvas visual items to the active `PlaceOrderContext`.

- **`TradedGroupPlace` Class (`class Z extends Ke`)**:
  - Represents the interactive pre-order on canvas.
  - Composed of:
    - `PreOrderItem`: Main order line (price, side, qty, type).
    - `ProjectionBracketItem` (Take Profit): Child bracket attached to pre-order.
    - `ProjectionBracketItem` (Stop Loss): Child bracket attached to pre-order.
  - Synchronizes changes:
    - When user changes price in Order Panel -> `_updateTradedGroupFromLinking()` updates `TradedGroupPlace` data -> canvas repaints at new y-coordinate.
    - When user drags line on canvas -> `_onDragMove()` updates context -> `PlaceOrderContext.setOrderPrice()` -> Order Panel price input field updates in real time.

---

### 2.4. `charting_library/bundles/6161.10c4a7de17f463d1d76e.js`

#### A. Module `376161` — `TradedGroupBase` (`Ke`) & `ItemRenderer` (`W`, `H`, `A`, `N`)
- **`Ke` (`TradedGroupBase`)**: Base class for visual traded groups on canvas. Handles hit-testing, selection, dragging, and hover states.
- **`A` (`HitTestParts`)**: Defines part identifiers for hit-testing:
  - `PART_LINE = 8`: The horizontal price line. Dragging this moves the entire order/bracket price.
  - `PART_PRICE_PILL = 9`: The price/quantity badge. Dragging this also changes price.
  - `PART_CLOSE_BUTTON = 10`: The cancel/close button ("X"). Clicking cancels the pre-order or closes the position.
  - `PART_BRACKET_TP = 11`: The `+TP` handle attached to the right of the order badge.
  - `PART_BRACKET_SL = 12`: The `+SL` handle attached to the right of the order badge.
- **`W` (`ItemRenderer` - Main Order / Position)**:
  - Draws the primary order line, side tag, quantity pill, and bracket attachment buttons (`+TP`, `+SL`).
  - When `supportOrderBrackets` is enabled: renders `+TP` and `+SL` buttons adjacent to the order badge.
- **`H` (`ItemRenderer` - Projection Bracket)**:
  - Draws the projected Take Profit or Stop Loss line.
  - Draws dashed line connecting bracket to main order line.
  - Displays offset in pips, ticks, currency, and percentage.
  - Provides circular drag handle at line extremity.

#### B. Module `112232` — Bracket Projection Engine
- Contains `buildProjectionBracketData(order, bracketType, price, pips, tickSize)`:
  - Calculates bracket target price:
    - For Buy Limit/Stop:
      - TP Price = `OrderPrice + (Pips * PipSize)`
      - SL Price = `OrderPrice - (Pips * PipSize)`
    - For Sell Limit/Stop:
      - TP Price = `OrderPrice - (Pips * PipSize)`
      - SL Price = `OrderPrice + (Pips * PipSize)`
  - Formats pip offset display and estimated profit/loss calculation.

#### C. Module `260449` — Canvas Painting Operations
- Contains low-level canvas primitives:
  - Crisp line snapping: `Math.round(coordinate) - 0.5` for 1px line sharpness.
  - Rounded badge paths with bezier arcs.
  - Text baseline measurement and horizontal centering.
  - Interactive hover glow / shadow rendering on handles.

---

### 2.5. `charting_library/bundles/trading.5355aa53ba59846168ee.js`

#### `BrokerWrapper` & `PlaceOrderContext`
- `BrokerWrapper` wraps the broker adapter and provides high-level trading capabilities to the UI.
- **`createPlaceOrderContext({ order, source, silent, signal })`**:
  - Creates an observable order placement context (`class G`).
  - Exposes:
    - `.data()`: Watched value of current order draft (`{ symbol, price, qty, side, type, takeProfit, stopLoss }`).
    - `.status()`: Observable status (`"valid"`, `"invalid"`, `"loading"`).
    - `.errors()`: Observable validation errors.
    - `.setOrderPrice(price)`: Updates price from canvas drag.
    - `.setBracket(type, value)`: Updates bracket from canvas drag.
    - `.send()`: Submits order to broker.
    - `.preview()`: Calls broker `orderPreview()` if supported.
- **Prerequisites for `createPlaceOrderContext`**:
  - `broker.symbolInfo(symbol)` must resolve validly.
  - `broker.formatter(symbol)` must resolve valid price formatter.
  - `broker.getOrderDialogOptions(symbol)` must resolve `{ customFields: [...] }` or `{}` (cannot reject or be missing).
  - `broker.getSymbolSpecificTradingOptions(symbol)` must resolve bracket capabilities.

---

## 3. Detailed Tracing of Canvas & Event Routing

### 3.1. How the Chart Creates and Renders Order Lines on Canvas

```
[Chart Initialization / Order Panel]
              │
              ▼
[TradedSourcesManager / LineToolOrder]
              │
              ▼
[PaneView: OrderPaneView / TradedGroupPaneView]
              │
              ▼
[priceScale.priceToCoordinate(order.price)] ──> y-coordinate
              │
              ▼
[MediaCoordinatesPaneRenderer / ItemRenderer.draw()]
  ├── 1. Canvas Context Scaled by DevicePixelRatio
  ├── 2. ctx.beginPath(), moveTo(0, y), lineTo(width, y), stroke()
  ├── 3. Draw Side/Type Badge ("BUY LIMIT")
  ├── 4. Draw Quantity Badge ("1.00")
  ├── 5. Draw Price Pill ("1.08500")
  ├── 6. Draw Cancel Icon ("X")
  └── 7. If supportOrderBrackets: Draw "+TP" and "+SL" handles
              │
              ▼
[Price Axis View: LineToolTradingPriceAxisView]
  └── Paints pill on right price scale at coordinate y
```

### 3.2. Mouse Event Capture, Hit Testing, and Drag Routing

```
[User MouseDown / TouchStart on Canvas]
              │
              ▼
[ChartWidget._onMouseDown(event)]
              │
              ▼
[CustomSourceLayer.Topmost -> TradedSourcesManager.hitTest(point)]
              │
              ▼
[ItemRenderer HitTest (Module 376161, Class A)]
  ├── Part 8 (Line Body): Hit along horizontal line (±4px tolerance)
  ├── Part 9 (Price Pill): Hit inside badge bounding box
  ├── Part 10 (Close Icon): Hit inside 14x14px "X" circle
  ├── Part 11 (+TP Handle): Hit inside "+TP" badge box
  └── Part 12 (+SL Handle): Hit inside "+SL" badge box
              │
              ▼ (User drags Part 8, 9, 11, or 12)
[MouseMove Event]
              │
              ▼
[coordinateToPrice(newY)] ──> Converts screen Y to decimal price
              │
              ▼
[TradedGroupPlace._onDragMove()]
              │
              ▼
[_tradedContextLinking.setOrderPrice(price)]
              │
              ▼
[PlaceOrderContext.data.setValue({ ...order, price })]
              │
       ┌──────┴────────────────────────┐
       ▼                               ▼
[Order Panel Price Input]    [Canvas Repaints at newY]
(Input field value updates    (Line moves synchronously
in real time without delay)   with mouse cursor)
```

### 3.3. Attached Bracket (SL/TP) Handle Lifecycle & Calculation

1. **Resting State**:
   - Order line displays `+TP` and `+SL` buttons to the right of the quantity pill.
2. **Handle Drag Initiation**:
   - User clicks and drags the `+TP` handle vertically.
   - Traded group instantiates a child `ProjectionBracketItem` (`ItemRenderer` `H`).
   - The bracket line starts following the mouse cursor.
3. **Offset & Price Calculation**:
   - Drag coordinate `y` is converted to price: `bracketPrice = priceScale.coordinateToPrice(y)`.
   - Offset in pips is calculated: `pips = Math.abs(bracketPrice - orderPrice) / pipSize`.
   - Currency PnL estimate: `pnl = pips * pipValue * orderQty`.
   - The bracket badge dynamically renders: `TP: 1.09200 (+70.0 pips / +$700.00)`.
4. **Drag Release**:
   - `_onDragEnd` commits the bracket price to `PlaceOrderContext`:
     `context.setBracket('takeProfit', bracketPrice)`.
   - The Order Ticket's Take Profit checkbox is automatically checked and populated with `bracketPrice`.

---

## 4. Configuration Requirements & Project Gaps

### 4.1. Required Chart Settings (`tradingProperties.*`)

In `widgetOptions.overrides`, TradingView requires explicit trading properties to be enabled:

```javascript
overrides: {
    // Enable order placement, position, and execution display on chart canvas
    "tradingProperties.showOrders": true,
    "tradingProperties.showPositions": true,
    "tradingProperties.showExecutions": true,
    
    // Formatting & layout
    "tradingProperties.extendLeft": true,           // Extend lines horizontally across chart
    "tradingProperties.horizontalAlignment": "Right", // Position badges on right edge
    "tradingProperties.lineLength": 100,
    "tradingProperties.lineStyle": 0,               // 0 = Solid, 1 = Dotted, 2 = Dashed
    "tradingProperties.lineWidth": 1
}
```

**Finding in Project**: `index.html` currently **does not** set `"tradingProperties.showOrders": true` or `"tradingProperties.showPositions": true` in `overrides`.

---

### 4.2. Required Broker Config Flags (`broker_config.configFlags`)

In `index.html` or broker adapter initialization:

```javascript
configFlags: {
    supportOrderBrackets: true,
    supportPositionBrackets: true,
    supportModifyBrackets: true,
    supportModifyOrderBrackets: true,
    supportModifyPositionBrackets: true,
    supportAddBracketsToExistingOrder: true,
    supportPlaceOrderPreview: true,           // Crucial for preview lines
    supportModifyOrderPreview: true,          // Crucial for modify preview
    supportModifyOrderPrice: true,
    supportModifyOrderQuantity: true,
    supportOrdersHistory: true,
    supportExecutions: true,
    supportTradeBrackets: true
}
```

**Finding in Project**: `index.html` defines `supportOrderBrackets: true`, but **omits** `supportPlaceOrderPreview: true` and `supportModifyOrderPreview: true`.

---

### 4.3. Required Broker Adapter Methods (`mt5_broker.js`)

In `mt5_broker.js`, the broker instance is queried by TradingView's `BrokerWrapper` and `SymbolDataProvider` for dynamic capability resolution. The following methods must exist and return valid responses:

#### A. `getOrderDialogOptions(symbol)`
Must return a promise resolving to configuration for the order ticket. If missing, TradingView logs an error and falls back to restricted mode.
```javascript
async getOrderDialogOptions(symbol) {
    return {
        customFields: []
    };
}
```

#### B. `getSymbolSpecificTradingOptions(symbol)`
Provides per-symbol bracket and execution capabilities.
```javascript
async getSymbolSpecificTradingOptions(symbol) {
    return {
        supportOrderBrackets: true,
        supportPositionBrackets: true,
        supportTradeBrackets: true,
        supportBracketsInPips: true,
        supportStopLimitOrders: true,
        supportMarketOrders: true,
        supportLimitOrders: true,
        supportStopOrders: true
    };
}
```

#### C. `orderPreview(order)`
TradingView calls `orderPreview` when placing or dragging order/bracket lines if `supportPlaceOrderPreview: true` is enabled.
```javascript
async orderPreview(order) {
    // Returns estimated cost, margin, and execution parameters
    return {
        price: order.price,
        quantity: order.qty,
        margin: 0,
        currency: "USD",
        warnings: [],
        errors: []
    };
}
```

**Finding in Project**: `mt5_broker.js` **lacks** `getOrderDialogOptions`, `getSymbolSpecificTradingOptions`, and `orderPreview`.

---

## 5. Concrete Remediation Plan for Implementation Agents

To enable full interactive order lines, drag handles, and bracket handles on the chart canvas, the implementer agents should execute the following targeted changes:

### 5.1. Modifications to `index.html`

1. **Add `tradingProperties` overrides in `widgetOptions.overrides`**:
   ```javascript
   "tradingProperties.showOrders": true,
   "tradingProperties.showPositions": true,
   "tradingProperties.showExecutions": true,
   "tradingProperties.extendLeft": true,
   "tradingProperties.horizontalAlignment": "Right",
   ```

2. **Add preview flags to `broker_config.configFlags`**:
   ```javascript
   supportPlaceOrderPreview: true,
   supportModifyOrderPreview: true,
   supportAddBracketsToExistingOrder: true,
   ```

### 5.2. Modifications to `mt5_broker.js`

1. **Implement `getOrderDialogOptions(symbol)`**:
   ```javascript
   async getOrderDialogOptions(symbol) {
       return { customFields: [] };
   }
   ```

2. **Implement `getSymbolSpecificTradingOptions(symbol)`**:
   ```javascript
   async getSymbolSpecificTradingOptions(symbol) {
       return {
           supportOrderBrackets: true,
           supportPositionBrackets: true,
           supportTradeBrackets: true,
           supportBracketsInPips: true,
           supportStopLimitOrders: true,
           supportMarketOrders: true,
           supportLimitOrders: true,
           supportStopOrders: true
       };
   }
   ```

3. **Implement `orderPreview(order)`**:
   ```javascript
   async orderPreview(order) {
       return {
           price: order.price,
           quantity: order.qty,
           margin: 0,
           currency: "USD",
           warnings: [],
           errors: []
       };
   }
   ```

---

## 6. Conclusion

The TradingView charting library contains a complete, highly sophisticated canvas rendering and event routing engine for order lines, drag handles, and attached brackets (`+TP`, `+SL`). The absence of interactive bracket handles on the canvas in the current project is caused entirely by missing broker configuration hooks and chart overrides, not by library limitations. Implementing the missing broker methods and overrides outlined above will fully unlock native interactive canvas order placement and bracket dragging.
