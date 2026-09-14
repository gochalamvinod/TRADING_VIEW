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
    time.sleep(4)

    # 1. Set main chart symbol to EURUSD.
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
    time.sleep(2)

    # 3. Set study input symbol to USDCHF.
    switch_res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        const inps = study.properties().childs().inputs;

        if (inps.child('sym')) inps.child('sym').setValue('USDCHF.');
        if (inps.child('0')) inps.child('0').setValue('USDCHF.');
        
        // Wait 3 seconds for USDCHF security bars to download and restart study
        await new Promise(r => setTimeout(r, 3000));
        
        if (typeof study.restart === 'function') study.restart();
        model.fullUpdate();
        await new Promise(r => setTimeout(r, 1000));

        const d = study.data();
        const count = d.size ? d.size() : d.length;
        
        const first5 = [];
        for (let i = 0; i < Math.min(count, 5); i++) {
            first5.push(d.valueAt(i));
        }
        
        const last5 = [];
        for (let i = Math.max(0, count - 5); i < count; i++) {
            last5.push(d.valueAt(i));
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
            chartSymbol: chart.symbol(),
            studyInputSym: inps.child('sym') ? inps.child('sym').value() : null,
            totalStudyBars: count,
            scaleMin,
            scaleMax,
            first5,
            last5
        };
    }""")

    print("Verification result for EURUSD + USDCHF:")
    print("Main Chart Symbol:", switch_res.get("chartSymbol"))
    print("Study Input Symbol:", switch_res.get("studyInputSym"))
    print("Total Study Bars:", switch_res.get("totalStudyBars"))
    print("Study Pane Scale:", switch_res.get("scaleMin"), "to", switch_res.get("scaleMax"))
    print("First 3 Bars:", switch_res.get("first5")[:3])
    print("Last 3 Bars:", switch_res.get("last5")[-3:])

    screenshot_path = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\eurusd_chart_usdchf_candles.png"
    page.screenshot(path=screenshot_path)
    print("Screenshot saved to:", screenshot_path)

    browser.close()
