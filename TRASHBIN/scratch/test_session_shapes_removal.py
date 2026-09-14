import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
import time
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:9000"
ACTIVE_SESSION_SCREENSHOT = "C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/sessions_active_shapes.png"
PURGED_SESSION_SCREENSHOT = "C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/sessions_purged_clean.png"

def test_sessions_shape_removal():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})

        print("[Test] 1. Loading TradingView chart...")
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

        # 3. Add Sessions [LuxAlgo] indicator
        print("[Test] 3. Adding Sessions [LuxAlgo] indicator...")
        add_res = page.evaluate("""() => {
            const chart = window.widget.activeChart();
            return window.PineIndicators.addStudyToChart(chart, "Sessions [LuxAlgo]", true).then(id => {
                return { success: true, studyId: id };
            });
        }""")
        print("[Test] Add result:", add_res)
        assert add_res.get("success"), f"Failed to add study: {add_res}"
        time.sleep(3)

        # 4. Check that shapes were created
        shape_status = page.evaluate("""() => {
            const chart = window.widget.activeChart();
            const shapes = typeof chart.getAllShapes === 'function' ? chart.getAllShapes() : [];
            const activeSessionCount = window.PineIndicators ? (window._allPineShapeIds ? window._allPineShapeIds.size : 0) : 0;
            return {
                shapeCount: shapes.length,
                trackedCount: activeSessionCount
            };
        }""")
        print("[Test] Active shape status:", shape_status)
        page.screenshot(path=ACTIVE_SESSION_SCREENSHOT)
        print(f"[Test] Saved session shapes screenshot to {ACTIVE_SESSION_SCREENSHOT}")

        # 5. Remove the study
        print("[Test] 5. Removing Sessions [LuxAlgo] study from chart...")
        study_id = add_res["studyId"]
        page.evaluate("""(id) => {
            const chart = window.widget.activeChart();
            chart.removeEntity(id);
        }""", study_id)

        time.sleep(2)

        # 6. Audit after removal
        post_audit = page.evaluate("""() => {
            const chart = window.widget.activeChart();
            const studies = chart.getAllStudies();
            const shapes = typeof chart.getAllShapes === 'function' ? chart.getAllShapes() : [];
            const tracked = window._allPineShapeIds ? window._allPineShapeIds.size : 0;
            return {
                studyCount: studies.length,
                shapeCount: shapes.length,
                trackedCount: tracked
            };
        }""")
        print("[Test] Post removal audit:", post_audit)
        assert post_audit["studyCount"] == 0, f"Expected 0 studies, got {post_audit['studyCount']}"
        assert post_audit["shapeCount"] == 0, f"Expected 0 shapes remaining, got {post_audit['shapeCount']}"
        assert post_audit["trackedCount"] == 0, f"Expected 0 tracked shapes remaining, got {post_audit['trackedCount']}"

        page.screenshot(path=PURGED_SESSION_SCREENSHOT)
        print(f"[Test] Saved clean screenshot to {PURGED_SESSION_SCREENSHOT}")

        # 7. Test symbol/interval change doesn't respawn ghost shapes
        print("[Test] 7. Changing interval to 5m to verify zero ghost shape respawning...")
        page.evaluate("""() => {
            const chart = window.widget.activeChart();
            chart.setResolution("5");
        }""")
        time.sleep(2)

        ghost_audit = page.evaluate("""() => {
            const chart = window.widget.activeChart();
            const shapes = typeof chart.getAllShapes === 'function' ? chart.getAllShapes() : [];
            return { shapeCount: shapes.length };
        }""")
        print("[Test] Ghost audit after resolution change:", ghost_audit)
        assert ghost_audit["shapeCount"] == 0, f"Ghost shapes respawned! Got {ghost_audit['shapeCount']}"

        browser.close()
        print("[Test] ALL SESSION REMOVAL AND ZERO-GHOST-SHAPE CHECKS PASSED!")

if __name__ == "__main__":
    test_sessions_shape_removal()
