# Handoff Report: Milestone M20 Survey Phase (Line Tools, Canvas Rendering, Drag Handles & Brackets)

**From**: `teamwork_preview_explorer` (`explorer_survey_m20_2`)  
**To**: Parent Agent (`7015faef-6e19-4066-9069-10b490151baf`)  
**Date**: 2026-09-08  
**Type**: Hard Handoff (Investigation Complete)  

---

## 1. Observation

1. **Dual Architecture in Charting Bundles**:
   - **Chart Primitives**: In `charting_library/bundles/library.e8d44337c84d65489d2c.js`:
     - Module `298602` defines `LineToolOrder` extending `LineToolTradingLine`.
     - Module `649675` defines `LineToolPosition`.
     - Module `937829` defines `LineToolExecution`.
     - Module `462541` defines `LineToolTradingPriceAxisView`.
     - Module `994790` defines Z-order constants: `ORDER_LAYER = 10000011`, `POSITION_LAYER = 10000012`, `EXECUTION_LAYER = 10000013`.
   - **Canvas Rendering for Primitives**: In `charting_library/bundles/lt-pane-views.0e3618964c1d64330263.js`:
     - Module `330085` defines `OrderPaneView` and `MediaCoordinatesPaneRenderer` which paints the line, side badge, quantity pill, cancel button, and anchor dot.
     - Module `735468` defines `PositionPaneView` which renders the entry line, green/red PnL pill, reverse and close buttons.
     - Module `87894` defines `orderLineLocation(paneWidth, alignment, padding)`.
   - **Interactive Traded Groups (Used by Order Panel / Ticket)**:
     - In `charting_library/bundles/trading-groups.9659877d7d96e0bb027b.js`, Module `751792` defines `TradedSourcesManager` (added via `chartWidgetCollection.addCustomSource("tradedGroupPlaceOrder", source, CustomSourceLayer.Topmost)`) and `TradedGroupPlace` (`class Z extends Ke`).
     - In `charting_library/bundles/6161.10c4a7de17f463d1d76e.js`:
       - Module `376161` defines `TradedGroupBase` (`Ke`), `ItemRenderer` (`W`), `ProjectionBracketRenderer` (`H`), and hit-test parts `A`:
         - Part 8: Line body drag handle
         - Part 9: Price pill drag handle
         - Part 10: Cancel/close button
         - Part 11: `+TP` handle
         - Part 12: `+SL` handle
       - Module `112232` defines `buildProjectionBracketData` for calculating bracket prices and pip offsets.
       - Module `260449` handles canvas drawing of dashed lines and anchor handles.

2. **Broker Integration & Context Linking**:
   - In `charting_library/bundles/trading.5355aa53ba59846168ee.js`, `BrokerWrapper.createPlaceOrderContext()` creates `PlaceOrderContext` (`class G`). It binds the canvas `TradedGroupPlace` to Order Panel inputs via `_tradedContextLinking`.
   - `SymbolDataProvider` queries `broker.getSymbolSpecificTradingOptions(symbol)` and `broker.getOrderDialogOptions(symbol)` to evaluate whether `supportOrderBrackets` is enabled for the symbol.

3. **Current Project Codebase State**:
   - In `index.html`:
     - Line 140-151: `overrides` specifies candle colors and grid lines, but lacks `tradingProperties.showOrders: true`, `tradingProperties.showPositions: true`, `tradingProperties.showExecutions: true`, `tradingProperties.extendLeft: true`, and `tradingProperties.horizontalAlignment: "Right"`.
     - Line 153-162: `broker_config.configFlags` specifies `supportOrderBrackets: true`, `supportPositionBrackets: true`, `supportOrdersHistory: true`, `supportExecutions: true`, but omits `supportPlaceOrderPreview: true`, `supportModifyOrderPreview: true`, and `supportAddBracketsToExistingOrder: true`.
   - In `mt5_broker.js`:
     - Lines 1-382: Implements `MT5Broker` methods (`orders`, `positions`, `placeOrder`, `modifyOrder`, `cancelOrder`, etc.).
     - Missing methods: `getOrderDialogOptions(symbol)`, `getSymbolSpecificTradingOptions(symbol)`, and `orderPreview(order)`.

---

## 2. Logic Chain

