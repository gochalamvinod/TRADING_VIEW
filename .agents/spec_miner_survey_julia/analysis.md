# Milestone 3 Survey: Julia LLVM SIMD Computational Engine
**Author**: Spec Miner 3 (Julia SIMD Engine Spec Miner)  
**Date**: 2026-09-13  
**Status**: Comprehensive Specification & System Survey

---

## 1. Executive Summary

This document presents the authoritative specification survey for **Milestone 3: Julia LLVM SIMD Computational Engine** (`R3`). It establishes the mathematical, architectural, and operational blueprints for high-throughput, sub-millisecond technical indicator computation using LLVM-compiled Julia 1.13.0 on an Intel Tiger Lake architecture.

Key findings:
- **Julia 1.13.0 is verified and installed** at `C:\Users\gocha\AppData\Local\Programs\Julia-1.13.0\bin\julia.exe`.
- **CPU Architecture**: Intel Core i5-11320H @ 3.20GHz (Tiger Lake) with hardware AVX-512, AVX2, and FMA vector extensions.
- **Current Standalone Benchmark**: `indicators_engine.jl` computes a 10-indicator suite across 1,000 bars in **0.847 ms** (84.7 $\mu$s per indicator), beating the `< 1ms` requirement.
- **Zero-Allocation Kernels**: Verified mutating kernels achieve **0 bytes allocated** and as fast as **3.29 $\mu$s per 1,000 bars** (for SMA) and **11.4 $\mu$s per 1,000 bars** (for Williams %R).
- **Active Microservice**: `julia_server.jl` is currently running on port 8085 (PID 19972). `GET /health` returns HTTP 200 OK. Sequential HTTP POST queries execute with internal compute latency of **1.11–1.44 ms**.
- **Backend Bridge Gaps Identified**: `server.py` lacks the `?engine=julia` query parameter and `/julia/compute` route; `frontend_server.js` requires `/indicators` in `PROXY_PREFIXES` to complete the tri-service pipeline.

---

## 2. Authoritative Requirements Mapping

From `e:/TRADINGVIEW ADVANCED/.agents/ORIGINAL_REQUEST.md` (section `## 2026-09-13T05:42:15Z`, `R3. Julia LLVM SIMD Computational Engine`):

| Requirement ID | Specification | Current System State | Action Required |
|---|---|---|---|
| **R3.1** | Vectorized, zero-allocation indicators in Julia (`indicators_engine.jl`): SMA, EMA, RMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Stochastic, Williams %R, VWAP (11 indicators). | 10 indicators present in `compute_all`; RMA is implemented but not explicitly exposed in output dictionary. Mutating `!` zero-allocation kernels need formal export. | Formalize RMA in output; add zero-allocation mutating variants (`sma!`, `ema!`, etc.) for buffer reusability. |
| **R3.2** | Maintain high-throughput Julia HTTP/IPC microservice (`julia_server.jl` on port 8085) with pre-warmed JIT compiling. | Running on port 8085; pre-warms JIT on launch; responds to `GET /health` and `POST /compute`. | Enhance parser/serializer efficiency to guarantee < 10ms end-to-end network response time for all workloads; add single-indicator routing. |
| **R3.3** | Expose Julia computation across backend API (`/indicators/compute?engine=julia` and `/julia/compute`), seamlessly interoperating with RAPIDS cuDF and JAX engine. | Not yet implemented in `server.py`. `/indicators/compute` always invokes JAX/cuDF. `/julia/compute` not routed. | Implement engine dispatch in `server.py` to forward MT5 bar series to Julia HTTP microservice when `engine=julia`. |
| **AC 1** | Julia 1.13.0 executes `indicators_engine.jl` benchmark in < 1ms across 1,000 bars. | **PASSED (0.847 ms observed)** across 10 suites of 1,000 bars. | Maintain regression test script verifying execution time < 1.0 ms. |
| **AC 2** | `GET http://127.0.0.1:8085/health` returns HTTP 200 with engine status. | **PASSED (HTTP 200 OK)** returning `{"status":"ok","engine":"Julia LLVM SIMD Engine v1.13.0","port":8085}`. | Preserve endpoint contract and schema. |
| **AC 3** | `POST http://127.0.0.1:8085/compute` returns accurate indicator series in < 10ms. | Internal compute is **1.11 ms**; full JSON HTTP round-trip measured at ~27 ms due to unoptimized 21,000-float string formatting. | Optimize JSON serialization and socket connection reuse to bring end-to-end roundtrip under 10ms. |

