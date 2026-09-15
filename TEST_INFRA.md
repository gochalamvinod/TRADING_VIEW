# E2E Test Infra: TRADINGVIEW ADVANCED

## Test Philosophy
- Opaque-box, requirement-driven.
- Automated browser testing via Playwright and Chrome DevTools Protocol (CDP).
- Microsecond and millisecond timing benchmarks via high-resolution performance timers.

## Feature Inventory & Test Mapping
| # | Feature | Source | Tier 1 | Tier 2 | Tier 3 | Tier 4 |
|---|---------|--------|:------:|:------:|:------:|:------:|
| 1 | Resolution Switching (1S..1M, 1T..100T) | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 2 | UI Buttons & Interactive Controls | ORIGINAL_REQUEST §R1 | 5 | 5 | ✓ | ✓ |
| 3 | Weekend 24/7 BTCUSD Micro-Ticks | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 4 | Ultra-Low Latency Pipeline (<1ms) | ORIGINAL_REQUEST §R2 | 5 | 5 | ✓ | ✓ |
| 5 | Zero-Drift Server Time & UTC Alignment | ORIGINAL_REQUEST §R3 | 5 | 5 | ✓ | ✓ |
| 6 | Tri-Service Dual-Port Integration (9000/9999/8080) | ORIGINAL_REQUEST §R4 | 5 | 5 | ✓ | ✓ |

## Test Architecture
- **Master Test Runner**: `python run_e2e_tests.py`
- **CDP Automated Suite**: `tests/test_cdp_verification.py` / `scripts/run_button_regression.js`
- **HFT & Latency Benchmarks**: `tests/test_hft_latency.py` / `tests/test_tier5_adversarial_backend.py`
- **Time Sync & Drift Verification**: `tests/test_server_time_drift.py`

## Real-World Application Scenarios (Tier 4)
| # | Scenario | Features Exercised | Target |
|---|----------|--------------------|--------|
| 1 | Weekend Live BTCUSD Chart Streaming | 24/7 synthetic ticks, 0ms buffer, 1T/1S/5S dynamic candles | Continuous chart movement |
| 2 | High-Speed Resolution Switching Sequence | Rapid switching 1S -> 5S -> 1T -> 1M -> 1D | Zero blank canvas, zero uncaught errors |
| 3 | Full UI Buttons & Modals Tour | Legend controls, Account Center, Symbol Search, Pine Editor | Zero native dialogs, clean modal state |
| 4 | Tri-Service Dual-Port Concurrency | Requests across 9000, 9999, 8080 simultaneously | 200 OK, identical /time timestamps |
| 5 | Latency Benchmark Under 10k Ticks | Ingestion, ring buffer, WebSocket broadcast | Latency < 1ms |
