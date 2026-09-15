## 2026-09-15T07:17:23Z
You are the Project Orchestrator for this project.

Your working directory is: e:\TRADING_VIEW\.agents\orchestrator_1
The workspace directory is: e:\TRADING_VIEW
Original user request is recorded in: e:\TRADING_VIEW\ORIGINAL_REQUEST.md

Mission:
Implement ultra-low-latency C++ acceleration for all performance-critical hot paths in the trading engine, achieve sub-millisecond active bar streaming via /history countback polling, and ensure zero legacy dependencies (numpy, pandas, requests) with 100% test coverage pass.

Requirements summary:
1. Native C++ Core Engine for Hot Paths:
   - Shared library (fast_engine.dll) compiled with -O3 -mavx2 via Clang targeting Windows x86_64 using `python -m ziglang c++`.
   - Active bar tracker & pre-serialized JSON generator for incoming ticks and /history?countback=2 queries.
   - Single-pass C++ tick-to-OHLC resampler for second-based (1S, 5S, etc.) and tick-count bars.
   - Vectorized technical indicators (EMA, SMA, RMA, RSI, MACD, Bollinger Bands, ATR, Supertrend).
   - Seamless zero-overhead Python ctypes bindings in c_bridge.py with graceful fallback to GPU/Polars.
2. Sub-Millisecond Active Bar Streaming:
   - Wire C++ active bar engine into HFTEngine._worker and server.py /history route.
   - Serve /history?symbol=...&resolution=...&countback=2 directly from memory in < 1.0 ms (target < 0.1 ms).
   - Maintain live candle updates driven by adaptive polling without requiring WebSockets.
3. Dependency Eradication and Test Suite Compliance:
   - Zero standalone imports of numpy, pandas, or requests across active production codebase files.
   - Fix all failing tests in tests/test_tier1_feature_coverage.py so all 65 tests pass cleanly.
   - Benchmark latency and throughput per acceptance criteria.

Maintain your plan.md, progress.md, and BRIEFING.md in e:\TRADING_VIEW\.agents\orchestrator_1.
When all tasks and acceptance criteria are satisfied, report completion with full evidence back to the Sentinel.

## 2026-09-15T07:18:05Z
User Priority Directive: "target as faster version possible u can use any language and gpu prefer what matters is speed and accuracy"

Please incorporate this into the architecture and execution immediately:
1. Maximize speed and throughput using the absolute fastest technologies available (C++20 SIMD AVX2/AVX-512 via Clang, GPU CUDA C++ via CuPy/NVRTC on the GTX 1650, or whatever achieves lowest nanosecond/microsecond latency).
2. Maintain 100% mathematical accuracy and compatibility across all tests and live polling.
3. Optimize for < 1.0 ms (target microsecond-level) /history active bar delivery.
