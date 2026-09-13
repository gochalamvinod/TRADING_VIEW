# BRIEFING — 2026-09-13T05:45:00Z

## Mission
Deliver an ultra-lightweight TradingView Advanced Charts frontend with native Bar Replay functionality, 95% compute offloaded to Node.js backend, and a high-performance Julia SIMD engine for technical indicators.

## 🔒 My Identity
- Archetype: orchestrator
- Roles: orchestrator, user_liaison, human_reporter, successor
- Working directory: e:/TRADINGVIEW ADVANCED/.agents/orchestrator_17
- Original parent: parent
- Original parent conversation ID: baee5d42-b3f2-4bd9-bc11-ba671c73ea32

## 🔒 My Workflow
- **Pattern**: Project
- **Scope document**: e:/TRADINGVIEW ADVANCED/PROJECT.md
1. **Decompose**: Decompose full system requirements into 3 main milestones: M1 (Interactive Bar Replay System), M2 (95% Frontend Offloading & Pine Node.js backend), M3 (Julia SIMD Engine & Microservice) + E2E Dual-track verification.
2. **Dispatch & Execute**:
   - **Direct (iteration loop)**: Survey (3 explorers) -> Decompose & Delegate to Sub-orchestrators / Workers -> Reviewers -> Challengers -> Forensic Auditor -> Gate.
3. **On failure** (in this order):
   - Retry: nudge stuck agent or re-send task
   - Replace: spawn fresh agent with partial progress
   - Skip: proceed without (only if non-critical)
   - Redistribute: split stuck agent's remaining work
   - Redesign: re-partition decomposition
   - Escalate: report to parent (sub-orchestrators only, last resort)
4. **Succession**: At 16 spawns, write handoff.md, spawn successor
- **Work items**:
  1. Survey and map scope [in-progress]
  2. M1 Interactive Bar Replay System [pending]
  3. M2 Frontend Offloading to Node.js Backend [pending]
  4. M3 Julia LLVM SIMD Engine [pending]
  5. E2E Dual-Track Integration & Verification [pending]
- **Current phase**: 0 (Survey)
- **Current focus**: Parallel Survey of existing code & requirements

## 🔒 Key Constraints
- NEVER write, modify, or create source code files directly.
- NEVER run build/test commands yourself — require workers to do so.
- NEVER investigate or explore the problem at the code level — dispatch Explorers for technical investigation.
- You MAY use file-editing tools ONLY for metadata/state files (.md) in your .agents/ folder.
- DO NOT CHEAT. All implementations must be genuine. Forensic auditor has binary veto.
- Always include ORIGINAL_REQUEST.md path in dispatch prompts.
- Never reuse a subagent after it has delivered its handoff — always spawn fresh.

## Current Parent
- Conversation ID: baee5d42-b3f2-4bd9-bc11-ba671c73ea32
- Updated: not yet

## Key Decisions Made
- Initializing orchestrator_17 workspace and starting Survey phase with 3 parallel explorers/spec miners.

## Team Roster
| Agent | Type | Work Item | Status | Conv ID |
|---|---|---|---|---|
| explorer_survey_replay | teamwork_preview_explorer | Phase 0 Survey: Bar Replay System | running | cf273ca4-5821-467a-84e9-c90dde7aa418 |
| explorer_survey_pine (replaced) | teamwork_preview_explorer | Phase 0 Survey: Frontend Offload & Pine Compiler | errored/killed | 2ad415ba-952f-44c2-aa33-65fdbce0bd2c |
| explorer_survey_pine_2 | teamwork_preview_explorer | Phase 0 Survey: Frontend Offload & Pine Compiler | running | 085d2bb3-c7be-47df-b77e-ae42038098e2 |
| spec_miner_survey_julia | teamwork_preview_spec_miner | Phase 0 Survey: Julia SIMD Engine & Microservice | completed | b0582b52-3082-4f7a-8080-9c0cbd337861 |

## Succession Status
- Succession required: no
- Spawn count: 4 / 16
- Pending subagents: cf273ca4-5821-467a-84e9-c90dde7aa418, 085d2bb3-c7be-47df-b77e-ae42038098e2, b0582b52-3082-4f7a-8080-9c0cbd337861
- Predecessor: orchestrator_16
- Successor: not yet spawned

## Active Timers
- Heartbeat cron: task-28
- Safety timer: none
- On succession: kill all timers before spawning successor
- On context truncation: run `manage_task(Action="list")` — re-create if missing

## Artifact Index
- e:/TRADINGVIEW ADVANCED/.agents/ORIGINAL_REQUEST.md — Original User Request
- e:/TRADINGVIEW ADVANCED/.agents/orchestrator_17/DISPATCH.md — Dispatch log
- e:/TRADINGVIEW ADVANCED/.agents/orchestrator_17/BRIEFING.md — Persistent context
- e:/TRADINGVIEW ADVANCED/.agents/orchestrator_17/progress.md — Liveness & status tracking
- e:/TRADINGVIEW ADVANCED/.agents/orchestrator_17/plan.md — Detailed execution plan
