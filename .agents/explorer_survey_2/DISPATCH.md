# Dispatch: Explorer 2 (Indicators, Resampling & Technical Specs)

You are Explorer 2 (`teamwork_preview_explorer`).
Your working directory is: `e:\TRADING_VIEW\.agents\explorer_survey_2`
Original request is at: `e:\TRADING_VIEW\ORIGINAL_REQUEST.md` (MUST read first)

## Objective
Investigate the technical indicators and resampling logic across the codebase:
1. Locate where technical indicators (EMA, SMA, RMA, RSI, MACD, Bollinger Bands, ATR, Supertrend) and resampling are currently implemented (Python, Polars, GPU/CuPy, etc.).
2. Document the exact formulas, parameter names, default values, edge-case behavior (e.g. initial NaN handling, length validation), input/output data formats (contiguous double/float arrays, timestamps, etc.).
3. Document tick-to-OHLC resampling specifications: second-based (1S, 5S, etc.) and tick-count bars, timestamp alignment, volume accumulation.
4. Detail the recommended C++ function signatures and vectorized algorithms for maximum performance and AVX2 compatibility.

Write your findings to `e:\TRADING_VIEW\.agents\explorer_survey_2\survey_indicators_resampling.md` and complete `handoff.md`.
Communicate results back to parent via `send_message`.

## 2026-09-15T07:18:35Z
User Request received for Explorer 2:
- Locate all technical indicator implementations across codebase
- For each indicator (EMA, SMA, RMA, RSI, MACD, Bollinger Bands, ATR, Supertrend): identify exact formulas, default parameters, smoothing constants, boundary conditions, array layouts, C++ SIMD AVX2 implementation strategy.
- Analyze tick-to-OHLC resampling: second-based bars (1S, 5S, etc.), tick-count bars, timestamp alignment, single-pass streaming in C++.
- Address User Priority Directive: evaluate GPU (CuPy/NVRTC/CUDA C++) vs CPU C++ AVX2 for batch and streaming.

## 2026-09-15T07:18:53Z
From: parent (6dde6f7e-c0ec-4d2d-a657-50539483ebe0)
**Context**: Codebase Survey & Exploration
**Content**: Urgent User Priority Directive received: "target as faster version possible u can use any language and gpu prefer what matters is speed and accuracy". Maximize speed using the absolute fastest technologies available (C++20 SIMD AVX2 via Clang, GPU CUDA C++ via CuPy/NVRTC on GTX 1650, zero-allocation microsecond memory buffers), while maintaining 100% mathematical accuracy and compatibility. Please factor this heavily into your findings and architectural recommendations.
**Action**: Incorporate into your survey report and handoff.
