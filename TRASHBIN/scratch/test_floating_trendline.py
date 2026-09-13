import sys
import os
import json
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)

    res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;

        // Get time from last bar
        const t1 = Math.floor(Date.now() / 1000) - 3600;
        const t2 = Math.floor(Date.now() / 1000);
        
        let shapeId = null;
        try {
            shapeId = await chart.createMultipointShape([
                { time: t1, price: 2000 },
                { time: t2, price: 2010 }
            ], {
                shape: 'trend_line',
                lock: false,
                disableSelection: false
            });
        } catch(e) {
            console.error("create shape error:", e);
        }

        await new Promise(r => setTimeout(r, 1000));

        // Let's see if we can select the shape via chartWidget
        try {
            const chartWidget = window.widget._innerAPI().chartWidget();
            const model = chartWidget.model();
            const sources = model.model().allLineSources();
            console.log("All line sources:", sources.length);
            if (sources.length > 0) {
                model.selection().set([sources[0]]);
                chartWidget.showPropertiesDialog(sources[0]); // or floating toolbar show
            }
        } catch(e) {
            console.error("Selection error:", e);
        }

        await new Promise(r => setTimeout(r, 1000));

        const outerTbs = Array.from(document.querySelectorAll('.tv-floating-toolbar')).map(tb => ({
            cls: tb.className,
            vis: window.getComputedStyle(tb).display !== 'none' && !tb.classList.contains('i-closed'),
            btnNames: Array.from(tb.querySelectorAll('[data-name]')).map(b => b.getAttribute('data-name'))
        }));
        const innerTbs = doc ? Array.from(doc.querySelectorAll('.tv-floating-toolbar')).map(tb => ({
            cls: tb.className,
            vis: window.getComputedStyle(tb).display !== 'none' && !tb.classList.contains('i-closed'),
            btnNames: Array.from(tb.querySelectorAll('[data-name]')).map(b => b.getAttribute('data-name'))
        })) : [];

        return {
            shapeId,
            outerTbs,
            innerTbs
        };
    }""")
    print("Result:", json.dumps(res, indent=2))
    browser.close()
