## 2026-09-08T15:46:44Z

Investigate live P&L calculation, formatting, and propagation across:
1. Chart Position Line tag (e.g. `0.01 | -0.93 USD | X`)
2. Account Manager Positions table `Profit` column
3. Account Summary bar `Open P&L`
4. DOM panel Position & P&L indicators

Analyze discrepancies, frontend vs backend calculation, quote propagation mechanisms, lag/freeze/failure causes, provide exact file locations and line numbers, and propose an architectural fix.
Write findings to `report.md` and `handoff.md`. Read-only exploration.
