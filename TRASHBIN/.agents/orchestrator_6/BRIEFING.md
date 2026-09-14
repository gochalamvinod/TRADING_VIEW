# BRIEFING — 2026-09-09T05:58:00Z

## Mission
Deploy a full multi-agent team to complete the native TradingView-style Pine Script IDE and indicator runtime engine on the trading platform, ensuring all custom and library Pine scripts render calculated visual plots and expose functional native legend controls matching TradingView's built-in indicators.

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: e:\TRADINGVIEW ADVANCED\.agents\orchestrator_6
- Original parent: parent
- Original parent conversation ID: 313a4109-2b76-41ab-981f-c5f3116865e0

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: e:\TRADINGVIEW ADVANCED\PROJECT.md
1. **Decompose**: Decompose Pine Script IDE and indicator runtime into modular milestones after full Survey.
2. **Dispatch & Execute**:
   - Project Orchestrator delegates milestones or runs Explorer -> Worker -> Reviewer -> Challenger -> Auditor loop.
   - Dual-track execution: Implementation Track + E2E Testing Track.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: Self-succeed at 16 spawns, write handoff.md, spawn successor.
- **Work items**:
  1. Survey and Scope Mapping [in-progress]
  2. Native Indicator Execution & Visual Plots (R1) [pending]
  3. Native Legend Controls & Study Editability (R2) [pending]
  4. Reference Built-in Indicators Architecture (R3) [pending]
  5. E2E Dual-Track Testing (Focus strictly on custom/library PineScript scripts, exclude built-ins) [pending]
- **Current phase**: 0 (Survey)
- **Current focus**: Survey phase with updated user directive.

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- Audit Enforcement: If a Forensic Auditor reports INTEGRITY VIOLATION, milestone FAILS UNCONDITIONALLY.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.
- USER DIRECTIVE (2026-09-09T05:57:14Z): Focus automated testing strictly on custom and library PineScript indicators (SMA Crossover, Smoothed RSI, Crossing Moving Averages, 0-plot scripts like Smart Trader / Golden Pocket Zones); DO NOT test built-in indicators.

## Current Parent
- Conversation ID: 313a4109-2b76-41ab-981f-c5f3116865e0
- Updated: 2026-09-09T05:58:00Z

## Key Decisions Made
- Dispatched 3 survey explorers (Pine runtime, legend controls, indicator templates & tests).
- Incorporated Sentinel directive to strictly focus testing on custom/library PineScript indicators and exclude built-ins from test suite.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|---|---|---|---|---|
| teamwork_preview_spec_miner_survey_1 | teamwork_preview_spec_miner | Survey Pine Script IDE & Runtime Engine | in-progress | 1662c764-e67a-4f24-bb5f-08546c271de3 |
| teamwork_preview_explorer_survey_2 | teamwork_preview_explorer | Survey Legend Controls & Study Editability | in-progress | bac18106-7599-4f47-83e2-57de56260b4f |
| teamwork_preview_explorer_survey_3 | teamwork_preview_explorer | Survey Built-in Indicators Architecture & E2E Testing | in-progress | fd9503f1-2a49-45bf-bfc0-aeada0f79225 |

## Succession Status
- Succession required: no
- Spawn count: 3 / 16
- Pending subagents: 1662c764-e67a-4f24-bb5f-08546c271de3, bac18106-7599-4f47-83e2-57de56260b4f, fd9503f1-2a49-45bf-bfc0-aeada0f79225
- Predecessor: none
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: task-16 (every 10 minutes)
- Safety timer: covered by task-16
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- e:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md — Original User Request
- e:\TRADINGVIEW ADVANCED\.agents\orchestrator_6\DISPATCH.md — Mission Mandate and Requirements
- e:\TRADINGVIEW ADVANCED\.agents\orchestrator_6\BRIEFING.md — Working memory and status index
- e:\TRADINGVIEW ADVANCED\.agents\orchestrator_6\progress.md — Progress and heartbeat tracking
- e:\TRADINGVIEW ADVANCED\.agents\orchestrator_6\plan.md — Master Plan
- e:\TRADINGVIEW ADVANCED\PROJECT.md — Global project plan and milestone specification
