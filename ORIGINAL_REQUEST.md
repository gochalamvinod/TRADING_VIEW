# Original User Request

## Initial Request — 2026-09-15T07:16:46Z

Implement ultra-low-latency C++ acceleration for all performance-critical hot paths in the trading engine, achieve sub-millisecond active bar streaming via /history countback polling, and ensure zero legacy dependencies (numpy, pandas, requests) with 100% test coverage pass.

Working directory: e:\TRADING_VIEW
Integrity mode: development

## Requirements

### R1. Native C++ Core Engine for Hot Paths
- Implement a high-performance C++ shared library (fast_engine.dll) compiled with -O3 -mavx2 via Clang targeting Windows x86_64 using python -m ziglang c++.
- Implement C++ active bar tracker and pre-serialized JSON generator for incoming ticks and /history?countback=2 queries.
- Implement single-pass C++ tick-to-OHLC resampler for second-based (1S, 5S, etc.) and tick-count bars.
- Implement C++ vectorized calculation functions for technical indicators (EMA, SMA, RMA, RSI, MACD, Bollinger Bands, ATR, Supertrend).
- Provide seamless zero-overhead Python ctypes bindings in c_bridge.py with graceful fallback to GPU/Polars.

### R2. Sub-Millisecond Active Bar Streaming
- Wire the C++ active bar engine directly into HFTEngine._worker and server.py /history route.
- Serve /history?symbol=...&resolution=...&countback=2 directly from memory in < 1.0 ms (target < 0.1 ms).
- Maintain live candle updates driven by adaptive polling without requiring WebSockets.

### R3. Dependency Eradication and Test Suite Compliance
- Verify zero standalone imports of numpy, pandas, or requests across all active production codebase files.
- Fix all failing tests in tests/test_tier1_feature_coverage.py so all 65 tests pass cleanly.

## Acceptance Criteria

### Performance & Latency
- [ ] Direct /history?symbol=EURUSD.&resolution=1&countback=2 response latency is measured under 1.0 ms across 100 consecutive requests.
- [ ] C++ tick resampling handles 100,000 ticks in under 1.0 ms.
- [ ] C++ technical indicator calculations for 10,000 bars execute in under 0.2 ms.

### Integrity & Compatibility
- [ ] The C++ shared library builds cleanly via python -m ziglang c++ -shared -O3 -mavx2 without MSVC dependency.
- [ ] All 65 tests in tests/test_tier1_feature_coverage.py pass with 0 failures and 0 errors.
- [ ] No direct imports of numpy, pandas, or requests exist outside compatibility shims.

## Follow-up — 2026-09-15T07:17:59Z

User Priority Directive: "target as faster version possible u can use any language and gpu prefer what matters is speed and accuracy"

Please incorporate this into the architecture and execution immediately:
1. Maximize speed and throughput using the absolute fastest technologies available (C++20 SIMD AVX2/AVX-512 via Clang, GPU CUDA C++ via CuPy/NVRTC on the GTX 1650, or whatever achieves lowest nanosecond/microsecond latency).
2. Maintain 100% mathematical accuracy and compatibility across all tests and live polling.
3. Optimize for < 1.0 ms (target microsecond-level) /history active bar delivery.
