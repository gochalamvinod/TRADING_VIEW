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

    diag = chart_frame.evaluate("""() => {
        const titleEl = document.querySelector('[data-name="legend-source-title"]');
        if (!titleEl) return "No titleEl";
        const rect = titleEl.getBoundingClientRect();
        const centerX = rect.x + rect.width / 2;
        const centerY = rect.y + rect.height / 2;
        const topEl = document.elementFromPoint(centerX, centerY);

        const hierarchy = [];
        let curr = titleEl;
        while (curr) {
            const style = window.getComputedStyle(curr);
            hierarchy.push({
                tag: curr.tagName,
                class: (typeof curr.className === 'string') ? curr.className : '',
                zIndex: style.zIndex,
                pointerEvents: style.pointerEvents,
                position: style.position
            });
            curr = curr.parentElement;
        }

        return {
            titleRect: rect,
            topEl: topEl ? {
                tag: topEl.tagName,
                class: (typeof topEl.className === 'string') ? topEl.className : '',
                html: topEl.outerHTML.slice(0, 200)
            } : null,
            hierarchy: hierarchy
        };
    }""")

    print(json.dumps(diag, indent=2))
    browser.close()
