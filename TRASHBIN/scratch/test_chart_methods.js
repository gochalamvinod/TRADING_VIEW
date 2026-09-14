const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  await page.goto('http://127.0.0.1:9000/', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(4000);

  const testResult = await page.evaluate(async () => {
    const widget = window.tvWidget;
    if (!widget) return { error: "no tvWidget" };
    const chart = widget.activeChart();
    if (!chart) return { error: "no activeChart" };

    // Check available shape methods
    const methods = Object.keys(Object.getPrototypeOf(chart)).filter(k => k.includes('Shape') || k.includes('Line') || k.includes('Box') || k.includes('study'));

    return {
      methods: methods
    };
  });

  console.log('Chart API Methods:', JSON.stringify(testResult, null, 2));
  await browser.close();
})();
