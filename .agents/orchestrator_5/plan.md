# Plan: Orchestrator 5 - Maximum Parallelism & 10M Stress Engine

## Objectives
Execute the user directive with maximum CPU (8 logical cores), full RAM, and NVIDIA GeForce GTX 1650 GPU acceleration across 4 developers and 4 testers:
1. Live P&L Synchronization across Chart tag, Positions table, Summary bar, and DOM (drift < $0.01).
2. Complete Symbol Metadata in Security Info & Datafeed (Pointvalue: 100 for XAUUSD., 100000 for EURUSD., 1 for BTCUSD; currency USD, base currency, pip size, tick size).
3. DOM Ladder Dynamic Anchoring & Position Sync (dynamicModeState: true, centered on Ask/Bid spread, dark theme).
4. Massive Vectorized 10 Million Scenario Stress Engine (Market, Limit, Adjust SL, Adjust TP, 10-window concurrency with 1M ticks, AAAA++++++++++++++++ certification).
5. Comprehensive Feature Set Activation (Scan bundles and enable non-breaking featuresets in index.html).
6. Orbex MT5 Demo Account Safety (#70257567: 0 unwanted positions, 0 orphan orders) & Full Regression Suite Pass.

## Team Structure & File Ownership
### Developers (Workers)
1. **dev_1_pl_sync** (teamwork_preview_worker)
   - Scope: P&L math, real-time quote propagation to chart position tag, positions table, summary bar, DOM widgets.
   - Files: `server.py`, `mt5_broker.js`, `trading_suite.js`, `index.html`.
   - Criteria: Drift < $0.01 on any tick or lot size.

2. **dev_2_symbol_meta** (teamwork_preview_worker)
   - Scope: Complete symbol specs in `/symbols` and datafeed `resolveSymbol`.
   - Files: `server.py`, `datafeeds/udf/datafeed.js`.
   - Criteria: Security Info displays point value 100 for XAUUSD., 100000 for EURUSD., 1 for BTCUSD; currency USD; pip size; tick size without dashes.

3. **dev_3_dom_ladder** (teamwork_preview_worker)
   - Scope: DOM ladder pinning and dynamic centering on Ask/Bid spread (`dynamicModeState: true`), position & floating P&L indicators, clean flat state, dark theme.
   - Files: `index.html`, DOM CSS/JS elements.
   - Criteria: Dynamic centering lock active, ladder tracks spread, position syncs.

4. **dev_4_featuresets** (teamwork_preview_worker)
   - Scope: Scan library bundles for featuresets (2014+), enable non-breaking ones in `index.html` `enabled_features`.
   - Files: `index.html`.
   - Criteria: Enhanced features active without breaking DOM or order execution.

### Testers & Specialists (Challengers, Test Writers, Auditors)
5. **tester_1_10m_stress** (teamwork_preview_challenger)
   - Scope: 10,000,000 Scenario Vectorized Stress Harness across 4 pillars (2.5M Market, 2.5M Limit, 2.5M SL adjust, 2.5M TP adjust) + Multi-Window (10 windows, 1M streaming ticks).
   - Execution: Maximize all 8 CPU cores (multiprocessing pool), unlocked RAM, NVIDIA GTX 1650 GPU acceleration.
   - Criteria: 10,000,000/10,000,000 passed, 0 failures, 0 penalties, `AAAA++++++++++++++++` (10,000,000 pts).

6. **tester_2_pl_adversary** (teamwork_preview_challenger)
   - Scope: Adversarial verification of P&L drift across all 4 surfaces.
   - Test File: `tests/test_pl_sync_adversarial.py`.
   - Criteria: 100% pass rate, max drift strictly < $0.01.

7. **tester_3_mt5_safety** (teamwork_preview_test_writer)
   - Scope: Orbex MT5 Demo account #70257567 safety verification (0 unwanted positions, 0 orphan orders) and full regression suite verification (Tiers 1-6).
   - Test Files: `run_e2e_tests.py`, `tests/test_agent14_mt5_execution_adversarial.py`.
   - Criteria: Account safety intact, 100% regression suite pass.

8. **tester_4_forensic_audit** (teamwork_preview_auditor)
   - Scope: Independent forensic audit of implementation authenticity, zero cheating, real logic, no dummy facades.
   - Criteria: Clean verdict with binary veto power.

## Phase Execution
- **Step 1**: Dispatch all 8 subagents concurrently with detailed prompts, exact file boundaries, and integrity warnings.
- **Step 2**: Monitor progress via heartbeat cron and `progress.md`.
- **Step 3**: Collect completion reports and handoffs from all 8 subagents.
- **Step 4**: Synthesize findings, verify all invariants, ensure 100% test pass.
- **Step 5**: Produce final comprehensive completion report for Victory Audit.
