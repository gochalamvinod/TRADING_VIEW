import asyncio
from playwright.async_api import async_playwright

async def test_legend_and_context():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_timeout(3500)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        # 1. Hover over series row in legend
        series_el = await frame.query_selector(".series-l31H9iuA, [data-name='legend-series-item']")
        print("Series el found:", bool(series_el))
        if series_el:
            await series_el.hover()
            await page.wait_for_timeout(500)

        # 2. Click the three dots more action button
        more_btn = await frame.query_selector("[data-name='legend-more-action']")
        print("More btn found:", bool(more_btn))
        if more_btn:
            await more_btn.click()
            await page.wait_for_timeout(1000)

        # Check if context menu opened
        menu_open = await frame.evaluate("""() => {
            const menu = document.querySelector('[data-name="menu-inner"], [class*="menuBox-"]');
            return menu ? menu.innerText : null;
        }""")
        print("Legend More Context Menu opened text:", menu_open)
        await page.screenshot(path="scratch/three_dots_opened.png")

        # 3. Test canvas right click (Secondary click)
        # Dismiss existing menu first by clicking outside
        await page.mouse.click(600, 300)
        await page.wait_for_timeout(500)

        # Right click on chart canvas
        canvas = await frame.query_selector("canvas")
        if canvas:
            box = await canvas.bounding_box()
            await page.mouse.click(box["x"] + 300, box["y"] + 200, button="right")
            await page.wait_for_timeout(1000)

        chart_menu = await frame.evaluate("""() => {
            const menu = document.querySelector('[data-name="menu-inner"], [class*="menuBox-"]');
            return menu ? menu.innerText : null;
        }""")
        print("Chart Right Click Context Menu text:", chart_menu)
        await page.screenshot(path="scratch/right_click_opened.png")

        # 4. Verify double-click does NOT open settings
        await page.mouse.click(600, 300)
        await page.wait_for_timeout(500)
        await page.mouse.dblclick(600, 300)
        await page.wait_for_timeout(800)

        settings_open = await page.evaluate("""() => {
            return Boolean(document.querySelector('[data-name="settings-dialog"], .tv-dialog'));
        }""")
        print("Settings dialog opened on double click? (should be False):", settings_open)

        print("Console errors during test:", console_errors)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_legend_and_context())
