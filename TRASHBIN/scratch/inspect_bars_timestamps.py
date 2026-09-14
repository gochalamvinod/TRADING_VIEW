import sys, time
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    time.sleep(3)

    res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        chart.setSymbol('EURUSD.');
        await new Promise(r => setTimeout(r, 2000));
        await chart.createStudy('Custom Symbol Candles', false, false);
        await new Promise(r => setTimeout(r, 2000));
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        const inps = study.properties().childs().inputs;

        inps.child('sym').setValue('GBPUSD.');
        study.recalculate();
        model.fullUpdate();
        await new Promise(r => setTimeout(r, 2000));

        const d = study.data();
        const count = d.size ? d.size() : d.length;
        const bars = [];
        for (let i = 0; i < Math.min(count, 20); i++) {
            bars.push(d.valueAt(i));
        }
        const lastBars = [];
        for (let i = Math.max(0, count - 10); i < count; i++) {
            lastBars.push(d.valueAt(i));
        }

        const cache = window._securityCache.get('GBPUSD._1');
        return {
            count,
            firstBars: bars,
            lastBars,
            cacheBarsCount: cache ? cache.bars.length : 0,
            cacheFirstTime: cache && cache.bars[0] ? cache.bars[0].time : null,
            cacheLastTime: cache && cache.bars[cache.bars.length - 1] ? cache.bars[cache.bars.length - 1].time : null
        };
    }""")
    print("Inspection result:")
    print("Count:", res.get("count"))
    print("Cache bars count:", res.get("cacheBarsCount"))
    print("Cache first time:", res.get("cacheFirstTime"))
    print("Cache last time:", res.get("cacheLastTime"))
    print("First 3 bars:", res.get("firstBars")[:3])
    print("Last 3 bars:", res.get("lastBars")[-3:])
    browser.close()
