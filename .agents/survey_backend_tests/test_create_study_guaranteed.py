from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto('http://127.0.0.1:9000')
    page.wait_for_selector('#tv_chart_container iframe')
    
    res = page.evaluate("""async () => {
        await new Promise(r => window.widget.onChartReady(r));
        
        // Check if PineIndicators has registered studies
        if (window.PineIndicators && window.PineIndicators.initPrebuiltStudies) {
            window.PineIndicators.initPrebuiltStudies();
        }
        
        const chart = window.widget.activeChart();
        const availableStudies = window.PineIndicators ? Array.from(window.PineIndicators.getRegisteredStudies().values()).map(s => s.metainfo.name) : [];
        
        let createdId = null;
        let err = null;
        try {
            // If SMA Crossover is available
            createdId = await chart.createStudy('SMA Crossover', false, false);
        } catch(e) {
            err = e.message;
        }
        
        return {
            availableStudies,
            createdId,
            err
        };
    }""")
    print("Guaranteed study test result:", res)
    b.close()
