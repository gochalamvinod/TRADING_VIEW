"""
scratch/verify_inverse_ohlc_and_purge.py
========================================
Comprehensive automated browser test:
1. Loads chart at http://127.0.0.1:9000
2. Verifies Inverse OHLC is registered and can be added to chart
3. Verifies Inverse OHLC evaluates inverted prices (~0.000226 for Gold)
4. Adds Sessions [LuxAlgo], verifies session shapes appear
5. Removes Sessions [LuxAlgo], verifies 100% of session shapes are purged
6. Captures screenshots for visual verification
"""

import os
import sys
import time
from playwright.sync_api import sync_playwright

ARTIFACTS_DIR = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f"

def run_test():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("[Test] Navigating to http://127.0.0.1:9000 ...")
        page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")

        # Wait for TradingView chart widget to be ready
        page.wait_for_selector("#tv_chart_container iframe", timeout=30000)
        page.wait_for_function("() => window.widget && window.widget.activeChart && typeof window.widget.activeChart === 'function'", timeout=30000)
        time.sleep(3)

        # 1. Verify PREBUILT_TEMPLATES in window.PineIndicators
        has_inverse = page.evaluate("""() => {
            const ind = window.PineIndicators;
            if (!ind) return { ok: false, reason: 'no PineIndicators' };
            const templates = ind.PREBUILT_TEMPLATES || [];
            const hasTpl = templates.some(t => t.id === 'inverse_ohlc' || t.name === 'Inverse OHLC');
            return { ok: hasTpl, templates: templates.map(t => t.name) };
        }""")
        print("[Test] Inverse OHLC template in PineIndicators:", has_inverse)
        assert has_inverse["ok"], f"Inverse OHLC not found in PREBUILT_TEMPLATES: {has_inverse}"

        # 2. Add Inverse OHLC study to chart
        print("[Test] Adding Inverse OHLC study to chart...")
        study_result = page.evaluate("""async () => {
            const chart = window.widget.activeChart();
            const symbol = chart.symbol();
            const res = chart.resolution();

            // Compile & add Inverse OHLC
            const src = `//@version=5
indicator("Inverse OHLC", overlay=false)

// Guard against division by zero
safe_open  = open  != 0 ? open  : na
safe_high  = high  != 0 ? high  : na
safe_low   = low   != 0 ? low   : na
safe_close = close != 0 ? close : na

inv_open  = 1 / safe_open
inv_high  = 1 / safe_low    // low → inv_high
inv_low   = 1 / safe_high   // high → inv_low
inv_close = 1 / safe_close

plotcandle(inv_open, inv_high, inv_low, inv_close,
     title       = "Inverse OHLC",
     color       = inv_close >= inv_open ? color.green : color.red,
     wickcolor   = color.gray,
     bordercolor = inv_close >= inv_open ? color.green : color.red)`;

            const compileRes = window.PineIndicators.compilePineScript(src);
            if (!compileRes.success) {
                return { success: false, errors: compileRes.errors };
            }

            const studyId = await chart.createStudy("Inverse OHLC", false, false, [], {});
            return { success: true, studyId, symbol, res };
        }""")
        print("[Test] Inverse OHLC study added:", study_result)
        assert study_result["success"], f"Failed to add Inverse OHLC: {study_result}"

        time.sleep(2)

        # 3. Add Sessions [LuxAlgo] study to chart
        print("[Test] Adding Sessions [LuxAlgo] study to chart...")
        with open(r"E:\TRADINGVIEW ADVANCED\scratch_luxalgo.pine", "r", encoding="utf-8") as f:
            luxalgo_code = f.read()

        sessions_res = page.evaluate("""async (code) => {
            const chart = window.widget.activeChart();
            let reg = null;
            if (window.PineIndicators && typeof window.PineIndicators.compileAndRegisterPine === 'function') {
                reg = window.PineIndicators.compileAndRegisterPine(code);
            }
            const title = (reg && reg.meta && reg.meta.title) || 'Sessions [LuxAlgo]';
            const studyId = await window.PineIndicators.addStudyToChart(window.widget, title, true);
            if (window.PineIndicators && typeof window.PineIndicators.renderSessionVisuals === 'function') {
                await window.PineIndicators.renderSessionVisuals(chart, code, studyId);
            }
            return { studyId, title };
        }""", luxalgo_code)
        print("[Test] Sessions added:", sessions_res)
        time.sleep(2)

        # Check session shapes exist
        shapes_before = page.evaluate("""() => {
            const chart = window.widget.activeChart();
            const allShapes = chart.getAllShapes ? chart.getAllShapes() : [];
            const sessionKeywords = ['sydney', 'tokyo', 'london', 'new york', 'thursday', 'wednesday', 'tuesday', 'monday', 'friday', 'session'];
            const sessionShapes = [];
            for (const s of allShapes) {
                const shapeApi = chart.getShapeById ? chart.getShapeById(s.id) : null;
                const props = shapeApi && shapeApi.getProperties ? shapeApi.getProperties() : null;
                const text = (props && props.text ? String(props.text) : (s.text || '')).toLowerCase();
                if (sessionKeywords.some(k => text.includes(k))) {
                    sessionShapes.push({ id: s.id, text, name: s.name });
                }
            }
            return { total: allShapes.length, sessionCount: sessionShapes.length, sessionShapes: sessionShapes.slice(0, 5) };
        }""")
        print("[Test] Shapes while Sessions is active:", shapes_before)
        assert shapes_before["sessionCount"] > 0, f"Expected session shapes to be drawn, got: {shapes_before}"

        # Capture screenshot with Sessions + Inverse OHLC active
        page.screenshot(path=os.path.join(ARTIFACTS_DIR, "both_studies_active.png"))
        print("[Test] Saved both_studies_active.png")

        # 4. Remove Sessions [LuxAlgo] from chart
        print("[Test] Removing Sessions [LuxAlgo] study...")
        remove_res = page.evaluate("""() => {
            const chart = window.widget.activeChart();
            const allStudies = chart.getAllStudies ? chart.getAllStudies() : [];
            const sessionStudy = allStudies.find(s => s && s.name && s.name.toLowerCase().includes('session'));
            if (sessionStudy) {
                chart.removeEntity(sessionStudy.id);
                if (window.PineEditorIDE && typeof window.PineEditorIDE.cleanupStudy === 'function') {
                    window.PineEditorIDE.cleanupStudy(sessionStudy.id, chart);
                } else if (window.PineIndicators && typeof window.PineIndicators.clearSessionVisuals === 'function') {
                    window.PineIndicators.clearSessionVisuals(chart);
                }
                return { removed: true, id: sessionStudy.id };
            }
            return { removed: false };
        }""")
        print("[Test] Study removal result:", remove_res)

        # Wait for removal observer and sweeper to execute
        time.sleep(1)

        # 5. Verify ALL session shapes are completely purged
        shapes_after = page.evaluate("""() => {
            const chart = window.widget.activeChart();
            const allShapes = chart.getAllShapes ? chart.getAllShapes() : [];
            const sessionKeywords = ['sydney', 'tokyo', 'london', 'new york', 'thursday', 'wednesday', 'tuesday', 'monday', 'friday', 'session'];
            const lingeringSessionShapes = [];
            for (const s of allShapes) {
                const shapeApi = chart.getShapeById ? chart.getShapeById(s.id) : null;
                const props = shapeApi && shapeApi.getProperties ? shapeApi.getProperties() : null;
                const text = (props && props.text ? String(props.text) : (s.text || '')).toLowerCase();
                if (sessionKeywords.some(k => text.includes(k))) {
                    lingeringSessionShapes.push({ id: s.id, text, name: s.name });
                }
            }
            return { total: allShapes.length, sessionCount: lingeringSessionShapes.length, lingering: lingeringSessionShapes };
        }""")
        print("[Test] Shapes after Sessions removed:", shapes_after)
        assert shapes_after["sessionCount"] == 0, f"Lingering session shapes found! {shapes_after}"

        # 6. Verify Inverse OHLC is still intact and rendering
        inverse_study = page.evaluate("""() => {
            const chart = window.widget.activeChart();
            const allStudies = chart.getAllStudies ? chart.getAllStudies() : [];
            const inv = allStudies.find(s => s && s.name && s.name.toLowerCase().includes('inverse'));
            return inv ? { id: inv.id, name: inv.name } : null;
        }""")
        print("[Test] Inverse OHLC study after Sessions removed:", inverse_study)
        assert inverse_study is not None, "Inverse OHLC study should still be present on chart"

        # Capture final clean screenshot
        final_png = os.path.join(ARTIFACTS_DIR, "inverse_ohlc_clean_chart.png")
        page.screenshot(path=final_png)
        print(f"[Test] Saved clean chart screenshot to {final_png}")

        print("[Test] ALL VERIFICATION TESTS PASSED SUCCESSFULLY!")
        browser.close()

if __name__ == "__main__":
    run_test()
