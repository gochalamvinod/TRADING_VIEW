import asyncio
from playwright.async_api import async_playwright

BASE_URL = "http://127.0.0.1:9000"

async def check():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})

        print("Navigating...")
        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await asyncio.sleep(5)

        # 1. Check broker host methods
        host_info = await page.evaluate("""() => {
            const b = window._mt5Broker;
            if (!b) return { error: "no broker" };
            const host = b._host;
            const methods = [];
            for (let k in host) {
                if (typeof host[k] === 'function') methods.push(k);
            }
            return {
                hasDefaultContextMenuActions: typeof host.defaultContextMenuActions === 'function',
                methods: methods.slice(0, 30)
            };
        }""")
        print("Broker Host Info:", host_info)

        # 2. Check iframe and chart
        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        chart_info = await frame.evaluate("""() => {
            const chartWidget = window.chartWidget || (window.widget && window.widget.activeChart && window.widget.activeChart());
            const winKeys = Object.keys(window).filter(k => k.toLowerCase().includes('chart') || k.toLowerCase().includes('widget'));
            return { winKeys };
        }""")
        print("Chart Info in Frame:", chart_info)

        # 3. Check what happens if we fire 'contextmenu' on pane-top-canvas
        cm_result = await frame.evaluate("""() => {
            const canvas = document.querySelector("canvas[data-name='pane-top-canvas']");
            if (!canvas) return { error: "no canvas" };

            // Listen for any menu appearing in the DOM
            let menuOpened = false;
            const observer = new MutationObserver((mutations) => {
                for (const m of mutations) {
                    for (const node of m.addedNodes) {
                        if (node.nodeType === 1) {
                            if (node.getAttribute('data-name')?.includes('menu') ||
                                node.className?.toString()?.includes('menu') ||
                                node.querySelector?.('[class*="item-"]')) {
                                menuOpened = true;
                            }
                        }
                    }
                }
            });
            observer.observe(document.body, { childList: true, subtree: true });

            // Dispatch right-click / contextmenu event
            const rect = canvas.getBoundingClientRect();
            const clientX = rect.left + 300;
            const clientY = rect.top + 200;

            const mDown = new MouseEvent("mousedown", {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 2,
                buttons: 2,
                clientX,
                clientY
            });
            canvas.dispatchEvent(mDown);

            const mUp = new MouseEvent("mouseup", {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 2,
                clientX,
                clientY
            });
            canvas.dispatchEvent(mUp);

            const cMenu = new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                view: window,
                button: 2,
                clientX,
                clientY
            });
            const defaultPrevented = !canvas.dispatchEvent(cMenu);

            return { defaultPrevented };
        }""")
        print("Contextmenu event dispatch result:", cm_result)
        await asyncio.sleep(1)

        menu_elements = await frame.evaluate("""() => {
            const menus = document.querySelectorAll('[data-name="popup-menu-container"], [class*="menu-"], [class*="contextMenu"]');
            return {
                count: menus.length,
                classes: Array.from(menus).map(m => m.className),
                text: Array.from(menus).map(m => m.textContent)
            };
        }""")
        print("Menu elements found:", menu_elements)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(check())
