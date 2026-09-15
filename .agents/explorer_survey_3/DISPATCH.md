# Dispatch: Explorer 3 (Test Suite Compliance & Dependency Eradication)

You are Explorer 3 (`teamwork_preview_explorer`).
Your working directory is: `e:\TRADING_VIEW\.agents\explorer_survey_3`
Original request is at: `e:\TRADING_VIEW\ORIGINAL_REQUEST.md` (MUST read first)

## Objective
Investigate the test suite and legacy dependencies:
1. Examine `tests/test_tier1_feature_coverage.py` and run tests (using pytest via worker or inspecting failure outputs) to identify which of the 65 tests are failing, erroring, or passing, and what the root causes are.
2. Scan the entire codebase (`.py` files) for standalone/direct imports of `numpy`, `pandas`, and `requests`. Document every file and line where they appear, and how compatibility shims or alternatives (e.g. Polars, pure Python, ctypes, urllib) should replace them.
3. Check the benchmark and performance tests or criteria (latency measurements for `/history?countback=2`, 100k ticks resampling in < 1ms, 10k bars indicator calculation in < 0.2ms).

Write your findings to `e:\TRADING_VIEW\.agents\explorer_survey_3\survey_tests_dependencies.md` and complete `handoff.md`.
Communicate results back to parent via `send_message`.

## 2026-09-15T07:18:35Z
You are Explorer 3, a Test Suite & Dependency Explorer.
Your working directory is: e:\TRADING_VIEW\.agents\explorer_survey_3
Workspace root: e:\TRADING_VIEW
Original user request is at: e:\TRADING_VIEW\ORIGINAL_REQUEST.md (MUST read first)
Dispatch details are in: e:\TRADING_VIEW\.agents\explorer_survey_3\DISPATCH.md

Your mission:
Investigate test suite compliance, failing tests, and legacy dependencies:
1. Examine `tests/test_tier1_feature_coverage.py` and run tests (using pytest via a worker or by running the test suite) to identify:
   - How many of the 65 tests pass, fail, or error currently.
   - For every failing or erroring test: test name, assertion failure or exception traceback, and root cause analysis.
2. Examine all other test files in `tests/` and document what is tested.
3. Scan the entire production codebase (`.py` files, excluding tests if applicable or including all as specified) for standalone/direct imports of `numpy`, `pandas`, and `requests`.
   - List every file and line where `import numpy`, `import pandas`, `import requests`, `from numpy import ...`, `from pandas import ...`, `from requests import ...` occur.
   - Propose exact drop-in replacements (e.g. Polars, pure Python, ctypes buffers, `urllib.request` / `urllib3` / `httpx`, or standard library) to ensure zero direct imports outside compatibility shims.
4. Review the Acceptance Criteria benchmarks:
   - Direct /history?symbol=EURUSD.&resolution=1&countback=2 latency measurement harness (< 1.0 ms over 100 requests).
   - 100,000 ticks resampling benchmark (< 1.0 ms).
   - 10,000 bars indicator calculations benchmark (< 0.2 ms).

Write your findings to `e:\TRADING_VIEW\.agents\explorer_survey_3\survey_tests_dependencies.md` and your handoff to `e:\TRADING_VIEW\.agents\explorer_survey_3\handoff.md`.
When finished, send a message to parent summarizing your findings and report file paths.

## 2026-09-15T07:18:57Z
[From parent: 6dde6f7e-c0ec-4d2d-a657-50539483ebe0]
**Context**: Codebase Survey & Exploration
**Content**: Urgent User Priority Directive received: "target as faster version possible u can use any language and gpu prefer what matters is speed and accuracy". Maximize speed using the absolute fastest technologies available (C++20 SIMD AVX2 via Clang, GPU CUDA C++ via CuPy/NVRTC on GTX 1650, zero-allocation microsecond memory buffers), while maintaining 100% mathematical accuracy and compatibility. Please factor this heavily into your findings and architectural recommendations.
**Action**: Incorporate into your survey report and handoff.
