import asyncio
import json
from playwright.async_api import async_playwright

async def inspect_dots():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        # Find legend and hover over the series title to reveal buttons
        series_item = await frame.query_selector('[data-name="legend-series-item"], [class*="item-"][data-name="legend-source-item"]')
        if not series_item:
            series_item = await frame.query_selector('[class*="item-"]')
        print("Series item found:", bool(series_item))

        # Hover over series item
        if series_item:
            await series_item.hover()
            await page.wait_for_timeout(500)

        # Look for buttons inside series legend
        buttons = await frame.evaluate('''() => {
            const btns = Array.from(document.querySelectorAll('[data-name*="legend"], [class*="button-"], [class*="icon-"]'));
            return btns.map(b => ({
                tag: b.tagName,
                cls: b.className,
                dataName: b.getAttribute('data-name'),
                ariaLabel: b.getAttribute('aria-label'),
                text: b.textContent.trim(),
                visible: window.getComputedStyle(b).display !== 'none' && window.getComputedStyle(b).visibility !== 'hidden'
            })).filter(b => b.dataName || b.ariaLabel || b.text === '•••' || b.cls.includes('more'));
        }''')
        print("Buttons found in legend:", json.dumps(buttons, ensure_ascii=True)[:500])

        # Try to click the three dots button
        # Selector for more button
        more_btn = await frame.query_selector('[data-name="legend-more-action"], [data-name="more"], [aria-label*="More"], [class*="more-"]')
        print("More button selector found:", bool(more_btn))
        if more_btn:
            print("Clicking more button...")
            await more_btn.click()
            await page.wait_for_timeout(1000)
            
            # Check what appeared
            popups = await frame.evaluate('''() => {
                const popups = Array.from(document.querySelectorAll('[data-name="popup-menu-container"], [class*="menuWrap"], [class*="context-menu"], [role="menu"]'));
                return popups.map(p => ({
                    cls: p.className,
                    dataName: p.getAttribute('data-name'),
                    items: Array.from(p.querySelectorAll('*')).map(el => el.textContent.trim()).filter(t => t.length > 0 && t.length < 40)
                }));
            }''')
            print("Popups after clicking more:", popups)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_dots())
