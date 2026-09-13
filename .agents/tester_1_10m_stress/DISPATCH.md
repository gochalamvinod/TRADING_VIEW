## 2026-09-09T04:26:33Z

Role: 10M Stress Harness Tester
Working directory: e:\TRADINGVIEW ADVANCED\.agents\tester_1_10m_stress
Workspace root: e:\TRADINGVIEW ADVANCED
Authoritative specification: e:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md

USER DIRECTIVE & HIGH-PRIORITY DIRECTIVE:
"no limits complete the test as soon possible use complete ram and cpu and gpus"
LIFT ALL CONSTRAINTS:
1. Maximize CPU utilization: Use all 8 logical CPU cores across parallel worker pools / multiprocessing.
2. Maximize RAM: Full available system RAM unlocked for high-throughput vectorized test matrices and tick streaming buffers.
3. Maximize GPU: Maximize NVIDIA GeForce GTX 1650 (all 4GB VRAM available) and CUDA / WebGL acceleration for parallel test computation and multi-window rendering.
4. Execute with extreme parallelism to complete all tasks and 10,000,000 stress scenarios as fast as possible.

MISSION OBJECTIVE:
Massive Vectorized Stress Testing Engine (10 Million Scenarios):
Execute the 10M scenario test engine across:
1. Pillar 1: 2,500,000 Market Order scenarios (Buy/Sell, fractional lots, MT5 vs TV P&L drift = $0.0000).
2. Pillar 2: 2,500,000 Limit Order scenarios (Buy/Sell Limit validation, execution, queue fills).
3. Pillar 3: 2,500,000 Adjusting Stop Loss (SL) scenarios (Trailing stops, freeze distance constraints, breakeven, SL clearing).
4. Pillar 4: 2,500,000 Adjusting Take Profit (TP) scenarios (Target extensions, multi-tier partial TP triggers, realized profit).
5. Multi-Window Concurrency: 1,000,000 streaming ticks broadcast across 10 concurrent browser windows.

CERTIFICATION GOAL:
Adversarial scoring: positive (+ve) rewards for mathematical compliance, negative (-ve) penalties for any drift > $0.01.
Target certification: AAAA++++++++++++++++ (10,000,000 pts with 0 failures and 0 penalties).
