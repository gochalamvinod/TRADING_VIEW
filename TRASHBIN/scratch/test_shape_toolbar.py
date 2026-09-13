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
        const t = Math.floor(Date.now() / 1000) - 3600;
        const shapeId = await chart.createShape({ time: t, price: 2000 }, { shape: 'horizontal_line', lock: false });
        await new Promise(r => setTimeout(r, 1000));

        // Now select the shape
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;

        // Try selecting the shape via chart model
        try {
            const model = chart._model || (window.widget && window.widget._innerAPI && window.widget._innerAPI().model && window.widget._innerAPI().model());
            // Or get sources
            const sources = chart.getAllShapes ? chart.getAllShapes() : [];
            console.log("Sources:", sources);
        } catch(e) {}

        // Look for floating toolbars in both docs
        const outerTbs = Array.from(document.querySelectorAll('.tv-floating-toolbar')).map(tb => ({
            cls: tb.className,
            vis: window.getComputedStyle(tb).display !== 'none',
            btnNames: Array.from(tb.querySelectorAll('[data-name]')).map(b => b.getAttribute('data-name'))
        }));
        const innerTbs = doc ? Array.from(doc.querySelectorAll('.tv-floating-toolbar')).map(tb => ({
            cls: tb.className,
            vis: window.getComputedStyle(tb).display !== 'none',
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
