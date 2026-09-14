import sys, time
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.on("console", lambda msg: print(f"[CONSOLE {msg.type}] {msg.text}"))
    page.on("pageerror", lambda err: print(f"[PAGE ERROR] {err}"))

    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    time.sleep(4)

    res = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        const id = await chart.createStudy('Custom Symbol Candles', false, false);
        await new Promise(r => setTimeout(r, 2000));

        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentDocument;

        const legendItems = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]'));
        const candleItem = legendItems.find(el => el.innerText.includes('Custom Symbol'));
        if (!candleItem) return { success: false, reason: "No legend item found" };

        // Find settings button
        const settingsBtn = candleItem.querySelector('[data-name="legend-settings-action"]');
        if (!settingsBtn) {
            return {
                success: false,
                reason: "No settings button in legend item",
                html: candleItem.innerHTML
            };
        }

        console.log("Settings button found! Clicking it with dispatchFullClick...");
        const rect = settingsBtn.getBoundingClientRect();
        const opts = { bubbles: true, cancelable: true, view: doc.defaultView || window, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2, button: 0, buttons: 1 };
        settingsBtn.dispatchEvent(new PointerEvent('pointerdown', opts));
        settingsBtn.dispatchEvent(new MouseEvent('mousedown', opts));
        settingsBtn.dispatchEvent(new PointerEvent('pointerup', opts));
        settingsBtn.dispatchEvent(new MouseEvent('mouseup', opts));
        settingsBtn.dispatchEvent(new MouseEvent('click', opts));
        await new Promise(r => setTimeout(r, 2000));

        // Check for dialog
        const dialogs = Array.from(doc.querySelectorAll('[data-name="property-dialog"], [class*="dialog-"], [role="dialog"]')).map(d => ({
            text: d.innerText.slice(0, 50),
            visible: window.getComputedStyle(d).display !== 'none'
        }));

        return {
            success: true,
            dialogsCount: dialogs.length,
            dialogs
        };
    }""")
    print("Result:", res)
    browser.close()
