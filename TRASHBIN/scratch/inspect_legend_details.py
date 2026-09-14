import asyncio
import json
from playwright.async_api import async_playwright

async def inspect_legend_dom():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 850})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)

        iframe_el = await page.query_selector("#tv_chart_container iframe")
        frame = await iframe_el.content_frame()

        legend_info = await frame.evaluate('''() => {
            const legend = document.querySelector('[data-name="legend"], [class*="legend-"]');
            if (!legend) return { error: "no legend" };

            // Find all rows in legend
            const rows = Array.from(legend.querySelectorAll('[class*="item-"]'));
            const rowData = rows.map((r, idx) => {
                const title = r.querySelector('[class*="title-"]')?.textContent?.trim();
                const values = Array.from(r.querySelectorAll('[class*="value-"], [class*="values-"] *')).map(v => ({
                    tag: v.tagName,
                    cls: v.className,
                    text: v.textContent.trim()
                })).filter(v => v.text.length > 0);
                return {
                    rowIdx: idx,
                    title,
                    rawText: r.textContent.replace(/\\s+/g, ' ').trim(),
                    values
                };
            });

            // Also check all studies on chart
            const chart = window.parent.widget ? window.parent.widget.activeChart() : null;
            const studies = chart && chart.getAllStudies ? chart.getAllStudies() : [];

            return {
                legendHtml: legend.outerHTML.slice(0, 2000),
                rowData,
                studies
            };
        }''')
        print("Legend Info:")
        for r in legend_info.get('rowData', []):
            print(f"Row {r.get('rowIdx')}: title={ascii(r.get('title'))} rawText={ascii(r.get('rawText'))}")
            print(f"  Values count: {len(r.get('values', []))}")
            for v in r.get('values', []):
                print(f"    [{v.get('tag')}] cls='{v.get('cls')}' text={ascii(v.get('text'))}")
        print("Active studies:", legend_info.get('studies'))

        await browser.close()

if __name__ == "__main__":
    asyncio.run(inspect_legend_dom())
