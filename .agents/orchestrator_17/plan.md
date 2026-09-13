# Execution Plan — Orchestrator 17

## Objectives
1. **R1: Interactive Bar Replay System**
   - Integrate native scissors bar selection via TradingView `widget.activeChart().requestSelectBar()` triggered from a dedicated 'Replay' header toolbar button.
   - Header replay controls: Replay Toggle Button, Play/Pause Button (SVG icons), Step Forward Button (+1 bar), Speed Selector Dropdown (0.1x, 0.3x, 0.5x, 1x, 3x, 5x, 10x), Exit Replay Button (restores live MT5 tick streaming without full page reload).
   - Enhance UDF Datafeed to slice history at selected cutoff timestamp, buffer future candles, and stream sequentially to `onRealtimeCallback`.
   - Complete LocalStorage chart and drawing template save/load adapter.

2. **R2: 95% Frontend Offloading to Node.js Backend**
   - Remove client-side `PineTS-main/dist/pinets.min.browser.js` (606 KB) from `index.html`.
   - Offload 100% of Pine Script transpilation, AST generation, syntax error diagnostics, and indicator descriptor creation to pre-warmed in-memory Node.js backend via `POST /pine/transpile` and `POST /pine/compile`.
   - Refactor `pine_indicators.js` to eliminate embedded duplicate compiler bundle.

3. **R3: Julia LLVM SIMD Computational Engine**
   - Implement vectorized, zero-allocation technical indicators in Julia (`indicators_engine.jl`): SMA, EMA, RMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Stochastic, Williams %R, and VWAP.
   - Maintain high-throughput Julia HTTP/IPC microservice (`julia_server.jl` on port 8085) with pre-warmed JIT compiling.
   - Expose Julia computation across backend API (`/indicators/compute?engine=julia` and `/julia/compute`).

## Phases
- **Phase 0: Survey & Codebase Reconnaissance**
  - Explorer 1 (Bar Replay & Chart controls / UDF Datafeed / LocalStorage)
  - Explorer 2 (Frontend Lightening & Node.js backend Pine compiler / Transpiler)
  - Explorer 3 (Julia Engine indicators_engine.jl & microservice julia_server.jl)
- **Phase 1: Project Architecture & Decomposition**
  - Consolidate findings into `PROJECT.md` & `TEST_INFRA.md`
  - Assign feature inventory and define interface contracts
- **Phase 2: Implementation & E2E Testing Dual Track**
  - Track A: Implement M1 (Bar Replay), M2 (Frontend Offload), M3 (Julia SIMD Engine)
  - Track B: Construct E2E tests (Tiers 1-4)
- **Phase 3: Verification, Review & Adversarial Auditing**
  - Reviewers (Code quality, interface conformance)
  - Challengers (Stress tests, benchmark execution, CDP browser verification)
  - Forensic Auditor (Integrity forensics, non-negotiable zero-tolerance veto)
- **Phase 4: Synthesis & Reporting**
  - Gate evaluation
  - Final human report and delivery
