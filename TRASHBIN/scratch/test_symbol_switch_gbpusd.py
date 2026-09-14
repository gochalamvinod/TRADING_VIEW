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

    # 1. Add study with default EURUSD.
    add_res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const id = await chart.createStudy('Custom Symbol Candles', false, false);
        return id;
    }""")
    print("Study added:", add_res)
    time.sleep(3)

    # 2. Check EURUSD value
    eur_val = page.evaluate("""() => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        const lastBar = study.data().valueAt(study.data().lastIndex());
        return { open: lastBar[1], close: lastBar[4] };
    }""")
    print("EURUSD values:", eur_val)

    # 3. Switch symbol to GBPUSD.
    switch_res = page.evaluate("""() => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        
        // Change the input property as TradingView does when user edits the input
        study.properties().childs().inputs.child('sym').setValue('={"session":"regular","symbol":"GBPUSD."}');
        return true;
    }""")
    print("Switched input to GBPUSD.:", switch_res)
    time.sleep(3)

    # 4. Check GBPUSD value (should be around ~1.35)
    gbp_val = page.evaluate("""() => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        const lastBar = study.data().valueAt(study.data().lastIndex());
        return { open: lastBar[1], close: lastBar[4] };
    }""")
    print("GBPUSD values:", gbp_val)

    # 5. Switch to BTCUSD (should be around ~79,000)
    page.evaluate("""() => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        study.properties().childs().inputs.child('sym').setValue('BTCUSD');
    }""")
    time.sleep(3)

    btc_val = page.evaluate("""() => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        const lastBar = study.data().valueAt(study.data().lastIndex());
        return { open: lastBar[1], close: lastBar[4] };
    }""")
    print("BTCUSD values:", btc_val)

    page.screenshot(path=r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\dynamic_symbol_switch_verified.png")

    browser.close()