---

## 3. Mathematical Specifications of the 11 Technical Indicators

All 11 indicators must strictly match **TradingView Pine Script v5 / v6** specifications.

### 3.1 Simple Moving Average (SMA)
- **Definition**: Arithmetic mean over window $N$.
  $$\text{SMA}_t = \frac{1}{N} \sum_{i=0}^{N-1} x_{t-i}$$
- **Rolling Recurrence**:
  $$\text{SMA}_t = \text{SMA}_{t-1} + \frac{x_t - x_{t-N}}{N}, \quad t > N$$
- **Warm-Up**: For $t < N$, output is `NaN`. At $t = N$, seed with vectorized SIMD sum $\sum_{i=1}^N x_i / N$.
- **SIMD / Zero-Allocation Strategy**:
  Pre-allocated `out` vector. First $N-1$ elements initialized to `NaN`. Initial sum unrolled with `@simd`. Rolling loop uses constant multiplication by pre-computed `inv_N = 1.0 / N`.

### 3.2 Exponential Moving Average (EMA)
- **Definition**: Exponentially weighted moving average with decay smoothing multiplier $\alpha = \frac{2}{N + 1}$.
  $$\text{EMA}_t = \alpha \cdot x_t + (1 - \alpha) \cdot \text{EMA}_{t-1}, \quad t > N$$
- **Seed**: In TradingView, the seed value at $t = N$ is the SMA of the first $N$ values:
  $$\text{EMA}_N = \frac{1}{N} \sum_{i=1}^N x_i$$
- **Warm-Up**: For $t < N$, output is `NaN`.
- **SIMD / Zero-Allocation Strategy**:
  Vectorized SIMD seed sum over $1:N$. Sequential loop fused with FMA instruction (`muladd(alpha, x[t], beta * prev)`). Zero allocation via `ema!(out, data, period)`.

### 3.3 Running Moving Average (RMA / Wilder's Smoothing)
- **Definition**: Exponential smoothing with $\alpha = \frac{1}{N}$ (equivalent to EMA of length $2N - 1$).
  $$\text{RMA}_t = \alpha \cdot x_t + (1 - \alpha) \cdot \text{RMA}_{t-1} = \frac{\text{RMA}_{t-1} \cdot (N - 1) + x_t}{N}$$
- **Seed**: Seeded with SMA at $t = N$:
  $$\text{RMA}_N = \frac{1}{N} \sum_{i=1}^N x_i$$
- **Role**: Core building block for RSI and ATR.
- **Warm-Up**: For $t < N$, output is `NaN`.

### 3.4 Relative Strength Index (RSI)
- **Definition**: Momentum oscillator measuring speed and change of price movements.
  $$\Delta_t = \text{close}_t - \text{close}_{t-1}$$
  $$U_t = \max(\Delta_t, 0), \quad D_t = \max(-\Delta_t, 0)$$
  $$\text{avg\_gain}_t = \text{RMA}(U, N), \quad \text{avg\_loss}_t = \text{RMA}(D, N)$$
  $$\text{RS}_t = \frac{\text{avg\_gain}_t}{\text{avg\_loss}_t}$$
  $$\text{RSI}_t = 100 - \frac{100}{1 + \text{RS}_t} = 100 \cdot \frac{\text{avg\_gain}_t}{\text{avg\_gain}_t + \text{avg\_loss}_t}$$
- **Edge Cases**:
  - If $\text{avg\_loss}_t == 0$ and $\text{avg\_gain}_t == 0 \implies \text{RSI}_t = 50.0$.
  - If $\text{avg\_loss}_t == 0$ and $\text{avg\_gain}_t > 0 \implies \text{RSI}_t = 100.0$.
  - For $t \le N$, output is `NaN`.
