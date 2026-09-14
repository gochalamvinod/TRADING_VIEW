import asyncio
from playwright.async_api import async_playwright

async def test_tv_context_menu():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        # Remove our custom contextmenu listener and test native TradingView right click
        res = await frame.evaluate('''() => {
            // Close any open dialogs first
            const closeBtn = document.querySelector('[data-name="close"]');
            if (closeBtn) closeBtn.click();

            // Check if activeChart has context menu or how Charting Library handles right click
            const chart = window.widget.activeChart();
            return {
                hasChart: Boolean(chart),
                contextMenuActions: chart ? Object.keys(chart).filter(k => k.toLowerCase().includes('context') || k.toLowerCase().includes('menu')) : []
            };
        }''')
        print("Chart info:", res)

        # Now let's trigger a native right-click without our custom handler
        # Let's inspect what elements exist inside the iframe DOM
        dom_info = await frame.evaluate('''() => {
            return {
                allDataNames: Array.from(document.querySelectorAll('[data-name]')).map(el => el.getAttribute('data-name')),
            };
        }''')
        print("Data names in frame:", [d for d in dom_info['allDataNames'] if 'menu' in d.lower() or 'setting' in d.lower() or 'prop' in d.lower() or 'gear' in d.lower()])

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_tv_context_menu())
