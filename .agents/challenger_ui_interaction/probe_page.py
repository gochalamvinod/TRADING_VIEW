"""
probe_page.py
Initial probe of http://127.0.0.1:9000 using Playwright to inspect page readiness,
iframe structure, Pine Editor elements, and chart readiness.
"""
import sys
import time
from playwright.sync_api import sync_playwright

def main():
    print("Launching Playwright Chromium...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        context = browser.new_context(viewport={"width": 1920, "height": 1080})
        page = context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda exc: console_errors.append(str(exc)))

        print("Navigating to http://127.0.0.1:9000...")
        page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded", timeout=30000)

        print("Waiting for #tv_chart_container iframe...")
        page.wait_for_selector("#tv_chart_container iframe", timeout=30000)

        print("Waiting 8s for chart widget and PineTS to initialize...")
        time.sleep(8)

        # Check chart ready
        chart_ready = page.evaluate("""() => {
            const w = window.widget;
            if (!w) return { ready: false, reason: 'window.widget is missing' };
            try {
                const chart = w.activeChart();
                return {
                    ready: !!chart,
                    symbol: chart ? chart.symbol() : null,
                    resolution: chart ? chart.resolution() : null,
                    idePresent: !!window.PineEditorIDE,
                    dockPresent: !!document.getElementById('pine_editor_dock'),
                    pinetsLoaded: !!(window.PineTSLib || window.PineTS)
                };
            } catch(e) {
                return { ready: false, error: e.message };
            }
        }""")
        print("Chart readiness:", chart_ready)
        print("Console errors count:", len(console_errors))
        if console_errors:
            print("First 5 errors:", console_errors[:5])

        browser.close()

if __name__ == '__main__':
    main()
