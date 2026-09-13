# E2E Test Infrastructure & Adversarial Grading Architecture
**MetaTrader 5 Backend & TradingView Advanced Charts with Native Trading Suite**

---

## 1. Executive Summary & Test Philosophy

This document defines the comprehensive end-to-end (E2E) testing infrastructure, multi-tier test architecture, and adversarial grading framework for the MetaTrader 5 backend and TradingView Advanced Charts platform.

### Core Testing Principles
1. **Opaque-Box & Requirement-Driven**: Tests validate behavioral specifications, mathematical correctness, interface contracts, and runtime invariants rather than internal implementation quirks.
2. **Strict Financial Safety**: Live and demo trading accounts (specifically account `#70257567`) must maintain absolute invariant safety: zero lingering, orphan, or unintended positions/orders.
3. **Sub-Cent P&L Precision**: On any open position across all supported assets and lot sizes, the floating P&L must synchronize across all four user-facing surfaces within standard round-off tolerance:
   $$\left|\text{Chart\_Position\_Line\_PL} - \text{Positions\_Table\_Profit}\right| < 0.01$$
4. **Adversarial Grading**: An automated grading engine assesses performance with mathematical precision, awarding positive credits ($+\text{ve}$) for exact parity and resilience, while imposing strict negative penalties ($-\text{ve}$) for discrepancies, corrupted inputs, or state drift. Top benchmark is **AAAA+++++++++++++++** (100.0%).

---

## 2. Multi-Tier Test Suite Taxonomy

The test infrastructure is structured into 7 distinct automated tiers, executable individually or unified via `run_e2e_tests.py`:

| Tier | Suite Name | Target File | Scope & Methodology | Min Tests |
|:----:|:-----------|:------------|:--------------------|:---------:|
| **Tier 1** | Feature Coverage (F1–F13) | `tests/test_tier1_feature_coverage.py` | Unit & endpoint isolation testing (5 tests × 13 features) | 65 |
| **Tier 2** | Boundary Value & Negative Cases | `tests/test_tier2_boundary_corner.py` | Limits, bad parameters, missing params, malformed Pine code, and anomalies | 65 |
| **Tier 3** | Pairwise Cross-Feature Interactions | `tests/test_tier3_cross_feature.py` | Combinatorial interactions between symbols, resolutions, storage, and runtime | 15 |
| **Tier 4** | End-to-End Real-World Workloads | `tests/test_tier4_workloads.py` | Full multi-step workflows (Scalper, Swing, Custom Indicator, Dashboard) | 7 |
| **Tier 6** | R1–R4 Comprehensive Verification | `tests/test_tier6_r1_to_r4.py` | Custom sec/ticks, HFT latency <10ms, WS push, MT5 trade API & IPC concurrency | 30 |
| **Tier 7** | HFT Clock Sync & Countdown Suite | `tests/test_hft_clock_countdown_suite.py` | Sub-1ms clock sync, smooth monotonic countdown, <500µs trade gateway | 20 |
| **Tier 8** | E2E Adversarial & P&L Parity Suite | `tests/test_pl_sync_adversarial.py` | Cross-surface P&L sync, Security Info metadata completeness, DOM ladder pinning, negative/positive stress grading, MT5 safety | 38 |
| **TOTAL** | **Unified Test Harness** | **All Tiers Combined** | **Comprehensive Full System Verification** | **≥ 240** |

---

## 3. Requirement Mapping & Specification Contracts

### R1. Cross-Surface Live P&L Synchronization
All four TradingView surfaces must display identical floating P&L in real time:
1. **Chart Position Line Tag**: e.g. `0.01 | -0.93 USD | X` on chart canvas.
2. **Positions Table**: `Profit` column in the native Account Manager docking table.
3. **Account Summary Bar**: `Open P&L` indicator in the header summary bar.
4. **DOM Ladder Widget**: Position & P&L status badge at the top/bottom of the DOM ladder.

#### Mathematical Formulation
For any symbol $S$ with contract size $C$, volume $V$ (in lots), entry price $P_{\text{open}}$, and live market quotes ($P_{\text{bid}}, P_{\text{ask}}$):

- **BUY Position Floating P&L**:
  $$\text{PL}_{\text{BUY}} = (P_{\text{bid}} - P_{\text{open}}) \times V \times C \times R_{\text{quote}\to\text{deposit}}$$
- **SELL Position Floating P&L**:
  $$\text{PL}_{\text{SELL}} = (P_{\text{open}} - P_{\text{ask}}) \times V \times C \times R_{\text{quote}\to\text{deposit}}$$

Where $R_{\text{quote}\to\text{deposit}}$ is the exchange rate from quote currency to account currency (1.0 for USD accounts on USD pairs).

#### Contract Sizes & Lot Variations
| Symbol | Asset Class | Contract Size ($C$) | Digits | Min Tick | P&L on 0.01 Lot | P&L on 0.10 Lot | P&L on 1.00 Lot |
|:-------|:------------|:-------------------:|:------:|:--------:|:---------------:|:---------------:|:---------------:|
| `XAUUSD.` | Gold / Metal | 100 | 2 | 0.01 | \$1.00 / \$1 move | \$10.00 / \$1 move | \$100.00 / \$1 move |
| `EURUSD.` | Major Forex | 100,000 | 5 | 0.00001 | \$0.10 / pip (0.0001) | \$1.00 / pip | \$10.00 / pip |
| `BTCUSD` | Crypto CFD | 1 | 2 | 0.01 | \$1.00 / \$100 move | \$10.00 / \$100 move | \$100.00 / \$100 move |

