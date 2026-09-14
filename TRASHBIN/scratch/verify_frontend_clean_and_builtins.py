import asyncio
import os
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        context = await browser.new_context(viewport={'width': 1920, 'height': 1080})
        page = await context.new_page()

        # Clear any cached localStorage mock indicators
        await page.goto("http://127.0.0.1:9999", wait_until="domcontentloaded")
        await page.evaluate("""
            localStorage.removeItem('tv_pine_user_scripts');
            localStorage.removeItem('tv_pine_recently_used');
        """)
        await page.reload(wait_until="networkidle")

        print("Page loaded.")
        await asyncio.sleep(2)

        # 1. Verify window.ServerIndicators exists and can compute via GPU
        server_res = await page.evaluate("""
            async () => {
                if (!window.ServerIndicators) return { error: "window.ServerIndicators not found" };
                const res = await window.ServerIndicators.compute('RSI', { count: 500 });
                return {
                    name: res.name,
                    engine: res.engine,
                    compute_time_ms: res.compute_time_ms,
                    plots: Object.keys(res.plots)
                };
            }
        """)
        print("Frontend ServerIndicators test:", server_res)

        # 2. Open Indicators modal
        await page.evaluate("""
            () => {
                if (window.openIndicatorsModal) {
                    window.openIndicatorsModal();
                } else {
                    const btn = document.querySelector('[data-name="open-indicators-dialog"]') ||
                                document.querySelector('#header-toolbar-indicators');
                    if (btn) btn.click();
                }
            }
        """)
        await asyncio.sleep(1)

        # Screenshot: Top / Popular built-in indicators
        out_dir = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f"
        await page.screenshot(path=os.path.join(out_dir, "snap_modal_top_clean.png"))
        print("Captured snap_modal_top_clean.png")

        # 3. Click "Technicals" category
        await page.evaluate("""
            () => {
                const item = document.querySelector('[data-category="technicals"]');
                if (item) item.click();
            }
        """)
        await asyncio.sleep(1)
        tech_count = await page.evaluate("() => document.querySelectorAll('.tv-indicator-row').length")
        print("Technicals row count:", tech_count)
        await page.screenshot(path=os.path.join(out_dir, "snap_modal_technicals_115.png"))
        print("Captured snap_modal_technicals_115.png")

        # 4. Click "My scripts" category
        await page.evaluate("""
            () => {
                const item = document.querySelector('[data-category="myscripts"]');
                if (item) item.click();
            }
        """)
        await asyncio.sleep(1)
        await page.screenshot(path=os.path.join(out_dir, "snap_modal_myscripts_empty.png"))
        print("Captured snap_modal_myscripts_empty.png")

        # 5. Open Pine Editor
        await page.evaluate("""
            () => {
                // close modal
                const closeBtn = document.getElementById('tv_indicators_modal_close');
                if (closeBtn) closeBtn.click();
                if (window.openPineEditor) window.openPineEditor();
            }
        """)
        await asyncio.sleep(1)
        await page.screenshot(path=os.path.join(out_dir, "snap_pine_editor_clean_template.png"))
        print("Captured snap_pine_editor_clean_template.png")

        await browser.close()
        print("Verification complete!")

asyncio.run(main())
