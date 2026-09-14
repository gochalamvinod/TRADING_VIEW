import sys, time
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on("console", lambda msg: print(f"[CONSOLE {msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))

    print("Navigating to http://127.0.0.1:9000 ...")
    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    time.sleep(4)

    # 1. Add study and check its inputs
    res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const id = await chart.createStudy('Custom Symbol Candles', false, false);
        await new Promise(r => setTimeout(r, 2000));

        const study = chart.getStudyById(id);
        const model = chart._chartWidget._model.model();
        const priceSource = model.priceDataSources().find(s => s.id() === id);

        // Check study properties/inputs
        const inputsObj = priceSource.properties().childs().inputs.state();
        
        return {
            studyId: id,
            inputsObj: inputsObj,
            priceRange: priceSource.priceRange() ? { min: priceSource.priceRange().min(), max: priceSource.priceRange().max() } : null
        };
    }""")
    print("Initial Study info:", res)

    # 2. Open settings, change symbol or check what inputs are in the dialog
    dialog_info = page.evaluate("""async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentDocument;

        const legendItems = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]'));
        const candleItem = legendItems.find(el => el.innerText.includes('Custom Symbol'));
        const settingsBtn = candleItem.querySelector('[data-name="legend-settings-action"]');

        const rect = settingsBtn.getBoundingClientRect();
        const opts = { bubbles: true, cancelable: true, view: doc.defaultView || window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0, buttons: 1 };
        settingsBtn.dispatchEvent(new MouseEvent('click', opts));
        await new Promise(r => setTimeout(r, 1500));

        const dialog = doc.querySelector('[data-name="property-dialog"], [class*="dialog-"], [role="dialog"]');
        if (!dialog) return { error: "No dialog" };

        const rows = Array.from(dialog.querySelectorAll('tr, [class*="cell-"], [class*="row-"]')).map(r => r.innerText.trim()).filter(Boolean);
        const inputs = Array.from(dialog.querySelectorAll('input')).map(i => ({
            value: i.value,
            type: i.type
        }));

        return {
            title: dialog.innerText.slice(0, 100),
            inputs: inputs
        };
    }""")
    print("Dialog info:", dialog_info)

    browser.close()
