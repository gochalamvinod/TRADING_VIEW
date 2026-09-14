import asyncio
import json
from playwright.async_api import async_playwright

async def debug_history():
    logs = []
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1920, "height": 1080})

        async def on_response(response):
            if any(k in response.url for k in ("history", "symbols", "config", "time", "quotes")):
                try:
                    b = await response.text()
                    logs.append({"url": response.url, "status": response.status, "body": b[:300]})
                except Exception as e:
                    logs.append({"url": response.url, "status": response.status, "err": str(e)})

        page.on("response", on_response)
        page.on("console", lambda msg: logs.append({"console": msg.type, "text": msg.text}))

        try:
            await page.goto("http://localhost:9000", wait_until="networkidle", timeout=30000)
            await page.wait_for_timeout(8000)
        except Exception as e:
            logs.append({"goto_err": str(e)})

        # Check chart visible range and bar count in widget
        try:
            chart_state = await page.evaluate("""() => {
                if (!window.tvWidget) return { err: "no widget" };
                const chart = window.tvWidget.activeChart();
                return {
                    symbol: chart.symbol(),
                    resolution: chart.resolution(),
                    visibleRange: chart.getVisibleRange(),
                    hasBars: !!chart.getVisibleRange()
                };
            }""")
            logs.append({"chart_state": chart_state})
        except Exception as e:
            logs.append({"chart_state_err": str(e)})

        await page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\oanda_chart_verified.png")
        await browser.close()

    with open(r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\scratch\browser_debug.json", "w", encoding="utf-8") as f:
        json.dump(logs, f, indent=2)

if __name__ == "__main__":
    asyncio.run(debug_history())
