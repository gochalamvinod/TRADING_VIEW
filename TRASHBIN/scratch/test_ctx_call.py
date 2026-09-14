import asyncio
import json
from playwright.async_api import async_playwright

async def test_ctx():
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

            // Check if showContextMenuForSources exists
            console.log("pw.showContextMenuForSources:", typeof pw.showContextMenuForSources);
            try {
                const menu = await pw.showContextMenuForSources([main], { clientX: 300, clientY: 100 });
                return {
                    success: true,
                    menuReturned: Boolean(menu),
                    isShown: menu ? menu.isShown?.() : null
                };
            } catch (err) {
                return {
                    success: false,
                    error: err.toString(),
                    stack: err.stack
                };
            }
        }''')
        print("Call result:", res)
        await page.wait_for_timeout(1000)

        # Look for open menu
        menus = await frame.evaluate('''() => {
            const popups = Array.from(document.querySelectorAll('[data-name="popup-menu-container"], [class*="menuWrap"], [data-role="menu"]'));
            return popups.map(p => ({
                html: p.outerHTML.slice(0, 300),
                text: p.textContent.slice(0, 100)
            }));
        }''')
        print("Menus:", menus)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_ctx())
