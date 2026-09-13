# Dispatch: Test Writer E2E M23 (Automated Playwright Suite)

## Role & Working Directory
- Role: teamwork_preview_test_writer
- Working Directory: E:\TRADINGVIEW ADVANCED\.agents\test_writer_e2e_m23
- Parent: orchestrator_3 (Conv ID: 7015faef-6e19-4066-9069-10b490151baf)

## Objective & Task
You are the dedicated E2E Test Writer for Requirement R4 and Milestone M23.
Read `E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md` (specifically section dated 2026-09-08T11:29:18Z).

Write an end-to-end programmatic verification suite (Playwright Python or Node.js / Puppeteer) to test:
1. Interactive Limit and Stop Order Placement Line on Chart:
   - Navigating to `http://127.0.0.1:9000` (or `http://127.0.0.1:8001`).
   - Selecting "Limit" in the order panel / ticket.
   - Verifying the horizontal draggable order placement line is rendered on the chart canvas (`PreOrderItem` / `LineToolOrder`).
   - Verifying drag handles, price pill on price scale, and quantity badge.
2. Drag Handle Price Sync:
   - Simulating drag-and-drop of the order placement line.
   - Verifying that moving the line updates the limit price in the order panel/ticket input field in real time.
3. Bracket Previews:
   - Toggling / configuring Take Profit (TP) and Stop Loss (SL) brackets.
   - Verifying SL and TP bracket handles appear attached to the pre-order line on chart.
4. Native Terminal Featureset Verification:
   - Confirming presence of native Order Panel, Account Manager, DOM widget, and Watchlist without custom HTML overlays.
5. MT5 Account Safety:
   - Verifying demo account #70257567 trade execution safety (no orphan trades, proper ticket cancellation).

Save your test scripts in `tests/test_interactive_order_lines.py` (and/or Node test equivalent) and write `TEST_READY.md` / `handoff.md` in your working directory.
Do NOT modify implementation code.

## 2026-09-08T11:36:24Z
You are teamwork_preview_test_writer for Milestone M23 (E2E Automated Verification).
Your working directory is E:\TRADINGVIEW ADVANCED\.agents\test_writer_e2e_m23.
Read your dispatch file at E:\TRADINGVIEW ADVANCED\.agents\test_writer_e2e_m23\DISPATCH.md and E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md (specifically section dated 2026-09-08T11:29:18Z).

Write an end-to-end programmatic verification suite (Playwright Python or Node.js / Puppeteer) to test:
1. Selecting "Limit" in the order panel / ticket renders the horizontal draggable order placement line on chart canvas (PreOrderItem / LineToolOrder).
2. Dragging the line updates the limit price in the input ticket in real time.
3. Brackets (SL/TP) can be previewed on chart and their handles drag properly.
4. Native featuresets render without custom HTML overlays.
5. MT5 demo account #70257567 trade execution safety.

Save your test scripts in tests/test_interactive_order_lines.py (and/or Node test equivalent), write TEST_READY.md and handoff.md in your working directory.
Do NOT modify implementation code.
Send a completion message to parent when finished.
