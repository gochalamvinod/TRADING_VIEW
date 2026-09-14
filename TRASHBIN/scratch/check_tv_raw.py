import asyncio
from playwright.async_api import async_playwright

async def check_without_interception():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        # Let's inspect what happens if contextmenu is NOT intercepted:
        # We can stop our listener or remove it, or see what TradingView does
        res = await frame.evaluate('''() => {
            // Close dialog
            document.querySelector('[data-name="close"]')?.click();

            // Look at window.TradingView or ChartingLibrary features
            const features = window.TradingView ? Object.keys(window.TradingView) : [];
            return { features };
        }''')
        print("Frame TV:", res)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(check_without_interception())
