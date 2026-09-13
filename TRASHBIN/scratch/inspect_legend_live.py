import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(6000)

    iframe_el = page.query_selector("#tv_chart_container iframe")
    if not iframe_el:
        print("No iframe found!")
        browser.close()
        sys.exit(1)

    frame = iframe_el.content_frame()
    
    info = frame.evaluate("""() => {
        const seriesItem = document.querySelector('[data-name="legend-series-item"], .series-l31H9iuA');
        const titles = Array.from(document.querySelectorAll('[data-name="legend-source-title"], [data-name="legend-source-description"], [class*="title-"]')).map(t => ({
            text: t.textContent.trim(),
            dataset: Object.assign({}, t.dataset),
            className: t.className,
            parentDataset: Object.assign({}, t.parentElement ? t.parentElement.dataset : {}),
            parentClass: t.parentElement ? t.parentElement.className : ''
        }));
        
        const seriesButtons = seriesItem ? Array.from(seriesItem.querySelectorAll('button, [data-name*="action"]')).map(b => ({
            name: b.getAttribute('data-name'),
            title: b.getAttribute('title') || b.getAttribute('aria-label'),
            className: b.className,
            computedDisplay: window.getComputedStyle(b).display,
            computedOpacity: window.getComputedStyle(b).opacity,
            computedVisibility: window.getComputedStyle(b).visibility
        })) : [];
        
        const logos = Array.from(document.querySelectorAll('[class*="logo"], [data-name*="logo"], img')).map(img => ({
            src: img.src || img.getAttribute('src'),
            className: img.className,
            parentElement: img.parentElement ? img.parentElement.className : ''
        }));
        
        return {
            hasSeriesItem: !!seriesItem,
            seriesItemClass: seriesItem ? seriesItem.className : '',
            titles,
            seriesButtons,
            logos
        };
    }""")
    print("LIVE LEGEND INFO:", info)
    browser.close()
