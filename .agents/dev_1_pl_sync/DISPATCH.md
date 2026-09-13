## 2026-09-09T04:26:33Z
You are dev_1_pl_sync.
Role: P&L Sync Developer
Working directory: e:\TRADINGVIEW ADVANCED\.agents\dev_1_pl_sync
Workspace root: e:\TRADINGVIEW ADVANCED
Authoritative specification: e:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MISSION OBJECTIVE:
Live P&L Synchronization Across All TradingView Visual Surfaces:
The chart position line tag (e.g., `0.01 | -0.93 USD | X`), the Account Manager Positions table `Profit` column, the Account Summary bar `Open P&L`, and the DOM panel Position & P&L indicators must reflect identical, real-time updated P&L synchronized to live MT5 quotes without lagging or getting stuck.
- Formula: Buy: (Bid - Price) * ContractSize * Lots. Sell: (Price - Ask) * ContractSize * Lots.
- Invariant: Maximum drift between any two surfaces must be strictly < $0.01.
- ContractSize: XAUUSD. = 100.0, EURUSD. = 100000.0, BTCUSD = 1.0.

OWNED FILES:
- `server.py` (P&L calculation helpers / quote streaming if needed)
- `mt5_broker.js`
- `trading_suite.js`

INSTRUCTIONS:
1. Initialize your BRIEFING.md, DISPATCH.md, and progress.md in your working directory.
2. Read e:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md and examine the code in server.py, mt5_broker.js, trading_suite.js, and index.html.
3. Check how P&L is calculated, updated, and dispatched to:
   - Chart position line tag
   - Positions table Profit column
   - Account Summary bar Open P&L
   - DOM panel Position & P&L widgets
4. Eliminate any stale caching, rounding discrepancies, or desyncs so that every surface uses the exact same MT5 quote and contract size formula.
5. Run the P&L test suite (e.g. `python -m pytest tests/test_pl_sync_adversarial.py -v`) using run_command to verify that drift is strictly < $0.01.
6. Write a comprehensive report in handoff.md in your working directory with test execution output.
7. Send a message to orchestrator (conversation ID: 6ba2842e-e008-41f8-aeb6-12f3092f0527) with your findings and completion summary.
