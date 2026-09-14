import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    
    res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        chart.applyOverrides({
            'paneProperties.legendProperties.showStudyArguments': true
        });
        const model = chart._chartWidget._model.model();
        model.properties().childs().paneProperties.childs().legendProperties.childs().showStudyArguments.setValue(true);

        await chart.createStudy('Custom Symbol Candles', false, false);
        await new Promise(r => setTimeout(r, 2000));

        const studies = model.priceDataSources().filter(s => s !== model.mainSeries());
        const csc = studies.find(s => s.name && s.name().includes('Custom Symbol'));
        
        const innerDoc = window.widget._innerWindow().document;
        const legendItems = Array.from(innerDoc.querySelectorAll('[data-name="legend-source-item"], [data-name="legend-source-title"], [data-name="legend-source-description"]'));
        
        return {
            title: csc ? csc.title() : null,
            titleInParts: csc ? csc.titleInParts() : null,
            metaInputs: csc ? csc.metaInfo().inputs : null,
            legendText: legendItems.map(el => el.textContent.trim()).filter(Boolean)
        };
    }""")
    print("Title:", res.get("title"))
    print("TitleInParts:", res.get("titleInParts"))
    print("MetaInputs:", res.get("metaInputs"))
    print("Legend items:", res.get("legendText"))
    browser.close()
