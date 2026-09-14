import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        val = await page.evaluate("""async () => {
            const chart = window.widget.activeChart();
            const cw = chart._chartWidget;
            const panes = cw._paneWidgets.value();
            const p0 = panes[0];
            try {
                const innerDoc = window.widget._innerWindow().document;
                const canvas = innerDoc.querySelector("canvas[data-name='pane-top-canvas']");
                const rect = canvas.getBoundingClientRect();
                const fakeEvent = {
                    localX: 300,
                    localY: 300,
                    clientX: rect.left + 300,
                    clientY: rect.top + 300,
                    pageX: rect.left + 300,
                    pageY: rect.top + 300,
                    isTouch: false,
                    target: canvas,
                    currentTarget: canvas,
                    preventDefault: () => {},
                    stopPropagation: () => {}
                };
                await p0._showContextMenu(fakeEvent);
                return 'menu shown!';
            } catch (e) {
                return 'error: ' + e.message + '\\n' + e.stack;
            }
        }""")
        print("Show menu call result:", val)
        await asyncio.sleep(1)

        # Check main window document
        in_main = await page.evaluate("""() => {
            return Array.from(document.querySelectorAll('*'))
                .filter(el => el.textContent.includes('Reset') || el.textContent.includes('Settings'))
                .map(el => el.tagName + '.' + el.className + ': ' + el.textContent.slice(0, 30));
        }""")
        print("In main document:", in_main)

        # Check iframe document
        in_iframe = await page.evaluate("""() => {
            const innerDoc = window.widget._innerWindow().document;
            return Array.from(innerDoc.querySelectorAll('*'))
                .filter(el => el.textContent.includes('Reset') || el.textContent.includes('Settings'))
                .map(el => el.tagName + '.' + el.className + ': ' + el.textContent.slice(0, 30));
        }""")
        print("In iframe document:", in_iframe)

        # Check all children in #overlap-manager-root
        overlap = await page.evaluate("""() => {
            const innerDoc = window.widget._innerWindow().document;
            const om = innerDoc.querySelector('#overlap-manager-root') || document.querySelector('#overlap-manager-root');
            return om ? { found: true, html: om.innerHTML.slice(0, 500) } : { found: false };
        }""")
        print("Overlap manager:", overlap)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
