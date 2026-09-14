import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        info = await page.evaluate("""() => {
            const chart = window.widget.activeChart();
            const cw = chart._chartWidget;
            const panes = cw._paneWidgets.value();
            const p0 = panes[0];
            const canvas = window.widget._innerWindow().document.querySelector("canvas[data-name='pane-top-canvas']");
            const rect = canvas.getBoundingClientRect();
            
            // test center
            const resCenter = p0._dataSourceAtPoint ? p0._dataSourceAtPoint(rect.width / 2, rect.height / 2) : 'no method';
            return {
                hasMethod: Boolean(p0._dataSourceAtPoint),
                resCenter: resCenter ? {
                    hasSource: Boolean(resCenter.source),
                    sourceName: resCenter.source?.name?.(),
                    sourceId: resCenter.source?.id?.()
                } : null
            };
        }""")
        print("dataSourceAtPoint test:", info)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
