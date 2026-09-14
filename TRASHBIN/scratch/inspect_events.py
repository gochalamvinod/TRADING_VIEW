import asyncio
from playwright.async_api import async_playwright

async def inspect_events():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        info = await frame.evaluate("""() => {
            const chart = window.chartWidgetCollection?.activeChartWidget?.value();
            const res = {};
            res.hasChart = Boolean(chart);
            
            // Check context menu actions in chart
            if (chart) {
                res.hasContextMenu = typeof chart.contextMenuActions === 'function';
                res.hasPane = Boolean(chart._paneWidgets && chart._paneWidgets.length);
            }

            // Check if contextmenu event is prevented
            const canvas = document.querySelector("canvas[data-name='pane-top-canvas']");
            res.hasCanvas = Boolean(canvas);

            // Let's test dispatching mousedown button 2 and contextmenu
            let contextMenuFired = false;
            let prevented = false;
            const listener = (e) => {
                contextMenuFired = true;
                prevented = e.defaultPrevented;
            };
            document.addEventListener('contextmenu', listener, { capture: true });

            const rect = canvas.getBoundingClientRect();
            const evt = new MouseEvent('contextmenu', {
                bubbles: true,
                cancelable: true,
                clientX: rect.left + 200,
                clientY: rect.top + 200,
                button: 2
            });
            canvas.dispatchEvent(evt);
            document.removeEventListener('contextmenu', listener, { capture: true });

            res.contextMenuFired = contextMenuFired;
            res.prevented = prevented;

            return res;
        }""")
        print("Event info:", info)

        # Let's see what happens if we right-click via Playwright's mouse click
        await frame.click("canvas[data-name='pane-top-canvas']", button="right")
        await asyncio.sleep(1)

        popups = await frame.evaluate("""() => {
            return Array.from(document.querySelectorAll('*')).filter(el => {
                const s = window.getComputedStyle(el);
                return s.position === 'absolute' || s.position === 'fixed';
            }).map(el => ({
                tag: el.tagName,
                className: el.className,
                dataName: el.getAttribute('data-name'),
                zIndex: window.getComputedStyle(el).zIndex,
                text: el.textContent.slice(0, 50)
            })).filter(x => parseInt(x.zIndex, 10) > 100);
        }""")
        print("Popups found (z-index > 100):", popups[:10])

        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_events())
