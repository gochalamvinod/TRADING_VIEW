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

    res = page.evaluate("""() => {
        try {
            const chart = window.widget.activeChart();
            chart.executeActionById('symbolSearch');
            return { ok: true };
        } catch(e) {
            return { error: e.message };
        }
    }""")
    print("executeActionById('symbolSearch') result:", res)
    page.wait_for_timeout(1500)

    # Check for opened dialogs in chart iframe
    chart_frame = page.frames[1] if len(page.frames) > 1 else None
    dialog_info = chart_frame.evaluate("""() => {
        const d = document.querySelector('[role="dialog"], [data-name="symbol-search-dialog"], [class*="dialog-"]');
        return d ? {
            tag: d.tagName,
            class: d.className,
            text: d.innerText.slice(0, 100).replace(/\\n/g, ' ')
        } : null;
    }""") if chart_frame else None

    print("Dialog in chart frame:", dialog_info)
    page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\symbol_search_test.png")
    browser.close()
