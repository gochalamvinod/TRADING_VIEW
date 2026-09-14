import asyncio
from playwright.async_api import async_playwright

async def test_user_script():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        page = await b.new_page()

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        await page.goto("http://127.0.0.1:9000/")
        await page.wait_for_timeout(3500)

        test_script = """//@version=6
indicator("Title", overlay=true)
plotshape(open>close, title="Signal", style=shape.triangleup, location=location.belowbar, color=color.green)"""

        res = await page.evaluate("""(code) => {
            if (window.PineIndicators && window.PineIndicators.compilePineScript) {
                return window.PineIndicators.compilePineScript(code);
            }
            return "no PineIndicators";
        }""", test_script)
        print("Compile result:", res)

        add_res = await page.evaluate("""async (code) => {
            if (window.PineIndicators && window.PineIndicators.addCustomStudyToChart) {
                try {
                    const r = await window.PineIndicators.addCustomStudyToChart(code);
                    return { success: true, r };
                } catch(e) {
                    return { error: e.message, stack: e.stack };
                }
            }
            return "no addCustomStudyToChart";
        }""", test_script)
        print("Add result:", add_res)

        # Also test open[1]
        test_script_2 = """//@version=6
indicator("Title 2", overlay=true)
prevOpen = open[1]
plot(prevOpen)"""
        res_2 = await page.evaluate("""(code) => {
            if (window.PineIndicators && window.PineIndicators.compilePineScript) {
                return window.PineIndicators.compilePineScript(code);
            }
            return "no PineIndicators";
        }""", test_script_2)
        print("open[1] Compile result:", res_2)

        add_res_2 = await page.evaluate("""async (code) => {
            if (window.PineIndicators && window.PineIndicators.addCustomStudyToChart) {
                try {
                    const r = await window.PineIndicators.addCustomStudyToChart(code);
                    return { success: true, r };
                } catch(e) {
                    return { error: e.message, stack: e.stack };
                }
            }
            return "no addCustomStudyToChart";
        }""", test_script_2)
        print("open[1] Add result:", add_res_2)

        print("Console logs during test:", console_logs[:15])
        await b.close()

if __name__ == "__main__":
    asyncio.run(test_user_script())
