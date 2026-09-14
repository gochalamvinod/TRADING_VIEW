# Orchestration Plan — orchestrator_4

## Objective
Fix live P&L discrepancies between chart position line, Account Manager positions table, and Account Summary bar, restore missing metadata in Security Info, ensure real-time DOM ladder dynamic anchoring and Position/P&L syncing, and prove system integrity via god-level adversarial testing with positive and negative grading.

## Milestones & Work Breakdown

### Phase 0: Parallel Exploration & Survey
- **explorer_pl_sync**: Investigate how P&L is calculated, formatted, and propagated across Chart Position Line, Account Manager positions table (`Profit` column), Account Summary bar (`Open P&L`), and DOM panel. Identify exact discrepancy sources (e.g. tick value vs point value, raw pips vs dollar P&L, quote update event listeners).
- **explorer_security_info**: Investigate `/symbols` endpoint in `server.py` and UDF datafeed resolution in `index.html` / `trading_suite.js`. Determine why `pointvalue`, `currency_code`, `pip_size`, `tick_size` display as dashes (`-`) in Security Info dialog for `XAUUSD.`, `EURUSD.`, `BTCUSD`.
- **explorer_dom_ladder**: Investigate DOM widget initialization, ladder anchoring mechanism (`dynamicModeState`), live Ask/Bid centering loop, and position/P&L display widgets when in position vs flat.

### Phase 1: Implementation (Milestones M21 - M23)
- **M21: Live P&L Synchronization Across All Surfaces**
  - Unify P&L calculation engine between chart position line, Account Manager table, Account Summary bar, and DOM widget.
  - Acceptance: `abs(Chart_Position_Line_PL - Positions_Table_Profit) == 0.00` (within round-off < $0.01). Updates on every tick without freeze. Account Summary bar Open P&L equals total sum of active position profits.
- **M22: Complete Symbol Metadata in Security Info & Datafeed**
  - Enrich `/symbols` and datafeed `resolveSymbol` with full specifications (`pointvalue`, `currency_code`, `original_currency_code`, `pip_size`, `tick_size`).
  - Acceptance: Security Info dialog displays correct values without dashes for all instruments.
- **M23: DOM Ladder Dynamic Anchoring & Position Sync**
  - Keep DOM price ladder centered on live Ask/Bid spread (`dynamicModeState: true`).
  - Real-time DOM position volume, entry price, and floating P&L sync; clean neutral status (`—` / `0.00`) when flat.

### Phase 2: Adversarial Hardening & Verification (M24)
- **M24: God-Level Adversarial Testing Suite & Safety Audit**
  - Positive (+ve) grading tests: exact P&L match across lots (0.01, 0.1, 1.0) and symbols (`XAUUSD.`, `EURUSD.`, `BTCUSD`), real-time sync, DOM centering.
  - Negative (-ve) grading tests: extreme spread jumps, invalid lot inputs, flat state handling, zero-division safeguards, symbol mismatch error handling.
  - Account Safety: Verify MT5 demo account #70257567 has zero lingering orders or unintended positions.
  - Full Regression Pass: Ensure all 182+ existing unit and integration tests pass 100%.

## Gate Requirements per Milestone
- 1 Worker (implementation & test run)
- 2 Reviewers (code review & feature verification)
- 2 Challengers (adversarial test verification)
- 1 Forensic Auditor (integrity verification, binary veto)
