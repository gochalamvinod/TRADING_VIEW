import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)

    iframe_el = page.query_selector("#tv_chart_container iframe")
    frame = iframe_el.content_frame()
    
    # 1. Normal state
    res_normal = frame.evaluate("""() => {
        const item = document.querySelector('[data-name="legend-series-item"]');
        const btn = item?.querySelector('[data-name="legend-more-action"]');
        const wrapper = item?.querySelector('[class*="buttonsWrapper-"]');
        const buttons = item?.querySelector('[class*="buttons-"]');
        return {
            itemHtml: item?.outerHTML.slice(0, 300),
            btnStyle: btn ? {
                display: window.getComputedStyle(btn).display,
                opacity: window.getComputedStyle(btn).opacity,
                visibility: window.getComputedStyle(btn).visibility,
                pointerEvents: window.getComputedStyle(btn).pointerEvents,
                width: window.getComputedStyle(btn).width,
                height: window.getComputedStyle(btn).height
            } : null,
            wrapperStyle: wrapper ? {
                maxWidth: window.getComputedStyle(wrapper).maxWidth,
                width: window.getComputedStyle(wrapper).width,
                display: window.getComputedStyle(wrapper).display
            } : null,
            buttonsStyle: buttons ? {
                opacity: window.getComputedStyle(buttons).opacity,
                display: window.getComputedStyle(buttons).display,
                pointerEvents: window.getComputedStyle(buttons).pointerEvents
            } : null
        };
    }""")
    print("NORMAL STATE:", res_normal)
    
    # 2. Hover state
    series_item = frame.query_selector('[data-name="legend-series-item"]')
    series_item.hover()
    page.wait_for_timeout(300)
    
    res_hover = frame.evaluate("""() => {
        const item = document.querySelector('[data-name="legend-series-item"]');
        const btn = item?.querySelector('[data-name="legend-more-action"]');
        const wrapper = item?.querySelector('[class*="buttonsWrapper-"]');
        const buttons = item?.querySelector('[class*="buttons-"]');
        return {
            btnStyle: btn ? {
                display: window.getComputedStyle(btn).display,
                opacity: window.getComputedStyle(btn).opacity,
                visibility: window.getComputedStyle(btn).visibility,
                pointerEvents: window.getComputedStyle(btn).pointerEvents,
                width: window.getComputedStyle(btn).width,
                height: window.getComputedStyle(btn).height
            } : null,
            wrapperStyle: wrapper ? {
                maxWidth: window.getComputedStyle(wrapper).maxWidth,
                width: window.getComputedStyle(wrapper).width,
                display: window.getComputedStyle(wrapper).display
            } : null,
            buttonsStyle: buttons ? {
                opacity: window.getComputedStyle(buttons).opacity,
                display: window.getComputedStyle(buttons).display,
                pointerEvents: window.getComputedStyle(buttons).pointerEvents
            } : null
        };
    }""")
    print("HOVER STATE:", res_hover)
    
    browser.close()