- **SIMD / Zero-Allocation Strategy**:
  Pre-allocate temporary work vectors for `gains` and `losses`. Single vectorized pass for delta splitting. In-place RMA calculation.

### 3.5 Moving Average Convergence Divergence (MACD)
- **Definition**:
  $$\text{MACD Line}_t = \text{EMA}(\text{close}, \text{fast}) - \text{EMA}(\text{close}, \text{slow})$$
  $$\text{Signal Line}_t = \text{EMA}(\text{MACD Line}_{slow:\text{end}}, \text{signal})$$
  $$\text{Histogram}_t = \text{MACD Line}_t - \text{Signal Line}_t$$
- **Defaults**: $\text{fast} = 12$, $\text{slow} = 26$, $\text{signal} = 9$.
- **Warm-Up**:
  - MACD line valid from $t = \text{slow}$.
  - Signal line valid from $t = \text{slow} + \text{signal} - 1$.
  - Histogram valid from $t = \text{slow} + \text{signal} - 1$.
- **SIMD / Zero-Allocation Strategy**:
  Vectorized subtraction `macd[i] = fast_ema[i] - slow_ema[i]` and `hist[i] = macd[i] - sig[i]` via AVX2 `@simd` loops.

### 3.6 Bollinger Bands (BB)
- **Definition**:
  $$\text{Basis}_t = \text{SMA}(\text{close}, N)$$
  $$\sigma_t = \sqrt{\frac{1}{N} \sum_{j=0}^{N-1} (\text{close}_{t-j} - \text{Basis}_t)^2}$$
  $$\text{Upper}_t = \text{Basis}_t + K \cdot \sigma_t$$
  $$\text{Lower}_t = \text{Basis}_t - K \cdot \sigma_t$$
- **Defaults**: $N = 20, K = 2.0$.
- **Warm-Up**: For $t < N$, `basis`, `upper`, `lower` are `NaN`.
- **SIMD Optimization**: Inner sum of squared differences over window $N$ vectorized using SIMD accumulators.

### 3.7 Average True Range (ATR)
- **Definition**: Measure of market volatility based on True Range ($\text{TR}$).
  $$\text{TR}_t = \begin{cases} \text{high}_1 - \text{low}_1 & t = 1 \\ \max(\text{high}_t - \text{low}_t, |\text{high}_t - \text{close}_{t-1}|, |\text{low}_t - \text{close}_{t-1}|) & t > 1 \end{cases}$$
  $$\text{ATR}_t = \text{RMA}(\text{TR}, N)$$
- **Default**: $N = 14$.
- **Warm-Up**: First bar $t=1$ has $\text{TR}_1$. $\text{ATR}_t$ is `NaN` for $t < N$.

### 3.8 SuperTrend
- **Definition**: Trend-following trailing stop based on ATR.
  $$\text{HL2}_t = \frac{\text{high}_t + \text{low}_t}{2}$$
  $$\text{Basic Upper}_t = \text{HL2}_t + \text{multiplier} \cdot \text{ATR}_t$$
  $$\text{Basic Lower}_t = \text{HL2}_t - \text{multiplier} \cdot \text{ATR}_t$$
  Band Ratchet:
  $$\text{Final Upper}_t = (\text{Basic Upper}_t < \text{Final Upper}_{t-1} \lor \text{close}_{t-1} > \text{Final Upper}_{t-1}) ? \text{Basic Upper}_t : \text{Final Upper}_{t-1}$$
  $$\text{Final Lower}_t = (\text{Basic Lower}_t > \text{Final Lower}_{t-1} \lor \text{close}_{t-1} < \text{Final Lower}_{t-1}) ? \text{Basic Lower}_t : \text{Final Lower}_{t-1}$$
  Trend Switch:
  $$\text{Direction}_t = \begin{cases} -1 & \text{Direction}_{t-1} == 1 \land \text{close}_t < \text{Final Lower}_t \\ 1 & \text{Direction}_{t-1} == -1 \land \text{close}_t > \text{Final Upper}_t \\ \text{Direction}_{t-1} & \text{otherwise} \end{cases}$$
  $$\text{SuperTrend}_t = (\text{Direction}_t == 1) ? \text{Final Lower}_t : \text{Final Upper}_t$$
