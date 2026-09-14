import sys
import json
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

ARTIFACTS_DIR = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(6000)

    chart_frame = page.frames[1] if len(page.frames) > 1 else None

    # Inspect floating toolbars in both page and chart_frame
    res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        // Create a trend line to summon floating toolbar
        const t = Math.floor(Date.now() / 1000);
        let shapeId = null;
        try {
            shapeId = chart.createShape({ time: t - 600, price: 4340 }, { shape: 'trend_line', lock: false });
        } catch(e) {
            console.error("createShape error:", e);
        }

        // Wait a bit
        await new Promise(r => setTimeout(r, 1000));

        // Search for floating toolbars
        const mainToolbars = Array.from(document.querySelectorAll('.tv-floating-toolbar')).map(t => ({
            tag: t.tagName,
            className: t.className,
            html: t.outerHTML.slice(0, 200)
        }));

        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe ? iframe.contentDocument : null;
        const iframeToolbars = doc ? Array.from(doc.querySelectorAll('.tv-floating-toolbar')).map(t => ({
            tag: t.tagName,
            className: t.className,
            html: t.outerHTML.slice(0, 200)
        })) : [];

        return {
            shapeId,
            mainToolbars,
            iframeToolbars
        };
    }""")
    print("Floating toolbars found:", json.dumps(res, indent=2))

    page.screenshot(path=f"{ARTIFACTS_DIR}\\test_floating_toolbar.png")
    print("Saved screenshot: test_floating_toolbar.png")

    browser.close()
