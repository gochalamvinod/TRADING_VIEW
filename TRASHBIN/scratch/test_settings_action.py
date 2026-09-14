import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        result = await page.evaluate("""() => {
            if (!window.widget) return 'no widget';
            const chart = window.widget.activeChart();
            if (!chart) return 'no activeChart';
            try {
                chart.executeActionById("chartProperties");
                return 'executed chartProperties';
            } catch (e) {
                return 'error: ' + e.message;
            }
        }""")
        print("Execute action result:", result)
        await asyncio.sleep(1)

        dialog_info = await page.evaluate("""() => {
            const innerDoc = window.widget._innerWindow().document;
            const dialog = innerDoc.querySelector('[data-name="property-dialog"], [data-dialog-name], [class*="dialog-"]');
            return dialog ? {
                found: true,
                title: dialog.querySelector('[class*="title-"]')?.textContent,
                text: dialog.textContent.slice(0, 100)
            } : { found: false };
        }""")
        print("Dialog info:", dialog_info)

        # Also take screenshot
        await page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\scratch\chart_properties_direct_test.png")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
