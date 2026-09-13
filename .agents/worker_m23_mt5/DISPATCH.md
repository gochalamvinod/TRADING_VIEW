# Dispatch: Worker M23 (MT5 Backend Integration & Safe Execution)

## Role & Working Directory
- Role: teamwork_preview_worker
- Working Directory: E:\TRADINGVIEW ADVANCED\.agents\worker_m23_mt5
- Parent: orchestrator_3 (Conv ID: 7015faef-6e19-4066-9069-10b490151baf)

## Authoritative User Request
Path to read: E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md (specifically section dated 2026-09-08T11:29:18Z). You MUST read this file before starting work.

## Mandatory Integrity Warning
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

## Write Ownership
You exclusively own: `server.py` and `tests/test_trading_api.py`
Do NOT modify `index.html` (owned by worker_m22) or `mt5_broker.js` (owned by worker_m21).

## Task & Scope
Verify and harden the MT5 backend endpoints and proxy routing for Limit/Stop pending orders, bracket modifications, cancellations, and account safety:
1. Inspect MT5 endpoints in `server.py`:
   - `/trade/pending`: Place BUY_LIMIT, SELL_LIMIT, BUY_STOP, SELL_STOP with price, volume, sl, tp.
   - `/trade/modify`: Modify pending order price, sl, tp.
   - `/trade/cancel`: Cancel pending order by ticket.
   - `/trade/orders`: Fetch active pending orders.
   - `/trade/positions`: Fetch open positions.
   - `/trade/account`: Fetch real-time account summary.
2. Ensure strict account safety on MT5 demo account #70257567:
   - Zero unintended trade executions or orphaned open orders.
   - Any test orders placed must be safely cleaned up / cancelled immediately.
   - Proper validation of price, volume, and symbol suffixes (e.g. `GCEG26`, `EURUSD.r`, etc.).
3. Run test verification with Python test runner and verify zero error codes.
4. Output report and test results to `E:\TRADINGVIEW ADVANCED\.agents\worker_m23_mt5\handoff.md`.

## 2026-09-08T11:36:24Z
You are teamwork_preview_worker for Milestone M23 (MT5 Backend Integration & Safety).
Your working directory is E:\TRADINGVIEW ADVANCED\.agents\worker_m23_mt5.
Read your dispatch file at E:\TRADINGVIEW ADVANCED\.agents\worker_m23_mt5\DISPATCH.md and E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md (specifically section dated 2026-09-08T11:29:18Z).

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A teamwork_preview_auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

Write Ownership: You exclusively own `server.py` and `tests/test_trading_api.py`. Do NOT edit mt5_broker.js or index.html.
Verify and harden pending order endpoints (/trade/pending, /trade/modify, /trade/cancel, /trade/orders, /trade/account) in server.py with strict account safety on MT5 demo account #70257567. Run automated tests.
Output your handoff report to E:\TRADINGVIEW ADVANCED\.agents\worker_m23_mt5\handoff.md and send a completion message to parent.
