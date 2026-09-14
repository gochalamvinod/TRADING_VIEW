# Spec Miner Dispatch: Official Pine Script v6 Manual & Spec

## Objective
Mine the official Pine Script v6 manual and specifications (including `https://github.com/codenamedevan/pinescriptv6.git`, web documentation, `scratch_luxalgo.pine`, and existing pine examples) to establish the authoritative requirements for:
1. Pine Script v6 compiler directives, headers (`//@version=6`), `indicator()`, `strategy()`, `library()`.
2. All 9 input types: `input.int`, `input.float`, `input.bool`, `input.string`, `input.color`, `input.timeframe`, `input.symbol`, `input.session`, `input.source` with their parameters, types, and defaults.
3. User-Defined Types (UDT) syntax (`type <TypeName> ...`), custom methods (`method <name>(...)`), tuples (`[a, b] = ...`), and namespaces.
4. Compile-time error diagnostics specifications (line, column, severity, precise error messages).
5. Visual output and plotter specs:
   - `plot()`, `plotcandle()`, `plotbar()`, `plotshape()`, `plotchar()`, `plotarrow()`, `hline()`, `fill()`.
   - Strict `na`/`NaN` invariance (zero line segments, zero synthetic badges on price scale).
   - Lines & boxes (`line.new`, `box.new`, `polyline.new`), tables (`table.new`, `table.cell`), dynamic labels (`label.new`).
   - Session & time window shading (LuxAlgo Sessions algorithm, session strings, time window calculations) and multi-day vertical dividers.
6. Reference scripts in repository (especially `scratch_luxalgo.pine`).

Write a comprehensive report to `report.md` and complete `handoff.md`.

## 2026-09-10T04:21:42Z
You are spec_miner_pinescript_v6, a specialized specification miner.
Your working directory is: E:\TRADINGVIEW ADVANCED\.agents\spec_miner_pinescript_v6

MANDATORY FIRST STEP: Read the authoritative user request at:
E:\TRADINGVIEW ADVANCED\ORIGINAL_REQUEST.md

Read your dispatch instructions at:
E:\TRADINGVIEW ADVANCED\.agents\spec_miner_pinescript_v6\DISPATCH.md

Your mission:
Mine the official Pine Script v6 manual and specifications based on the repository https://github.com/codenamedevan/pinescriptv6.git, official Pine Script v6 documentation, and existing scripts in E:\TRADINGVIEW ADVANCED (such as scratch_luxalgo.pine, pine_examples/, etc.).
Extract and document word-for-word official Pine Script v6 specifications:
1. Header directives: //@version=6 and compiler directives indicator(), strategy(), library().
2. All 9 input types: input.int, input.float, input.bool, input.string, input.color, input.timeframe, input.symbol, input.session, input.source with exact parameters, defaults, and typing rules.
3. User-Defined Types (UDT) via 'type <Name>', custom methods via 'method <func>(...)', tuples, and namespaces.
4. Compile-time diagnostics: exact line, column, error severity, and informative messages.
5. Visual output and plotting rules: plot, plotcandle, plotbar, plotshape, plotchar, plotarrow, hline, fill.
6. na/NaN strict invariance: behavior of na in numerical series, plot lines, and price scale badges (zero line segments across inactive intervals, zero synthetic price scale badges).
7. Drawings & display primitives: line.new, box.new, polyline.new, table.new, table.cell, label.new.
8. Session shading (e.g. LuxAlgo Sessions) and multi-day vertical dividers.

Perform git inspection, file reading, or web searches if needed to locate and verify the exact v6 specs.
Write your exhaustive findings to:
E:\TRADINGVIEW ADVANCED\.agents\spec_miner_pinescript_v6\report.md
and a complete Handoff report to:
E:\TRADINGVIEW ADVANCED\.agents\spec_miner_pinescript_v6\handoff.md

Send a completion message back to the orchestrator with send_message when done.

