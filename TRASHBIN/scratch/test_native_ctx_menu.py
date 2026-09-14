import asyncio
from playwright.async_api import async_playwright

async def inspect_native_context_menu():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        # Check what happens on right click on canvas
        # First remove any contextmenu capture listeners if present or test directly
        await frame.evaluate('''() => {
            // Check context menu elements
            console.log("Testing native context menu...");
        }''')

        # Click right button on canvas
        await frame.click("canvas[data-name='pane-top-canvas']", button="right", position={"x": 500, "y": 350})
        await page.wait_for_timeout(1000)

        info = await frame.evaluate('''() => {
            const popup = document.querySelector('[data-name="popup-menu-container"], [class*="menuWrap"], [class*="context-menu"]');
            const items = popup ? Array.from(popup.querySelectorAll('*')).map(el => el.textContent.trim()).filter(t => t.length > 0 && t.length < 40) : [];
            const modal = document.querySelector('[data-name="property-dialog"], [class*="dialog-"]');
            return {
                popupExists: popup !== null,
                items: Array.from(new Set(items)),
                modalExists: modal !== null && window.getComputedStyle(modal).display !== 'none'
            };
        }''')
        print("Right click result:", info)

        screenshot_path = "C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/inspect_native_ctx_menu.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_native_context_menu())