#### Multi-Position Summary Bar Aggregation
$$\text{Summary\_Bar\_Open\_PL} = \sum_{i=1}^{N} \text{Positions\_Table\_Profit}_i$$
Strict Parity Invariant:
$$\left|\text{Summary\_Bar\_Open\_PL} - \sum_{i=1}^{N} \text{Positions\_Table\_Profit}_i\right| < 0.01$$

---

### R2. Security Info Metadata Completeness
The `/symbols` endpoint and datafeed `resolveSymbol()` must return complete instrument specifications so the native TradingView "Security Info" dialog renders complete data without missing dashes (`-`):

| Property Name | Type | Description | Example (`XAUUSD.`) | Example (`EURUSD.`) | Example (`BTCUSD`) |
|:--------------|:----:|:------------|:-------------------:|:-------------------:|:------------------:|
| `pointvalue` | `number` | Contract size / Point value | `100` | `100000` | `1` |
| `currency_code` | `string` | Base or profit currency code | `"USD"` | `"USD"` | `"USD"` |
| `original_currency_code` | `string` | Original currency code | `"USD"` | `"USD"` | `"USD"` |
| `pip_size` | `number` | Size of one pip | `0.01` | `0.0001` | `0.1` |
| `tick_size` | `number` | Minimum price movement | `0.01` | `0.00001` | `0.01` |
| `minmove2` | `number` | Fractional pip multiplier (must be $>0$ for pip display) | `10` or `1` | `10` | `1` |

---

### R3. DOM Ladder Dynamic Anchoring & State Verification
1. **Dynamic Centering State**: `dynamicModeState: true` must remain active and lock icon enabled.
2. **Spread Pinning**:
   - `bestAsk` and `bestBid` must bracket the live spread without overlap:
     $$\text{bestBid} < \text{bestAsk}$$
   - When spread collapses or quotes are inverted, the ladder must automatically adjust $\text{bestBid} = \text{bestAsk} - \text{tick\_size}$.
3. **Level Distribution**: 30 symmetric depth levels above Ask and 30 levels below Bid.
4. **Position & P&L Widget States**:
   - **Flat State**: When no position exists, display neutral `—` and `0.00` P&L.
   - **Open Position State**: When position exists, display volume, entry price, and real-time floating P&L matching the Positions Table.

---

### R4. Adversarial Grading Framework Methodology

The adversarial test suite incorporates an algorithmic grading engine:
- **Base Score**: 100.0 points.
- **Positive Rewards ($+\text{ve}$)**:
  - Exact P&L Parity ($\Delta < 0.001$): $+2.0$ pts per symbol/lot test.
  - Multi-position aggregation consistency: $+3.0$ pts.
  - Security Info completeness (zero dashes): $+2.5$ pts.
  - DOM dynamic centering & spread pinning: $+2.5$ pts.
  - Negative stress graceful resilience: $+2.0$ pts per scenario.
- **Negative Penalties ($-\text{ve}$)**:
  - P&L Discrepancy ($\Delta \ge 0.01$): $-10.0$ pts deduction.
  - Corrupted or Missing Symbol Metadata: $-5.0$ pts deduction.
  - Unhandled NaN, Inf, or ZeroDivisionError: $-15.0$ pts deduction.
  - Inverted DOM Bid/Ask Spread: $-8.0$ pts deduction.
  - State Leak or Lingering Position: $-25.0$ pts deduction.

#### Grading Scale
- **AAAA+++++++++++++++**: $100.0\%$ (Zero defects, complete parity, perfect resilience)
- **AAA+**: $95.0\% - 99.9\%$
- **AA**: $90.0\% - 94.9\%$
- **A**: $85.0\% - 89.9\%$
- **B**: $70.0\% - 84.9\%$
- **F**: $< 70.0\%$ (Unacceptable for financial trading)

---

### R5. MT5 Financial Safety Guardrails
- Demo Account: `#70257567` (Orbex Global Ltd / `OrbexGlobal-Server`).
- **Zero Lingering Positions Invariant**: $\text{len}(\text{positions}) == 0$.
- **Zero Orphan Orders Invariant**: $\text{len}(\text{orders}) == 0$.
- Guard fixture enforces clean teardown after all live trade executions.

---

## 4. Test Execution Guide

### Run Unified Test Suite (All Tiers)
```powershell
python run_e2e_tests.py
```

### Run Tier 8 Adversarial Suite Only
```powershell
python run_e2e_tests.py --tier 8 -v
```
or directly via pytest:
```powershell
pytest tests/test_pl_sync_adversarial.py -v --tb=short
```

### Run Specific Test Focus
```powershell
pytest tests/test_pl_sync_adversarial.py -k "test_pl_sync" -v
pytest tests/test_pl_sync_adversarial.py -k "test_security_info" -v
pytest tests/test_pl_sync_adversarial.py -k "test_dom" -v
pytest tests/test_pl_sync_adversarial.py -k "test_negative" -v
pytest tests/test_pl_sync_adversarial.py -k "test_mt5_safety" -v
```
