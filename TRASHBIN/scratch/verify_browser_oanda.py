import asyncio
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1600, 'height': 950})
        page = await context.new_page()

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type in ("error", "warning") else None)

        print("[TEST] Navigating to http://localhost:9000 ...")
        await page.goto("http://localhost:9000", wait_until="networkidle", timeout=30000)

        print("[TEST] Waiting for TradingView chart iframe / canvas ...")
        await page.wait_for_timeout(4000)

        # Check title
        title = await page.title()
        print(f"[TEST] Page Title: {title}")

        # Check if chart container has iframe or canvas
        canvas_count = await page.locator("canvas").count()
        iframe_count = await page.locator("iframe").count()
        print(f"[TEST] Canvases: {canvas_count}, IFrames: {iframe_count}")

        # Check Account Manager or text on page
        page_text = await page.inner_text("body")
        has_oanda = "OANDA" in page_text or "oanda" in page_text.lower()
        has_practice = "Practice" in page_text or "101-001" in page_text
        print(f"[TEST] Text contains OANDA: {has_oanda}, contains Practice: {has_practice}")

        # Capture screenshot
        screenshot_path = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\oanda_mid_verified.png"
        await page.screenshot(path=screenshot_path)
        print(f"[TEST] Screenshot saved to: {screenshot_path}")

        # Filter severe console errors (ignoring benign font or cross-origin notices)
        severe_errors = [e for e in console_errors if "error" in e.lower() and "favicon" not in e.lower()]
        print(f"[TEST] Severe console errors: {len(severe_errors)}")
        for err in severe_errors[:5]:
            print(f"   -> {err}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
