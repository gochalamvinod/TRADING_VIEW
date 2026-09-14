import asyncio
import json
from playwright.async_api import async_playwright

async def test_fix():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        res = await page.evaluate('''async () => {
            const chart = window.widget.activeChart();
            const cw = chart._chartWidget;
            const panes = cw._paneWidgets.value();
            const pw = panes[0];
            const model = cw._model.model();
            const main = model.mainSeries();

            // Patch showContextMenuForSources to filter out undefined/null before passing to createMenu
            const origShow = pw.showContextMenuForSources;
            pw.showContextMenuForSources = async function(sources, pos, opt, s, r) {
                // Let's call original
                return origShow.apply(this, arguments);
            };

            // Let's also patch ContextMenuManager if possible or test calling with clean array
            // Let's see: what if we disable text_notes feature?
            // In charting library:
            // window.TradingView features
            return "ready";
        }''')

        # Click the more button in legend
        more_btn = await frame.query_selector('[data-name="legend-more-action"]')
        print("More button found:", bool(more_btn))
        
        # Test clicking more button with page.evaluate monkey-patching items to filter(Boolean)
        menu_opened = await page.evaluate('''async () => {
            const chart = window.widget.activeChart();
            const cw = chart._chartWidget;
            const pw = cw._paneWidgets.value()[0];

            // Monkey-patch showContextMenuForSources to ensure items are filtered:
            const orig = pw.showContextMenuForSources;
            let resMenu = null;
            pw.showContextMenuForSources = async function(sources, pos, opt, s, r) {
                // Call orig
                try {
                    return await orig.apply(this, arguments);
                } catch(e) {
                    console.error("orig failed:", e);
                    throw e;
                }
            };

            const btn = document.querySelector("#tv_chart_container iframe")?.contentWindow?.document?.querySelector('[data-name="legend-more-action"]');
            if (btn) btn.click();
            return "clicked";
        }''')
        print("Click result:", menu_opened)
        await page.wait_for_timeout(1000)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_fix())
