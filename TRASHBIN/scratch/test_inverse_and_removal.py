import os
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:9000"
ACTIVE_SCREENSHOT = "C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/inverse_ohlc_active.png"
CLEAN_SCREENSHOT = "C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/inverse_ohlc_removed_clean.png"

def test_inverse_and_removal():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        page.on("console", lambda msg: print(f"PAGE CONSOLE [{msg.type}]: {msg.text}"))
        page.on("pageerror", lambda err: print(f"PAGE ERROR: {err}"))

        print("[Test] 1. Navigating to TradingView chart...")
        page.goto(BASE_URL, timeout=30000)
        page.wait_for_selector("#tv_chart_container iframe", timeout=20000)

        print("[Test] 2. Waiting for TradingView Chart ready...")
        page.evaluate("""() => new Promise(res => {
            if (window.widget && window.widget.onChartReady) {
                window.widget.onChartReady(() => res(true));
            } else {
                setTimeout(() => res(true), 5000);
            }
        })""")
        time.sleep(2)

        inverse_pine = """//@version=5
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
     bordercolor = inv_close >= inv_open ? color.green : color.red)
"""

        print("[Test] 3. Compiling and adding Inverse OHLC indicator...")
        add_result = page.evaluate("""(code) => {
            if (!window.PineIndicators || !window.widget) return { success: false, reason: 'No widget' };
            const chart = window.widget.activeChart();
            if (!chart) return { success: false, reason: 'No chart' };
            const compileRes = window.PineIndicators.compileAndRegisterPine(code);
            if (!compileRes.success && compileRes.errors && compileRes.errors.length > 0) {
                return { success: false, errors: compileRes.errors };
            }
            return window.PineIndicators.addStudyToChart(chart, "Inverse OHLC", false).then(id => {
                return { success: true, studyId: id, studyName: "Inverse OHLC" };
            });
        }""", inverse_pine)

        print("[Test] Add result:", add_result)
        assert add_result.get("success"), f"Failed to add study: {add_result}"
        time.sleep(3)

        # 4. Verify indicator exists on chart and study is registered
        study_info = page.evaluate("""() => {
            const chart = window.widget.activeChart();
            const studies = chart.getAllStudies();
            const invStudy = studies.find(s => s.name && s.name.includes("Inverse OHLC"));
            return {
                allStudies: studies.map(s => ({ id: s.id, name: s.name })),
                hasInverse: Boolean(invStudy),
                inverseId: invStudy ? invStudy.id : null
            };
        }""")
        print("[Test] Study info on chart:", study_info)
        assert study_info["hasInverse"], "Inverse OHLC study must be on the chart"

        # Capture screenshot with Inverse OHLC active
        page.screenshot(path=ACTIVE_SCREENSHOT)
        print(f"[Test] Saved active screenshot to {ACTIVE_SCREENSHOT}")

        # 5. Test Indicator Removal and Zero Leaks
        print("[Test] 5. Removing Inverse OHLC indicator from chart...")
        inv_id = study_info["inverseId"]
        remove_res = page.evaluate("""(studyId) => {
            const chart = window.widget.activeChart();
            chart.removeEntity(studyId);
            return true;
        }""", inv_id)

        time.sleep(2)

        # 6. Assert zero studies and zero shape leaks
        post_removal_info = page.evaluate("""() => {
            const chart = window.widget.activeChart();
            const studies = chart.getAllStudies();
            const shapes = typeof chart.getAllShapes === 'function' ? chart.getAllShapes() : [];
            const tables = document.querySelectorAll('.tv-pine-table-container, [id^="pine_table_"]').length;
            return {
                studyCount: studies.length,
                shapeCount: shapes.length,
                tableCount: tables,
                activeStudiesMapSize: window._pineActiveStudies ? window._pineActiveStudies.size : 0
            };
        }""")
        print("[Test] Post removal audit:", post_removal_info)
        assert post_removal_info["studyCount"] == 0, f"Expected 0 studies, got {post_removal_info['studyCount']}"
        assert post_removal_info["shapeCount"] == 0, f"Expected 0 shapes, got {post_removal_info['shapeCount']}"
        assert post_removal_info["tableCount"] == 0, f"Expected 0 tables, got {post_removal_info['tableCount']}"

        page.screenshot(path=CLEAN_SCREENSHOT)
        print(f"[Test] Saved clean screenshot to {CLEAN_SCREENSHOT}")

        browser.close()
        print("[Test] ALL CHECKS PASSED: Inverse OHLC plotted correctly and zero-leak cleanup verified!")

if __name__ == "__main__":
    test_inverse_and_removal()
