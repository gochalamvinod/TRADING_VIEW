# Plan — Orchestrator 3: Native TradingView Trading Pipeline & Interactive Order Lines

## Objective
Deliver native interactive Limit/Stop order placement lines on chart (PreOrderItem / createPlaceOrderContext), drag handles, bracket previews (SL/TP), enable 100+ native featuresets, and verify via automated Playwright tests and MT5 demo account integration with strict account safety.

## Milestones Breakdown

### Milestone M20: Exhaustive 311+ JS Bundle Analysis & Architecture Mapping
- **Objective**: Analyze all 311 JS bundle files in `charting_library/bundles/*.js` and `charting_library.standalone.js`.
- **Key targets**:
  - Pre-order placement line architecture (`PreOrderItem`, `createPlaceOrderContext`, `createEditOrderContext`).
  - Order panel / ticket binding & traded context linking (`_updateTradedContextLinking`, `bindToOrderTicket`).
  - Line tools: `LineToolOrder`, `LineToolPosition`, `LineToolExecution`.
  - Broker configFlags (`supportPlaceOrderPreview`, `supportModifyOrderPreview`, `supportOrderBrackets`, `supportPositionBrackets`).
  - Full catalog of 100+ native Charting Library & Trading Terminal featuresets.
- **Workers**: Dispatch 3 parallel Explorers / Spec Miners.
- **Deliverable**: Detailed architectural analysis report & blueprint for implementation.

### Milestone M21: Native Interactive Limit/Stop Order Placement Lines Implementation
- **Objective**: Implement native order placement line rendering and interactive dragging.
- **Key targets**:
  - Implement `createPlaceOrderContext` and `createEditOrderContext` in broker adapter (`mt5_broker.js` / `broker-sample`).
  - Connect chart host and pre-order item lifecycle.
  - Enable interactive drag handles, price pill on price scale, quantity badge, and SL/TP bracket handles.
  - Ensure `tradingProperties.showOrders` and `tradingProperties.showPositions` are set to `true`.
- **Workers**: Worker + 2 Reviewers + 2 Challengers + Forensic Auditor.
- **Gate criteria**: Build & syntax valid, all reviewers APPROVE, challengers confirm line dragging & bracket behavior, auditor CLEAN.

### Milestone M22: 100+ Native Featuresets Activation & Clean UI
- **Objective**: Enable all cataloged native featuresets and remove intrusive custom HTML overlays.
- **Key targets**:
  - Update `widgetOptions.enabled_features` in `index.html` with all 100+ featuresets (order_panel, dom_widget, trading_terminal, trading_account_manager, japanese_chart_styles, etc.).
  - Configure complete `broker_config.configFlags`.
  - Clean up any legacy intrusive custom HTML overlays, ensuring 100% native TradingView look and feel.
- **Workers**: Worker + 2 Reviewers + 2 Challengers + Forensic Auditor.
- **Gate criteria**: All features render natively without console errors or layout breakage.

### Milestone M23: MT5 Integration, Strict Account Safety & Automated Playwright E2E Suite
- **Objective**: Verify MT5 backend trading integration and create comprehensive automated browser test suite.
- **Key targets**:
  - Playwright/CDP automated test script verifying:
    1. Limit order selection triggers interactive horizontal order placement line on chart.
    2. Dragging the line updates the limit price in the order panel/ticket.
    3. Brackets (SL/TP) preview and drag handles update accurately.
    4. Safe execution test on MT5 demo account #70257567 (with zero orphan leaks or unintended risk).
- **Workers**: Worker + Reviewers + Challengers + Forensic Auditor.
- **Gate criteria**: 100% pass rate on automated Playwright tests, zero errors on MT5 IPC.
