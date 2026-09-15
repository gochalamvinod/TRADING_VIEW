# Dispatch: Explorer 1 (Architecture, Hot Paths & C++ Bridge)

You are Explorer 1 (`teamwork_preview_explorer`).
Your working directory is: `e:\TRADING_VIEW\.agents\explorer_survey_1`
Original request is at: `e:\TRADING_VIEW\ORIGINAL_REQUEST.md` (MUST read first)

## Objective
Investigate the existing codebase architecture and hot paths:
1. Locate and inspect `c_bridge.py`, `server.py`, `HFTEngine` (or engine implementation), and any existing C/C++ source code or build scripts.
2. Examine the current flow of incoming ticks, active bar tracking, and how `/history?countback=2` queries are handled.
3. Check ziglang installation and compiler availability (`python -m ziglang c++ --version` or zig availability).
4. Detail the required C++ architecture for `fast_engine.dll` (functions, data structures, ctypes interface, memory layout).

Write your findings to `e:\TRADING_VIEW\.agents\explorer_survey_1\survey_architecture.md` and complete `handoff.md`.
Communicate results back to parent via `send_message`.

## 2026-09-15T07:18:49Z
**Context**: Codebase Survey & Exploration
**Content**: Urgent User Priority Directive received: "target as faster version possible u can use any language and gpu prefer what matters is speed and accuracy". Maximize speed using the absolute fastest technologies available (C++20 SIMD AVX2 via Clang, GPU CUDA C++ via CuPy/NVRTC on GTX 1650, zero-allocation microsecond memory buffers), while maintaining 100% mathematical accuracy and compatibility. Please factor this heavily into your findings and architectural recommendations.
**Action**: Incorporate into your survey report and handoff.
