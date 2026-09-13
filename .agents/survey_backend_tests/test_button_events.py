from playwright.sync_api import sync_playwright
import time

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto('http://127.0.0.1:9000', timeout=25000)
    page.wait_for_selector('#tv_chart_container iframe', timeout=20000)
    
    # Wait for chart ready
    page.evaluate("""() => new Promise(res => {
        if (window.widget && window.widget.onChartReady) {
            window.widget.onChartReady(() => res(true));
        } else {
            setTimeout(res, 5000);
        }
    })""")
    
    # Create study
    entityId = page.evaluate("""async () => {
        const chart = window.widget.activeChart();
        return await chart.createStudy('SMA Crossover', false, false);
    }""")
    print("Created study:", entityId)
    time.sleep(2)
    
    # Check iframe and dispatch events
    diag = page.evaluate("""async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentDocument;
        const studyEl = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]')).find(el => el.innerText.includes('SMA Crossover'));
        if (!studyEl) return { error: 'Study item not found' };
        
        const delBtn = studyEl.querySelector('[data-name="legend-delete-action"]');
        const eyeBtn = studyEl.querySelector('[data-name="legend-show-hide-action"]');
        const setBtn = studyEl.querySelector('[data-name="legend-settings-action"]');
        
        function dispatchFullClick(el) {
            const rect = el.getBoundingClientRect();
            const opts = {
                bubbles: true,
                cancelable: true,
                view: doc.defaultView,
                clientX: rect.left + rect.width / 2,
                clientY: rect.top + rect.height / 2,
                button: 0,
                buttons: 1
            };
            el.dispatchEvent(new PointerEvent('pointerdown', opts));
            el.dispatchEvent(new MouseEvent('mousedown', opts));
            el.dispatchEvent(new PointerEvent('pointerup', opts));
            el.dispatchEvent(new MouseEvent('mouseup', opts));
            el.dispatchEvent(new MouseEvent('click', opts));
        }

        // Test delete via full click sequence
        dispatchFullClick(delBtn);
        await new Promise(r => setTimeout(r, 1000));
        
        const chart = window.widget.activeChart();
        const studiesAfterDelete = chart.getAllStudies();
        
        return {
            studiesAfterDelete
        };
    }""")
    print("Full click delete test:", diag)
    
    b.close()
