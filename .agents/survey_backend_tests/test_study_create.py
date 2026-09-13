from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto('http://127.0.0.1:9000', timeout=20000)
    page.wait_for_selector('#tv_chart_container iframe', timeout=15000)
    
    # Wait for chart ready
    page.evaluate("""() => new Promise(res => {
        if (window.widget && window.widget.onChartReady) {
            window.widget.onChartReady(() => res(true));
        } else {
            setTimeout(res, 5000);
        }
    })""")
    
    res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const entityId = await chart.createStudy('SMA Crossover', false, false);
        return {
            entityId,
            studies: chart.getAllStudies()
        };
    }""")
    print("Study created:", res)
    b.close()
