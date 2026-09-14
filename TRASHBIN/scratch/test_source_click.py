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

        # Open indicators modal
        await page.evaluate('() => window.openIndicatorsModal && window.openIndicatorsModal()')
        await asyncio.sleep(1)

        # Switch to technicals
        await page.evaluate('() => document.querySelector("[data-category=\'technicals\']").click()')
        await asyncio.sleep(1)

        # Click the open-editor-btn ({}) on the 6th row (Average Directional Index)
        opened = await page.evaluate("""
            () => {
                const rows = document.querySelectorAll('.tv-indicator-row');
                for (let r of rows) {
                    const name = r.querySelector('.tv-indicator-name')?.innerText;
                    if (name && name.includes('Average Directional Index')) {
                        const btn = r.querySelector('.open-editor-btn');
                        if (btn) {
                            btn.click();
                            return true;
                        }
                    }
                }
                return false;
            }
        """)
        print("Clicked open-editor-btn for Average Directional Index:", opened)
        await asyncio.sleep(2)

        out_dir = r'C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f'
        await page.screenshot(path=os.path.join(out_dir, 'snap_builtin_opened_in_pine_editor.png'))
        print("Captured snap_builtin_opened_in_pine_editor.png")

        # Try typing into editor or click "Create a copy" button on banner
        copy_clicked = await page.evaluate("""
            () => {
                const btn = document.getElementById('pine_readonly_create_copy');
                if (btn) {
                    btn.click();
                    return true;
                }
                return false;
            }
        """)
        print("Clicked Create a copy button on banner:", copy_clicked)
        await asyncio.sleep(1)

        await page.screenshot(path=os.path.join(out_dir, 'snap_after_create_copy_click.png'))
        print("Captured snap_after_create_copy_click.png")

        await b.close()

asyncio.run(run())
