from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto('http://127.0.0.1:9000')
    page.wait_for_selector('#tv_chart_container iframe')
    time.sleep(4)

    res = page.evaluate('''async () => {
        const chart = window.widget.activeChart();
        const id = await chart.createStudy('Custom Symbol Candles', false, false);
        await new Promise(r => setTimeout(r, 2000));
        const studies = chart.getAllStudies();
        return {
            studyId: id,
            allStudies: studies.map(s => ({ id: s.id, name: s.name }))
        };
    }''')
    print("Studies added:", res)

    # Now let's inject a console logger or test ctx directly
    ctx_info = page.evaluate('''() => {
        const chart = window.widget.activeChart();
        const s = chart._chartWidget._model.model().priceDataSources().find(x => x.name && x.name().includes('Custom Symbol'));
        if (!s) return "Study not found in priceDataSources";
        return {
            sourceId: s.id(),
            name: s.name(),
            symbols: s.symbols ? s.symbols() : null,
            parentSources: s.parentSources ? s.parentSources().map(p => p.id()) : null
        };
    }''')
    print("Ctx info:", ctx_info)
    b.close()
