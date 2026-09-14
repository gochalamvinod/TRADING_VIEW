import asyncio
from playwright.async_api import async_playwright

async def verify_sessions():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1600, "height": 900})
        
        print("1. Navigating to http://127.0.0.1:9000/ ...")
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        
        print("2. Waiting for chart widget to initialize...")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)
        
        # Set chart to 15m resolution
        await page.evaluate('''() => {
            const chart = window.widget.activeChart();
            chart.setResolution('15');
        }''')
        await page.wait_for_timeout(3000)
        
        # Read scratch_luxalgo.pine content
        with open("e:/TRADINGVIEW ADVANCED/scratch_luxalgo.pine", "r", encoding="utf-8") as f:
            luxalgo_code = f.read()
            
        print("3. Compiling and adding Sessions [LuxAlgo] via PineIndicators / Pine Editor API...")
        eval_res = await page.evaluate('''async (code) => {
            try {
                if (!window.PineIndicators) return { error: "PineIndicators not found" };
                const res = window.PineIndicators.compileAndRegisterPine(code);
                if (!res || !res.study) return { error: "compileAndRegisterPine failed", details: res };
                
                const chart = window.widget.activeChart();
                const studyId = await window.PineIndicators.addStudyToChart(chart, res.meta.title, res.meta.isOverlay);
                
                // Trigger session visuals rendering
                await window.PineIndicators.renderSessionVisuals(chart, code);
                
                return {
                    success: true,
                    studyTitle: res.meta.title,
                    studyId: studyId,
                    plotsCount: res.meta.plots.length
                };
            } catch (err) {
                return { error: err.message, stack: err.stack };
            }
        }''', luxalgo_code)
        
        print("Evaluation result:", eval_res)
        await page.wait_for_timeout(3000)
        
        # Take full chart screenshot
        screenshot_path = "C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/verified_sessions_luxalgo.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")
        
        # Inspect chart study and shapes count
        stats = await page.evaluate('''() => {
            const chart = window.widget.activeChart();
            const studies = chart.getAllStudies ? chart.getAllStudies() : [];
            return {
                studies: studies,
                registeredStudiesCount: window.PineIndicators ? window.PineIndicators.getStudyCount() : 0
            };
        }''')
        print("Chart stats:", stats)
        
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_sessions())
