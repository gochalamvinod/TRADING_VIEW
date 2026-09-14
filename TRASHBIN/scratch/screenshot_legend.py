import sys
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    
    page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        await chart.createStudy('Custom Symbol Candles', false, false);
        await new Promise(r => setTimeout(r, 2500));
    }""")
    page.wait_for_timeout(3000)
    page.screenshot(path="verified_legend_inputs.png")
    print("Screenshot saved to verified_legend_inputs.png")
    browser.close()
