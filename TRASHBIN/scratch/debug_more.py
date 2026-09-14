import asyncio
import json
from playwright.async_api import async_playwright

async def debug_more():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        
        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        # Check more button
        btn_info = await frame.evaluate('''() => {
            const btn = document.querySelector('[data-name="legend-more-action"]');
            if (!btn) return { exists: false };
            return {
                exists: true,
                tag: btn.tagName,
                className: btn.className,
                rect: btn.getBoundingClientRect()
            };
        }''')
        print("More button info:", btn_info)

        # Trigger click on more button directly via JS and mouse
        click_res = await frame.evaluate('''() => {
            const btn = document.querySelector('[data-name="legend-more-action"]');
            if (!btn) return "not found";
            
            // Try dispatching click
            const rect = btn.getBoundingClientRect();
            const evt = new MouseEvent('click', {
                bubbles: true,
                cancelable: true,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                button: 0
            });
            btn.dispatchEvent(evt);
            return { dispatched: true };
        }''')
        print("Click dispatched:", click_res)
        await page.wait_for_timeout(800)

        # Look for any popup in DOM
        popups = await frame.evaluate('''() => {
            const all = Array.from(document.querySelectorAll('body *')).filter(el => {
                const s = window.getComputedStyle(el);
                return (s.position === 'fixed' || s.position === 'absolute') && s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 30 && el.offsetHeight > 30;
            }).map(el => ({
                tag: el.tagName,
                cls: el.className,
                dataName: el.getAttribute('data-name'),
                text: el.textContent.slice(0, 50)
            }));
            return all;
        }''')
        print("Popups after click:", json.dumps(popups, ensure_ascii=True))
        print("Console logs:", [l for l in console_logs if 'error' in l.lower() or 'warn' in l.lower()][:10])

        await browser.close()

if __name__ == "__main__":
    asyncio.run(debug_more())
