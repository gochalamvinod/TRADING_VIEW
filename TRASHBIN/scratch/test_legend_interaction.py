import sys
import json
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(6000)

    # Find the chart iframe
    chart_frame = None
    for f in page.frames:
        if "charting_library" in f.url or "custom.css" in f.content():
            chart_frame = f
            break
    if not chart_frame and len(page.frames) > 1:
        chart_frame = page.frames[1]

    print(f"Using chart frame: {chart_frame.url if chart_frame else 'None'}")

    # Inspect the legend elements
    info = chart_frame.evaluate("""() => {
        const titleEl = document.querySelector('[data-name="legend-source-title"]') || document.querySelector('.title-l31H9iuA');
        const itemEl = document.querySelector('[data-name="legend-series-item"]');
        const moreBtn = document.querySelector('[data-name="legend-more-action"]');
        return {
            hasTitle: !!titleEl,
            titleText: titleEl ? titleEl.innerText : null,
            titleRect: titleEl ? titleEl.getBoundingClientRect() : null,
            hasItem: !!itemEl,
            hasMoreBtn: !!moreBtn,
            moreBtnRect: moreBtn ? moreBtn.getBoundingClientRect() : null
        };
    }""")
    print("Legend info:", json.dumps(info, indent=2))

    # Test 1: Click the legend title
    print("Clicking title element...")
    click_res = chart_frame.evaluate("""() => {
        const titleEl = document.querySelector('[data-name="legend-source-title"]') || document.querySelector('.title-l31H9iuA');
        if (!titleEl) return { error: "No title element" };
        titleEl.click();
        return { success: true };
    }""")
    print("Click result:", click_res)
    page.wait_for_timeout(1500)

    # Check if symbol search dialog opened
    dialog_info = chart_frame.evaluate("""() => {
        const d = document.querySelector('[data-name="symbol-search-dialog"], [data-dialog-name="symbol-search"], [role="dialog"]');
        const input = document.querySelector('input[data-role="search"], input[type="text"]');
        return {
            dialogFound: !!d,
            dialogClass: d ? d.className : null,
            inputFound: !!input,
            inputValue: input ? input.value : null
        };
    }""")
    print("Dialog info after click:", json.dumps(dialog_info, indent=2))
    page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\legend_title_click_result.png")

    browser.close()
