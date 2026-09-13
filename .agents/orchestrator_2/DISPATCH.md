# Dispatch to Project Orchestrator 2

## Mission
Eliminate all lag, countdown jumping, and timescale clock drift in the TradingView chart, ensuring the bar close countdown timer and server time synchronize with MetaTrader 5 with sub-millisecond precision and zero truncation delay. Zero tolerance for even 1ms delay. Execute zero-overhead trade & order pipeline, and deliver an automated clock synchronization & countdown verification suite.

## Working Directory
E:\TRADINGVIEW ADVANCED
Agent folder: E:\TRADINGVIEW ADVANCED\.agents\orchestrator_2

## Original Request & Directives
Authoritative source: E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md

### R1. High-Resolution Server Time & Truncation-Free Timescale Synchronization
- Eliminate integer-second truncation jitter in /time and timescale clock queries, replacing 1-second quantized timestamps with high-resolution sub-second timekeeping.
- Synchronize server time directly with MetaTrader 5 broker server time (time_msc) and true UTC, eliminating any clock skew between broker ticks, backend server, and the client browser.
- Use Windows timeBeginPeriod(1) to enforce 1ms OS timer resolution.

### R2. Smooth Real-Time Bar Close Countdown Timer
- Ensure TradingView's bar close countdown timer (e.g. countdown to close on 1S, 5S, 1m charts) updates smoothly in real time without 1-second stalls, jumping, or lagging behind the actual arrival of MT5 ticks.
- Ensure the UDF datafeed synchronization frequency (getServerTime / updateFrequency) aligns continuously with real-time quote feeds rather than relying on stale 10-second polling.
- Implement Cristian's algorithm RTT latency compensation (RTT / 2) and continuous EWMA recalibration.
- Direct zero-latency WebSocket bar push to subscribeBars (onRealtimeCallback) with 0ms buffering delay.
- Patch PriceAxisView._countdownText to use Math.ceil and accelerate timer animation loop to 60 FPS.

### R3. Automated Clock Synchronization & Countdown Verification Suite
- Provide an automated test suite verifying that clock drift between MT5 tick arrival, the server time endpoint, and the chart timescale is under 1 millisecond.
- Programmatically verify that the bar close countdown timer decrements continuously and smoothly without hesitation or drift under live market conditions.
- Maintain 100% pass rate across all existing test suites without regression.

### R4. Zero-Overhead Trade & Order Execution Pipeline
- Eliminate all pre-trade dispatch delays, redundant IPC queries, and threadpool hopping before mt5.order_send().
- Convert trade routes (/trade/order, /trade/pending, /trade/modify, /trade/close, /trade/close_all) to async def.
- Resolve prices and symbols directly from in-memory atomic cache with 0ms delay (< 2us RAM resolution).
- Zero-copy request handling and immediate serialization via orjson.

## Previous Context & Discovery
- Review .agents/orchestrator_1/ and PROJECT.md for Features F27-F38 and Milestones M17, M18, M19.
- Check existing implementations in server.py, hft_engine.py, datafeeds/udf/dist/bundle.js, index.html, and tests/.
- Maintain active progress updates in .agents/orchestrator_2/progress.md.

## 2026-09-08T10:27:41Z
You are the Project Orchestrator for E:\TRADINGVIEW ADVANCED.
Your working directory is E:\TRADINGVIEW ADVANCED\.agents\orchestrator_2.
Authoritative user request: E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md.
Detailed dispatch instructions: E:\TRADINGVIEW ADVANCED\.agents\orchestrator_2\DISPATCH.md.

Mission:
Eliminate all lag, countdown jumping, and timescale clock drift in the TradingView chart, ensuring the bar close countdown timer and server time synchronize with MetaTrader 5 with sub-millisecond precision and zero truncation delay. Zero tolerance for even 1ms delay. Execute zero-overhead trade & order pipeline, and deliver an automated clock synchronization & countdown verification suite.

Key tracks to drive:
1. High-Resolution Server Time & Truncation-Free Timescale Synchronization (R1 / M17).
2. Smooth Real-Time Bar Close Countdown Timer & WebSocket Push (R2 / M18).
3. Automated Clock Sync & Countdown Verification Suite & Regression Pass (R3 / M19).
4. Zero-Overhead Trade & Order Execution Pipeline (R4 / M17).
