import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="networkidle")
    page.wait_for_timeout(4000)

    # Add an indicator if none exists
    page.evaluate("""async () => {
        const chart = window.widget?.activeChart();
        if (chart) {
            await chart.createStudy('Moving Average', false, false, [9, 'close', 0]);
        }
    }""")
    page.wait_for_timeout(2000)

    # Check legend items
    legend_info = page.evaluate("""() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        if (!doc) return { error: 'no doc' };

        const items = Array.from(doc.querySelectorAll('[data-name="legend-source-item"], [data-name="legend-study-item"], [class*="item-"]')).map(el => {
            const btns = Array.from(el.querySelectorAll('button, div, span')).filter(b => 
                b.getAttribute('data-name')?.includes('action') || 
                b.className?.includes('tv-legend-code-btn') ||
                b.textContent?.trim() === '{ }'
            ).map(b => ({
                tag: b.tagName,
                dataName: b.getAttribute('data-name'),
                className: b.className,
                title: b.getAttribute('title'),
                text: b.textContent?.trim()
            }));
            return {
                text: el.textContent?.slice(0, 50),
                buttons: btns
            };
        });
        return { itemsCount: items.length, items };
    }""")
    print("Legend info:", legend_info)

    # Check floating toolbar
    tb_info = page.evaluate("""() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe?.contentDocument;
        const outerTbs = Array.from(document.querySelectorAll('.tv-floating-toolbar')).map(tb => ({
            loc: 'outer',
            className: tb.className,
            html: tb.outerHTML.slice(0, 300)
        }));
        const innerTbs = doc ? Array.from(doc.querySelectorAll('.tv-floating-toolbar')).map(tb => ({
            loc: 'inner',
            className: tb.className,
            html: tb.outerHTML.slice(0, 300)
        })) : [];
        return { outerTbs, innerTbs };
    }""")
    print("Floating toolbars:", tb_info)

    browser.close()
