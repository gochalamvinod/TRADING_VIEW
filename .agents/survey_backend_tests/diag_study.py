from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.on("console", lambda msg: print(f"[BROWSER {msg.type}] {msg.text}"))
    page.goto('http://127.0.0.1:9000')
    page.wait_for_selector('#tv_chart_container iframe')
    
    info = page.evaluate("""async () => {
        await new Promise(r => window.widget.onChartReady(r));
        const reg = window.PineIndicators ? Array.from(window.PineIndicators.getRegisteredStudies().values()).map(s => s.metainfo.name) : [];
        return {
            reg,
            hasPineTranspiler: !!window.PineTranspiler
        };
    }""")
    print("Pre-create info:", info)
    
    # Now try create study
    study_res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        try {
            return await chart.createStudy('SMA Crossover', false, false);
        } catch(e) {
            return { error: e.message };
        }
    }""")
    print("Create study result:", study_res)
    b.close()
