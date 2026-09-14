import sys, time
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    time.sleep(3)

    res = page.evaluate("""() => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        return model.priceDataSources().map(s => ({
            name: s.name ? s.name() : 'unknown',
            isStudy: typeof s.isStudy === 'function' ? s.isStudy() : false,
            hasRestart: typeof s.restart === 'function',
            hasRecalculate: typeof s.recalculate === 'function',
            metaId: s._metaInfo ? s._metaInfo.id : null
        }));
    }""")
    print("Data sources:", res)
    browser.close()
