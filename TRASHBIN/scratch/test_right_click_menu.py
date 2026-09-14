import asyncio
import os
from playwright.async_api import async_playwright

BASE_URL = "http://127.0.0.1:9000"
ARTIFACTS_DIR = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f"

async def test_rc():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1400, "height": 850}, has_touch=True)
        page = await context.new_page()

        print("Navigating...")
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await asyncio.sleep(5)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        # Check chart ready
        is_ready = await frame.evaluate("() => Boolean(window.chartWidgetCollection?.activeChartWidget?.value())")
        print("Chart widget active:", is_ready)

        # Right click using Playwright's mouse
        box = await frame.locator("canvas[data-name='pane-top-canvas']").bounding_box()
        print("Canvas box:", box)

        if box:
            print(f"Right clicking at canvas...")
            await frame.locator("canvas[data-name='pane-top-canvas']").click(button="right")
            await asyncio.sleep(1)

        # Take screenshot
        ss_path = os.path.join(ARTIFACTS_DIR, "right_click_test.png")
        await page.screenshot(path=ss_path)
        print("Screenshot saved to:", ss_path)

        # Check for any menu in DOM
        menus = await frame.evaluate("""() => {
            const popupMenus = document.querySelectorAll('[data-name="popup-menu-container"], [class*="menuWrap"], [class*="contextMenu"]');
            const items = Array.from(document.querySelectorAll('[class*="item-"]')).map(el => el.textContent.trim());
            return {
                popupCount: popupMenus.length,
                items: items
            };
        }""")
        print("Menus after right click:", menus)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_rc())
