import asyncio
from playwright.async_api import async_playwright

async def check_all_errors():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})

        console_errors = []
        console_warnings = []
        failed_requests = []

        page.on("console", lambda msg: console_errors.append(f"[{msg.type}] {msg.text}") if msg.type in ["error", "assert"] else (console_warnings.append(f"[{msg.type}] {msg.text}") if msg.type == "warning" else None))
        page.on("requestfailed", lambda req: failed_requests.append(f"FAILED: {req.method} {req.url} - {req.failure}"))
        page.on("pageerror", lambda err: console_errors.append(f"[UNCAUGHT] {err}"))

        print("Navigating to page...")
        await page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
        await asyncio.sleep(4)

        print("\n--- CONSOLE ERRORS ---")
        for err in console_errors:
            print(err)

        print(f"\nTotal Errors: {len(console_errors)}")

        print("\n--- FAILED REQUESTS ---")
        for req in failed_requests:
            print(req)

        print(f"\nTotal Failed Requests: {len(failed_requests)}")

        print("\n--- TOP WARNINGS ---")
        for w in console_warnings[:10]:
            print(w)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(check_all_errors())
