import asyncio
from playwright.async_api import async_playwright

async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1400, "height": 800})
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        
        # Wait for widget to be ready
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(4000)
        
        res = await page.evaluate('''async () => {
            try {
                const chart = window.widget.activeChart();
                const nowSec = Math.floor(Date.now() / 1000);
                
                // 1. Session Box (New York)
                const rectId = await chart.createMultipointShape([
                    { time: nowSec - 5400, price: 4425 },
                    { time: nowSec - 600, price: 4375 }
                ], {
                    shape: 'rectangle',
                    lock: true,
                    disableSelection: true,
                    overrides: {
                        color: '#ff5d00',
                        backgroundColor: '#ff5d00',
                        fillBackground: true,
                        transparency: 82,
                        linewidth: 2,
                        showLabel: true,
                        text: 'New York',
                        textColor: '#ff5d00',
                        fontsize: 12,
                        bold: true
                    }
                });
                
                // 2. Day Divider (Vertical Line)
                const lineId = await chart.createShape(
                    { time: nowSec - 3600, price: 4400 },
                    {
                        shape: 'vertical_line',
                        lock: true,
                        disableSelection: true,
                        overrides: {
                            linecolor: '#787b86',
                            linewidth: 1,
                            linestyle: 2,
                            showLabel: true,
                            text: 'Monday',
                            textcolor: '#787b86',
                            fontsize: 11
                        }
                    }
                );
                
                return { success: true, rectId, lineId };
            } catch (err) {
                return { success: false, error: err.message, stack: err.stack };
            }
        }''')
        print("Shape creation result:", res)
        await page.screenshot(path="C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/test_shape_rect.png")
        print("Saved test_shape_rect.png")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(main())
