import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        val = await page.evaluate("""async () => {
            const chart = window.widget.activeChart();
            await chart.createStudy('Moving Average', false, false, [9, 'close', 0]);
            await new Promise(r => setTimeout(r, 500));
            const studies = chart.getAllStudies ? chart.getAllStudies() : [];
            const ids = studies.map(s => ({ id: s.id, name: s.name }));
            if (ids.length > 0) {
                chart.showPropertiesDialog(ids[0].id);
                return { success: true, opened: ids[0] };
            }
            return { success: false, reason: 'no studies' };
        }""")
        print("Open study settings result:", val)
        await asyncio.sleep(1)

        dialog = await page.evaluate("""() => {
            const innerDoc = window.widget._innerWindow().document;
            const d = innerDoc.querySelector('[data-name="property-dialog"], [class*="dialog-"]');
            return d ? {
                found: true,
                title: d.querySelector('[class*="title-"]')?.textContent,
                text: d.textContent.slice(0, 100)
            } : { found: false };
        }""")
        print("Dialog info:", dialog)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
