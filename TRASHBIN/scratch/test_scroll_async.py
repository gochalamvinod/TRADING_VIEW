import sys
import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1920, "height": 1080})
    page.goto("http://127.0.0.1:9000", wait_until="domcontentloaded")
    page.wait_for_timeout(3000)
    page.evaluate("window.PineEditorIDE.open()")
    
    lines = ["//@version=4", "study('Long Test Script', overlay=true)"]
    for i in range(1, 100):
        lines.append(f"val{i} = sma(close, {i})")
    long_script = "\n".join(lines)
    
    page.evaluate(f"""() => {{
        window.PineEditorIDE.loadScript("Long Script Test", `{long_script}`);
    }}""")
    page.wait_for_timeout(300)
    page.query_selector('.pine-version-bulb').click()
    page.wait_for_timeout(300)
    page.query_selector('#pine_quickfix_convert_btn').click()
    page.wait_for_timeout(500)
    
    # Scroll right pane using mouse wheel or evaluate with wait
    res = page.evaluate("""async () => {
        const left = document.getElementById('tv_diff_left_pane');
        const right = document.getElementById('tv_diff_right_pane');
        
        // Scroll right
        right.scrollTop = 500;
        await new Promise(r => setTimeout(r, 100));
        const leftAfterRight = left.scrollTop;
        
        // Scroll left
        left.scrollTop = 200;
        await new Promise(r => setTimeout(r, 100));
        const rightAfterLeft = right.scrollTop;
        
        return {
            leftAfterRight: leftAfterRight,
            rightAfterLeft: rightAfterLeft
        };
    }""")
    print("Async scroll sync result:", res)
    browser.close()
