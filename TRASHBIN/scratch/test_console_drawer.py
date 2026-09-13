import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(5000)

    # Open Pine Editor
    page.evaluate("window.PineEditorIDE && window.PineEditorIDE.open && window.PineEditorIDE.open()")
    page.wait_for_timeout(500)

    # Click console toggle button
    page.query_selector('.pine-console-toggle-btn-v2').click()
    page.wait_for_timeout(500)

    drawer_info = page.evaluate("""() => {
        const drawer = document.querySelector('.pine-console-drawer-v2');
        if (!drawer) return null;
        const entries = Array.from(drawer.querySelectorAll('.pine-console-v2-entry')).map(e => ({
            text: e.textContent.trim(),
            color: window.getComputedStyle(e).color
        }));
        const cs = window.getComputedStyle(drawer);
        return {
            display: cs.display,
            bg: cs.backgroundColor,
            color: cs.color,
            borderTop: cs.borderTopColor,
            entries
        };
    }""")
    print("CONSOLE DRAWER INFO:", drawer_info)
    browser.close()
