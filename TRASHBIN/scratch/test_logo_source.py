import asyncio
from playwright.async_api import async_playwright

async def test_logo():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        # Inspect customSources and panes on model
        info = await page.evaluate('''() => {
            const chart = window.widget.activeChart();
            const model = chart.model ? chart.model() : chart._chartWidget?._model?.model();
            if (!model) return { error: "no model" };

            const panes = model.panes ? model.panes() : [];
            const sources = [];
            panes.forEach((p, pIdx) => {
                const cs = p.customSources ? p.customSources() : [];
                cs.forEach(s => {
                    sources.push({
                        pane: pIdx,
                        type: s.constructor?.name || typeof s,
                        layout: s._layout,
                        needToShow: s._needToShow,
                        showBranding: s._showBranding,
                        customLogoSrc: s._customLogoSrc,
                        left: s._left,
                        bottom: s._bottom
                    });
                });
            });

            const allCS = model.customSources ? model.customSources() : [];
            const modelCS = allCS.map(s => ({
                type: s.constructor?.name || typeof s,
                layout: s._layout,
                needToShow: s._needToShow,
                showBranding: s._showBranding
            }));

            return {
                sources,
                modelCS
            };
        }''')
        print("Logo custom source info:", info)

        await browser.close()

if __name__ == "__main__":
    asyncio.run(test_logo())
