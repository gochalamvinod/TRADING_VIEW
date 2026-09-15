# Project Execution Plan: Ultra-Low-Latency C++ Acceleration & Engine Modernization

## Phase 0: Survey & Codebase Exploration
- Dispatch 3 parallel Explorers:
  - Explorer 1: Codebase architecture, hot paths, existing C++ / ctypes bindings (`c_bridge.py`, `HFTEngine`, `server.py`).
  - Explorer 2: Technical indicator implementations, resampling logic, and data structures across engine.
  - Explorer 3: Test suite state (`tests/test_tier1_feature_coverage.py`), failure modes, and legacy dependency scan (`numpy`, `pandas`, `requests`).
- Aggregate findings into `PROJECT.md` (Architecture, Feature Inventory, Milestone Decomposition, Interface Contracts, Code Layout).

## Phase 1: Native C++ Core Engine & Build System
- Implement `fast_engine.cpp` / header files with:
  - Active bar tracker & pre-serialized JSON generator
  - Single-pass tick-to-OHLC resampler (time-based & tick-count)
  - Vectorized technical indicators (EMA, SMA, RMA, RSI, MACD, Bollinger Bands, ATR, Supertrend)
- Build system: compile `fast_engine.dll` using `python -m ziglang c++ -shared -O3 -mavx2`.
- Bridge layer: update `c_bridge.py` ctypes wrapper with graceful fallbacks.

## Phase 2: Streaming Integration & Hot Path Wiring
- Wire active bar tracker into `HFTEngine._worker` and `server.py` `/history` route.
- Optimize memory and JSON serialization to achieve < 1.0 ms (target < 0.1 ms) countback=2 queries.
- Verify adaptive polling and candle update continuity.

## Phase 3: Dependency Eradication & Test Suite Compliance
- Eliminate any standalone `numpy`, `pandas`, `requests` imports across active production code.
- Debug and fix all failures in `tests/test_tier1_feature_coverage.py` until all 65 pass cleanly.

## Phase 4: Verification, Benchmarking & Acceptance Audit
- Run latency benchmarks on `/history?countback=2` over 100 requests.
- Run tick resampling benchmarks (100k ticks in < 1.0 ms).
- Run indicator calculation benchmarks (10k bars in < 0.2 ms).
- Forensic integrity audit and final adversarial testing.
