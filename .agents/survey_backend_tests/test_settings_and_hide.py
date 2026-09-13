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
    
    # Test Settings button click
    diag = page.evaluate("""async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentDocument;
        const studyEl = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]')).find(el => el.innerText.includes('SMA Crossover'));
        if (!studyEl) return { error: 'Study item not found' };
        
        const setBtn = studyEl.querySelector('[data-name="legend-settings-action"]');
        if (!setBtn) return { error: 'Settings button not found' };
        
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

        dispatchFullClick(setBtn);
        await new Promise(r => setTimeout(r, 1200));
        
        // Find dialog in iframe
        const dialog = doc.querySelector('[data-name="indicator-properties-dialog"], [data-dialog-name], [class*="dialog-"]');
        const dialogTitle = dialog ? (dialog.querySelector('[class*="title-"], [data-name="dialog-title"]')?.innerText || dialog.innerText.split('\\n')[0]) : null;
        
        // Look for tabs (e.g. Inputs, Style, Visibility)
        const tabs = dialog ? Array.from(dialog.querySelectorAll('[role="tab"], [class*="tab-"]')).map(t => t.innerText.trim()) : [];
        
        // Look for inputs
        const inputs = dialog ? Array.from(dialog.querySelectorAll('input, select')).map(i => ({
            type: i.type,
            value: i.value
        })) : [];

        // Close dialog
        const closeBtn = dialog ? dialog.querySelector('[data-name="close"], button[name="cancel"], [class*="close-"]') : null;
        if (closeBtn) dispatchFullClick(closeBtn);

        return {
            dialogFound: !!dialog,
            dialogTitle,
            tabs,
            inputsCount: inputs.length
        };
    }""")
    print("Full click settings dialog test:", diag)
    
    # Test Hide/Show button click
    hide_diag = page.evaluate("""async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentDocument;
        const studyEl = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]')).find(el => el.innerText.includes('SMA Crossover'));
        if (!studyEl) return { error: 'Study item not found' };
        
        const eyeBtn = studyEl.querySelector('[data-name="legend-show-hide-action"]');
        if (!eyeBtn) return { error: 'Eye button not found' };
        
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

        const titleBefore = eyeBtn.getAttribute('title');
        dispatchFullClick(eyeBtn);
        await new Promise(r => setTimeout(r, 600));
        const titleAfter = eyeBtn.getAttribute('title');
        
        // Toggle back
        dispatchFullClick(eyeBtn);
        await new Promise(r => setTimeout(r, 600));
        const titleRestored = eyeBtn.getAttribute('title');
        
        return {
            titleBefore,
            titleAfter,
            titleRestored
        };
    }""")
    print("Full click hide/show test:", hide_diag)
    
    b.close()
