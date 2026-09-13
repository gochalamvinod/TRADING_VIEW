# BRIEFING — 2026-09-08T11:36:24Z

## Mission
Implement native interactive Limit and Stop order placement lines (PreOrderItem engine, orderPreview, order dialog options, trading options, and place/edit order contexts) in mt5_broker.js.

## 🔒 My Identity
- Archetype: teamwork_preview_worker
- Roles: implementer, qa, specialist
- Working directory: E:\TRADINGVIEW ADVANCED\.agents\worker_m21_order_lines
- Original parent: 7015faef-6e19-4066-9069-10b490151baf
- Milestone: M21 (Interactive Order Lines)

## 🔒 Key Constraints
- Exclusively own `mt5_broker.js`. Do NOT edit `index.html` or `server.py`.
- Integrity Mandate: genuine logic only, no hardcoded test shortcuts or dummy facades.
- Must implement getOrderDialogOptions, getSymbolSpecificTradingOptions, orderPreview, createPlaceOrderContext, createEditOrderContext.
- Must handle destroy() / abort() gracefully.
- Coordinate via send_message to parent (7015faef-6e19-4066-9069-10b490151baf) and write handoff report to handoff.md.

## Current Parent
- Conversation ID: 7015faef-6e19-4066-9069-10b490151baf
- Updated: 2026-09-08T11:36:38Z (incorporating findings from explorer_survey_m20_2)

## Task Summary
- **What to build**: Interactive order lines, pre-order preview, and order execution contexts in `mt5_broker.js`.
- **Success criteria**:
  1. `getOrderDialogOptions(symbol)` returns correct config and flags.
  2. `getSymbolSpecificTradingOptions(symbol)` returns accurate trading options (minQty, maxQty, qtyStep, pipValue, pipSize, etc.).
  3. `orderPreview(order)` computes accurate margin, cost, estimated profit/loss, and bracket values.
  4. `createPlaceOrderContext(order)` and `createEditOrderContext(order)` return fully functional observable-backed contexts with destroy/abort support.
  5. Bracket handling (takeProfit, stopLoss) integrates seamlessly.
  6. Unit and syntax tests pass with zero regressions.
- **Interface contracts**: TradingView Broker API / charting library broker terminal protocol.
- **Code layout**: `mt5_broker.js`.

## Key Decisions Made
- Read explorer_survey_m20_2 analysis report to strictly align with TradingView bundle expectations.

## Artifact Index
- `E:\TRADINGVIEW ADVANCED\mt5_broker.js` — Target file to implement
- `E:\TRADINGVIEW ADVANCED\.agents\worker_m21_order_lines\handoff.md` — Final handoff report

## Change Tracker
- **Files modified**: None yet
- **Build status**: Pending
- **Pending issues**: None

## Quality Status
- **Build/test result**: Not yet run
- **Lint status**: Clean
- **Tests added/modified**: Pending

## Loaded Skills
- None explicitly loaded
