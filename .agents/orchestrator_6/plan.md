# Master Plan: Pine Script IDE & Indicator Runtime Engine

## Objective
Deliver a production-grade, native TradingView-style Pine Script IDE and indicator runtime engine on the trading platform:
1. Genuine calculated visual plots (lines, bands, histograms, shapes) on price candles or sub-panes without blank/NaN renders, with an adaptive trend baseline fallback for scripts with 0 explicit `plot()` calls.
2. Full native legend controls with `lock: false`, hover action buttons (👁️ Hide/Show, ⚙️ Settings, 🗑️ Delete), and native Format dialog binding.
3. Reference built-in indicators architecture conforming to TradingView Metainfo v52/v53 and `Std` engine (`this.main(ctx, inputCallback)`), featuring PineScript v5 reference templates (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume) in IDE and custom indicators getter.
4. Comprehensive E2E headless verification (Playwright) and 100% passing FastAPI backend services.

## Execution Strategy: Multi-Agent Parallelism
### Step 0: Survey & Scope Exploration (3 Parallel Agents)
- **Explorer 1 (Codebase & Pine Runtime)**: Inspect existing Pine Script compiler, parser, runtime, AST/Std engine implementation, backend endpoints, and how custom indicators are registered with the TradingView widget.
- **Explorer 2 (Legend Controls & Study Editability)**: Inspect TradingView chart legend DOM/API, study locking (`lock: false`), study action buttons (eye, gear, trash), and modal dialog triggers.
- **Explorer 3 (Reference Indicators & Playwright Test Harness)**: Survey available indicators, Metainfo v52/v53 compliance, reference templates, and existing Playwright / E2E test setup.

### Step 1: Synthesis & PROJECT.md
Aggregate survey findings into `PROJECT.md` Feature Inventory, Architecture, Code Layout, and Milestone Decomposition.

### Step 2: Parallel Dual-Track Implementation & Testing
- **Track A (Implementation)**:
  - M1: Indicator Execution Engine & Adaptive Trend Baseline (R1)
  - M2: Native Legend Action Buttons & Study Properties Dialog (R2)
  - M3: Reference Templates & Metainfo v52/v53 Schema Alignment (R3)
- **Track B (E2E Testing)**:
  - Playwright test suite covering all 4 tiers (Feature, Boundary, Combinatorial, Real-World)
  - Headless browser verification of canvas rendering and legend clicks

### Step 3: Adversarial Review & Forensic Audit
- Reviewers (2)
- Challengers (2)
- Forensic Auditor (teamwork_preview_auditor) for zero-compromise integrity verification.
