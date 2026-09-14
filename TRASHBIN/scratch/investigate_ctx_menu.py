import asyncio
from playwright.async_api import async_playwright

async def check_ctx_menu():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        # Let's inspect event listeners and dispatch contextmenu to see what happens
        res = await frame.evaluate('''() => {
            const canvas = document.querySelector("canvas[data-name='pane-top-canvas']");
            const rect = canvas.getBoundingClientRect();
            const x = rect.left + 350;
            const y = rect.top + 250;

            // Dispatch pointerdown, mousedown (button 2), mouseup (button 2), contextmenu
            canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2, buttons: 2 }));
            canvas.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2, buttons: 2 }));
            canvas.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2, buttons: 0 }));
            const ctxEvt = new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 2 });
            canvas.dispatchEvent(ctxEvt);

            return {
                defaultPrevented: ctxEvt.defaultPrevented
            };
        }''')
        print("Dispatch result:", res)
        await page.wait_for_timeout(1000)

        # Look for any popup, menu, or dialog in the entire frame DOM
        dom_elements = await frame.evaluate('''() => {
            const allElements = Array.from(document.querySelectorAll('body *'));
            const popups = allElements.filter(el => {
                const s = window.getComputedStyle(el);
                return (s.position === 'fixed' || s.position === 'absolute') && s.display !== 'none' && s.visibility !== 'hidden' && el.offsetWidth > 50 && el.offsetHeight > 50;
            }).map(el => ({
                tag: el.tagName,
                className: el.className,
                dataName: el.getAttribute('data-name'),
                role: el.getAttribute('role'),
                text: el.textContent.slice(0, 80)
            }));
            return popups;
        }''')
        print("Visible floating elements count:", len(dom_elements))
        for el in dom_elements:
            try:
                print(f"  [{el.get('tag')}] dataName={el.get('dataName')} class={el.get('className')[:30]} text={repr(el.get('text')[:40])}")
            except:
                pass

        await browser.close()

if __name__ == "__main__":
    asyncio.run(check_ctx_menu())
