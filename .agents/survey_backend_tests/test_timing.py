from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto('http://127.0.0.1:9000')
    page.wait_for_selector('#tv_chart_container iframe')
    res = page.evaluate("""async () => {
        await new Promise(r => window.widget.onChartReady(r));
        await new Promise(r => setTimeout(r, 2000));
        const chart = window.widget.activeChart();
        try {
            return {
                ok: true,
                id: await chart.createStudy('SMA Crossover', false, false)
            };
        } catch(e) {
            return {
                ok: false,
                error: e.message
            };
        }
    }""")
    print('Result:', res)
    b.close()
