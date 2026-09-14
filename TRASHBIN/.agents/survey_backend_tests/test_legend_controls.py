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
    
    # Wait for legend to update in iframe
    time.sleep(2)
    
    # Inspect legend in iframe
    legend_info = page.evaluate("""() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        if (!iframe || !iframe.contentDocument) return null;
        const doc = iframe.contentDocument;
        
        // Find legend items
        const studyItems = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]')).filter(el => {
            return el.innerText.includes('SMA Crossover') || el.querySelector('[data-name="legend-source-title"]')?.innerText.includes('SMA Crossover');
        });
        
        if (studyItems.length === 0) {
            // Check all items
            const allItems = Array.from(doc.querySelectorAll('[class*="item-"]')).map(el => el.innerText.replace(/\\n/g, ' '));
            return { found: false, allItems };
        }
        
        const studyEl = studyItems[0];
        
        // Find action buttons inside or associated with this item
        const buttons = Array.from(studyEl.querySelectorAll('button, [class*="button-"], [data-name*="action"]')).map(btn => ({
            name: btn.getAttribute('data-name') || btn.className,
            title: btn.getAttribute('title') || '',
            ariaLabel: btn.getAttribute('aria-label') || ''
        }));
        
        return {
            found: true,
            text: studyEl.innerText.replace(/\\n/g, ' '),
            buttons: buttons
        };
    }""")
    print("Legend inspection:", legend_info)
    
    # Now simulate hover over the study item in the iframe
    hover_res = page.evaluate("""() => {
        const iframe = document.querySelector('#tv_chart_container iframe');
        const doc = iframe.contentDocument;
        const studyEl = Array.from(doc.querySelectorAll('[data-name="legend-source-item"]')).find(el => el.innerText.includes('SMA Crossover'));
        if (!studyEl) return { error: 'Study item not found' };
        
        // Dispatch mouseenter / mouseover
        studyEl.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        studyEl.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        
        // Check buttons after hover
        const buttons = Array.from(studyEl.querySelectorAll('[data-name*="action"], [class*="button-"]')).map(b => ({
            name: b.getAttribute('data-name') || b.className,
            title: b.getAttribute('title') || '',
            display: window.getComputedStyle(b).display,
            visibility: window.getComputedStyle(b).visibility,
            opacity: window.getComputedStyle(b).opacity
        }));
        
        return { success: true, buttons };
    }""")
    print("Hover result:", hover_res)
    
    b.close()
