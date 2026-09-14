import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.on("console", lambda m: print(f"CONSOLE: {m.text[:100]}"))
    page.on("pageerror", lambda e: print(f"PAGEERROR: {e}"))
    page.goto("http://127.0.0.1:9000", wait_until="networkidle")
    page.wait_for_timeout(4000)

    print("Total frames:", len(page.frames))
    for i, f in enumerate(page.frames):
        print(f"Frame {i}: url={f.url}")
        try:
            titles = f.locator('[data-name="legend-source-title"]').all_inner_texts()
            print(f"  titles: {titles}")
            items = f.locator('[data-name="legend-series-item"]').all_inner_texts()
            print(f"  items: {items}")
        except Exception as e:
            print(f"  error: {e}")

    page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\diag_screenshot.png")
    browser.close()
