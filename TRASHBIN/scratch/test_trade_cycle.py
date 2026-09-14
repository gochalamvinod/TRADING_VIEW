import asyncio
import json
import urllib.request
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1600, 'height': 950})

        print("[TEST] Opening chart ...")
        await page.goto("http://localhost:9000", wait_until="networkidle", timeout=30000)
        await page.wait_for_timeout(4000)

        # Place pending order via backend API
        print("[TEST] Placing test Limit Order via OANDA API ...")
        req_data = json.dumps({
            "symbol": "EURUSD",
            "type": "BUY_LIMIT",
            "volume": 0.01,
            "price": 1.0500
        }).encode('utf-8')
        req = urllib.request.Request("http://127.0.0.1:8080/trade/pending", data=req_data, headers={'Content-Type': 'application/json'})
        resp = json.loads(urllib.request.urlopen(req).read())
        print(f"[TEST] Order placed result: {resp}")
        ticket = resp.get("ticket") or resp.get("order")

        # Wait 1.5 seconds for reactive in-memory sync
        await page.wait_for_timeout(1500)

        # Query /trade/bundle to verify order is in RAM
        bundle = json.loads(urllib.request.urlopen("http://127.0.0.1:9999/trade/bundle").read())
        print(f"[TEST] In-Memory Bundle Orders count: {len(bundle.get('orders', []))}")
        if bundle.get('orders'):
            print(f"       First order in RAM: {bundle['orders'][0]}")

        # Cancel the pending order
        if ticket:
            print(f"[TEST] Cancelling order #{ticket} via API ...")
            cancel_data = json.dumps({"ticket": ticket}).encode('utf-8')
            c_req = urllib.request.Request("http://127.0.0.1:8080/trade/close", data=cancel_data, headers={'Content-Type': 'application/json'})
            c_resp = json.loads(urllib.request.urlopen(c_req).read())
            print(f"[TEST] Cancel result: {c_resp}")

        # Wait 1.5 seconds and verify RAM state
        await page.wait_for_timeout(1500)
        bundle_after = json.loads(urllib.request.urlopen("http://127.0.0.1:9999/trade/bundle").read())
        print(f"[TEST] After cancellation, In-Memory Bundle Orders count: {len(bundle_after.get('orders', []))}")

        # Screenshot
        screenshot_path = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\oanda_order_cycle_verified.png"
        await page.screenshot(path=screenshot_path)
        print(f"[TEST] Screenshot saved to: {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(run())
