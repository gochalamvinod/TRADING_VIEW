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
        const inps = study.properties().childs().inputs;

        // Change sym property
        inps.child('sym').setValue('={\x22session\x22:\x22regular\x22,\x22symbol\x22:\x22GBPUSD.\x22}');
        
        // Let's hook or check what study computes
        study.recalculate();
        model.fullUpdate();
        await new Promise(r => setTimeout(r, 1000));

        const inpsObj = {};
        for (const k of inps.childNames ? inps.childNames() : Object.keys(inps.childs ? inps.childs() : inps)) {
            try {
                if (inps.child(k) && typeof inps.child(k).value === 'function') {
                    inpsObj[k] = inps.child(k).value();
                }
            } catch(e) {}
        }
        const lastBar = study.data().valueAt(study.data().lastIndex());
        return {
            inpsObj,
            lastBarOHLC: lastBar ? [lastBar[1], lastBar[2], lastBar[3], lastBar[4]] : null,
            pineDebug: window.__lastPineDebug
        };
    }""")
    print("Trace result:", res)
    browser.close()
