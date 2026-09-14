import asyncio
from playwright.async_api import async_playwright

BASE_URL = "http://127.0.0.1:9000"

async def test_gestures():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        await page.goto(BASE_URL, wait_until="domcontentloaded")
        await asyncio.sleep(4)

        # Get iframe
        iframe_el = await page.query_selector("#tv_chart_container iframe")
        assert iframe_el, "Chart iframe must exist"
        frame = await iframe_el.content_frame()
        assert frame, "Content frame must exist"

        print("Page & iframe loaded successfully.")

        # 1. Test right click (two-finger tap simulation) on the main chart canvas
        canvas = await frame.query_selector("canvas[data-name='pane-top-canvas']")
        if not canvas:
            canvas = await frame.query_selector("canvas")
        print("Canvas found:", bool(canvas))

        # Check existing context menu listeners on chart or window
        handlers_info = await frame.evaluate("""() => {
            const res = {};
            res.hasContextMenuOnWindow = Boolean(window.oncontextmenu);
            res.hasContextMenuOnDoc = Boolean(document.oncontextmenu);
            return res;
        }""")
        print("Window/Doc contextmenu handlers:", handlers_info)

        # Let's perform a right-click on the top canvas (x=400, y=300)
        print("Performing right click (mouse button=right) on chart canvas...")
        await frame.click("canvas[data-name='pane-top-canvas']", button="right", position={"x": 400, "y": 300})
        await asyncio.sleep(1)

        # Check if context menu appeared
        menu_items = await frame.evaluate("""() => {
            // Check for popup menu / context menu
            const menu = document.querySelector('[data-name="popup-menu-container"], .menu-2-I872yt, [class*="menuWrap"], [class*="context-menu"]');
            if (!menu) {
                // look for any visible menu item
                const allMenus = Array.from(document.querySelectorAll('[class*="item-"], [class*="action-"]'))
                    .map(el => el.textContent.trim())
                    .filter(t => t.length > 0 && t.length < 50);
                return { menuFound: false, samples: allMenus.slice(0, 10) };
            }
            const items = Array.from(menu.querySelectorAll('[class*="item-"]')).map(el => el.textContent.trim());
            return { menuFound: true, items: items };
        }""")
        print("Right click context menu result:", menu_items)

        # 2. Check two-finger touch event simulation
        print("Simulating two-finger touch tap on canvas...")
        touch_result = await frame.evaluate("""() => {
            const canvas = document.querySelector("canvas");
            if (!canvas) return "no canvas";

            const touch1 = new Touch({
                identifier: 1,
                target: canvas,
                clientX: 400,
                clientY: 300,
                screenX: 400,
                screenY: 300,
                pageX: 400,
                pageY: 300
            });
            const touch2 = new Touch({
                identifier: 2,
                target: canvas,
                clientX: 410,
                clientY: 305,
                screenX: 410,
                screenY: 305,
                pageX: 410,
                pageY: 305
            });

            const startEvt = new TouchEvent("touchstart", {
                touches: [touch1, touch2],
                targetTouches: [touch1, touch2],
                changedTouches: [touch1, touch2],
                bubbles: true,
                cancelable: true
            });
            const defaultPrevented = !canvas.dispatchEvent(startEvt);

            const endEvt = new TouchEvent("touchend", {
                touches: [],
                targetTouches: [],
                changedTouches: [touch1, touch2],
                bubbles: true,
                cancelable: true
            });
            canvas.dispatchEvent(endEvt);

            return { defaultPrevented };
        }""")
        print("Touch simulation result:", touch_result)
        await asyncio.sleep(1)

        # Check if settings dialog opened or menu opened
        dialog_info = await frame.evaluate("""() => {
            const dialog = document.querySelector('[data-name="property-dialog"], [class*="dialog-"], [data-dialog-name]');
            return dialog ? { dialogFound: true, text: dialog.textContent.slice(0, 100) } : { dialogFound: false };
        }""")
        print("Dialog info after touch:", dialog_info)

        # 3. Check what happens on double click on canvas
        print("Testing double click on canvas...")
        await frame.dblclick("canvas[data-name='pane-top-canvas']", position={"x": 400, "y": 300})
        await asyncio.sleep(1)

        dialog_after_dblclick = await frame.evaluate("""() => {
            const dialog = document.querySelector('[data-name="property-dialog"], [class*="dialog-"], [data-dialog-name], [class*="properties-"]');
            return dialog ? { dialogFound: true, text: dialog.textContent.slice(0, 100) } : { dialogFound: false };
        }""")
        print("Dialog info after double click:", dialog_after_dblclick)

        # 4. Check what TradingView actions exist on the chart
        actions = await page.evaluate("""() => {
            if (!window.widget) return [];
            const chart = window.widget.activeChart();
            if (!chart) return [];
            // Check available chart actions
            const res = [];
            for (let k in chart) {
                if (typeof chart[k] === 'function') res.push(k);
            }
            return res;
        }""")
        print("Available chart functions on widget.activeChart():", [a for a in actions if 'setting' in a.lower() or 'dialog' in a.lower() or 'propert' in a.lower() or 'action' in a.lower()])

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_gestures())
