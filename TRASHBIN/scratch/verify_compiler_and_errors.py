import asyncio
import json
from playwright.async_api import async_playwright

async def run_test():
    async with async_playwright() as p:
        browser = await p.chromium.launch(headless=True)
        page = await browser.new_page(viewport={"width": 1440, "height": 900})

        console_logs = []
        page.on("console", lambda msg: console_logs.append(f"[{msg.type}] {msg.text}"))

        print("1. Loading http://127.0.0.1:9000/ ...")
        await page.goto("http://127.0.0.1:9000/", timeout=30000, wait_until="domcontentloaded")
        await asyncio.sleep(4)

        # 2. Open Pine Editor dock if not already open
        print("\n2. Opening Pine Editor IDE...")
        await page.evaluate("""() => {
            const dock = document.getElementById('pine_editor_dock');
            if (dock) {
                dock.style.display = 'flex';
            }
        }""")
        await asyncio.sleep(1)

        # 3. Test Syntax Error Compilation (Unbalanced parenthesis)
        print("\n3. Testing broken code compilation (unbalanced parenthesis)...")
        broken_str = "//@version=5\nindicator(\"Broken Test\")\nx = (10 + 20\n"
        
        ui_res = await page.evaluate("""async (code) => {
            const codeInput = document.getElementById('pine_code_input');
            codeInput.value = code;
            codeInput.dispatchEvent(new Event('input'));

            const compileBtn = document.getElementById('pine_compile_btn');
            compileBtn.click();

            await new Promise(r => setTimeout(r, 1200));

            const badge = document.getElementById('pine_compiler_badge');
            const statusText = document.getElementById('pine_compiler_status_text');
            const compBody = document.getElementById('pine_compiler_body');
            const errorItems = compBody ? compBody.querySelectorAll('.pine-compiler-error-item') : [];
            const gutterError = document.querySelector('.pine-gutter-line.error');

            return {
                badgeText: badge ? badge.textContent.trim() : null,
                badgeClass: badge ? badge.className : null,
                status: statusText ? statusText.textContent.trim() : null,
                errorItemCount: errorItems.length,
                firstErrorMessage: errorItems[0] ? errorItems[0].querySelector('.pine-err-msg')?.textContent?.trim() : null,
                hasGutterError: !!gutterError,
                gutterErrorLine: gutterError ? gutterError.dataset.line : null
            };
        }""", broken_str)
        print("Broken Code Result:", json.dumps(ui_res, indent=2))
        assert int(ui_res.get("badgeText") or "0") > 0, "Error badge must show error count!"
        assert "Error" in (ui_res.get("status") or ""), "Status pill must indicate Error!"
        assert ui_res.get("hasGutterError"), "Gutter must mark error line!"
        assert ui_res.get("gutterErrorLine") == "3", "Error line must be line 3!"

        # Screenshot of error state
        screenshot_err_path = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\verified_compiler_error.png"
        await page.screenshot(path=screenshot_err_path)
        print(f"Screenshot saved to: {screenshot_err_path}")

        # 4. Test Valid Code Compilation
        print("\n4. Testing valid code compilation...")
        valid_str = "//@version=5\nindicator(\"Valid MA Test\", overlay=true)\nfast = ta.sma(close, 14)\nplot(fast, \"Fast SMA\", color=#2962ff)\n"
        valid_res = await page.evaluate("""async (code) => {
            const codeInput = document.getElementById('pine_code_input');
            codeInput.value = code;
            codeInput.dispatchEvent(new Event('input'));

            const compileBtn = document.getElementById('pine_compile_btn');
            compileBtn.click();

            await new Promise(r => setTimeout(r, 1200));

            const badge = document.getElementById('pine_compiler_badge');
            const statusText = document.getElementById('pine_compiler_status_text');
            const compBody = document.getElementById('pine_compiler_body');
            const successEl = compBody ? compBody.querySelector('.pine-compiler-success') : null;
            const gutterError = document.querySelector('.pine-gutter-line.error');

            return {
                badgeText: badge ? badge.textContent.trim() : null,
                badgeClass: badge ? badge.className : null,
                status: statusText ? statusText.textContent.trim() : null,
                hasSuccessMsg: !!successEl,
                hasGutterError: !!gutterError
            };
        }""", valid_str)
        print("Valid Code Result:", json.dumps(valid_res, indent=2))
        assert valid_res.get("badgeText") == "0", "Valid code badge must be 0!"
        assert valid_res.get("status") == "Compiled", "Status must be 'Compiled'!"
        assert valid_res.get("hasSuccessMsg"), "Must display success message!"
        assert not valid_res.get("hasGutterError"), "Gutter errors must be cleared!"

        screenshot_valid_path = r"C:\Users\gocha\.gemini\antigravity\brain\33ae35fd-c4b4-474e-a08a-28c2840b311f\verified_compiler_success.png"
        await page.screenshot(path=screenshot_valid_path)
        print(f"Screenshot saved to: {screenshot_valid_path}")

        # 5. Test Add to Chart Protection when error exists
        print("\n5. Testing Add to Chart protection on broken code...")
        protect_res = await page.evaluate("""async (code) => {
            const codeInput = document.getElementById('pine_code_input');
            codeInput.value = code;
            codeInput.dispatchEvent(new Event('input'));

            const addBtn = document.getElementById('pine_add_to_chart_btn');
            addBtn.click();
            await new Promise(r => setTimeout(r, 1000));

            const badge = document.getElementById('pine_compiler_badge');
            const statusText = document.getElementById('pine_compiler_status_text');
            const logBody = document.getElementById('pine_console_body');

            return {
                badgeText: badge ? badge.textContent.trim() : null,
                statusText: statusText ? statusText.textContent.trim() : null,
                lastLog: logBody ? logBody.lastElementChild?.textContent?.trim() : null
            };
        }""", broken_str)
        print("Add to Chart Protection Result:", json.dumps(protect_res, indent=2))
        assert "Cannot add to chart" in (protect_res.get("lastLog") or ""), "Must block adding broken code!"

        print("\nALL VERIFICATIONS PASSED SUCCESSFULLY!")
        await browser.close()

if __name__ == "__main__":
    asyncio.run(run_test())
