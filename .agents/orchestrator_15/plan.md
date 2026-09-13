# Execution Plan — Orchestrator Session 15

## Objective
Implement end-to-end resolution for real-time chart freezing, server time synchronization, missing ticks, and seconds/tick resolution bugs across the TradingView Tri-Service architecture so charts, candles, and tick charts stream live and continuously at all times.

## Phase 0: Survey & Scope Discovery (3 Explorers in Parallel)
1. **Explorer 1 (Backend Tick Streaming & Broker Time)**:
   - Target files: `server.py`, `broker_time.py`, `hft_engine.py`, ring buffers, websocket `/ws/quotes`.
   - Goal: Map how ticks are streamed, why charts freeze on weekends/market closures, how synthetic micro-ticks should be injected, and trace the `-18000s` offset bug in `broker_time.py`.
2. **Explorer 2 (History Fetching & Seconds/Tick Resolution)**:
   - Target files: `server.py` (`/history`), resolution handlers, MT5 `copy_ticks_range` / `copy_ticks_from`.
   - Goal: Map the naive `datetime.fromtimestamp` usage, `int(from_val)` / `int(to_val)` replacement, market closure fallback retrieval, monotonic timestamp aggregation for 1S/5S/10S/15S and 1T/10T/40T.
3. **Explorer 3 (Tri-Service Architecture & Automated CDP Verification)**:
   - Target files: `index.html`, `datafeeds/udf/dist/bundle.js`, Account Center, proxy configurations (9000, 9999, 8080), existing Playwright / CDP test harnesses.
   - Goal: Map service startup, port binding, chart datafeed subscription lifecycle, and establish CDP verification capabilities.

## Phase 1: PROJECT.md & Test Infrastructure
- Synthesize findings into `PROJECT.md`.
- Establish `TEST_INFRA.md` and automated test verification plan.

## Phase 2: Milestone Execution & Verification Loop
- M1: Weekend Heartbeat & Live Tick Engine (R1).
- M2: Deterministic Broker Timezone Offset & Zero-Drift Server Time (R2).
- M3: Seconds & Tick Resolution History Architecture (R3).
- M4: Dual-Port Tri-Service Integration & Automated CDP Verification (R4).

## Phase 3: Final Verification & Audit Gate
- 100% E2E test verification in headless Chrome via CDP.
- Forensic integrity audit.
- Final report to Sentinel.