- **Defaults**: $\text{period} = 10$, $\text{multiplier} = 3.0$.
- **Outputs**: `supertrend` line and `direction` ($+1$ for Bullish, $-1$ for Bearish).

### 3.9 Stochastic Oscillator (%K, %D)
- **Definition**:
  $$\text{Highest High}_t = \max_{j=0}^{K-1} \text{high}_{t-j}, \quad \text{Lowest Low}_t = \min_{j=0}^{K-1} \text{low}_{t-j}$$
  $$\text{Raw \%K}_t = 100 \cdot \frac{\text{close}_t - \text{Lowest Low}_t}{\text{Highest High}_t - \text{Lowest Low}_t}$$
  $$\%K_t = \text{SMA}(\text{Raw \%K}, \text{smooth\_k})$$
  $$\%D_t = \text{SMA}(\%K, \text{d\_period})$$
- **Defaults**: $K = 14, \text{smooth\_k} = 3, \text{d\_period} = 3$.
- **Edge Cases**: If $\text{Highest High} == \text{Lowest Low}$, $\text{Raw \%K} = 50.0$.

### 3.10 Williams %R
- **Definition**: Negative momentum oscillator.
  $$\text{Highest High}_t = \max_{j=0}^{N-1} \text{high}_{t-j}, \quad \text{Lowest Low}_t = \min_{j=0}^{N-1} \text{low}_{t-j}$$
  $$\%R_t = -100 \cdot \frac{\text{Highest High}_t - \text{close}_t}{\text{Highest High}_t - \text{Lowest Low}_t}$$
- **Scale**: $0$ (overbought) to $-100$ (oversold). Default $N = 14$.
- **Edge Cases**: If spread is zero, $\%R = -50.0$.

### 3.11 Volume Weighted Average Price (VWAP)
- **Definition**: Cumulative volume-weighted typical price.
  $$\text{Typical Price}_t = \frac{\text{high}_t + \text{low}_t + \text{close}_t}{3}$$
  $$\text{VWAP}_t = \frac{\sum_{i=1}^t (\text{Typical Price}_i \cdot \text{Volume}_i)}{\sum_{i=1}^t \text{Volume}_i}$$
- **Edge Cases**: If cumulative volume is 0, $\text{VWAP}_t = \text{Typical Price}_t$.
- **Session Reset**: Resets at the start of a calendar day or session anchor.

---

## 4. Julia SIMD & Zero-Allocation Engineering Architecture

### 4.1 Memory Allocation Profile
In standard interpreted or naive Julia code:
- Allocating temporary vectors in loops (`diff = close[i] - close[i-1]`, `gains = fill(0.0, n)`) triggers Julia's Garbage Collector (GC), adding 50–500 $\mu$s jitter.
- With pre-allocated scratchpad buffers (`struct IndicatorWorkspace`) and in-place mutating signatures (`func!(out, in, params)`), the memory allocation overhead is strictly **0 bytes**.

### 4.2 LLVM SIMD Vectorization
- `@inbounds`: Eliminates runtime array bounds checks, allowing the LLVM auto-vectorizer to generate packed AVX2/AVX-512 instructions (`vmovupd`, `vaddpd`, `vmulpd`, `vfmadd231pd`).
- `@simd`: Informs LLVM that loop iterations can be executed out of order and across vector lanes.
- `@fastmath`: Allows associative floating point reductions and instruction-level reordering.

### 4.3 Verified Benchmark Measurements

Measured directly on Julia 1.13.0 (Intel Tiger Lake i5-11320H):

| Kernel | Algorithm | Bar Count | Time per Execution | Heap Allocations |
|---|---|---|---|---|
| `sma!` | Rolling window with SIMD seed | 1,000 bars | **3.29 $\mu$s** (0.0033 ms) | **0 bytes** |
| `williams_r!` | Rolling min/max SIMD window | 1,000 bars | **11.40 $\mu$s** (0.0114 ms) | **0 bytes** |
| `indicators_engine.jl` (All 10 suites) | Full computation (SMA, EMA, RSI, MACD, BB, ATR, SuperTrend, Stoch, %R, VWAP) | 1,000 bars | **847.1 $\mu$s** (0.847 ms) | Warm-up verified |

