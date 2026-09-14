import asyncio
from playwright.async_api import async_playwright

BASE_URL = "http://127.0.0.1:9000"

async def check():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})

        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await asyncio.sleep(5)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        menu_items = await frame.evaluate("""() => {
            const canvas = document.querySelector("canvas[data-name='pane-top-canvas']");
            const rect = canvas.getBoundingClientRect();
            const clientX = rect.left + 300;
            const clientY = rect.top + 200;

            canvas.dispatchEvent(new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 2,
                clientX,
                clientY
            }));

            // Wait a tick
            return new Promise(resolve => {
                setTimeout(() => {
                    const menu = document.querySelector('.wrap-evmjQ0gK, [data-name="popup-menu-container"]');
                    if (!menu) return resolve({ found: false });
                    resolve({
                        found: true,
                        html: menu.outerHTML.slice(0, 500),
                        allElements: Array.from(menu.querySelectorAll('*')).map(e => e.className + ' | ' + e.textContent)
                    });
                }, 400);
            });
        }""")
        print("Menu items from right-click on chart:", menu_items)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(check())
