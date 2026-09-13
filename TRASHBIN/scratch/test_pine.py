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
    
    # Check PineEditorIDE
    has_ide = page.evaluate("typeof window.PineEditorIDE !== 'undefined'")
    print("has PineEditorIDE:", has_ide)
    
    # Open Pine Editor
    page.evaluate("window.PineEditorIDE.open()")
    page.wait_for_timeout(1000)
    
    # Check dock visibility
    dock_info = page.evaluate("""() => {
        const d = document.getElementById('pine_editor_dock');
        if (!d) return null;
        const rect = d.getBoundingClientRect();
        return {
            visible: d.style.display !== 'none',
            width: rect.width,
            height: rect.height,
            theme: d.getAttribute('data-theme')
        };
    }""")
    print("dock info:", dock_info)
    
    # Check current code
    cur_code = page.evaluate("document.getElementById('pine_code_input')?.value?.slice(0, 100)")
    print("cur code:", cur_code)
    
    # Check gutter
    gutter_info = page.evaluate("""() => {
        const lines = document.querySelectorAll('.pine-gutter-line');
        const bulbs = document.querySelectorAll('.pine-version-bulb');
        return {
            totalLines: lines.length,
            bulbsCount: bulbs.length
        };
    }""")
    print("gutter info with default script:", gutter_info)
    
    # Load a v5 script
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
    page.wait_for_timeout(1000)
    
    gutter_info_v5 = page.evaluate("""() => {
        const lines = document.querySelectorAll('.pine-gutter-line');
        const bulbs = document.querySelectorAll('.pine-version-bulb');
        const bulbTexts = Array.from(bulbs).map(b => ({
            text: b.innerText,
            version: b.getAttribute('data-version'),
            title: b.getAttribute('title'),
            parentLine: b.parentElement.innerText
        }));
        return {
            totalLines: lines.length,
            bulbsCount: bulbs.length,
            bulbDetails: bulbTexts
        };
    }""")
    print("gutter info with v5 script:", gutter_info_v5)
    
    browser.close()
