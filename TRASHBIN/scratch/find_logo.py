import asyncio
from playwright.async_api import async_playwright

async def find_logo():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        # Find elements containing 'logo' or svg or button near bottom-left of chart
        res = await frame.evaluate('''() => {
            const results = [];
            document.querySelectorAll('*').forEach(el => {
                const rect = el.getBoundingClientRect();
                const cls = (el.className && typeof el.className === 'string') ? el.className : '';
                const id = el.id || '';
                const dataName = el.getAttribute('data-name') || '';
                const ariaLabel = el.getAttribute('aria-label') || '';
                const href = el.getAttribute('href') || '';
                
                // Match anything mentioning logo, tradingview, or circle button
                if (
                    cls.toLowerCase().includes('logo') ||
                    id.toLowerCase().includes('logo') ||
                    dataName.toLowerCase().includes('logo') ||
                    ariaLabel.toLowerCase().includes('tradingview') ||
                    href.toLowerCase().includes('tradingview') ||
                    cls.toLowerCase().includes('watermark') ||
                    (rect.left >= 0 && rect.left < 100 && rect.top > 300 && rect.width > 15 && rect.width < 60 && rect.height > 15 && rect.height < 60)
                ) {
                    results.push({
                        tag: el.tagName,
                        id,
                        cls,
                        dataName,
                        ariaLabel,
                        href,
                        rect: { left: rect.left, top: rect.top, width: rect.width, height: rect.height },
                        html: el.outerHTML.slice(0, 150)
                    });
                }
            });
            return results;
        }''')
        print(f"Found {len(res)} candidates:")
        for r in res:
            print(r)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(find_logo())
