import asyncio
from playwright.async_api import async_playwright

async def test_remove_logo():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        # Remove logo via custom source manipulation
        res = await page.evaluate('''() => {
            const chart = window.widget.activeChart();
            const model = chart.model ? chart.model() : chart._chartWidget?._model?.model();
            if (!model) return "no model";

            let removedCount = 0;
            const panes = model.panes ? model.panes() : [];
            panes.forEach(p => {
                const cs = p.customSources ? p.customSources().slice() : [];
                cs.forEach(s => {
                    if (s._layout === 'library_branding' || s._left === 13 || s.constructor?.name === 'wv' || (s._needToShow !== undefined && s._showBranding !== undefined)) {
                        s._needToShow = false;
                        s._showBranding = false;
                        if (s._powBy) s._powBy.show = false;
                        // If pane has removeCustomSource
                        if (typeof p.removeCustomSource === 'function') {
                            p.removeCustomSource(s);
                            removedCount++;
                        }
                    }
                });
            });

            // Also check model level custom sources
            const allCS = model.customSources ? model.customSources().slice() : [];
            allCS.forEach(s => {
                if (s._layout === 'library_branding' || s._left === 13 || s.constructor?.name === 'wv' || (s._needToShow !== undefined && s._showBranding !== undefined)) {
                    s._needToShow = false;
                    s._showBranding = false;
                    if (s._powBy) s._powBy.show = false;
                    if (typeof model.removeCustomSource === 'function') {
                        try { model.removeCustomSource(s); } catch(e){}
                    }
                }
            });

            model.fullUpdate();
            return { success: true, removedCount };
        }''')
        print("Remove logo result:", res)
        await page.wait_for_timeout(1000)

        # Screenshot bottom left area
        screenshot_path = "C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/verify_logo_removed.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_remove_logo())
