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
    
    # Generate long v4/v5 script
    lines = ["//@version=4", "study('Long Test Script', overlay=true)"]
    for i in range(1, 80):
        lines.append(f"val{i} = sma(close, {i})")
        lines.append(f"plot(val{i}, color=blue)")
    long_script = "\n".join(lines)
    
    page.evaluate(f"""() => {{
        window.PineEditorIDE.loadScript("Long Script Test", `{long_script}`);
    }}""")
    page.wait_for_timeout(500)
    
    # Check bulb
    bulb = page.query_selector('.pine-version-bulb')
    print("Bulb found for v4:", bulb is not None)
    bulb.click()
    page.wait_for_timeout(300)
    
    # Click convert
    page.query_selector('#pine_quickfix_convert_btn').click()
    page.wait_for_timeout(500)
    
    # Test synchronized scrolling
    scroll_test = page.evaluate("""() => {
        const left = document.getElementById('tv_diff_left_pane');
        const right = document.getElementById('tv_diff_right_pane');
        
        // Scroll left pane
        left.scrollTop = 350;
        left.dispatchEvent(new Event('scroll'));
        const rightAfterLeft = right.scrollTop;
        
        // Scroll right pane
        right.scrollTop = 700;
        right.dispatchEvent(new Event('scroll'));
        const leftAfterRight = left.scrollTop;
        
        return {
            leftScrollTop: 350,
            rightAfterLeft: rightAfterLeft,
            rightScrollTop: 700,
            leftAfterRight: leftAfterRight
        };
    }""")
    print("Scroll sync test:", scroll_test)
    
    # Test Cancel button
    page.evaluate("document.getElementById('tv_diff_cancel_btn').click()")
    page.wait_for_timeout(300)
    is_modal_open_after_cancel = page.evaluate("!!document.getElementById('tv_diff_modal_overlay')")
    code_after_cancel = page.evaluate("document.getElementById('pine_code_input').value.slice(0, 15)")
    print("After cancel - modal open:", is_modal_open_after_cancel, "code header:", repr(code_after_cancel))
    
    # Re-open diff modal and test Apply button
    page.query_selector('.pine-version-bulb').click()
    page.wait_for_timeout(300)
    page.query_selector('#pine_quickfix_convert_btn').click()
    page.wait_for_timeout(500)
    
    page.evaluate("document.getElementById('tv_diff_apply_btn').click()")
    page.wait_for_timeout(500)
    is_modal_open_after_apply = page.evaluate("!!document.getElementById('tv_diff_modal_overlay')")
    code_after_apply = page.evaluate("document.getElementById('pine_code_input').value.slice(0, 30)")
    status_ver_after_apply = page.evaluate("document.getElementById('pine_status_version')?.innerText")
    bulbs_count_after_apply = page.evaluate("document.querySelectorAll('.pine-version-bulb').length")
    print("After apply - modal open:", is_modal_open_after_apply)
    print("code header:", repr(code_after_apply))
    print("status version:", status_ver_after_apply)
    print("bulbs count:", bulbs_count_after_apply)
    
    browser.close()
