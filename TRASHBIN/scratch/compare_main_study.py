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
        const mainSeries = model.mainSeries();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        
        const inps = study.properties().childs().inputs;
        inps.child('sym').setValue('GBPUSD.');
        if (inps.child('0')) inps.child('0').setValue('GBPUSD.');
        
        await new Promise(r => setTimeout(r, 2500));
        study.restart();
        model.fullUpdate();
        await new Promise(r => setTimeout(r, 1000));

        const mainData = mainSeries.data();
        const studyData = study.data();
        
        const mCount = mainData.size ? mainData.size() : mainData.length;
        const sCount = studyData.size ? studyData.size() : studyData.length;
        
        const comparison = [];
        for (let i = Math.max(0, sCount - 10); i < sCount; i++) {
            const sVal = studyData.valueAt(i);
            const mVal = mainData.valueAt(i);
            comparison.push({
                index: i,
                mainTime: mVal ? mVal[0] : null,
                studyTime: sVal ? sVal[0] : null,
                mainOHLC: mVal ? [mVal[1], mVal[2], mVal[3], mVal[4]] : null,
                studyOHLC: sVal ? [sVal[1], sVal[2], sVal[3], sVal[4]] : null
            });
        }
        
        return {
            mCount,
            sCount,
            comparison
        };
    }""")
    print("MCount:", res["mCount"], "SCount:", res["sCount"])
    for row in res["comparison"]:
        print(f"Time {row['studyTime']}: Main(EUR)={row['mainOHLC']} | Study={row['studyOHLC']}")
    browser.close()
