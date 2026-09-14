from playwright.sync_api import sync_playwright
import time

def test_add_study():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://127.0.0.1:9000", timeout=30000)
        page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
        
        page.evaluate("""() => {
            return new Promise((resolve) => {
                if (!window.widget) return resolve(false);
                window.widget.onChartReady(() => resolve(true));
                setTimeout(() => resolve(true), 12000);
            });
        }""")
        
        # Test adding a study via createStudy
        result = page.evaluate("""async () => {
            try {
                const chart = window.widget.activeChart();
                // Attempt to create study
                const entityId = await chart.createStudy('SMA 9/21 Crossover', false, false);
                const studiesAfter = chart.getAllStudies();
                return {
                    success: true,
                    entityId: entityId,
                    studiesAfter: studiesAfter
                };
            } catch (err) {
                return {
                    success: false,
                    error: err.message
                };
            }
        }""")
        print("Create study result:", result)
        
        # Check iframe DOM for legend items
        iframe_legend = page.evaluate("""() => {
            const iframe = document.querySelector('#tv_chart_container iframe');
            if (!iframe || !iframe.contentDocument) return { error: 'No iframe doc' };
            const doc = iframe.contentDocument;
            const items = Array.from(doc.querySelectorAll('[data-name="legend-source-item"], [class*="item-"]')).map(el => {
                const titleEl = el.querySelector('[data-name="legend-source-title"], [class*="title-"]');
                return {
                    text: el.innerText.replace(/\\n/g, ' '),
                    title: titleEl ? titleEl.innerText : null
                };
            });
            return {
                legendItemsCount: items.length,
                items: items
            };
        }""")
        print("Legend in iframe:", iframe_legend)
        
        browser.close()

if __name__ == "__main__":
    test_add_study()
