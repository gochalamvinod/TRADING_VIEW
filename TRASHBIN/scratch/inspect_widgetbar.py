import asyncio
from playwright.async_api import async_playwright

async def inspect_widgetbar():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        info = await page.evaluate("""() => {
            const innerDoc = window.widget._innerWindow().document;
            const wb = innerDoc.querySelector('[class*="widgetbar-"], [class*="widgetBar-"], #widgetbar');
            const btns = Array.from(innerDoc.querySelectorAll('[class*="widgetbar"] button, [data-name*="widgetbar"], [class*="widgetbar"] [role="button"]')).map(el => ({
                dataName: el.getAttribute('data-name'),
                ariaLabel: el.getAttribute('aria-label'),
                className: el.className
            }));
            return {
                hasWidgetbar: Boolean(wb),
                wbClass: wb?.className,
                buttons: btns
            };
        }""")
        print("Widgetbar info:", info)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_widgetbar())
