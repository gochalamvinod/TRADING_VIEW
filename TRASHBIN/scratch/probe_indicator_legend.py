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
        const sId = await chart.createStudy('SMA Crossover', false, false);
        await new Promise(r => setTimeout(r, 2000));

        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;

        const studyItems = Array.from(doc?.querySelectorAll('[data-name="legend-study-item"], [data-name="legend-source-item"], [class*="item-"]') || []);
        
        const details = studyItems.map(item => {
            const title = item.querySelector('[data-name="legend-source-title"], .title-l31H9iuA, [class*="title-"]')?.textContent?.trim();
            const eye = item.querySelector('[data-name="legend-show-hide-action"]');
            const gear = item.querySelector('[data-name="legend-settings-action"]');
            const code = item.querySelector('[data-name="legend-source-code-action"], .tv-legend-code-btn');
            const more = item.querySelector('[data-name="legend-more-action"]');
            return {
                title,
                hasEye: !!eye,
                hasGear: !!gear,
                hasCode: !!code,
                hasMore: !!more
            };
        });

        return {
            studyId: sId,
            itemsCount: studyItems.length,
            details
        };
    }""")
    print("Study legend check:\n", json.dumps(res, indent=2))
    browser.close()
