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
        await chart.createStudy('Custom Symbol Candles', false, false);
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        
        // Change study property like TradingView dialog does:
        study.properties().childs().inputs.child('sym').setValue('={"session":"regular","symbol":"GBPUSD."}');
        if (study._inputs) study._inputs.sym = '={"session":"regular","symbol":"GBPUSD."}';
        study.recalculate();
        model.fullUpdate();
        await new Promise(r => setTimeout(r, 1000));

        return {
            studyInputs: study._inputs,
            propSym: study.properties().childs().inputs.child('sym').value(),
            prop0: study.properties().childs().inputs.child('0') ? study.properties().childs().inputs.child('0').value() : null
        };
    }""")
    print("Test result:", res)
    browser.close()
