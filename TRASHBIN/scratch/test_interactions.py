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
    frame = iframe_el.content_frame()
    
    # 1. Test clicking on main series symbol title
    title_el = frame.query_selector('[data-name="legend-source-title"]')
    print("Found title_el:", title_el is not None)
    if title_el:
        print("Clicking title_el...")
        title_el.click()
        page.wait_for_timeout(1000)
        
        # Check if symbol search dialog is opened either in frame or in main page
        frame_dialog = frame.query_selector('[data-name="symbol-search-items-dialog"], [data-role="dialog"]')
        page_dialog = page.query_selector('[data-name="symbol-search-items-dialog"], [data-role="dialog"]')
        print("After title click -> frame_dialog:", frame_dialog is not None, "page_dialog:", page_dialog is not None)
        if frame_dialog:
            print("frame_dialog data-name:", frame_dialog.get_attribute('data-name'))
        if page_dialog:
            print("page_dialog data-name:", page_dialog.get_attribute('data-name'))

        # Close dialog if open (press Escape)
        page.keyboard.press("Escape")
        page.wait_for_timeout(500)

    # 2. Test hover on series item & 3-dots button
    series_item = frame.query_selector('[data-name="legend-series-item"]')
    print("Found series_item:", series_item is not None)
    more_btn = frame.query_selector('[data-name="legend-more-action"]')
    print("Found more_btn:", more_btn is not None)
    
    if series_item and more_btn:
        # Hover series item
        series_item.hover()
        page.wait_for_timeout(300)
        
        more_style = frame.evaluate("""() => {
            const btn = document.querySelector('[data-name="legend-more-action"]');
            if (!btn) return null;
            const cs = window.getComputedStyle(btn);
            return {
                display: cs.display,
                opacity: cs.opacity,
                visibility: cs.visibility,
                pointerEvents: cs.pointerEvents,
                width: cs.width,
                height: cs.height
            };
        }""")
        print("More btn computed style on hover:", more_style)
        
        # Click more_btn
        print("Clicking more_btn...")
        more_btn.click()
        page.wait_for_timeout(1000)
        
        # Check for context menu
        cm_frame = frame.query_selector('[data-name="menu-inner"], [class*="menu-"], [data-role="menu"]')
        cm_page = page.query_selector('[data-name="menu-inner"], [class*="menu-"], [data-role="menu"]')
        print("After more_btn click -> cm_frame:", cm_frame is not None, "cm_page:", cm_page is not None)
        if cm_frame:
            print("cm_frame class:", cm_frame.get_attribute('class'))
        if cm_page:
            print("cm_page class:", cm_page.get_attribute('class'))
            
    browser.close()
