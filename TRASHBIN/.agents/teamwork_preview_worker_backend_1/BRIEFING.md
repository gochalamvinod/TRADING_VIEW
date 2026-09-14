# BRIEFING — 2026-09-11T07:49:00Z

## Mission
Milestone M33 / Requirement R4: 100,000x Speed Backend & Realtime Stability, fixing "Incremental update failed" loop, removing incorrect UTC tick offsets, non-blocking read queries in hft_engine, tick ring buffer pre-warming, and index.html datafeed watchdog & incremental filtering.

## 🔒 My Identity
- Archetype: implementer, qa, specialist
- Roles: implementer, qa, specialist
- Working directory: e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_worker_backend_1
- Original parent: 0660eeb7-cf9a-4416-bdec-e3267ee45261 (orchestrator_14)
- Milestone: M33 - Requirement R4

## 🔒 Key Constraints
- Exclusively own: server.py, seconds.py, ticks.py, hft_engine.py, index.html (specifically datafeed & streaming hooks)
- Do NOT edit pine_editor_ide.js, pine_indicators.js, or pine_editor.css
- Integrity mandate: No shortcuts, no fake results, genuine implementation only

## Current Parent
- Conversation ID: 0660eeb7-cf9a-4416-bdec-e3267ee45261
- Updated: 2026-09-11T07:49:00Z

## Task Summary
- **What to build**:
  1. Fix "Incremental update failed. Starting full update" loop:
     - server.py: pass integer epoch timestamp `int(safe_to_broker)` into `mt5.copy_rates_from`
     - seconds.py & ticks.py: remove `- hours_offset` from UTC ticks returned by `copy_ticks_range`
     - index.html: in `wrappedOnHistory`, filter incremental bars (`bars = bars.filter(b => b.time <= periodParams.to * 1000)` if not `firstDataRequest`), update `sub.currentBar` / `_lastHistoricalBars` only when `periodParams.firstDataRequest === true`, silence `_dataPulseProvider` HTTP polling when WebSocket quote stream active.
  2. Fix chart spinner locks & optimize throughput to 100,000x:
     - hft_engine.py: add `copy_rates_from`, `copy_rates_range`, `copy_rates_from_pos`, and `symbol_info` to `_FAST_READ_METHODS` so reads bypass lock
     - Size and pre-warm `ContiguousTickRingBuffer` to 250k ticks in RAM with UTC normalization at ingestion
     - index.html: add 3-second safety watchdog in `getBars` and `resolveSymbol` cleanly returning `{ noData: true }` on timeout
- **Success criteria**: Tests pass, 0 incremental update loops, fast chart loading, verification commands pass.
- **Interface contracts**: PROJECT.md / SCOPE.md
- **Code layout**: Root directory backend files + index.html

## Key Decisions Made
- Initial setup

## Change Tracker
- **Files modified**: None yet
- **Build status**: Untested
- **Pending issues**: None

## Quality Status
- **Build/test result**: Untested
- **Lint status**: Untested
- **Tests added/modified**: TBD

## Loaded Skills
None yet

## Artifact Index
- DISPATCH.md — Dispatch instructions
- BRIEFING.md — Situational awareness
- progress.md — Progress tracker
- handoff.md — Final handoff report
