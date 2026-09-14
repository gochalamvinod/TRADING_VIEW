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

    # 1. Switch main chart to EURUSD.
    page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        chart.setSymbol('EURUSD.');
    }""")
    time.sleep(3)

    # 2. Add Custom Symbol Candles study
    add_res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const id = await chart.createStudy('Custom Symbol Candles', false, false);
        return id;
    }""")
    print("Study added:", add_res)
    time.sleep(3)

    # 3. Switch study symbol to GBPUSD.
    switch_res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        const inps = study.properties().childs().inputs;

        if (inps.child('sym')) inps.child('sym').setValue('GBPUSD.');
        if (inps.child('0')) inps.child('0').setValue('GBPUSD.');
        study.recalculate();
        model.fullUpdate();
        return {
            studySym: inps.child('sym') ? inps.child('sym').value() : null,
            chartSym: chart.symbol()
        };
    }""")
    print("Switch state:", switch_res)
    time.sleep(4)

    # 4. Check study data values and chart data values
    data_res = page.evaluate("""() => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        const d = study.data();
        const lastIdx = d.lastIndex();
        const lastVal = d.valueAt(lastIdx);
        
        return {
            mainSeriesSymbol: chart.symbol(),
            studyLastVal: lastVal,
            studyTotalBars: d.size ? d.size() : d.length,
            cacheKeys: window._securityCache ? Array.from(window._securityCache.keys()) : []
        };
    }""")
    print("Data verification:", data_res)

    screenshot_path = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\eurusd_chart_gbpusd_candles.png"
    page.screenshot(path=screenshot_path)
    print("Screenshot saved to:", screenshot_path)

    browser.close()
