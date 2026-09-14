import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1400, 'height': 900})
        page = await context.new_page()

        console_logs = []
        page.on('console', lambda msg: console_logs.append(f'[{msg.type}] {msg.text}'))

        print("Navigating to http://127.0.0.1:9000 ...")
        await page.goto('http://127.0.0.1:9000', wait_until='domcontentloaded')
        await page.wait_for_timeout(5000)

        # 1. Open Pine Editor
        await page.evaluate("""() => {
            const btn = document.querySelector('#pine-editor-btn') || Array.from(document.querySelectorAll('button, div')).find(el => el.textContent.includes('Pine Editor'));
            if (btn) btn.click();
        }""")
        await page.wait_for_timeout(1000)

        # 2. Add user script
        user_script = '''//@version=6
indicator("Signal Shapes", overlay=true)
plotshape(open>close, title="Signal", style=shape.triangleup, location=location.belowbar, color=color.green)
'''
        print("Adding Signal Shapes...")
        await page.evaluate(f"""async (script) => {{
            const ta = document.querySelector('#pine-code-input');
            if (ta) {{
                ta.value = script;
                ta.removeAttribute('readonly');
                ta.dispatchEvent(new Event('input', {{ bubbles: true }}));
            }}
            const banner = document.querySelector('.pine-ide-readonly-banner');
            if (banner) banner.style.display = 'none';

            const addBtn = document.querySelector('#pine_add_to_chart_btn');
            if (addBtn) addBtn.click();
        }}""", user_script)
        await page.wait_for_timeout(4000)

        # Close editor to view full chart
        await page.evaluate("""() => {
            const closeBtn = document.querySelector('#pine_win_close');
            if (closeBtn) closeBtn.click();
        }""")
        await page.wait_for_timeout(1000)

        await page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/live_shapes_verification.png')
        print("Screenshot saved to scratch/live_shapes_verification.png")

        studies1 = await page.evaluate("""() => {
            if (window.widget && typeof window.widget.activeChart === 'function') {
                return window.widget.activeChart().getAllStudies();
            }
            return [];
        }""")
        print("Studies after Signal Shapes:", studies1)

        # Check console logs for any errors
        errors = [l for l in console_logs if 'error' in l.lower() and 'depth' not in l.lower()]
        print("Console errors:", errors)

        await browser.close()

asyncio.run(main())
