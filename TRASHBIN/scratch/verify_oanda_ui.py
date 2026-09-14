import asyncio
from playwright.async_api import async_playwright
import os

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1920, "height": 1080})
        page = await context.new_page()

        print("[PLAYWRIGHT] Navigating to http://localhost:9000 ...")
        await page.goto("http://localhost:9000", wait_until="networkidle", timeout=30000)
        
        # Wait for charting container or iframe to render
        print("[PLAYWRIGHT] Waiting for chart iframe or canvas...")
        await page.wait_for_timeout(8000)

        # Check title and content
        title = await page.title()
        print(f"[PLAYWRIGHT] Page title: {title}")

        # Try to locate account manager or trading panel if present
        screenshot_path = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\oanda_chart_verified.png"
        await page.screenshot(path=screenshot_path, full_page=False)
        print(f"[PLAYWRIGHT] Screenshot saved to: {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
