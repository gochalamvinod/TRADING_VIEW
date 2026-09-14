# BRIEFING — 2026-09-08T16:05:00Z

## Mission
Investigate why instrument specifications display as dashes in TradingView's native Security Info dialog and determine exact fixes for server.py and frontend datafeed.

## 🔒 My Identity
- Archetype: explorer
- Roles: explorer, investigator
- Working directory: e:\TRADINGVIEW ADVANCED\.agents\explorer_security_info
- Original parent: fd039a4f-10aa-4c4a-8fe8-709c22e7e41b
- Milestone: Security Info Investigation

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Do NOT edit or modify source code
- Write only to e:\TRADINGVIEW ADVANCED\.agents\explorer_security_info
- Output report.md and handoff.md

## Current Parent
- Conversation ID: fd039a4f-10aa-4c4a-8fe8-709c22e7e41b
- Updated: 2026-09-08T16:05:00Z

## Investigation State
- **Explored paths**:
  - `server.py` (`/symbols` endpoint at line 681-738)
  - `charting_library/bundles/symbol-info-dialog-impl.23e8feddd0326a1feabb.js`
  - `charting_library/bundles/library.e8d44337c84d65489d2c.js` (module 162172 currency & symbol helpers)
  - `charting_library/bundles/en.8622.9181e2b364297c860b4f.js`
  - `datafeeds/udf/dist/bundle.js`
  - `mt5_broker.js`
  - `index.html` (`datafeed.resolveSymbol` wrapper)
- **Key findings**:
  - `pointvalue` is read directly from `symbolInfo["pointvalue"]`; currently omitted in `server.py`.
  - `currency_code` requires `original_currency_code` or `currency_code` for `symbolOriginalCurrency` to return non-null; currently omitted in `server.py`.
  - `pip_size` is mathematically calculated by TradingView as `minmove2 / pricescale`; requires `minmove2 > 0`. Because `minmove2` is omitted in `server.py`, the field is hidden or returns `null` (`"-"`). For 5-digit Forex `minmove2 = 10` gives `0.0001`; for Gold `minmove2 = 1` gives `0.01`.
  - `tick_size` is calculated as `minmov / pricescale`. MT5 `trade_tick_size` must be synchronized.
- **Unexplored areas**: None. Full evidence chain complete.

## Key Decisions Made
- Successfully reverse-engineered the exact TradingView bundle logic for Security Info dialog.
- Provided concrete code snippets and verification methods for `server.py`, `index.html`, and `mt5_broker.js`.

## Artifact Index
- DISPATCH.md — Dispatch instructions
- BRIEFING.md — Working memory and status
- progress.md — Heartbeat and activity log
- report.md — Comprehensive findings & proposed code changes
- handoff.md — 5-component handoff report
