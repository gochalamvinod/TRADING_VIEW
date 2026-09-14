import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        await page.evaluate("""() => {
            const chart = window.widget.activeChart();
            chart.executeActionById('chartProperties');
        }""")
        await asyncio.sleep(0.5)
        d_info = await page.evaluate("""() => {
            const innerDoc = window.widget._innerWindow().document;
            const dialog = innerDoc.querySelector('[data-name="property-dialog"], [data-dialog-name], [class*="dialog-"]');
            return {
                found: Boolean(dialog),
                tag: dialog?.tagName,
                className: dialog?.className,
                dataName: dialog?.getAttribute('data-name'),
                dataDialogName: dialog?.getAttribute('data-dialog-name'),
                id: dialog?.id
            };
        }""")
        print("Dialog attributes after 1st call:", d_info)

        # Call again
        await page.evaluate("""() => {
            window.widget.activeChart().executeActionById('chartProperties');
        }""")
        await asyncio.sleep(0.5)

        d_info2 = await page.evaluate("""() => {
            const innerDoc = window.widget._innerWindow().document;
            const dialog = innerDoc.querySelector('[class*="dialog-"]');
            return {
                found: Boolean(dialog),
                className: dialog?.className
            };
        }""")
        print("Dialog attributes after 2nd call:", d_info2)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
