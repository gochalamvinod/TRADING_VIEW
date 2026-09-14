import asyncio
import json
from playwright.async_api import async_playwright

async def inspect_series_actions():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        items_breakdown = await page.evaluate('''async () => {
            const chart = window.widget.activeChart();
            const cw = chart._chartWidget;
            const panes = cw._paneWidgets.value();
            const pw = panes[0];
            const model = cw._model.model();
            const main = model.mainSeries();

            // We can intercept the internal ActionsProvider call
            // Notice: pw.showContextMenuForSources creates new En.ActionsProvider(this._chart, o);
            // Let's find En.ActionsProvider on cw or pw or inspect pw._chart:
            let interceptedItems = null;
            const origShowCM = pw.showContextMenuForSources;
            pw.showContextMenuForSources = async function(sources, pos, opt, s, r) {
                // Let's create an ActionsProvider directly or trace
                return origShowCM.apply(this, arguments);
            };

            // Let's see: pw._chart has actions:
            const actions = pw._chart.actions();
            const actionKeys = actions ? Object.keys(actions) : [];
            const missingActions = actionKeys.filter(k => !actions[k]);

            // Let's inspect what is in pw._chart:
            return {
                actionKeys: actionKeys.slice(0, 30),
                missingActions,
                showSymbolInfoDialog: typeof actions.showSymbolInfoDialog,
                showDataWindow: typeof actions.showDataWindow,
                addToWatchlist: typeof actions.addToWatchlist,
                addToTextNotes: typeof actions.addToTextNotes,
                mainSeriesPropertiesAction: typeof actions.mainSeriesPropertiesAction
            };
        }''')
        print("Breakdown:", items_breakdown)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_series_actions())
