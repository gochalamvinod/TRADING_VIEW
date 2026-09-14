import sys, time
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    time.sleep(4)

    res = page.evaluate("""async () => {
        function dispatchFullClick(el, doc) {
            const rect = el.getBoundingClientRect();
            const opts = { bubbles: true, cancelable: true, view: (doc && doc.defaultView) || window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0, buttons: 1 };
            el.dispatchEvent(new PointerEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new PointerEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
        }
        const chart = window.widget.activeChart();
        await chart.createStudy('Custom Symbol Candles', false, false);
        await new Promise(r => setTimeout(r, 2000));
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentDocument;
        const studyEl = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]')).find(el => el.innerText.includes('Custom Symbol'));
        const setBtn = studyEl.querySelector('[data-name="legend-settings-action"]');
        dispatchFullClick(setBtn, doc);
        await new Promise(r => setTimeout(r, 1500));
        const dialog = doc.querySelector('[data-name="indicator-properties-dialog"], [data-dialog-name], [class*="dialog-"]');
        if (!dialog) return { hasDialog: false };
        const tabs = Array.from(dialog.querySelectorAll('[role="tab"], [class*="tab-"]')).map(t => ({ text: t.innerText.trim(), el: t }));
        const inputsTab = tabs.find(t => t.text.toLowerCase().includes('input'));
        if (inputsTab) {
            dispatchFullClick(inputsTab.el, doc);
            await new Promise(r => setTimeout(r, 800));
        }
        const symEl = Array.from(dialog.querySelectorAll('*')).find(el => el.children.length === 0 && el.innerText && el.innerText.trim() === 'EURUSD.');
        const symBtn = symEl ? symEl.closest('button, [role="button"], div[class*="wrap-"]') : null;
        if (symBtn) dispatchFullClick(symBtn, doc);
        await new Promise(r => setTimeout(r, 1200));

        // Look for symbol search popup or input
        const searchInput = doc.querySelector('[data-name="symbol-search-items-dialog"] input, [data-role="search"] input, input[data-name="symbol-search-input"]') || document.querySelector('[data-name="symbol-search-items-dialog"] input, input[data-role="search"]');
        let searchFound = !!searchInput;
        let selected = false;

        if (searchInput) {
            searchInput.value = 'GBPUSD.';
            searchInput.dispatchEvent(new Event('input', { bubbles: true }));
            await new Promise(r => setTimeout(r, 1000));
            const item = doc.querySelector('[data-name="symbol-search-dialog-content-item"], [class*="item-"]') || document.querySelector('[data-name="symbol-search-dialog-content-item"]');
            if (item) {
                dispatchFullClick(item, doc);
                selected = true;
            }
        }
        await new Promise(r => setTimeout(r, 1000));

        // Check dialog property values before Ok
        const model = chart._chartWidget._model.model();
        const study = model.priceDataSources().find(s => s.name && s.name().includes('Custom Symbol'));
        // Click Ok button
        const okBtn = Array.from(dialog.querySelectorAll('button')).find(b => b.innerText.trim() === 'Ok');
        if (okBtn) dispatchFullClick(okBtn, doc);
        await new Promise(r => setTimeout(r, 1500));

        const inpsAfter = study.properties().childs().inputs;
        const lastBar = study.data().valueAt(study.data().lastIndex());

        return {
            hasDialog: !!dialog,
            symBtnFound: !!symBtn,
            searchFound,
            selected,
            after0: inpsAfter.child('0') ? inpsAfter.child('0').value() : null,
            afterSym: inpsAfter.child('sym') ? inpsAfter.child('sym').value() : null,
            lastBarOHLC: lastBar ? [lastBar[1], lastBar[2], lastBar[3], lastBar[4]] : null
        };
    }""")
    print("Dialog inputs:", res)
    browser.close()
