import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        apis = await page.evaluate("""() => {
            const chart = window.widget.activeChart();
            const res = {};
            for (let k in chart) {
                if (typeof chart[k] === 'function') {
                    if (k.toLowerCase().includes('prop') || k.toLowerCase().includes('dialog') || k.toLowerCase().includes('action') || k.toLowerCase().includes('study')) {
                        res[k] = true;
                    }
                }
            }
            return Object.keys(res);
        }""")
        print("Chart properties/study APIs:", apis)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
