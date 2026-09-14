import asyncio
from playwright.async_api import async_playwright

async def inspect_header():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        info = await page.evaluate("""() => {
            const innerDoc = window.widget._innerWindow().document;
            const buttons = Array.from(innerDoc.querySelectorAll('[data-name], button')).map(el => ({
                dataName: el.getAttribute('data-name'),
                ariaLabel: el.getAttribute('aria-label'),
                text: el.textContent.trim(),
                className: el.className
            })).filter(x => x.dataName || x.text.toLowerCase().includes('indicator') || x.ariaLabel?.toLowerCase().includes('indicator'));
            return buttons.slice(0, 20);
        }""")
        print("Header buttons:", info)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_header())
