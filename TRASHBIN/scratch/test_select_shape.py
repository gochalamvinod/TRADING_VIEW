from playwright.sync_api import sync_playwright
import time
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(6000)

    res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const t = Math.floor(Date.now() / 1000);
        let shapeId = null;
        try {
            shapeId = await chart.createShape({ price: 4342 }, { shape: 'horizontal_line', lock: false, disableSelection: false });
        } catch(e) {
            console.error("createShape error:", e);
        }
        await new Promise(r => setTimeout(r, 800));
        
        const model = chart._chartWidget ? chart._chartWidget.model().model() : (chart.model ? chart.model() : null);
        let selected = false;
        if (model && shapeId) {
            const src = model.dataSourceForId(shapeId) || (chart.getShapeById ? chart.getShapeById(shapeId) : null);
            if (src && model.selection()) {
                model.selection().add(src);
                selected = true;
            }
        }
        await new Promise(r => setTimeout(r, 1200));

        const iframe = document.querySelector('#tv_chart_container iframe');
        const innerDoc = iframe ? iframe.contentDocument : null;
        const allToolbars = innerDoc ? Array.from(innerDoc.querySelectorAll('[class*="toolbar"], [class*="floating"], [data-name*="toolbar"]')).map(el => ({
            tag: el.tagName,
            className: el.className,
            dataName: el.getAttribute('data-name'),
            html: el.outerHTML.slice(0, 150)
        })) : [];
        return {
            shapeId,
            selected,
            allToolbars
        };
    }""")
    print("Result:", json.dumps(res, indent=2))
    browser.close()
