import asyncio
from playwright.async_api import async_playwright

async def test_pine_editor_ui():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        
        print("1. Opening app at http://127.0.0.1:9000/ ...")
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)
        
        # Set chart to 15m resolution
        await page.evaluate('''() => {
            const chart = window.widget.activeChart();
            chart.setResolution('15');
        }''')
        await page.wait_for_timeout(2000)
        
        # Open Pine Editor Dock
        print("2. Opening Pine Editor Dock...")
        await page.evaluate('''() => {
            if (window.PineEditorIDE && typeof window.PineEditorIDE.toggle === 'function') {
                window.PineEditorIDE.toggle();
            }
        }''')
        await page.wait_for_timeout(1000)
        
        # Read scratch_luxalgo.pine content
        with open("e:/TRADINGVIEW ADVANCED/scratch_luxalgo.pine", "r", encoding="utf-8") as f:
            luxalgo_code = f.read()
            
        print("3. Setting Pine Script code in editor textarea...")
        await page.evaluate('''(code) => {
            const editor = document.getElementById('pine_code_input');
            if (editor) {
                editor.value = code;
                editor.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }''', luxalgo_code)
        await page.wait_for_timeout(500)
        
        # Click Compile button
        print("4. Clicking Compile button...")
        await page.click('#pine_compile_btn')
        await page.wait_for_timeout(1500)
        
        compiler_status = await page.evaluate('''() => {
            const statusText = document.getElementById('pine_compiler_status_text')?.textContent;
            const badge = document.getElementById('pine_tab_badge_compiler')?.textContent;
            const successMsg = document.querySelector('.pine-success-title')?.textContent;
            return { statusText, badge, successMsg };
        }''')
        print("Compiler Status:", compiler_status)
        
        # Click Add to Chart button
        print("5. Clicking Add to chart button...")
        await page.click('#pine_add_to_chart_btn')
        await page.wait_for_timeout(4000)
        
        add_result = await page.evaluate('''() => {
            const statusText = document.getElementById('pine_compiler_status_text')?.textContent;
            const chart = window.widget.activeChart();
            const studies = chart.getAllStudies ? chart.getAllStudies() : [];
            const consoleLogs = Array.from(document.querySelectorAll('.pine-console-log-line')).map(el => el.textContent);
            return {
                statusText,
                studies,
                consoleLogs: consoleLogs.slice(-3)
            };
        }''')
        print("Add to Chart Result:", add_result)
        
        screenshot_path = "C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/pine_editor_e2e_verified.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_pine_editor_ui())
