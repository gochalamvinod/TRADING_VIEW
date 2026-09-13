# BRIEFING — 2026-09-08T16:06:00Z

## Mission
Investigate DOM Ladder Dynamic Anchoring (`dynamicModeState: true`, centering around live Ask/Bid spread) and Position/P&L widget real-time synchronization in TradingView Advanced Charts.

## 🔒 My Identity
- Archetype: explorer
- Roles: explorer_dom_ladder
- Working directory: e:\TRADINGVIEW ADVANCED\.agents\explorer_dom_ladder
- Original parent: fd039a4f-10aa-4c4a-8fe8-709c22e7e41b
- Milestone: DOM Ladder Dynamic Anchoring & Position Sync Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Investigate DOM Ladder dynamic centering & position sync
- Produce report.md and handoff.md in working directory
- Do NOT modify or edit any source code

## Current Parent
- Conversation ID: fd039a4f-10aa-4c4a-8fe8-709c22e7e41b
- Updated: 2026-09-08T15:46:45Z

## Investigation State
- **Explored paths**:
  - `charting_library/bundles/dom-panel.81d8dd298ff835119bb5.js`
  - `charting_library/bundles/trading.5355aa53ba59846168ee.js`
  - `charting_library/bundles/library.e8d44337c84d65489d2c.js`
  - `broker-sample/dist/bundle.js`
  - `mt5_broker.js`
  - `index.html`
  - `PROJECT.md`
  - `ORIGINAL_REQUEST.md`
- **Key findings**:
  - DOM Centering formula: `topIndex = floor((bestBid + bestAsk) / 2) + floor(height / 2)`. Dynamic centering only triggers in `updateData(depthPayload)`, not `updateLast(price)`.
  - Centering failures caused by: throttled 350ms DOM updates decoupled from WebSocket ticks, inverted button UI state in `Ze`, and a bug in `checkAutoCenter()` that permanently aborts the fallback auto-centering timer.
  - DOM Position/P&L sync failures caused by: smoking-gun bug in `mt5_broker.js` calling `host.plUpdate(pos.symbol, profit)` instead of `host.plUpdate(posId, profit)` (DOM panel subscribes under `position.id`); `DOMPanel` subscribing only to `positionUpdate` and ignoring `positionPartialUpdate`; and stale position caching.
- **Unexplored areas**: None. All 4 target questions fully investigated with exact file paths and line numbers.

## Key Decisions Made
- Fully documented root causes and provided an exact, actionable fix blueprint in `report.md` and `handoff.md`.

## Artifact Index
- `e:\TRADINGVIEW ADVANCED\.agents\explorer_dom_ladder\DISPATCH.md` — Incoming messages log
- `e:\TRADINGVIEW ADVANCED\.agents\explorer_dom_ladder\progress.md` — Liveness and progress tracker
- `e:\TRADINGVIEW ADVANCED\.agents\explorer_dom_ladder\report.md` — Comprehensive analysis report
- `e:\TRADINGVIEW ADVANCED\.agents\explorer_dom_ladder\handoff.md` — 5-component handoff report
