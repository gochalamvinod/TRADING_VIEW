import time
from playwright.sync_api import sync_playwright

def test_removal():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1400, "height": 900})
        page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded", timeout=60000)
        page.wait_for_timeout(4000)

        # 1. Add Sessions [LuxAlgo] study
        res = page.evaluate("""async () => {
            const w = window.widget;
            const chart = w.activeChart();
            
            // Add Sessions [LuxAlgo] via loadScript and button or directly
            const code = `//@version=6
indicator("Sessions [LuxAlgo]", overlay=true)
plot(close)
`;
            window.PineEditorIDE.loadScript("Sessions [LuxAlgo]", code, "sessions_test");
            document.getElementById('pine_add_to_chart_btn').click();
            await new Promise(r => setTimeout(r, 2000));

            const studies = chart.getAllStudies();
            const shapes = chart.getAllShapes();
            return {
                studiesBefore: studies.map(s => ({ id: s.id, name: s.name })),
                shapesBefore: shapes.map(s => ({ id: s.id, name: s.name }))
            };
        }""")
        print("BEFORE REMOVAL:", res)

        # 2. Now remove the study via chart.removeEntity(studyId)
        removal_res = page.evaluate("""async () => {
            const w = window.widget;
            const chart = w.activeChart();
            const studies = chart.getAllStudies();
            if (studies.length > 0) {
                const sId = studies[0].id;
                console.log("Removing study:", sId);
                chart.removeEntity(sId);
            }
            
            // Wait 2.5 seconds for observer
            await new Promise(r => setTimeout(r, 2500));

            const studiesAfter = chart.getAllStudies();
            const shapesAfter = chart.getAllShapes();
            return {
                studiesAfter: studiesAfter.map(s => ({ id: s.id, name: s.name })),
                shapesAfter: shapesAfter.map(s => ({ id: s.id, name: s.name }))
            };
        }""")
        print("AFTER REMOVAL:", removal_res)

        browser.close()

if __name__ == "__main__":
    test_removal()
