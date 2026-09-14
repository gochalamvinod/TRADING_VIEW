# Plan: Exhaustive Pine Script v6 Compiler, Runtime Evaluator, and Authentic Plotter Engine

## Objective
Build an exhaustive Pine Script v6 compiler, runtime evaluator, and high-fidelity TradingView Charting Library plotter based word-for-word on the official Pine Script v6 manual (https://github.com/codenamedevan/pinescriptv6.git), ensuring 100% TradingView parity with zero visual diversion.

## Phases

### Phase 0: Survey & Spec Mining (Parallel Spawns)
1. **Spec Miner (`teamwork_preview_spec_miner`)**: Mine Pine Script v6 official specifications from `https://github.com/codenamedevan/pinescriptv6.git` (or cloned repo / online manual) for v6 syntax, directives (`indicator`, `strategy`, `library`), all 9 input types, UDTs (`type`), custom `method`, tuples, namespaces, and diagnostic requirements.
2. **Codebase Explorer (`teamwork_preview_explorer`)**: Survey existing AST & runtime infrastructure in `PineTS-main/`, `server.py`, `pine_indicators.js`, and identify exact gaps between current PineTS v5 support and full v6 spec.
3. **Visual Engine Explorer (`teamwork_preview_explorer`)**: Survey Charting Library plotter, `pine_indicators.js`, `pine_editor_ide.js`, and `index.html` for `plot*`, `line.new`, `box.new`, `polyline.new`, `table.*`, `label.*`, LuxAlgo Sessions shading, na/NaN strict invariance, zero price badges on na, and lifecycle sync.

### Phase 1: Decompose & Milestone Specification
Merge findings into `PROJECT.md`:
- **M30**: Exhaustive Pine Script v6 Compiler & AST Engine (`//@version=6`, 9 inputs, UDTs, methods, tuples, namespaces, diagnostics).
- **M31**: Authentic Visual Output & Plotter Engine (Zero Diversion) (`plot*`, `line.new`, `box.new`, `polyline.new`, `table.*`, `label.*`, LuxAlgo Sessions shading, multi-day vertical dividers, strict na/NaN invariance).
- **M32**: Seamless Pine Editor IDE Integration & Lifecycle Sync (compile & add-to-chart, study registration into repository/JSServer, live symbol/resolution/tick sync, format modal).
- **M33**: Comprehensive 4-Tier + Adversarial E2E Verification & Forensic Integrity Audit.

### Phase 2: Implementation & Verification Loop (Direct / Delegated)
For each milestone:
- Spawn Workers with clear write boundaries.
- Run Reviewers, Challengers, and Forensic Auditor (`teamwork_preview_auditor`).
- Gate evaluation: strict AND of tests pass, all reviewers APPROVE, challengers confirm correctness, and auditor reports CLEAN.

### Phase 3: Final E2E Suite & User Victory Delivery
- Headless browser validation of LuxAlgo Sessions, 0 false positives, 0 stacked badges, 0 flat inactive lines.
- Complete documentation and notify Sentinel / human user.
