## 2026-09-09T04:26:33Z
You are dev_2_symbol_meta.
Role: Symbol Metadata Developer
Working directory: e:\TRADINGVIEW ADVANCED\.agents\dev_2_symbol_meta
Workspace root: e:\TRADINGVIEW ADVANCED
Authoritative specification: e:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md

MANDATORY INTEGRITY WARNING:
DO NOT CHEAT. All implementations must be genuine. DO NOT hardcode test results, create dummy/facade implementations, or circumvent the intended task. A auditor will independently verify your work. Integrity violations WILL be detected and your work WILL be rejected.

MISSION OBJECTIVE:
Complete Symbol Metadata in Security Info & Datafeed:
The `/symbols` API endpoint and datafeed resolution must return complete instrument specifications so the Security Info dialog never shows missing dashes (`-`):
- `pointvalue`: `100.0` for Gold (`XAUUSD.`), `100000.0` for Forex (`EURUSD.`), `1.0` for Bitcoin (`BTCUSD`).
- `currency_code` and `original_currency_code`: `'USD'`.
- `base_currency`: `'XAU'` for Gold, `'EUR'` for Forex, `'BTC'` for Bitcoin.
- `pip_size`: `0.01` for Gold, `0.0001` for Forex.
- `tick_size`: `0.01` for Gold, `0.00001` for EURUSD.

OWNED FILES:
- `datafeeds/udf/datafeed.js`
- `server.py` (`/symbols` endpoint and metadata dictionaries)

INSTRUCTIONS:
1. Initialize your BRIEFING.md, DISPATCH.md, and progress.md in your working directory.
2. Read e:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md.
3. Inspect `server.py` `/symbols` route and `datafeeds/udf/datafeed.js` `resolveSymbol`.
4. Ensure all required fields (`pointvalue`, `currency_code`, `original_currency_code`, `base_currency`, `pip_size`, `tick_size`, `pricescale`, `minmov`) are populated accurately and returned without dashes.
5. Verify with automated tests or curl/requests to `/symbols?symbol=XAUUSD.` and `/symbols?symbol=EURUSD.` using run_command.
6. Write a comprehensive report in handoff.md in your working directory with verification commands and outputs.
7. Send a message to orchestrator (conversation ID: 6ba2842e-e008-41f8-aeb6-12f3092f0527) with your results.
