# Progress - survey_r1_r2

Last visited: 2026-09-12T05:01:00Z
Status: In Progress

## Tasks
- [x] Initial setup: DISPATCH.md, BRIEFING.md, progress.md
- [ ] Investigate broker_time.py & hft_engine.py timezone offset calculation & -18000s bug
- [ ] Investigate server.py MT5 tick loop, ring buffers, and WebSocket /ws/quotes dispatch
- [ ] Analyze chart freezing root causes when MT5 market is closed / weekend
- [ ] Design synthetic micro-tick engine (interval 200-500ms, spread preservation, jitter, live UTC timestamp, priority override)
- [ ] Design deterministic broker timezone offset (D1 alignment `% 86400 == 0`, live tick verification <= 5s, /time endpoint)
- [ ] Synthesize findings and write handoff.md
- [ ] Send completion message to parent
