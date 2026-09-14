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
        print("Opening Pine Editor...")
        await page.evaluate("""() => {
            const btn = document.querySelector('#pine-editor-btn') || Array.from(document.querySelectorAll('button, div')).find(el => el.textContent.includes('Pine Editor'));
            if (btn) btn.click();
            else if (window.PineEditorIDE && typeof window.PineEditorIDE.open === 'function') window.PineEditorIDE.open();
        }""")
        await page.wait_for_timeout(1000)

        # 2. Set user's script in editor
        user_script = '''//@version=6
indicator("Signal Shapes", overlay=true)
plotshape(open>close, title="Signal", style=shape.triangleup, location=location.belowbar, color=color.green)
'''
        print("Setting user script in Pine Editor...")
        await page.evaluate(f"""(script) => {{
            const ta = document.querySelector('#pine-code-input') || document.querySelector('.pine-ide-editor-textarea') || document.querySelector('textarea');
            if (ta) {{
                ta.value = script;
                ta.removeAttribute('readonly');
                ta.dispatchEvent(new Event('input', {{ bubbles: true }}));
                ta.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }}
            const banner = document.querySelector('.pine-ide-readonly-banner');
            if (banner) banner.style.display = 'none';
        }}""", user_script)
        await page.wait_for_timeout(500)

        # 3. Click Add to chart
        print("Clicking Add to chart...")
        add_result = await page.evaluate("""async () => {
            const addBtn = document.querySelector('.pine-ide-btn-add') || document.querySelector('.add-chart-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add to chart'));
            if (addBtn) {
                addBtn.click();
                return 'clicked addBtn';
            }
            return 'not found';
        }""")
        print("Add button clicked:", add_result)
        await page.wait_for_timeout(4000)

        # Check studies on chart
        studies_on_chart = await page.evaluate("""() => {
            if (window.widget && typeof window.widget.activeChart === 'function') {
                const chart = window.widget.activeChart();
                return chart.getAllStudies ? chart.getAllStudies() : [];
            }
            return [];
        }""")
        print("Studies on chart:", studies_on_chart)

        # Close Pine Editor drawer to get a full view of the chart
        await page.evaluate("""() => {
            const closeBtn = document.querySelector('.pine-ide-titlebar-btn.close') || document.querySelector('.pine-ide-titlebar-btn[title="Close"]');
            if (closeBtn) closeBtn.click();
        }""")
        await page.wait_for_timeout(1000)

        # Take screenshot of chart with shapes
        await page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/verify_shapes_plot.png')
        print("Screenshot saved to scratch/verify_shapes_plot.png")

        # Now test open[1] script
        print("\n--- Testing open[1] ---")
        history_script = '''//@version=6
indicator("Prev Open Line", overlay=true)
prevOpen = open[1]
plot(prevOpen, color=color.blue, linewidth=2)
'''
        # Re-open Pine Editor
        await page.evaluate("""() => {
            const btn = document.querySelector('#pine-editor-btn') || Array.from(document.querySelectorAll('button, div')).find(el => el.textContent.includes('Pine Editor'));
            if (btn) btn.click();
        }""")
        await page.wait_for_timeout(1000)

        await page.evaluate(f"""(script) => {{
            const ta = document.querySelector('#pine-code-input') || document.querySelector('.pine-ide-editor-textarea') || document.querySelector('textarea');
            if (ta) {{
                ta.value = script;
                ta.removeAttribute('readonly');
                ta.dispatchEvent(new Event('input', {{ bubbles: true }}));
                ta.dispatchEvent(new Event('change', {{ bubbles: true }}));
            }}
            const banner = document.querySelector('.pine-ide-readonly-banner');
            if (banner) banner.style.display = 'none';
        }}""", history_script)
        await page.wait_for_timeout(500)

        print("Clicking Add to chart for open[1]...")
        await page.evaluate("""async () => {
            const addBtn = document.querySelector('.pine-ide-btn-add') || document.querySelector('.add-chart-btn') || Array.from(document.querySelectorAll('button')).find(b => b.textContent.includes('Add to chart'));
            if (addBtn) addBtn.click();
        }""")
        await page.wait_for_timeout(4000)

        studies_on_chart2 = await page.evaluate("""() => {
            if (window.widget && typeof window.widget.activeChart === 'function') {
                const chart = window.widget.activeChart();
                return chart.getAllStudies ? chart.getAllStudies() : [];
            }
            return [];
        }""")
        print("Studies on chart after adding open[1]:", studies_on_chart2)

        # Close editor again and screenshot
        await page.evaluate("""() => {
            const closeBtn = document.querySelector('.pine-ide-titlebar-btn.close') || document.querySelector('.pine-ide-titlebar-btn[title="Close"]');
            if (closeBtn) closeBtn.click();
        }""")
        await page.wait_for_timeout(1000)

        await page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/verify_open1_plot.png')
        print("Screenshot saved to scratch/verify_open1_plot.png")

        # Print relevant console logs
        print("\nBrowser console errors/warnings:")
        for log in console_logs:
            if 'error' in log.lower() or 'warn' in log.lower() or 'pine' in log.lower():
                print("  ", log)

        await browser.close()

asyncio.run(main())
