from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.on("console", lambda msg: print(f"[BROWSER] {msg.text}"))
    page.goto('http://127.0.0.1:9000')
    page.wait_for_selector('#tv_chart_container iframe')
    time.sleep(4)

    res = page.evaluate('''() => {
        // Let's inspect getPineIndicators or register a test study
        const chart = window.widget.activeChart();
        return new Promise((resolve) => {
            // We can check PineJS if available or create a custom indicator
            resolve("ready");
        });
    }''')
    print("Ready:", res)
    b.close()
