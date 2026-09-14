import asyncio
import json
from playwright.async_api import async_playwright

async def inspect_cm_actions():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        items_info = await page.evaluate('''async () => {
            const chart = window.widget.activeChart();
            const cw = chart._chartWidget;
            const panes = cw._paneWidgets.value();
            const pw = panes[0];
            const model = cw._model.model();
            const main = model.mainSeries();
            const state = pw.state();

            // Let's hook into showContextMenuForSources to see the raw array i
            const origShow = pw.showContextMenuForSources;
            let capturedItems = null;
            pw.showContextMenuForSources = async function(sources, pos, opt, s, r) {
                // Let's call original or inspect
                return origShow.apply(this, arguments);
            };

            // Now let's trigger it and catch the error
            try {
                await pw.showContextMenuForSources([main], { clientX: 300, clientY: 100 }, undefined, { origin: "LegendPropertiesContextMenu" });
            } catch (err) {
                console.error("Caught error:", err);
            }

            return "done";
        }''')
        print("Test finished:", items_info)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_cm_actions())
