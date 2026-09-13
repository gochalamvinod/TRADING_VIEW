import sys
import json
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)

    print("=== MAIN PAGE ELEMENTS ===")
    main_elems = page.evaluate("""() => {
        const elems = Array.from(document.querySelectorAll('button, [role="button"], [role="tab"], .tab, [class*="button"], [id*="btn"], [id*="tab"], [class*="toolbar"], [id*="toolbar"], [id*="dock"], [class*="dock"], [id*="pine"], [class*="pine"]'));
        return elems.map(el => ({
            tag: el.tagName,
            id: el.id,
            className: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
            text: el.innerText ? el.innerText.trim().slice(0, 50) : '',
            ariaLabel: el.getAttribute('aria-label') || '',
            role: el.getAttribute('role') || '',
            title: el.getAttribute('title') || '',
            visible: el.offsetParent !== null,
            rect: { width: el.offsetWidth, height: el.offsetHeight }
        })).filter(e => e.visible && (e.rect.width > 0 || e.rect.height > 0));
    }""")
    print(f"Total visible interactive elements in Main Page: {len(main_elems)}")
    for e in main_elems:
        print(f"[{e['tag']}] id='{e['id']}' class='{e['className']}' text='{e['text']}' aria='{e['ariaLabel']}' title='{e['title']}'")

    print("\n=== CHART IFRAME ELEMENTS ===")
    chart_frame = page.frames[1] if len(page.frames) > 1 else None
    if chart_frame:
        iframe_elems = chart_frame.evaluate("""() => {
            const elems = Array.from(document.querySelectorAll('button, [role="button"], [role="tab"], [data-name], [class*="button"], [class*="toolbar"], [id*="header"], [id*="drawing"], [data-role="button"]'));
            return elems.map(el => ({
                tag: el.tagName,
                id: el.id,
                dataName: el.getAttribute('data-name') || '',
                className: typeof el.className === 'string' ? el.className.slice(0, 60) : '',
                text: el.innerText ? el.innerText.trim().slice(0, 50) : '',
                ariaLabel: el.getAttribute('aria-label') || '',
                role: el.getAttribute('role') || '',
                title: el.getAttribute('title') || '',
                visible: el.offsetParent !== null,
                rect: { width: el.offsetWidth, height: el.offsetHeight }
            })).filter(e => e.visible && (e.rect.width > 0 || e.rect.height > 0));
        }""")
        print(f"Total visible interactive elements in Chart Iframe: {len(iframe_elems)}")
        for e in iframe_elems:
            print(f"[{e['tag']}] data-name='{e['dataName']}' id='{e['id']}' text='{e['text']}' aria='{e['ariaLabel']}' title='{e['title']}'")

    page.screenshot(path="scratch/initial_page.png")
    print("\nInitial page screenshot saved to scratch/initial_page.png")
    browser.close()
