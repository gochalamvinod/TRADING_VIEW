import sys
import json
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(4000)

    chart_frame = page.frames[1] if len(page.frames) > 1 else None
    if not chart_frame:
        print("ERROR: Chart frame not found!")
        browser.close()
        sys.exit(1)

    print("=== SEARCHING FOR LEGEND ELEMENTS IN CHART IFRAME ===")
    legend_info = chart_frame.evaluate("""() => {
        const results = [];
        // Find all elements in legend or containing XAUUSD
        const all = Array.from(document.querySelectorAll('*'));
        for (const el of all) {
            const text = (el.innerText || '').trim();
            const className = (typeof el.className === 'string') ? el.className : '';
            if (className.includes('legend') || (text.includes('XAUUSD') && el.children.length === 0)) {
                results.push({
                    tag: el.tagName,
                    class: className.slice(0, 80),
                    dataName: el.getAttribute('data-name') || '',
                    dataTitle: el.getAttribute('data-title') || '',
                    text: text.slice(0, 100).replace(/\\n/g, ' '),
                    rect: el.getBoundingClientRect(),
                    display: window.getComputedStyle(el).display,
                    visibility: window.getComputedStyle(el).visibility,
                    pointerEvents: window.getComputedStyle(el).pointerEvents,
                    parentClass: el.parentElement ? ((typeof el.parentElement.className === 'string') ? el.parentElement.className.slice(0, 60) : '') : ''
                });
            }
        }
        return results;
    }""")
    print(f"Found {len(legend_info)} matches:")
    for item in legend_info:
        print(f"[{item['tag']}] class='{item['class']}' data-name='{item['dataName']}' text='{item['text']}' rect=({item['rect']['x']},{item['rect']['y']},{item['rect']['width']}x{item['rect']['height']}) ptr={item['pointerEvents']}")

    # Let's inspect the entire legend source element
    legend_dom = chart_frame.evaluate("""() => {
        const legend = document.querySelector('[data-name="legend"]') || document.querySelector('[class*="legend"]');
        if (!legend) return "No legend found";
        return {
            outerHTML: legend.outerHTML.slice(0, 3000),
            sources: Array.from(document.querySelectorAll('[data-name="legend-source-item"], [class*="item-"]')).map(item => ({
                text: item.innerText ? item.innerText.replace(/\\n/g, ' ') : '',
                html: item.innerHTML.slice(0, 400),
                buttons: Array.from(item.querySelectorAll('button, [role="button"], [class*="button"]')).map(b => ({
                    title: b.title || b.getAttribute('aria-label') || '',
                    class: (typeof b.className === 'string') ? b.className : '',
                    dataName: b.getAttribute('data-name') || '',
                    text: b.innerText || ''
                }))
            }))
        };
    }""")
    print("\n=== LEGEND DOM ===")
    print(json.dumps(legend_dom, indent=2))

    page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\legend_debug.png", clip={"x": 0, "y": 0, "width": 800, "height": 300})
    print("Screenshot saved to legend_debug.png")

    browser.close()
