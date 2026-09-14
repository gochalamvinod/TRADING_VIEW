import sys, time
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    time.sleep(3)

    res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        chart.setSymbol('XAUUSD.');
        await new Promise(r => setTimeout(r, 2000));
        await chart.createStudy('Custom Symbol Candles', false, false);
        await new Promise(r => setTimeout(r, 2000));

        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        const inps = study.properties().childs().inputs;

        inps.child('sym').setValue('CADJPY.');
        if (inps.child('0')) inps.child('0').setValue('CADJPY.');

        await new Promise(r => setTimeout(r, 3000));
        study.restart();
        model.fullUpdate();
        await new Promise(r => setTimeout(r, 1000));

        const d = study.data();
        const count = d.size ? d.size() : d.length;
        const last10 = [];
        for (let i = Math.max(0, count - 10); i < count; i++) {
            last10.push({
                idx: i,
                val: d.valueAt(i)
            });
        }

        const cache = window._securityCache.get('CADJPY._1');
        return {
            count,
            cacheBarsCount: cache ? cache.bars.length : 0,
            cacheLastTime: cache && cache.bars.length ? cache.bars[cache.bars.length - 1].time : null,
            last10
        };
    }""")

    print("Count:", res.get("count"))
    print("Cache bars count:", res.get("cacheBarsCount"))
    print("Cache last time:", res.get("cacheLastTime"))
    print("Last 10 bars:")
    for b in res.get("last10", []):
        v = b["val"]
        print(f"  idx {b['idx']}: time={v[0]} O={v[1]} H={v[2]} L={v[3]} C={v[4]}")

    page.screenshot(path="C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/test_cadjpy_repeat.png")
    browser.close()
