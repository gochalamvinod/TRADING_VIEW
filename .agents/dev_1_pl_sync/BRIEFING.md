# BRIEFING — 2026-09-09T04:26:33Z

## Mission
Live P&L Synchronization Across All TradingView Visual Surfaces (Chart position line tag, Positions table Profit column, Account Summary bar Open P&L, DOM panel Position & P&L indicators) synchronized to live MT5 quotes with drift strictly < $0.01.

## 🔒 My Identity
- Archetype: dev_1_pl_sync
- Roles: implementer, qa, specialist
- Working directory: e:\TRADINGVIEW ADVANCED\.agents\dev_1_pl_sync
- Original parent: 6ba2842e-e008-41f8-aeb6-12f3092f0527
- Milestone: P&L Real-Time Synchronization & Zero-Drift Guarantee

## 🔒 Key Constraints
- Invariant: Maximum drift between any two surfaces must be strictly < $0.01.
- Formula: Buy: (Bid - Price) * ContractSize * Lots. Sell: (Price - Ask) * ContractSize * Lots.
- ContractSize: XAUUSD. = 100.0, EURUSD. = 100000.0, BTCUSD = 1.0.
- Mandatory Integrity Mandate: No hardcoding test results, no dummy/facade implementations.
- Owned files: server.py, mt5_broker.js, trading_suite.js.

## Current Parent
- Conversation ID: 6ba2842e-e008-41f8-aeb6-12f3092f0527
- Updated: 2026-09-09T04:26:33Z

## Task Summary
- **What to build**: Eliminate stale caching, rounding discrepancies, or desyncs across all 4 visual P&L surfaces (Chart tag, Positions table, Summary bar, DOM panel). Ensure live quote updates propagate seamlessly and immediately using the exact contract size and P&L formula.
- **Success criteria**: All 4 surfaces match live MT5 calculation within < $0.01 drift; test suite passes completely.
- **Interface contracts**: e:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md
- **Code layout**: server.py, mt5_broker.js, trading_suite.js

## Key Decisions Made
- Initializing agent workspace and briefing.

## Artifact Index
- DISPATCH.md — Orchestrator instructions
- BRIEFING.md — Persistent working state
- progress.md — Liveness heartbeat & task progress
- handoff.md — Final self-contained handoff report

## Change Tracker
- **Files modified**: None yet
- **Build status**: Pending
- **Pending issues**: None

## Quality Status
- **Build/test result**: Not yet run
- **Lint status**: Clean
- **Tests added/modified**: Pending

## Loaded Skills
- None explicitly requested by orchestrator.
