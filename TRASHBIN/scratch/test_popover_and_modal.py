import sys
import time
from playwright.sync_api import sync_playwright

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    
    page.evaluate("window.PineEditorIDE.open()")
    page.wait_for_timeout(500)
    
    v5_script = '''//@version=5
indicator("My v5 Test Indicator", overlay=true)
fast = sma(close, 14)
slow = ema(close, 28)
diff = fast - slow
plot(fast, color=red)
plot(slow, color=green)
'''
    page.evaluate(f"""() => {{
        window.PineEditorIDE.loadScript("Test v5 Indicator", `{v5_script}`);
    }}""")
    page.wait_for_timeout(500)
    
    # Click the lightbulb
    bulb = page.query_selector('.pine-version-bulb')
    print("Found bulb:", bulb is not None)
    if bulb:
        bulb.click()
        page.wait_for_timeout(500)
        
        # Check popover
        popover_info = page.evaluate("""() => {
            const p = document.getElementById('pine_quickfix_popover');
            if (!p) return null;
            return {
                id: p.id,
                text: p.innerText,
                rect: p.getBoundingClientRect(),
                btnText: document.getElementById('pine_quickfix_convert_btn')?.innerText
            };
        }""")
        print("Popover info:", popover_info)
        
        # Click the convert button in the popover
        convert_btn = page.query_selector('#pine_quickfix_convert_btn')
        print("Found convert button:", convert_btn is not None)
        if convert_btn:
            convert_btn.click()
            page.wait_for_timeout(500)
            
            # Check diff modal
            modal_info = page.evaluate("""() => {
                const overlay = document.getElementById('tv_diff_modal_overlay');
                if (!overlay) return null;
                const title = overlay.querySelector('div[style*="font-size: 16px"]')?.innerText;
                const leftPane = document.getElementById('tv_diff_left_pane');
                const rightPane = document.getElementById('tv_diff_right_pane');
                const cancelBtn = document.getElementById('tv_diff_cancel_btn');
                const applyBtn = document.getElementById('tv_diff_apply_btn');
                
                // Count red and green lines
                const redLines = leftPane?.querySelectorAll('div[style*="background: rgba(242, 54, 69"]');
                const greenLines = rightPane?.querySelectorAll('div[style*="background: rgba(8, 153, 129"]');
                
                return {
                    hasOverlay: !!overlay,
                    title: title,
                    hasLeftPane: !!leftPane,
                    hasRightPane: !!rightPane,
                    redCount: redLines?.length,
                    greenCount: greenLines?.length,
                    hasCancelBtn: !!cancelBtn,
                    cancelText: cancelBtn?.innerText,
                    hasApplyBtn: !!applyBtn,
                    applyText: applyBtn?.innerText
                };
            }""")
            print("Modal info:", modal_info)
            
    browser.close()
