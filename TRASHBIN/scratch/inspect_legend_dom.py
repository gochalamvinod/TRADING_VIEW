import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
import json
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    
    res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();

        await chart.createStudy('SMA Crossover', false, false);
        await chart.createStudy('Custom Symbol Candles', false, false);
        await new Promise(r => setTimeout(r, 2500));

        const doc = window.widget._innerWindow().document;
        const studyItems = Array.from(doc.querySelectorAll('[data-name="legend-source-item"].study-l31H9iuA'));

        return studyItems.map(item => {
            const titleSpan = item.querySelector('[data-name="legend-source-title"]');
            const descSpan = item.querySelector('[data-name="legend-source-description"]');
            return {
                fullText: item.innerText.replace(/\\n/g, ' '),
                titleHTML: titleSpan ? titleSpan.outerHTML : null,
                descHTML: descSpan ? descSpan.outerHTML : null,
                titleText: titleSpan ? titleSpan.innerText : null,
                descText: descSpan ? descSpan.innerText : null,
                descDisplay: descSpan ? window.widget._innerWindow().getComputedStyle(descSpan).display : null
            };
        });
    }""")
    print("Study Items in Legend:")
    print(json.dumps(res, indent=2))
    browser.close()
