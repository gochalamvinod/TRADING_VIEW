# Progress — explorer_btree_data

Last visited: 2026-09-12T05:35:00Z

## Status: IN_PROGRESS
- [x] Initialized DISPATCH.md, BRIEFING.md, and progress.md
- [x] Review prior survey 2 analysis and handoff reports
- [x] Investigate Question 1: Resolution Switching Bug (1S..1M, tick resolutions 1T..100T), "Incremental update failed", seconds.py, ticks.py, server.py, copy_ticks_range offset, copy_rates_from clamping, index.html wrappedOnHistory, MN1 35s freeze, missing M45 timeframe mapping
- [x] Investigate Question 2: Weekend 24/7 BTCUSD Micro-Ticks & Live Streaming, market_status, hft_engine.py, frontend_server.js ring buffer
- [x] Investigate Question 3: Ultra-Low Latency Pipeline (<1ms target), memory allocations (ring buffer 2.4GB -> 350MB fix), thread hopping, lock contention
- [x] Investigate Question 4: Zero-Drift Server Time & UTC Axis Alignment, broker timezone offset calculation, D1 bar alignment vs staleness bug, /time endpoints
- [x] Investigate Question 5: Tri-Service Dual-Port Integration (9000, 9999, 8080), dual uvicorn instance conflict
- [ ] Draft analysis.md with detailed findings, evidence chains, and verification commands
- [ ] Draft handoff.md with 5-component report and concrete code-level fix blueprints
- [ ] Send completion message to parent
