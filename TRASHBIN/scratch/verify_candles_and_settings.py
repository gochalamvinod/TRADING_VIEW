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

    # 1. Check Pine Editor template
    template_info = page.evaluate("""() => {
        const t = (window.PineEditorIDE && window.PineEditorIDE.TEMPLATES) ?
            window.PineEditorIDE.TEMPLATES.find(x => x.id === 'custom_symbol_candles') : null;
        return t ? { name: t.name, codeSnippet: t.code.split('\\n').slice(0, 5).join(' | ') } : null;
    }""")
    print("Pine Editor Template Check:", template_info)

    # 2. Add study
    add_study_res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const id = await chart.createStudy('Custom Symbol Candles', false, false);
        await new Promise(r => setTimeout(r, 2500));

        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentDocument;

        // Check study legend
        const legendItems = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]'));
        const candleItem = legendItems.find(el => el.innerText.includes('Custom Symbol'));
        const legendText = candleItem ? candleItem.innerText.replace(/\\s+/g, ' ').trim() : null;

        return {
            studyId: id,
            hasCandleItem: !!candleItem,
            legendText: legendText
        };
    }""")
    print("Add Study Result:", add_study_res)

    # Screenshot the chart with candles
    screenshot_path1 = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\custom_symbol_candles_rendered.png"
    page.screenshot(path=screenshot_path1)
    print("Saved chart screenshot to:", screenshot_path1)

    # 3. Click settings button
    click_res = page.evaluate("""async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentDocument;

        const legendItems = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]'));
        const candleItem = legendItems.find(el => el.innerText.includes('Custom Symbol'));
        if (!candleItem) return { success: false, reason: "No legend item found" };

        const settingsBtn = candleItem.querySelector('[data-name="legend-settings-action"]');
        if (!settingsBtn) return { success: false, reason: "No settings button in legend item" };

        const rect = settingsBtn.getBoundingClientRect();
        const opts = { bubbles: true, cancelable: true, view: doc.defaultView || window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0, buttons: 1 };
        settingsBtn.dispatchEvent(new PointerEvent('pointerdown', opts));
        settingsBtn.dispatchEvent(new MouseEvent('mousedown', opts));
        settingsBtn.dispatchEvent(new PointerEvent('pointerup', opts));
        settingsBtn.dispatchEvent(new MouseEvent('mouseup', opts));
        settingsBtn.dispatchEvent(new MouseEvent('click', opts));

        await new Promise(r => setTimeout(r, 2000));

        // Find dialog
        const dialog = doc.querySelector('[data-name="property-dialog"], [class*="dialog-"], [role="dialog"]');
        if (!dialog) return { success: false, reason: "Dialog not found after click" };

        // Get dialog tabs & inputs
        const tabs = Array.from(dialog.querySelectorAll('[role="tab"], [class*="tab-"]')).map(t => t.innerText.trim()).filter(Boolean);
        const inputs = Array.from(dialog.querySelectorAll('input, select')).map(i => ({
            name: i.getAttribute('name') || i.getAttribute('id') || i.type,
            value: i.value,
            type: i.type
        }));

        return {
            success: true,
            dialogTitle: dialog.querySelector('[class*="title-"]')?.innerText || "Found Dialog",
            tabs: tabs,
            inputCount: inputs.length,
            inputsSummary: inputs.slice(0, 8)
        };
    }""")
    print("Click Settings Result:", click_res)

    # Screenshot dialog open
    screenshot_path2 = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\candles_settings_dialog.png"
    page.screenshot(path=screenshot_path2)
    print("Saved dialog screenshot to:", screenshot_path2)

    browser.close()
    print("VERIFICATION COMPLETE.")
