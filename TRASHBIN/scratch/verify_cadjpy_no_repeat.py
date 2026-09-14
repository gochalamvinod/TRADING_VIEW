import sys, time
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})

    print("Navigating to http://127.0.0.1:9000 ...")
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

        // Wait 4 seconds for initial fetch & active poller
        await new Promise(r => setTimeout(r, 4000));
        if (typeof study.restart === 'function') study.restart();
        model.fullUpdate();
        await new Promise(r => setTimeout(r, 2000));

        const d = study.data();
        const count = d.size ? d.size() : d.length;
        const last15 = [];
        for (let i = Math.max(0, count - 15); i < count; i++) {
            last15.push({
                idx: i,
                val: d.valueAt(i)
            });
        }

        const pane = model.panes().find(p => p.dataSources().includes(study));
        let scaleMin = null, scaleMax = null;
        if (pane) {
            const ps = pane.defaultPriceScale();
            if (ps && ps.priceRange()) {
                scaleMin = ps.priceRange().minValue();
                scaleMax = ps.priceRange().maxValue();
            }
        }

        return {
            count,
            scaleMin,
            scaleMax,
            last15
        };
    }""")

    print("Verification result for CADJPY on XAUUSD:")
    print("Bar Count:", res.get("count"))
    print("Scale Range:", res.get("scaleMin"), "to", res.get("scaleMax"))
    
    last15 = res.get("last15", [])
    print(f"Inspecting last {len(last15)} bars:")
    consecutive_repeats = 0
    for i in range(len(last15)):
        b = last15[i]
        v = b["val"]
        print(f"  [{b['idx']}] time={v[0]} O={v[1]} H={v[2]} L={v[3]} C={v[4]}")
        if i > 0:
            prev_v = last15[i-1]["val"]
            if v[1] == prev_v[1] and v[2] == prev_v[2] and v[3] == prev_v[3] and v[4] == prev_v[4] and v[1] != v[4]:
                consecutive_repeats += 1

    print("Identical candle clones detected:", consecutive_repeats)
    screenshot_path = "C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/xauusd_chart_cadjpy_live.png"
    page.screenshot(path=screenshot_path)
    print("Saved screenshot to:", screenshot_path)
    browser.close()
