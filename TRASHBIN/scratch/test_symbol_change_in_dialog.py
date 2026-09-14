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

    # 1. Add study
    page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        await chart.createStudy('Custom Symbol Candles', false, false);
    }""")
    time.sleep(2)

    # 2. Open settings dialog and change symbol to GBPUSD.
    dialog_res = page.evaluate("""async () => {
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

        // Change symbol input directly through TradingView chart study property
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        
        // Update input property to GBPUSD.
        study.properties().childs().inputs.child('sym').setValue('GBPUSD.');
        study.recalculate();
        model.fullUpdate();

        // Close dialog with Ok
        const okBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText.trim() === 'Ok');
        if (okBtn) okBtn.click();

        return { changed: true };
    }""")
    print("Change result:", dialog_res)
    time.sleep(3)

    # 3. Inspect updated values
    updated_values = page.evaluate("""() => {
        const chart = window.widget.activeChart();
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        const d = study.data();
        const lastIdx = d.lastIndex();
        return {
            lastVal: d.valueAt(lastIdx)
        };
    }""")
    print("Updated study values (GBPUSD):", updated_values)

    # Screenshot
    screenshot_path = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\gbpusd_candles_verified.png"
    page.screenshot(path=screenshot_path)
    print("Saved GBPUSD screenshot to:", screenshot_path)

    browser.close()
