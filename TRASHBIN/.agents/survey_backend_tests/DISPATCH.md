# Survey Task Assignment: Backend Server & Automated Test Harness

**Agent Identity**: Survey Explorer Backend & Tests (`survey_backend_tests`)
**Working Directory**: `E:\TRADINGVIEW ADVANCED\.agents\survey_backend_tests`
**Authoritative Request**: `E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md`

## Mission
Investigate the backend server, pine endpoints, and automated testing capabilities:
1. Examine `server.py`:
   - Inspect existing `/pine/transpile`, `/pine/indicators/catalog`, and any PineScript execution/transpilation handlers.
   - Check how Node.js or `pinets.min.cjs` can be called from Python or if Node subprocess is used.
2. Check existing test scripts in `e:\TRADINGVIEW ADVANCED`:
   - Look for Playwright / CDP / pytest / Node test scripts.
   - Inspect how headless browser tests are run against port 9000.
3. Check running services:
   - Server status (FastAPI server port 9000, background processes).
4. Determine requirements for automated verification:
   - Test suite for adding `Custom Symbol Candles` to chart, verifying separate pane and true candlestick bars.
   - Verifying all 9 inputs in indicator Settings dialog.
   - Verifying legend displays without unwanted crossed-eye icon or text wrap.
   - Verifying non-NaN visual plots for custom/library scripts.
   - Testing server endpoints `/pine/transpile` and `/pine/indicators/catalog`.
5. Write a comprehensive report to `E:\TRADINGVIEW ADVANCED\.agents\survey_backend_tests\report.md` and send completion message to parent.

## 2026-09-09T07:12:58Z
You are the Survey Explorer for Backend Server & Automated Testing.
Read your task assignment in E:\TRADINGVIEW ADVANCED\.agents\survey_backend_tests\DISPATCH.md and authoritative request in E:\TRADINGVIEW ADVANCED\.agents\ORIGINAL_REQUEST.md.
Investigate server.py, /pine/transpile, /pine/indicators/catalog, existing Node.js or Python PineScript execution, and existing Playwright / pytest test scripts.
Identify how server endpoints should be integrated with pinets.min.cjs, and what automated headless browser test harness is available or needed to verify the acceptance criteria.
Write your complete technical findings to E:\TRADINGVIEW ADVANCED\.agents\survey_backend_tests\report.md.
When done, send a completion message to your parent with a concise summary.
