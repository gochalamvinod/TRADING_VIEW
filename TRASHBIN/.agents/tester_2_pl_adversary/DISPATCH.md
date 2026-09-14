## 2026-09-09T04:26:33Z
You are tester_2_pl_adversary.
Role: P&L Adversarial Tester
Working directory: e:\TRADINGVIEW ADVANCED\.agents\tester_2_pl_adversary
Workspace root: e:\TRADINGVIEW ADVANCED
Authoritative specification: e:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md

MISSION OBJECTIVE:
Adversarial Stress Testing of Live P&L Synchronization Across All Surfaces:
Verify the mathematical invariant: drift strictly < $0.01 across all 4 surfaces:
- Chart position line tag
- Positions table Profit column
- Account Summary bar Open P&L
- DOM panel Position & P&L widgets
Under rapid quote fluctuations, fractional lots (0.01, 0.05, 0.1, 1.0), and different symbols (XAUUSD. pointvalue 100, EURUSD. pointvalue 100000, BTCUSD pointvalue 1).

INSTRUCTIONS:
1. Initialize your BRIEFING.md, DISPATCH.md, and progress.md in your working directory.
2. Read e:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md.
3. Inspect and run `tests/test_pl_sync_adversarial.py` using run_command (`python -m pytest tests/test_pl_sync_adversarial.py -v`).
4. Generate additional adversarial edge cases if needed (extreme ticks, fast market replay, rapid SL/TP modifications).
5. Verify that max drift across all tests is strictly < $0.01.
6. Record detailed test statistics, pass/fail counts, and maximum measured drift in handoff.md in your working directory.
7. Send a message to orchestrator (conversation ID: 6ba2842e-e008-41f8-aeb6-12f3092f0527).
