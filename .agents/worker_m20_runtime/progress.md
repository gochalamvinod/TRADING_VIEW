# Progress — Worker M20 (Pine Runtime & Non-NaN Plots)

Last visited: 2026-09-09T06:21:00Z
Status: Investigating pine_indicators.js

## Checklist
- [ ] Investigate current pine_indicators.js implementation details
- [ ] Task 1: Eliminate globalThis state pollution across concurrent indicator executions
- [ ] Task 2: Fix named argument plot regex matching (`title="..."`)
- [ ] Task 3: Implement zero-warmup cold-start seeding (seed EMA with ctx.symbol.close on Bar 0; seed RSI with 50.0 on Bar 0)
- [ ] Task 4: Inject adaptive trend baseline fallback plot (21-period EMA for overlays, 14-period RSI for subpanes) + Pine Logs notice for 0-plot indicators
- [ ] Task 5: Populate all 8 clean reference Pine v5 templates in PREBUILT_TEMPLATES (SMA, EMA, RSI, MACD, Bollinger Bands, ATR, SuperTrend, Volume)
- [ ] Task 6: Verify syntax with `node -c pine_indicators.js` and write verification tests
- [ ] Write handoff.md and send completion message to parent
