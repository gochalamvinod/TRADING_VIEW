import asyncio
from playwright.async_api import async_playwright

async def verify_all():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1450, "height": 900})

        console_errors = []
        page.on("console", lambda msg: console_errors.append(msg.text) if msg.type == "error" else None)

        print("Navigating to http://127.0.0.1:9000/ ...")
        await page.goto("http://127.0.0.1:9000/", wait_until="domcontentloaded")
        await page.wait_for_timeout(3500)

        # 1. Open Pine Editor Dock
        print("Opening Pine Editor...")
        await page.evaluate("""() => {
            window.PineEditorIDE.open();
        }""")
        await page.wait_for_timeout(1000)

        # Verify Pine Editor Dock is visible
        dock_visible = await page.evaluate("""() => {
            const dock = document.getElementById('pine_editor_dock');
            return dock && dock.style.display !== 'none';
        }""")
        print("Pine Editor dock visible:", dock_visible)

        # Screenshot 1: Full Pine Editor View (matching user Image 1)
        dock = await page.query_selector("#pine_editor_dock")
        await dock.screenshot(path="scratch/verify_image1_main_view.png")
        print("Saved scratch/verify_image1_main_view.png")

        # 2. Click script title dropdown (matching user Image 2)
        print("Opening script title dropdown...")
        title_btn = await page.query_selector("#pine_script_dropdown_trigger")
        if title_btn:
            await title_btn.click()
            await page.wait_for_timeout(500)

        await dock.screenshot(path="scratch/verify_image2_title_dropdown.png")
        print("Saved scratch/verify_image2_title_dropdown.png")

        # Close title dropdown by clicking outside
        await page.mouse.click(100, 100)
        await page.wait_for_timeout(300)

        # 3. Click more actions (•••) button (matching user Image 3)
        print("Opening more actions (•••) dropdown...")
        more_btn = await page.query_selector("#pine_more_btn")
        if more_btn:
            await more_btn.click()
            await page.wait_for_timeout(500)

        await dock.screenshot(path="scratch/verify_image3_more_dropdown.png")
        print("Saved scratch/verify_image3_more_dropdown.png")

        # Close more dropdown
        await page.mouse.click(100, 100)
        await page.wait_for_timeout(300)

        # 4. Status bar verification (matching user Image 4)
        status_bar = await page.query_selector(".pine-bottom-statusbar-v2")
        await status_bar.screenshot(path="scratch/verify_image4_statusbar.png")
        print("Saved scratch/verify_image4_statusbar.png")

        # 5. Toggle console drawer [>_] (matching user Image 5)
        print("Toggling console drawer...")
        console_btn = await page.query_selector("#pine_console_toggle_btn")
        if console_btn:
            await console_btn.click()
            await page.wait_for_timeout(500)

        await dock.screenshot(path="scratch/verify_image5_console_drawer.png")
        print("Saved scratch/verify_image5_console_drawer.png")

        # 6. Test 'make a copy.' banner link
        print("Testing 'make a copy.' banner link...")
        copy_link = await page.query_selector("#pine_banner_copy_btn")
        if copy_link:
            await copy_link.click()
            await page.wait_for_timeout(500)

        script_state = await page.evaluate("""() => {
            const banner = document.getElementById('pine_readonly_banner');
            const title = document.getElementById('pine_script_title_display');
            const textarea = document.getElementById('pine_code_input');
            const consoleEntries = Array.from(document.querySelectorAll('.pine-console-v2-entry')).map(e => e.textContent);
            return {
                bannerDisplay: banner ? banner.style.display : null,
                scriptTitle: title ? title.textContent : null,
                isReadOnly: textarea ? textarea.readOnly : null,
                consoleEntries
            };
        }""")
        print("Script state after make a copy:", script_state)

        await dock.screenshot(path="scratch/verify_copied_editable.png")
        print("Saved scratch/verify_copied_editable.png")

        print("Any page console errors:", console_errors)
        await browser.close()

if __name__ == "__main__":
    asyncio.run(verify_all())