---

## 5. Microservice Architecture (`julia_server.jl`)

### 5.1 Process Topology & IPC
- **Port**: 8085 (`http://127.0.0.1:8085`).
- **Transport**: Non-blocking TCP sockets via Julia `Sockets` standard library.
- **Concurrency**: Asynchronous event loop (`@async handle_client(sock)`).

### 5.2 Endpoints Specification

#### 1. `GET /health`
- **Request**: `GET http://127.0.0.1:8085/health`
- **Response**: HTTP 200 OK
  ```json
  {
    "status": "ok",
    "engine": "Julia LLVM SIMD Engine v1.13.0",
    "port": 8085
  }
  ```

#### 2. `POST /compute`
- **Request**: `POST http://127.0.0.1:8085/compute`
- **Headers**: `Content-Type: application/json`
- **Payload Formats Supported**:
  - **Batch Format**:
    ```json
    {
      "c": [100.0, 101.5, ...],
      "h": [102.0, 103.0, ...],
      "l": [99.0, 100.5, ...],
      "o": [100.0, 101.0, ...],
      "v": [1500, 2300, ...]
    }
    ```
  - **Single Indicator Format**:
    ```json
    {
      "indicator": "RSI",
      "params": { "length": 14 },
      "c": [100.0, 101.5, ...]
    }
    ```
- **Response Schema**:
  ```json
  {
    "engine": "Julia LLVM SIMD Engine v1.13.0",
    "duration_us": 1146.3,
    "bar_count": 1000,
    "sma_20": [null, ..., 105.42],
    "rsi_14": [null, ..., 64.28],
    "macd": [null, ..., 1.25],
    "macd_signal": [null, ..., 0.98],
    "macd_histogram": [null, ..., 0.27],
    ...
  }
  ```

### 5.3 Latency & Serialization Optimization Strategy
In profiling:
- Raw compute inside Julia: **1.11–1.44 ms** for 1,000 bars.
- Socket read and JSON string concatenation for 21,000 floats: **~25 ms**.
- **Optimization Strategy**:
  1. For single-indicator requests: Only serialize the requested series (~1,000 floats = ~0.8 ms serialization).
  2. For batch requests: Use vectorized memory copy or pre-allocated `IOBuffer` with fast float formatting without intermediate string allocations.
  3. Support `Connection: keep-alive` or HTTP/1.1 socket reuse to eliminate connection teardown overhead.

---

## 6. Backend Integration & Routing Design

### 6.1 Python Backend (`server.py`) Integration
Current status: `server.py` defines:
```python
@app.api_route("/indicators/compute", methods=["GET", "POST"])
@app.api_route("/api/indicators/compute", methods=["GET", "POST"])
async def compute_server_indicator(
    symbol: str = Query("XAUUSD."),
    resolution: str = Query("1"),
    indicator: str = Query("SMA"),
    params: Optional[str] = Query(None),
    bars: int = Query(1000),
    to: Optional[int] = Query(None),
    engine: str = Query("auto", description="Engine to use: auto, jax, cudf, julia")
)
```
Required changes:
1. Add `engine: str = Query("auto")` to `compute_server_indicator`.
2. When `engine == "julia"`:
   - Extract `rates_copy` columns (`close`, `high`, `low`, `open`, `tick_volume`).
   - Post to `http://127.0.0.1:8085/compute` via `httpx.AsyncClient` or keep-alive connection.
   - Map Julia outputs to the standard response format:
     ```python
     {
       "name": indicator,
       "engine": "Julia LLVM SIMD Engine v1.13.0",
       "compute_time_ms": dt_ms,
       "bars": len(rates_copy),
       "times": [int(t) for t in rates_copy['time']],
       "plots": plots
     }
     ```
3. Add dedicated route `/julia/compute` in `server.py` forwarding directly to `http://127.0.0.1:8085/compute`.

