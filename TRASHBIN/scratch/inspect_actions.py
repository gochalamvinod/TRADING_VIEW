import asyncio
import json
from playwright.async_api import async_playwright

async def inspect_actions():
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

            // ActionsProvider is used inside showContextMenuForSources
            // Let's call ActionsProvider or pw.showContextMenuForSources
            // But let's see what items are in the array:
            const ActionsProvider = window.ActionsProvider || null;
            // Let's inspect pw's options
            return {
                mainId: main.id(),
                mainName: main.name(),
                hasPW: Boolean(pw)
            };
        }''')
        print("Initial info:", items_info)

        # Now let's test what happens if we patch ContextMenuManager or ActionsTable to filter out null/undefined
        patch_res = await page.evaluate('''() => {
            // Check if we can intercept ContextMenuManager.createMenu
            // Let's check window or module exports
            return "ready";
        }''')

        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_actions())
