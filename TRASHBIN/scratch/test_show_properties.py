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
        try {
            const chart = window.widget.activeChart();
            // Test with default symbol
            const id = await chart.createStudy('Custom Symbol Candles', false, false);
            console.log('Study created with ID:', id);
            await new Promise(r => setTimeout(r, 2000));

            console.log('Now calling chart.showPropertiesDialog(id)...');
            try {
                chart.showPropertiesDialog(id);
                console.log('showPropertiesDialog called successfully!');
            } catch (err) {
                console.error('Error in showPropertiesDialog:', err.message, err.stack);
                return { success: false, error: err.message, stack: err.stack };
            }

            await new Promise(r => setTimeout(r, 1500));
            const iframe = document.querySelector('#tv_chart_container iframe');
            const doc = iframe.contentDocument;
            const dialog = doc.querySelector('[data-name="indicator-properties-dialog"], [class*="dialog-"]');
            return {
                success: true,
                dialogFound: !!dialog,
                dialogTitle: dialog?.innerText.slice(0, 50)
            };
        } catch (globalErr) {
            console.error('Global error:', globalErr.message, globalErr.stack);
            return { success: false, error: globalErr.message, stack: globalErr.stack };
        }
    }""")
    print("Execution result:", res)
    browser.close()
