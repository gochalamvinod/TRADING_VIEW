## 2026-09-11T07:48:00Z
MANDATORY INSTRUCTION:
Read the authoritative user request at: e:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md (specifically see header ## 2026-09-11T07:10:27Z).
Read the scope document at: e:\TRADINGVIEW ADVANCED\.agents\orchestrator_14\SCOPE.md.
Read the survey findings at:
- e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_2\analysis.md
- e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_explorer_survey_2\handoff.md

EXCLUSIVE WRITE OWNERSHIP:
You exclusively own:
- server.py
- seconds.py
- ticks.py
- hft_engine.py
- index.html (specifically the datafeed and streaming hooks)
Do NOT edit pine_editor_ide.js, pine_indicators.js, or pine_editor.css.

YOUR MISSION (Milestone M33 - Requirement R4):
100,000x Speed Backend & Realtime Stability:
1. Fix "Incremental update failed. Starting full update" loop in console:
   - In server.py (line 1084), pass integer epoch timestamp int(safe_to_broker) into mt5.copy_rates_from instead of timezone-aware datetime to avoid Windows C-extension clamping forward to the live bar.
   - In seconds.py (line 311) and ticks.py (line 224), remove - hours_offset from UTC ticks returned by copy_ticks_range (which is already in true UTC).
   - In index.html (lines 561-576), in wrappedOnHistory:
     * Filter incremental bars: if not firstDataRequest, filter bars: bars = bars.filter(b => b.time <= periodParams.to * 1000).
     * Only update sub.currentBar and _lastHistoricalBars when periodParams.firstDataRequest === true.
     * Silence _dataPulseProvider HTTP polling when WebSocket quote stream is active.
2. Fix chart spinner locks & optimize throughput to 100,000x:
   - In hft_engine.py, add copy_rates_from, copy_rates_range, copy_rates_from_pos, and symbol_info to _FAST_READ_METHODS so read queries never block under self._lock.
   - Size and pre-warm ContiguousTickRingBuffer to 250k ticks in RAM with UTC normalization at ingestion for 0ms buffering.
   - In index.html, add a 3-second safety watchdog in getBars and resolveSymbol to cleanly return { noData: true } on timeout so chart spinner never hangs.

VERIFICATION:
- Run backend verification:
  pytest tests/test_tier5_adversarial_backend.py -v
  python -c "import MetaTrader5 as mt5, datetime; mt5.initialize(); ts = 1789101420; r = mt5.copy_rates_from('XAUUSD.', mt5.TIMEFRAME_M1, ts, 5); print('End rate time:', r[-1]['time'], 'Requested ts:', ts)"
- Confirm 0 incremental update failed loops and instant chart loading.
- Write your completion report to e:\TRADINGVIEW ADVANCED\.agents\teamwork_preview_worker_backend_1\handoff.md.
- Send a completion message to parent when finished.
