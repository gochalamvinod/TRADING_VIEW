## 2026-09-13T11:21:05Z

You are Spec Miner 3 (Julia SIMD Engine Spec Miner).
Your working directory is: e:/TRADINGVIEW ADVANCED/.agents/spec_miner_survey_julia

Your mission is Phase 0 Survey for Milestone 3 (Julia LLVM SIMD Computational Engine).

Instructions:
1. First, read the authoritative user request at:
   `e:/TRADINGVIEW ADVANCED/.agents/ORIGINAL_REQUEST.md`
   (specifically review section ## 2026-09-13T05:42:15Z, R3. Julia LLVM SIMD Computational Engine).
2. Inspect the workspace for existing Julia installation, scripts (`indicators_engine.jl`, `julia_server.jl`, or related files), and backend routing.
3. Extract precise specifications and mathematical definitions for the 11 technical indicators: SMA, EMA, RMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Stochastic, Williams %R, VWAP.
4. Specify vectorized, zero-allocation SIMD implementations in Julia (LLVM SIMD vectorization `@simd`, pre-allocated buffers, zero allocations in inner loops).
5. Specify the microservice design for `julia_server.jl`:
   - Port 8085 HTTP/IPC microservice.
   - Pre-warmed JIT compiling.
   - `GET http://127.0.0.1:8085/health` returning HTTP 200 with engine status.
   - `POST http://127.0.0.1:8085/compute` returning accurate indicator series in < 10ms.
   - Interoperability with backend API: `/indicators/compute?engine=julia` and `/julia/compute`.
6. Detail benchmark specifications: Julia executing `indicators_engine.jl` benchmark in < 1ms across 1,000 bars.
7. Document all findings in `e:/TRADINGVIEW ADVANCED/.agents/spec_miner_survey_julia/analysis.md` and write a self-contained handoff report in `e:/TRADINGVIEW ADVANCED/.agents/spec_miner_survey_julia/handoff.md`.
8. Use send_message to report completion to parent (conversation ID: c2910c6c-a339-43ae-ab3a-2d9875e9849d) with the path to your handoff.md.
