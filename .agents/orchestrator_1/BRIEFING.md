# BRIEFING — 2026-09-08T09:50:00Z

## Mission
Eliminate lag, countdown jumping, and timescale clock drift in TradingView chart by synchronizing with MT5 with sub-millisecond precision and zero truncation delay.

## 🔒 My Identity
- Archetype: teamwork_preview_orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: e:\TRADINGVIEW ADVANCED\.agents\orchestrator_1
- Original parent: sentinel (sentinel_1)
- Original parent conversation ID: ebf2fa84-37c0-42e9-b1df-ed8c24a0ea95

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: e:\TRADINGVIEW ADVANCED\PROJECT.md
1. **Decompose**: Survey codebase (3 explorers) -> Decompose into milestones -> Interface contracts
2. **Dispatch & Execute** (pick ONE):
   - **Direct (iteration loop)**: Explorer -> Worker -> Reviewer -> Challenger -> Auditor gate
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Self-succeed at 16 spawns, write handoff.md, spawn successor
- **Work items**:
  1. Survey and Scope Mapping [in-progress]
  2. Architecture Decomposition & PROJECT.md [pending]
  3. Milestone Execution (Implementation + E2E Dual Track) [pending]
  4. Final Verification & Victory Audit [pending]
- **Current phase**: 0 (Survey)
- **Current focus**: Survey phase with 3 parallel explorers

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- File-editing tools ONLY for metadata/state files (.md) in .agents/ folder.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.
- Binary veto on integrity violation by forensic auditor.
- CRITICAL USER PRIORITY: Speed with accuracy ($100s/ms delay). Enforce HFT standards: microsecond precision, Windows timeBeginPeriod(1), zero-delay lockless data paths, orjson zero-copy, sub-ms automated verification.
- EXTENDED HFT MANDATE: "Same in order execution and all other stuff". Ultra-low latency for /trade/order, /trade/pending, /trade/modify, /trade/close (zero pre-trade overhead, zero AnyIO threadpool dispatch, RAM price cache, zero-copy retcode serialization) and all datafeed endpoints (/quotes, /history, /symbols, WebSocket).

## Current Parent
- Conversation ID: ebf2fa84-37c0-42e9-b1df-ed8c24a0ea95
- Updated: not yet

## Key Decisions Made
- Selected Project Pattern with parallel Survey explorers (2 teamwork_preview_explorer + 1 teamwork_preview_spec_miner).

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|-------|------|-----------|--------|---------|
| explorer_survey_1 | teamwork_preview_explorer | Survey Backend Timekeeping & MT5 Sync | failed/replaced | fa28d3d3-53c8-47a3-a6d1-c1f9f3dbc66a |
| explorer_survey_2 | teamwork_preview_explorer | Survey Frontend Charting & Countdown | completed | ccf92a72-dd80-46a1-bc98-d454dae42857 |
| spec_miner_survey_3 | teamwork_preview_spec_miner | Spec & Requirements Mining | completed | 3f83ab0a-52d7-4ea8-80dd-ceff7a0c3bda |
| explorer_survey_1_rep | teamwork_preview_explorer | Survey Backend Timekeeping & Trade Pipeline | completed | 81f69d2a-fdaa-496c-83c0-abed09b04486 |
| worker_m17 | teamwork_preview_worker | Implement M17 Backend Timekeeping & Trade Pipeline | in-progress | 09dea1d6-3ff9-4041-b944-9f7a5906a2b5 |
| frontend_eng | (parent-dispatched) | M18 Frontend Timescale & Countdown Engineer | in-progress | 3844f228 |
| trade_opt | (parent-dispatched) | M17 HFT Trade Optimizer | in-progress | e7b1719b |
| clock_auditor | (parent-dispatched) | M19 Timescale & Clock Drift Auditor | in-progress | fa3585a2 |
| suite_auditor | (parent-dispatched) | M19 Full Suite & Financial Safety Auditor | in-progress | c109095d |

## Succession Status
- Succession required: no
- Spawn count: 5 / 16
- Pending subagents: 09dea1d6-3ff9-4041-b944-9f7a5906a2b5
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: not started
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- e:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md — Verbatim user request
- e:\TRADINGVIEW ADVANCED\.agents\orchestrator_1\DISPATCH.md — Dispatch instructions
- e:\TRADINGVIEW ADVANCED\.agents\orchestrator_1\progress.md — Liveness & task progress
