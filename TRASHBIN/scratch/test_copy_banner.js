const { chromium } = require('playwright');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.goto('http://127.0.0.1:9999', { waitUntil: 'networkidle' });
  await page.waitForTimeout(2000);

  // Open modal
  await page.evaluate(() => window.openIndicatorsModal && window.openIndicatorsModal());
  await page.waitForTimeout(800);

  // Click technicals
  await page.click('[data-category="technicals"]');
  await page.waitForTimeout(800);

  // Click {} on 6th row
  const row = (await page.$$('.tv-indicator-row'))[5];
  if (row) {
    const btn = await row.$('.open-editor-btn');
    if (btn) await btn.click();
  }
  await page.waitForTimeout(1500);

  // Click "make a copy." link
  await page.click('#pine_banner_copy_btn');
  await page.waitForTimeout(1000);

  const outDir = 'C:\\Users\\gocha\\.gemini\\antigravity\\brain\\33ae35fd-c4b4-474e-a08a-28c2840b311f';
  await page.screenshot({ path: path.join(outDir, 'snap_modal_confirm_copy.png') });
  console.log('Captured snap_modal_confirm_copy.png');

  // Click Confirm on dialog if present
  const confirmBtn = await page.$('.tv-confirm-dialog-confirm-btn');
  if (confirmBtn) {
    await confirmBtn.click();
    await page.waitForTimeout(1000);
    await page.screenshot({ path: path.join(outDir, 'snap_after_copy_confirmed.png') });
    console.log('Captured snap_after_copy_confirmed.png');
  }

  await browser.close();
  console.log('Test completed successfully!');
})();
