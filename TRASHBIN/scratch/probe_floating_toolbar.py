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
        // Create a trendline shape to make floating toolbar appear
        try {
            // Get visible range or time
            const t = Math.floor(Date.now() / 1000);
            const shapeId = chart.createShape({ time: t, price: 2000 }, { shape: 'horizontal_line', lock: false });
            await new Promise(r => setTimeout(r, 1000));
        } catch(e) {}

        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;

        function findTbs(d) {
            if (!d) return [];
            return Array.from(d.querySelectorAll('.tv-floating-toolbar')).map(tb => ({
                className: tb.className,
                isClosed: tb.classList.contains('i-closed'),
                isHidden: tb.classList.contains('i-hidden'),
                hasCodeBtn: !!tb.querySelector('[data-name="source-code"], .tv-floating-code-btn'),
                buttons: Array.from(tb.querySelectorAll('button, [data-name]')).map(b => b.getAttribute('data-name'))
            }));
        }

        return {
            outer: findTbs(document),
            inner: findTbs(doc)
        };
    }""")
    print("Floating toolbars check:\n", json.dumps(res, indent=2))
    browser.close()
