import asyncio
from playwright.async_api import async_playwright

async def test_settings():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await b.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/")
        await page.wait_for_timeout(3500)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        # Right click canvas
        canvas = await frame.query_selector("canvas")
        box = await canvas.bounding_box()
        await page.mouse.click(box["x"] + 300, box["y"] + 200, button="right")
        await page.wait_for_timeout(500)

        # Click Settings in the context menu
        settings_item = await frame.query_selector("[class*='item-']:has-text('Settings')")
        print("Settings item in context menu:", bool(settings_item))
        if settings_item:
            await settings_item.click()
            await page.wait_for_timeout(1000)

        # Check if settings dialog opened
        dialog = await frame.query_selector("[class*='dialog-']")
        print("Settings dialog opened:", bool(dialog))
        await page.screenshot(path="scratch/settings_dialog_opened.png")
        await b.close()

if __name__ == "__main__":
    asyncio.run(test_settings())