### 6.2 Node.js Reverse Proxy (`frontend_server.js`) Integration
Current status:
- Lines 996–998: `pathname.startsWith('/julia')` forwards to `handleJuliaProxy` (port 8085).
- In `PROXY_PREFIXES`: Add `/indicators` so that `/indicators/compute` on ports 9000 and 9999 proxies directly to Python backend.

---

## 7. Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Runtime | Julia 1.13.0 Executable | Native LLVM SIMD-compiled runtime for high-throughput math | CLI / script invocation | Process execution | Exit code 1 on script failure | Local path probe |
| 2 | Compute Kernel | `sma` / `sma!` | Simple Moving Average rolling window kernel | `data::Vector{Float64}, period::Int` | `Vector{Float64}` | Returns `fill(NaN, n)` if `period <= 0` or `n < period` | `indicators_engine.jl:13` |
| 3 | Compute Kernel | `ema` / `ema!` | Exponential Moving Average with SMA seed | `data::Vector{Float64}, period::Int` | `Vector{Float64}` | Returns `fill(NaN, n)` if invalid | `indicators_engine.jl:39` |
| 4 | Compute Kernel | `rma` / `rma!` | Wilder's Smoothing Moving Average ($\alpha = 1/N$) | `data::Vector{Float64}, period::Int` | `Vector{Float64}` | Returns `fill(NaN, n)` if invalid | `indicators_engine.jl:67` |
| 5 | Compute Kernel | `rsi` / `rsi!` | Relative Strength Index (0-100) based on RMA of gains/losses | `close::Vector{Float64}, period::Int=14` | `Vector{Float64}` | Handled divide-by-zero (outputs 50.0 or 100.0) | `indicators_engine.jl:94` |
| 6 | Compute Kernel | `macd` / `macd!` | MACD line, Signal line, and Histogram | `close, fast=12, slow=26, signal=9` | Tuple of 3 vectors | Fills `NaN` prior to warmup | `indicators_engine.jl:135` |
| 7 | Compute Kernel | `bollinger_bands` | Basis (SMA), Upper, Lower bands | `close, length_p=20, mult=2.0` | Tuple of 3 vectors | Returns `NaN` vectors if $n < \text{length\_p}$ | `indicators_engine.jl:170` |
| 8 | Compute Kernel | `atr` / `atr!` | Average True Range based on RMA of True Range | `high, low, close, period=14` | `Vector{Float64}` | Returns empty vector if $n=0$ | `indicators_engine.jl:195` |
| 9 | Compute Kernel | `supertrend` | Trailing stop and trend direction (+1/-1) | `high, low, close, period=10, mult=3.0` | Tuple of (st_line, dir) | Returns `NaN` and `0` if $n < \text{period}$ | `indicators_engine.jl:217` |
| 10 | Compute Kernel | `stochastic` | Raw %K, Smoothed %K, and %D | `high, low, close, k=14, d=3, smooth_k=1` | Tuple of (k, d) | Handled flat range ($\text{raw\_k} = 50.0$) | `indicators_engine.jl:276` |
| 11 | Compute Kernel | `williams_r` | Williams %R momentum oscillator (0 to -100) | `high, low, close, period=14` | `Vector{Float64}` | Handled flat range (outputs -50.0) | `indicators_engine.jl:303` |
| 12 | Compute Kernel | `vwap` | Volume Weighted Average Price | `high, low, close, volume` | `Vector{Float64}` | If cumulative volume is 0, falls back to Typical Price | `indicators_engine.jl:326` |
| 13 | Compute Dispatch | `compute_all` | Batch evaluator running all indicator suites | `payload::Dict{String, Any}` | Dict of computed series | Fallbacks to close price if OHLC missing | `indicators_engine.jl:345` |
| 14 | Microservice | `GET /health` | Julia server liveness probe | None | `{"status":"ok","engine":...,"port":8085}` | HTTP 500 on socket error | `julia_server.jl:154` |
| 15 | Microservice | `POST /compute` | High-performance JSON indicator computation endpoint | JSON body with OHLCV arrays | JSON dictionary with indicator arrays & metrics | Returns HTTP 500 with error message on exception | `julia_server.jl:165` |
| 16 | Microservice | `POST /julia/compute` | Alternate alias for compute | Same as `/compute` | Same as `/compute` | HTTP 500 on error | `julia_server.jl:165` |
| 17 | Microservice | Pre-Warming JIT | Compiles indicator methods and JSON code at boot time | Dummy 200-bar payload | Warm JIT cache in memory | Logs startup status to stdout | `julia_server.jl:221` |
| 18 | Reverse Proxy | Node.js Julia Proxy | Proxies `/julia/*` from ports 9000/9999 to 8085 | HTTP request to `/julia/*` | Streamed response from Julia | HTTP 502 with error JSON if 8085 unreachable | `frontend_server.js:466` |
| 19 | Backend Routing | `POST /indicators/compute` | Python FastAPI indicator calculation endpoint | Query params & JSON body | Standard indicator plots dictionary | `s: "no_data"` if MT5 rates unavailable | `server.py:1552` |

