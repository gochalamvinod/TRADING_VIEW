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
        if (inps.child('0')) inps.child('0').setValue('GBPUSD.');
        
        // Wait for fetch of GBPUSD to complete
        await new Promise(r => setTimeout(r, 2000));
        
        // Now call restart() vs recalculate()
        const hasRestart = typeof study.restart === 'function';
        if (hasRestart) {
            study.restart();
        } else {
            study.recalculate();
        }
        model.fullUpdate();
        await new Promise(r => setTimeout(r, 1000));

        const d = study.data();
        const count = d.size ? d.size() : d.length;
        const first3 = [d.valueAt(0), d.valueAt(1), d.valueAt(2)];
        const last3 = [d.valueAt(count - 3), d.valueAt(count - 2), d.valueAt(count - 1)];

        return {
            hasRestart,
            count,
            first3,
            last3
        };
    }""")
    print("Test restart result:", res)
    browser.close()
