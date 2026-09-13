# Dispatch: Explorer Survey M20-1 (Order Lifecycle & PreOrderItem Context)

## Role & Working Directory
- Role: teamwork_preview_explorer
- Working Directory: E:\TRADINGVIEW ADVANCED\.agents\explorer_survey_m20_1
- Parent: orchestrator_3 (Conv ID: 7015faef-6e19-4066-9069-10b490151baf)

## Objective & Task
You are the specialist explorer for Trading Order lifecycle, PreOrderItem, and Broker Adapter context binding in TradingView Charting Library.
Read `E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md` (specifically section dated 2026-09-08T11:29:18Z).

Conduct an exhaustive investigation across all 311+ JS bundle files in `charting_library/bundles/*.js`, `charting_library.standalone.js`, and `broker-sample/`:
1. Search and analyze all references to `createPlaceOrderContext`, `createEditOrderContext`, `PreOrderItem`, `_updateTradedContextLinking`, `bindToOrderTicket`, `getOrderDialogOptions`, `supportPlaceOrderPreview`, `supportModifyOrderPreview`, and `supportOrderBrackets`.
2. Trace the exact call hierarchy:
   - What happens when a user selects "Limit", "Stop", or "StopLimit" in the order panel / ticket?
   - How does TradingView request or instantiate a pre-order item on the chart?
   - What interface methods must the broker adapter implement? What properties must `createPlaceOrderContext` return (e.g. symbol, price, qty, brackets, callbacks, promises)?
   - How does line dragging sync back to the order ticket input field?
3. Inspect `mt5_broker.js`, `index.html`, and `broker-sample/dist/bundle.js` to see what is currently implemented and what is missing or broken.
4. Output a comprehensive report to `E:\TRADINGVIEW ADVANCED\.agents\explorer_survey_m20_1/analysis.md` and write a structured `handoff.md`.

## 2026-09-08T11:31:36Z
You are teamwork_preview_explorer for Milestone M20 (Survey Phase).
Your working directory is E:\TRADINGVIEW ADVANCED\.agents\explorer_survey_m20_1.
Read your dispatch file at E:\TRADINGVIEW ADVANCED\.agents\explorer_survey_m20_1\DISPATCH.md and E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md (specifically section dated 2026-09-08T11:29:18Z).

Task:
Conduct an exhaustive investigation across all 311+ JS bundle files in charting_library/bundles/*.js, charting_library.standalone.js, and broker-sample/:
1. Search and analyze all references to createPlaceOrderContext, createEditOrderContext, PreOrderItem, _updateTradedContextLinking, bindToOrderTicket, getOrderDialogOptions, supportPlaceOrderPreview, supportModifyOrderPreview, and supportOrderBrackets.
2. Trace the exact call hierarchy:
   - What happens when a user selects "Limit", "Stop", or "StopLimit" in the order panel / ticket?
   - How does TradingView request or instantiate a pre-order item on the chart?
   - What interface methods must the broker adapter implement? What properties must createPlaceOrderContext return (symbol, price, qty, brackets, callbacks, promises)?
   - How does line dragging sync back to the order ticket input field?
3. Inspect mt5_broker.js, index.html, and broker-sample/dist/bundle.js to see what is currently implemented and what is missing or broken.
4. Output your comprehensive analysis to E:\TRADINGVIEW ADVANCED\.agents\explorer_survey_m20_1\analysis.md and write a structured handoff.md.

Update your progress.md regularly with Last visited timestamps. Send a completion message to parent when finished.