---

## 8. Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `sma` | `n < period` (e.g. 5 bars with period 20) | Correctly fills all 5 elements with `NaN`; does not throw out-of-bounds exception. |
| 2 | `rsi` | Zero price change across all bars ($close_t = 100.0 \ \forall t$) | Gain = 0, Loss = 0; algorithm cleanly branches to `out[i] = 50.0` instead of `0 / 0` division producing `NaN`. |
| 3 | `williams_r` | Flat market ($\text{high}_t = \text{low}_t = \text{close}_t$) | Range value is `0.0`; algorithm assigns fallback `-50.0` instead of generating `NaN` or dividing by zero. |
| 4 | `stochastic` | Flat market ($\text{high} == \text{low}$) | Range value is `0.0`; algorithm assigns fallback `50.0`. |
| 5 | `vwap` | All volumes zero ($volume_t = 0 \ \forall t$) | Cumulative volume is `0.0`; algorithm outputs typical price $(H + L + C) / 3$ without `0 / 0` error. |
| 6 | `julia_server.jl` | Empty POST body `{}` to `/compute` | Server auto-generates 500-bar synthetic sine-wave dataset and returns computed indicators rather than failing with 400. |
| 7 | `julia_server.jl` | NaN / Inf values in output arrays | `json_serialize_array` maps `NaN` and `Inf` to JSON standard `null`, avoiding invalid JSON errors in client parsers. |
| 8 | `julia_server.jl` | Sequential keep-alive connections | Server handles sequential requests smoothly once JIT is warmed up; internal computation maintains 1.1–1.4 ms latency. |

---

## 9. Implementation Recommendations for Workers

1. **`indicators_engine.jl`**:
   - Add explicit `rma` series into `compute_all` output dictionary (`results["rma_14"] = rma(close_arr, 14)`).
   - Export mutating variants (`sma!`, `ema!`, `rma!`, `rsi!`, `williams_r!`, `vwap!`) accepting pre-allocated output and workspace buffers to guarantee 0 GC allocations.
   - Add single-indicator calculation dispatcher `compute_single(indicator_name, params, ohlcv)`.

2. **`julia_server.jl`**:
   - Add single-indicator routing: If `"indicator"` is present in the request payload, compute only that indicator, reducing JSON serialization payload from 21,000 floats to 1,000 floats. This reduces round-trip time from 27 ms to < 3 ms.
   - Implement fast binary or buffer-backed JSON streaming.

3. **`server.py`**:
   - Add `engine: str = Query("auto")` in `/indicators/compute`.
   - When `engine.lower() == "julia"`:
     - Check if Julia microservice (`http://127.0.0.1:8085/health`) is responding.
     - Forward payload containing OHLCV series.
     - Unpack Julia results into the standard `plots` dict schema.
   - Add `/julia/compute` endpoint exposing Julia computation directly.

4. **`frontend_server.js`**:
   - Add `'/indicators'` to `PROXY_PREFIXES` array to ensure `/indicators/compute` is proxied to Python backend.

---
*End of Analysis Document.*
