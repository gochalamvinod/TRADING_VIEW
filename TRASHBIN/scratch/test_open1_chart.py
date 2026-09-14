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

        # Open Pine Editor
        await page.evaluate("""() => {
            const btn = document.querySelector('#pine-editor-btn') || Array.from(document.querySelectorAll('button, div')).find(el => el.textContent.includes('Pine Editor'));
            if (btn) btn.click();
        }""")
        await page.wait_for_timeout(1000)

        history_script = '''//@version=6
indicator("Prev Open Line", overlay=true)
prevOpen = open[1]
plot(prevOpen, title="Prev Open", color=color.blue, linewidth=2)
'''

        # Compile and add directly through PineEditorIDE or click
        print("Compiling and adding Prev Open Line to chart...")
        result = await page.evaluate(f"""async (script) => {{
            const ta = document.querySelector('#pine-code-input');
            if (ta) {{
                ta.value = script;
                ta.removeAttribute('readonly');
                ta.dispatchEvent(new Event('input', {{ bubbles: true }}));
            }}
            const banner = document.querySelector('.pine-ide-readonly-banner');
            if (banner) banner.style.display = 'none';

            // Click Add to chart
            const addBtn = document.querySelector('#pine_add_to_chart_btn');
            if (addBtn) {{
                addBtn.click();
                return 'clicked';
            }}
            return 'addBtn not found';
        }}""", history_script)
        print("Add button action:", result)
        await page.wait_for_timeout(4000)

        # Check studies
        studies = await page.evaluate("""() => {
            if (window.widget && typeof window.widget.activeChart === 'function') {
                const chart = window.widget.activeChart();
                return chart.getAllStudies ? chart.getAllStudies() : [];
            }
            return [];
        }""")
        print("Studies on chart:", studies)

        # Close editor and take screenshot
        await page.evaluate("""() => {
            const closeBtn = document.querySelector('#pine_win_close');
            if (closeBtn) closeBtn.click();
        }""")
        await page.wait_for_timeout(1000)

        await page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/verify_prev_open_line.png')
        print("Screenshot saved to scratch/verify_prev_open_line.png")

        print("\nRelevant Console logs:")
        for l in console_logs:
            if any(k in l.lower() for k in ['pine', 'study', 'prev open', 'compil', 'error']):
                print("  ", l)

        await browser.close()

asyncio.run(main())
