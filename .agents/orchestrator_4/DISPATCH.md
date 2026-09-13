# Dispatch History

## 2026-09-08T15:45:00Z

Fix all live P&L discrepancies between chart position line, Account Manager positions table, and Account Summary bar, restore missing metadata in Security Info (Point value, Currency, Pip size), and ensure real-time DOM ladder anchoring and Position/P&L syncing with god-level adversarial testing.

Requirements:
1. R1. Live P&L Synchronization Across All TradingView Surfaces:
   The chart position line tag (e.g. `0.01 | -0.93 USD | X`), the Account Manager Positions table `Profit` column, the Account Summary bar `Open P&L`, and the DOM panel Position & P&L indicators must reflect identical, real-time updated P&L synchronized to live MT5 quotes without lagging or getting stuck.
   - Acceptance: abs(Chart_Position_Line_PL - Positions_Table_Profit) == 0.00 (within round-off < $0.01). Updates on every tick without freeze. Account Summary bar Open P&L equals total sum of active position profits.

2. R2. Complete Symbol Metadata in Security Info & Datafeed:
   The `/symbols` API endpoint and datafeed resolution must return complete instrument specifications so Security Info dialog never displays dashes (`-`):
   - `pointvalue` matching MT5 contract size / point value (e.g. 100 for `XAUUSD.`, 100,000 for `EURUSD.`, 1 for `BTCUSD`)
   - `currency_code` and `original_currency_code` (e.g. `USD`)
   - `pip_size` (e.g. `0.01` for Gold, `0.0001` for 5-digit Forex)
   - `tick_size` matching `trade_tick_size` (`0.01`)

3. R3. DOM Ladder Dynamic Anchoring & Position Sync:
   - The DOM price ladder must stay pinned and centered on the current live Ask and Bid spread (`dynamicModeState: true`).
   - The DOM Position and P&L widgets must accurately display current position volume, entry price, and floating P&L when a position exists, and clean neutral status (`—` / `0.00`) when flat.

4. R4. Rigorous Adversarial Testing & Account Safety:
   - Full automated test suite verifying P&L calculations against live/mocked MT5 ticks across multiple lot sizes (0.01, 0.1, 1.0) and symbols (`XAUUSD.`, `EURUSD.`, `BTCUSD`).
   - Stress test all fixes with negative and positive grading tests.
   - Zero unwanted open positions or lingering orders on MT5 account `#70257567` at all times.
   - Ensure all 182+ existing unit and integration tests continue to pass 100%.

## 2026-09-08T15:47:04Z

[CRITICAL USER DIRECTIVE - HIGH PRIORITY]
"search for more hidden features and add them too i think there are 2014+ features add all of them"

Instructions:
1. Scan the Charting Library bundle and codebase for all available and hidden feature flags (featuresets, drawing tools, indicators, chart styles, volume profile, bar magnifier, multi-chart layouts, trading capabilities, DOM features, shortcuts, etc.).
2. Enable all beneficial features in `index.html` (in `enabled_features`) without breaking existing functionality or causing UI regressions.
3. Incorporate this requirement into your plan and milestones (e.g. expand survey and feature enablement scope).
4. Ensure all featuresets, studies, and trading flags are tested and verified by the adversarial QA team.

## 2026-09-08T15:52:45Z

[MAXIMUM PARALLEL ACCELERATION DIRECTIVE]
"use peak parallel processing and stress the agents to complete the task as soon possible"

Directives:
1. Maximize parallel processing across all tracks immediately.
2. Synthesize survey findings upon receipt and launch direct parallel implementation across all workstreams:
   - M21 (Live P&L synchronization)
   - M22 (Symbol metadata & Security Info)
   - M23 (DOM ladder dynamic centering)
   - M24 (Adversarial test suite with +/- grading & safety)
   - M25 (Enable beneficial hidden featuresets from 2014+ mined)
3. Stress test every fix with adversarial tests, maintain 100% test pass rate, and enforce account #70257567 safety.
4. Push for the fastest reliable completion.
