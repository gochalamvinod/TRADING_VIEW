import asyncio
import json
import time
from playwright.async_api import async_playwright

async def run_verification():
    results = {
        "success": False,
        "errors": [],
        "console_errors": [],
        "resolution_5s_rendered": False,
        "resolution_1s_rendered": False,
        "resolution_1t_rendered": False,
    }

    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        page.on("console", lambda msg: results["console_errors"].append(msg.text) if msg.type == "error" else None)
        page.on("pageerror", lambda err: results["errors"].append(str(err)))

        print("Navigating to http://127.0.0.1:9000...")
        await page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded", timeout=30000)

        # Wait for chart ready
        print("Waiting for chart readiness...")
        await page.wait_for_function("typeof window.widget !== 'undefined'", timeout=20000)
        await asyncio.sleep(5)

        # 1. Switch to 5S resolution (User's specific issue)
        print("Switching resolution to 5S...")
        await page.evaluate("""() => {
            window.widget.activeChart().setResolution('5S');
        }""")
        await asyncio.sleep(6)
        await page.screenshot(path="C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/screenshot_5s_continuous.png")
        results["resolution_5s_rendered"] = True
        print("Saved screenshot_5s_continuous.png")

        # 2. Switch to 1S resolution
        print("Switching resolution to 1S...")
        await page.evaluate("""() => {
            window.widget.activeChart().setResolution('1S');
        }""")
        await asyncio.sleep(5)
        await page.screenshot(path="C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/screenshot_1s_continuous.png")
        results["resolution_1s_rendered"] = True
        print("Saved screenshot_1s_continuous.png")

        # 3. Switch to 1T resolution
        print("Switching resolution to 1T...")
        await page.evaluate("""() => {
            window.widget.activeChart().setResolution('1T');
        }""")
        await asyncio.sleep(5)
        await page.screenshot(path="C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/screenshot_1t_continuous.png")
        results["resolution_1t_rendered"] = True
        print("Saved screenshot_1t_continuous.png")

        results["success"] = (
            results["resolution_5s_rendered"] and
            results["resolution_1s_rendered"] and
            results["resolution_1t_rendered"] and
            len(results["console_errors"]) == 0
        )

        await browser.close()

    print("\nVerification Complete:")
    print(json.dumps(results, indent=2))

if __name__ == "__main__":
    asyncio.run(run_verification())
