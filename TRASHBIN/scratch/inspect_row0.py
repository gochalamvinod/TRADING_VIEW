import asyncio
from playwright.async_api import async_playwright

async def inspect_row0():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        html_info = await frame.evaluate('''() => {
            const vw = document.querySelector('[class*="valuesAdditionalWrapper-"]');
            if (!vw) return "no valuesAdditionalWrapper";
            
            const children = Array.from(vw.children).map(c => ({
                tag: c.tagName,
                cls: c.className,
                dataName: c.getAttribute('data-name'),
                text: c.textContent.trim(),
                html: c.outerHTML
            }));

            return children;
        }''')
        print(f"Row 0 has {len(html_info)} children:")
        for c in html_info:
            print(f"  [{c.get('tag')}] dataName={c.get('dataName')} cls={c.get('cls')[:40]} text={ascii(c.get('text'))}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_row0())
