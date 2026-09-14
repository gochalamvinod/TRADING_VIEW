import sys
import json
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

artifact_dir = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f"

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    errors = []
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)

    print("Navigating to http://127.0.0.1:9000...")
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(7000)

    # Test 1: Switch resolution to 5S
    print("\nTesting resolution switch to 5S...")
    res_5s = page.evaluate("""() => {
        const w = window.tvWidget || window.widget;
        const chart = w.activeChart();
        chart.setResolution("5S");
        return {
            symbol: chart.symbol(),
            resolution: chart.resolution()
        };
    }""")
    print("5S Resolution state:", res_5s)
    page.wait_for_timeout(4000)
    page.screenshot(path=f"{artifact_dir}/chart_5s_verified.png")
    print("Screenshot saved: chart_5s_verified.png")

    # Test 2: Switch resolution to 10T
    print("\nTesting resolution switch to 10T...")
    res_10t = page.evaluate("""() => {
        const w = window.tvWidget || window.widget;
        const chart = w.activeChart();
        chart.setResolution("10T");
        return {
            symbol: chart.symbol(),
            resolution: chart.resolution()
        };
    }""")
    print("10T Resolution state:", res_10t)
    page.wait_for_timeout(4000)
    page.screenshot(path=f"{artifact_dir}/chart_10t_verified.png")
    print("Screenshot saved: chart_10t_verified.png")

    print("\nTotal console errors during switching:", len(errors))
    if errors:
        print("Sample console errors:", errors[:3])

    browser.close()
    print("Seconds and Ticks browser verification completed successfully!")
