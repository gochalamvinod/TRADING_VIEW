# BRIEFING — 2026-09-08T09:54:00Z

## Mission
Perform comprehensive survey of frontend charting, timescale, bar close countdown timer implementation, UDF datafeed, tick streaming, and server time synchronization under strict HFT speed & accuracy directives ($100s per ms delay).

## 🔒 My Identity
- Archetype: explorer
- Roles: frontend-surveyor, timescale-countdown-analyst
- Working directory: e:\TRADINGVIEW ADVANCED\.agents\explorer_survey_2
- Original parent: 88dbf002-5adc-4372-8695-13cb2fb183cc
- Milestone: survey-frontend-countdown

## 🔒 Key Constraints
- Read-only investigation — do NOT implement
- Scope: frontend charting, timescale, countdown timer, UDF datafeed, server time sync, tick handling
- Output to survey_frontend_countdown.md and handoff.md in working directory
- Strictest HFT standards: 0ms buffering, sub-millisecond clock sync, smooth countdown without 1-second stalls, eliminate 10s stale polling
- Communicate via send_message to parent (88dbf002-5adc-4372-8695-13cb2fb183cc)

## Current Parent
- Conversation ID: 88dbf002-5adc-4372-8695-13cb2fb183cc
- Updated: 2026-09-08T09:53:55Z

## Investigation State
- **Explored paths**:
  * `index.html`: Widget initialization, adaptive timeframe manager, websocket /ws/quotes client, polling fallback, datafeed instantiation.
  * `datafeeds/udf/dist/bundle.js`: UDF CompatibleDatafeed, DataPulseProvider, QuotesPulseProvider, getServerTime implementation.
  * `charting_library/bundles/library.e8d44337c84d65489d2c.js`: Internal ChartApi, serverTime calculation, countdown rendering (`pe`), countdown update timer (`_countdownUpdateTimer` at 500ms), Math.round truncation.
  * `server.py`: `/time` returning `str(int(time.time()))`, `/config`, `/quotes`, `/history`, `/ws/quotes`.
  * `hft_engine.py`: High-frequency tick ingestion, ring buffers, `time_msc` capture, WebSocket broadcasting.
- **Key findings**:
  1. `server.py` `/time` truncates time with `int(time.time())`, discarding sub-second milliseconds!
  2. TradingView `library.js` calls `getServerTime` ONCE at init and computes `_serverTimeOffset = e - (new Date).valueOf() / 1e3`. Due to integer truncation in `/time`, this initial clock offset can be wrong by up to 999ms!
  3. `datafeed.js` (`bundle.js`) parses `/time` using `parseInt(s)`!
  4. TradingView's internal countdown (`pe._countdownText()`) rounds the countdown remaining time using `Math.round((n - this._currentTime()) / 1e3)` to whole seconds.
  5. The internal countdown update timer is scheduled via `setInterval(..., 500)` (every 500ms), which checks if `_countdownText() !== _previousCountdown`. Because remaining seconds is rounded, it creates 1-second step jumps and up to 500ms hesitation/quantization lag!
  6. On 1S timeframe, `_countdownText()` explicitly returns `""` (no native countdown for 1s bars).
  7. Real-time tick integration: While `/ws/quotes` streams ticks to `activeQuoteListeners` in `index.html`, quotes currently only call `sub.callback([qData])` for quotes (DOM/Watchlist/Quote summary), NOT `subscribeBars` (`onRealtimeCallback`)! Candle bars in `index.html` rely on `DataPulseProvider` polling `/history` every `barPollIntervalMs` (150-1000ms), causing candle update latency.
- **Unexplored areas**:
  * Examine how `subscribeBars` callback (`onRealtimeCallback`) can be fed directly from live ticks.
  * Timescale marks & session configuration interaction with server time.
  * Custom countdown overlay / RAF sub-second timer design.

## Key Decisions Made
- Documenting all root causes of countdown stalls, jumping, and clock drift with exact code citations.
- Synthesizing findings and recommendations for HFT-grade sub-millisecond synchronization.

## Artifact Index
- DISPATCH.md — Received task prompts and directives
- BRIEFING.md — Working memory and status
- progress.md — Liveness heartbeat
