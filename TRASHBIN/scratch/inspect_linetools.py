import asyncio
from playwright.async_api import async_playwright

async def inspect_linetools():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        info = await page.evaluate("""() => {
            const chart = window.widget.activeChart();
            const cw = chart._chartWidget;
            const model = cw._model.model();
            
            // Check line tools methods
            const res = {};
            for (let k in model) {
                if (k.toLowerCase().includes('line') || k.toLowerCase().includes('tool') || k.toLowerCase().includes('draw')) {
                    res[k] = typeof model[k];
                }
            }
            return {
                methods: res,
                hasAllLineTools: typeof model.allLineTools === 'function',
                hasLineTools: typeof model.lineTools === 'function'
            };
        }""")
        print("Model line tool methods:", info)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_linetools())