1. **Step 1 (Why `+TP` and `+SL` handles appear or disappear)**:
   - Observation 1 & 2 show that `ItemRenderer` (`W` in module `376161`) renders `+TP` (part 11) and `+SL` (part 12) if and only if `supportOrderBrackets` evaluates to `true` for the symbol in `SymbolDataProvider`.
   - `SymbolDataProvider` inspects `broker.getSymbolSpecificTradingOptions(symbol)` first. Because `mt5_broker.js` does not implement `getSymbolSpecificTradingOptions`, TradingView falls back to checking default configuration flags.
   - Without `supportPlaceOrderPreview: true` in `configFlags`, the interactive preview line lifecycle in `PlaceOrderContext` is truncated, preventing smooth drag-to-attach bracket generation.

2. **Step 2 (Canvas Event Flow and Bidirectional Sync)**:
   - When a user interacts with the canvas, `ChartWidget._onMouseDown` hits `TradedSourcesManager`.
   - Module `376161` hit testing detects part `8` (line) or part `9` (price pill).
   - Moving the cursor invokes `_onDragMove` in `TradedGroupPlace`, which calls `_tradedContextLinking.setOrderPrice(newPrice)`.
   - This directly mutates `PlaceOrderContext.data()`, immediately firing listeners that update the price input in the Order Ticket / Panel.
   - Conversely, when typing a new price into the Order Ticket, `OrderViewController` invokes `_tradedContextLinking.setOrder(order)`, which updates `TradedGroupPlace` coordinates and schedules a canvas redraw on `CustomSourceLayer.Topmost`.

3. **Step 3 (Chart Properties Requirement)**:
   - Chart primitives (`LineToolOrder`, `LineToolPosition`) strictly check `this._model.properties().tradingProperties.showOrders.value()` in their pane views (`OrderPaneView._draw()`).
   - If `tradingProperties.showOrders` is false or omitted, `_draw()` returns immediately without painting anything to the canvas.
   - Therefore, `"tradingProperties.showOrders": true` and `"tradingProperties.showPositions": true` must be specified in `widgetOptions.overrides`.

---

## 3. Caveats

- **DOM vs Canvas**: The Order Ticket / Order Panel itself is a Preact/React DOM layer docked to the right of the chart, whereas the pre-order line, pills, badges, and `+TP`/`+SL` handles are drawn natively onto the HTML5 Canvas via `MediaCoordinatesPaneRenderer` and `ItemRenderer`. Dragging is canvas hit testing, not HTML drag-and-drop.
- **LineTool vs TradedGroup**: If the user desires lines drawn programmatically outside the order ticket flow, `chart.createOrderLine()` must be used. If the user desires interactive order ticket preview lines, `TradedSourcesManager` (native order ticket flow) is used. Both architectures are supported by the chart library.

---

## 4. Conclusion

The absence of interactive bracket handles and order line dragging on the canvas in the current project is caused by three specific missing configuration items:
1. Missing `tradingProperties.*` overrides in `index.html`.
2. Missing preview config flags (`supportPlaceOrderPreview: true`, `supportModifyOrderPreview: true`) in `index.html`.
3. Missing broker adapter capability methods (`getOrderDialogOptions`, `getSymbolSpecificTradingOptions`, `orderPreview`) in `mt5_broker.js`.

Detailed implementation snippets and architecture breakdowns are fully documented in `E:\TRADINGVIEW ADVANCED\.agents\explorer_survey_m20_2\analysis.md`.

---

## 5. Verification Method

To verify these findings:
1. **Inspect Bundle Modules**:
   - Open `charting_library/bundles/library.e8d44337c84d65489d2c.js` and search for module ID `298602` (`LineToolOrder`) and `462541` (`LineToolTradingPriceAxisView`).
   - Open `charting_library/bundles/trading-groups.9659877d7d96e0bb027b.js` and search for `TradedSourcesManager` and `tradedGroupPlaceOrder`.
   - Open `charting_library/bundles/6161.10c4a7de17f463d1d76e.js` and search for `buildProjectionBracketData`.
2. **Inspect Project Files**:
   - Inspect `index.html` lines 135-165 (`widgetOptions.overrides` and `broker_config.configFlags`).
   - Inspect `mt5_broker.js` to confirm absence of `getOrderDialogOptions` and `getSymbolSpecificTradingOptions`.
3. **Invalidation Conditions**:
   - If `getSymbolSpecificTradingOptions` is already defined in `mt5_broker.js`, this conclusion is invalidated (it is currently absent).
   - If `tradingProperties.showOrders` is already set in `index.html`, this conclusion is invalidated (it is currently absent).
