from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto('http://127.0.0.1:9000')
    srcs = page.evaluate("""() => {
        return Array.from(document.querySelectorAll('script')).map(s => s.src);
    }""")
    print('Scripts in DOM:', srcs)
    b.close()
