# Orchestrator 4 Context

## Mission Overview
User Directive: "team of developer and AAAA+++++++++++++++ testers who cares even minor bugs i mean god level testing and stress them with -ve and +ve grading for wrong and wright ans"

Fix all live P&L discrepancies between chart position line, Account Manager positions table, and Account Summary bar, restore missing metadata in Security Info (Point value, Currency, Pip size), and ensure real-time DOM ladder anchoring and Position/P&L syncing with god-level adversarial testing.

## Key Focus Areas
1. **P&L Synchronization**:
   - Chart position line tag: `0.01 | -0.93 USD | X`
   - Account Manager Positions table `Profit` column
   - Account Summary bar `Open P&L`
   - DOM panel Position & P&L indicators
   - Must be identical and update live on every tick without freezing.
   - Acceptance: `abs(Chart_Position_Line_PL - Positions_Table_Profit) == 0.00` (< $0.01 round-off).

2. **Security Info & Symbol Metadata**:
   - `/symbols` API and UDF datafeed symbol resolution
   - Security Info dialog must not show dashes (`-`):
     - `pointvalue`: 100 for XAUUSD., 100,000 for EURUSD., 1 for BTCUSD
     - `currency_code` & `original_currency_code`: USD
     - `pip_size`: 0.01 for Gold, 0.0001 for 5-digit Forex
     - `tick_size`: 0.01

3. **DOM Ladder Dynamic Anchoring & Position Sync**:
   - Price ladder pinned and centered on live Ask/Bid spread (`dynamicModeState: true`)
   - Current position volume, entry price, and floating P&L displayed when open, and `—` / `0.00` when flat.

4. **Adversarial Testing & Safety**:
   - Python & Node test suite verifying P&L calculation across multiple lot sizes (0.01, 0.1, 1.0) and symbols (`XAUUSD.`, `EURUSD.`, `BTCUSD`).
   - Stress testing with negative (-ve) and positive (+ve) grading tests.
   - Zero unwanted open positions or lingering orders on MT5 account `#70257567`.
   - All 182+ existing unit and integration tests passing 100%.
