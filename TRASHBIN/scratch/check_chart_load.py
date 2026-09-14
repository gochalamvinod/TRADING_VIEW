import sys
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})

    err_msgs = []
    feed_msgs = []

    def on_console(m):
        txt = m.text
        if "Incremental update failed" in txt:
            feed_msgs.append(txt)
        if m.type == "error":
            err_msgs.append(txt)

    page.on("console", on_console)
    print("Navigating to http://127.0.0.1:9000...")
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(6000)

    print(f"Total 'Incremental update failed' messages: {len(feed_msgs)}")
    print(f"Total console error messages: {len(err_msgs)}")
    if feed_msgs:
        print(f"Sample feed message: {feed_msgs[0]}")
    if err_msgs:
        print(f"Sample error message: {err_msgs[:3]}")

    page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\check_chart_load.png")
    print("Screenshot saved: check_chart_load.png")
    browser.close()
