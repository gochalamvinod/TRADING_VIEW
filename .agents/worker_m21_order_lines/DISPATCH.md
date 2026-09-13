# Dispatch: Worker M21 (Interactive Order Lines & PreOrderItem Engine)

## Role & Working Directory
- Role: teamwork_preview_worker
- Working Directory: E:\TRADINGVIEW ADVANCED\.agents\worker_m21_order_lines
- Parent: orchestrator_3 (Conv ID: 7015faef-6e19-4066-9069-10b490151baf)

## Authoritative User Request
Path to read: E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md (specifically section dated 2026-09-08T11:29:18Z). You MUST read this file before starting work.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership
You exclusively own: `mt5_broker.js`
Do NOT modify `index.html` (owned by worker_m22) or `server.py` (owned by worker_m23).

## Task & Scope
Implement the native interactive Limit and Stop order placement lines on chart in `mt5_broker.js`:
1. Implement `getOrderDialogOptions(symbol)` returning:
   ```javascript
   {
     customFields: [],
     flags: {
       supportPlaceOrderPreview: true,
       supportModifyOrderPreview: true,
       supportOrderBrackets: true,
       supportPositionBrackets: true
     }
   }
   ```
2. Implement `getSymbolSpecificTradingOptions(symbol)` returning symbol trading parameters (minQty, maxQty, qtyStep, pipValue, pipSize, minStopDistance, etc.).
3. Implement `orderPreview(order)` to compute accurate margin, cost, estimated profit/loss, and bracket values for order preview.
4. Implement `createPlaceOrderContext(order)` and `createEditOrderContext(order)` returning valid context objects:
   - Must provide `symbol`, `order`, `formatter`, `price`, `qty`, `brackets` observables/handlers.
   - Must handle `destroy()` / `abort()` gracefully without unhandled rejections.
5. Ensure bracket handling (`takeProfit`, `stopLoss`) integrates seamlessly with `mt5_broker.js` order structures and callbacks.
6. Verify syntax and run tests. Document all changes and test outputs in `E:\TRADINGVIEW ADVANCED\.agents\worker_m21_order_lines\handoff.md`.

## 2026-09-08T11:36:24Z
You are teamwork_preview_worker for Milestone M21 (Interactive Order Lines).
Your working directory is E:\TRADINGVIEW ADVANCED\.agents\worker_m21_order_lines.
Read your dispatch file at E:\TRADINGVIEW ADVANCED\.agents\worker_m21_order_lines\DISPATCH.md and E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md (specifically section dated 2026-09-08T11:29:18Z).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership: You exclusively own `mt5_broker.js`. Do NOT edit index.html or server.py.
Implement getOrderDialogOptions, getSymbolSpecificTradingOptions, orderPreview, and createPlaceOrderContext/createEditOrderContext in mt5_broker.js per the dispatch specifications. Verify syntax and tests.
Output your handoff report to E:\TRADINGVIEW ADVANCED\.agents\worker_m21_order_lines\handoff.md and send a completion message to parent.

