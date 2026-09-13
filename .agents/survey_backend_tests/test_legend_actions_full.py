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
    print("Created study entityId:", entityId)
    time.sleep(2)
    
    # Test 1: Click Settings action button
    settings_res = page.evaluate("""async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentDocument;
        const studyEl = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]')).find(el => el.innerText.includes('SMA Crossover'));
        if (!studyEl) return { error: 'Study item not found' };
        
        const settingsBtn = studyEl.querySelector('[data-name="legend-settings-action"]');
        if (!settingsBtn) return { error: 'Settings button not found' };
        
        // Click settings button
        settingsBtn.click();
        await new Promise(r => setTimeout(r, 1000));
        
        // Look for dialog in iframe doc or parent doc
        const dialogInIframe = doc.querySelector('[data-name="indicator-properties-dialog"], [data-dialog-name], [class*="dialog-"]');
        const dialogTitle = dialogInIframe ? dialogInIframe.innerText.split('\\n')[0] : null;
        
        // Look for inputs / tabs inside dialog
        const inputs = dialogInIframe ? Array.from(dialogInIframe.querySelectorAll('input, select')).map(i => ({
            type: i.type,
            value: i.value,
            name: i.name
        })) : [];
        
        // Close dialog if open (click cancel or close button)
        const closeBtn = dialogInIframe ? dialogInIframe.querySelector('[data-name="close"], button[name="cancel"], [class*="close-"]') : null;
        if (closeBtn) closeBtn.click();
        
        return {
            dialogFound: !!dialogInIframe,
            dialogTitle,
            inputsCount: inputs.length
        };
    }""")
    print("Settings click test:", settings_res)
    time.sleep(1)
    
    # Test 2: Click Hide/Show toggle
    hide_res = page.evaluate("""async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentDocument;
        const studyEl = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]')).find(el => el.innerText.includes('SMA Crossover'));
        if (!studyEl) return { error: 'Study item not found' };
        
        const eyeBtn = studyEl.querySelector('[data-name="legend-show-hide-action"]');
        if (!eyeBtn) return { error: 'Eye button not found' };
        
        const beforeTitle = eyeBtn.getAttribute('title');
        eyeBtn.click();
        await new Promise(r => setTimeout(r, 500));
        const afterTitle = eyeBtn.getAttribute('title');
        
        // Click again to toggle back
        eyeBtn.click();
        await new Promise(r => setTimeout(r, 500));
        const restoredTitle = eyeBtn.getAttribute('title');
        
        return {
            beforeTitle,
            afterTitle,
            restoredTitle
        };
    }""")
    print("Hide/Show toggle test:", hide_res)
    time.sleep(1)
    
    # Test 3: Click Delete button
    delete_res = page.evaluate("""async () => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentDocument;
        const studyEl = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]')).find(el => el.innerText.includes('SMA Crossover'));
        if (!studyEl) return { error: 'Study item not found' };
        
        const delBtn = studyEl.querySelector('[data-name="legend-delete-action"]');
        if (!delBtn) return { error: 'Delete button not found' };
        
        delBtn.click();
        await new Promise(r => setTimeout(r, 1000));
        
        // Verify study removed from chart
        const chart = window.widget.activeChart();
        const studiesAfter = chart.getAllStudies();
        const stillInLegend = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]')).some(el => el.innerText.includes('SMA Crossover'));
        
        return {
            studiesAfter,
            stillInLegend
        };
    }""")
    print("Delete test:", delete_res)
    
    b.close()
