import asyncio
import os
from playwright.async_api import async_playwright

async def run():
    async with async_playwright() as p:
        b = await p.chromium.launch(headless=True)
        ctx = await b.new_context(viewport={'width': 1920, 'height': 1080})
        page = await ctx.new_page()
        await page.goto('http://127.0.0.1:9999', wait_until='networkidle')
        await asyncio.sleep(2)

        # Open modal
        await page.evaluate('() => window.openIndicatorsModal && window.openIndicatorsModal()')
        await asyncio.sleep(1)

        # Click technicals
        await page.click('[data-category="technicals"]')
        await asyncio.sleep(1)

        # Click {} on 6th row
        rows = await page.query_selector_all('.tv-indicator-row')
        if len(rows) > 5:
            btn = await rows[5].query_selector('.open-editor-btn')
            if btn:
                await btn.click()
        await asyncio.sleep(2)

        # Click "make a copy." link
        await page.click('#pine_banner_copy_btn')
        await asyncio.sleep(1)

        out_dir = r'C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f'
        await page.screenshot(path=os.path.join(out_dir, 'snap_modal_confirm_copy.png'))
        print('Captured snap_modal_confirm_copy.png')

        # Click Confirm on dialog if present
        confirm_btn = await page.query_selector('.tv-confirm-dialog-confirm-btn')
        if confirm_btn:
            await confirm_btn.click()
            await asyncio.sleep(1)
            await page.screenshot(path=os.path.join(out_dir, 'snap_after_copy_confirmed.png'))
            print('Captured snap_after_copy_confirmed.png')

        await b.close()
        print('Test completed successfully!')

asyncio.run(run())
