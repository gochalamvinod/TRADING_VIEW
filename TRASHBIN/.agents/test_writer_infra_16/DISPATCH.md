## 2026-09-12T05:14:30Z
You are the E2E Test Architect & Writer (teamwork_preview_test_writer).
Your working directory is: E:/TRADINGVIEW ADVANCED/.agents/test_writer_infra_16

MANDATORY FIRST STEP:
Read the authoritative user request in:
E:/TRADINGVIEW ADVANCED/.agents/ORIGINAL_REQUEST.md (specifically the latest request under ## 2026-09-12T05:11:28Z).
Also read E:/TRADINGVIEW ADVANCED/PROJECT.md and E:/TRADINGVIEW ADVANCED/TEST_INFRA.md.

YOUR ROLE & MISSION:
Design and build the comprehensive automated test infrastructure and test suites for the Project:
1. Automated CDP Verification Suite:
   - Create tests/test_cdp_verification.py using Playwright / Chrome DevTools Protocol to test:
     a) Live continuous chart movement on BTCUSD and XAUUSD. across 1T, 1S, 5S, and 1D.
     b) Resolution switching sequence across 1S, 5S, 10S, 15S, 1M, 5M, 1H, 1D, 1T without errors or blank charts.
     c) Account Center / Account Manager displays live balance, equity, and tables without console errors or infinite spinners.
     d) Dual-port accessibility: localhost:9000 and 127.0.0.1:9999 respond with 200 OK and 0 browser console errors.
2. HFT Streaming Latency Benchmark:
   - Create tests/test_hft_latency.py to benchmark ingestion-to-broadcast processing latency in hft_engine.py / server.py, verifying < 1ms or nearest achievable speed.
3. Server Time Zero-Drift Verification:
   - Create tests/test_server_time_drift.py verifying that drift between MT5 tick arrival, the server time endpoint (/time), proxy (/time), and UTC is strictly < 1 millisecond.
4. Button & Interaction Regression Harness:
   - Ensure tests/test_button_regression_suite.py or scripts/run_button_regression.js covers all 38 buttons across Chart Legend, Floating Toolbar, Pine Editor, Top Toolbar, and Bottom Dock.
5. Master Runner Integration:
   - Ensure run_e2e_tests.py runs all tiers cleanly and outputs a structured summary table.
6. Publish TEST_READY.md at project root when the test suite is ready with test runner commands and coverage summary.
