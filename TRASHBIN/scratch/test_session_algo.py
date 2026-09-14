import asyncio
from playwright.async_api import async_playwright

async def test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={'width': 1600, 'height': 900})
        await page.goto('http://127.0.0.1:9000/', wait_until='domcontentloaded')
        await page.wait_for_function("() => window.widget && typeof window.widget.activeChart === 'function'")
        await page.wait_for_timeout(3000)
        
        # Set chart resolution to 15m
        await page.evaluate('''() => {
            const chart = window.widget.activeChart();
            chart.setResolution('15');
        }''')
        await page.wait_for_timeout(3000)
        
        res = await page.evaluate('''async () => {
            const chart = window.widget.activeChart();
            const symbol = chart.symbol();
            const resolution = chart.resolution();
            
            // Fetch history bars
            const resp = await fetch(`/history?symbol=${encodeURIComponent(symbol)}&resolution=${resolution}&countback=500`);
            const data = await resp.json();
            if (!data || !data.t || data.t.length === 0) return { error: "No history data" };
            
            const bars = [];
            for (let i = 0; i < data.t.length; i++) {
                bars.push({
                    t: data.t[i],
                    o: data.o[i],
                    h: data.h[i],
                    l: data.l[i],
                    c: data.c[i]
                });
            }
            
            const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
            const createdIds = [];
            
            // 1. Day Dividers
            let prevDay = -1;
            for (let i = 0; i < bars.length; i++) {
                const b = bars[i];
                const dt = new Date(b.t * 1000);
                const day = dt.getUTCDay();
                if (prevDay !== -1 && day !== prevDay) {
                    try {
                        const lineId = await chart.createShape({ time: b.t, price: b.c }, {
                            shape: 'vertical_line',
                            lock: true,
                            disableSelection: true,
                            overrides: {
                                linecolor: '#787b86',
                                linewidth: 1,
                                linestyle: 2,
                                showLabel: true,
                                text: daysOfWeek[day],
                                textcolor: '#787b86',
                                fontsize: 10
                            }
                        });
                        if (lineId) createdIds.push(lineId);
                    } catch (e) {
                        console.error('Failed to create divider:', e);
                    }
                }
                prevDay = day;
            }
            
            // 2. Sessions configuration (LuxAlgo defaults)
            const sessions = [
                { name: 'London', color: '#2157f3', start: 700, end: 1600 },
                { name: 'New York', color: '#ff5d00', start: 1300, end: 2200 },
                { name: 'Tokyo', color: '#e91e63', start: 0, end: 900 },
                { name: 'Sydney', color: '#ffeb3b', start: 2100, end: 600 }
            ];
            
            function isInSession(hhmm, start, end) {
                if (start <= end) {
                    return hhmm >= start && hhmm < end;
                } else {
                    return hhmm >= start || hhmm < end;
                }
            }
            
            for (const s of sessions) {
                let current = null;
                for (let i = 0; i < bars.length; i++) {
                    const b = bars[i];
                    const dt = new Date(b.t * 1000);
                    const hhmm = dt.getUTCHours() * 100 + dt.getUTCMinutes();
                    const active = isInSession(hhmm, s.start, s.end);
                    
                    if (active) {
                        if (!current) {
                            current = { startTime: b.t, endTime: b.t, high: b.h, low: b.l };
                        } else {
                            current.high = Math.max(current.high, b.h);
                            current.low = Math.min(current.low, b.l);
                            current.endTime = b.t;
                        }
                    } else {
                        if (current) {
                            try {
                                const rectId = await chart.createMultipointShape([
                                    { time: current.startTime, price: current.high },
                                    { time: current.endTime, price: current.low }
                                ], {
                                    shape: 'rectangle',
                                    lock: true,
                                    disableSelection: true,
                                    overrides: {
                                        color: s.color,
                                        backgroundColor: s.color,
                                        fillBackground: true,
                                        transparency: 82,
                                        linewidth: 1,
                                        showLabel: true,
                                        text: s.name,
                                        textColor: s.color,
                                        fontsize: 11,
                                        bold: true
                                    }
                                });
                                if (rectId) createdIds.push(rectId);
                            } catch (e) {
                                console.error('Failed to create rect:', e);
                            }
                            current = null;
                        }
                    }
                }
                if (current) {
                    try {
                        const rectId = await chart.createMultipointShape([
                            { time: current.startTime, price: current.high },
                            { time: current.endTime, price: current.low }
                        ], {
                            shape: 'rectangle',
                            lock: true,
                            disableSelection: true,
                            overrides: {
                                color: s.color,
                                backgroundColor: s.color,
                                fillBackground: true,
                                transparency: 82,
                                linewidth: 1,
                                showLabel: true,
                                text: s.name,
                                textColor: s.color,
                                fontsize: 11,
                                bold: true
                            }
                        });
                        if (rectId) createdIds.push(rectId);
                    } catch (e) {}
                }
            }
            
            return { success: true, createdCount: createdIds.length, symbol, resolution };
        }''')
        print('Render result:', res)
        await page.wait_for_timeout(2000)
        screenshot_path = "C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/sessions_rendered_test_15m.png"
        await page.screenshot(path=screenshot_path)
        print(f"Screenshot saved to {screenshot_path}")
        await browser.close()

if __name__ == '__main__':
    asyncio.run(test())
