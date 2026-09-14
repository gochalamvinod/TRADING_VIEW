from playwright.sync_api import sync_playwright
import json

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(6000)

    chart_frame = page.frames[1] if len(page.frames) > 1 else None
    res = chart_frame.evaluate("""() => {
        // Look for any existing floating toolbar in DOM
        const tbDom = Array.from(document.querySelectorAll('.tv-floating-toolbar, [data-name="drawing-toolbar"]'));
        
        return {
            tbDomCount: tbDom.length,
            tbDomClasses: tbDom.map(el => el.className)
        };
    }""")
    print("TB DOM:", json.dumps(res, indent=2))
    browser.close()
