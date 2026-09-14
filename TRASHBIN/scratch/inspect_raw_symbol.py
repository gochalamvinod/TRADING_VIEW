import sys, time
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page.goto("http://127.0.0.1:9000", timeout=30000)
    page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
    time.sleep(3)

    res = page.evaluate("""() => {
        const raw = '={"session":"regular","symbol":"GBPUSD."}';
        let str = String(raw).trim();
        let parsedSymbol = null;
        if (str.startsWith('=')) {
          try {
            const p = JSON.parse(str.slice(1));
            if (p && p.symbol) str = String(p.symbol);
            parsedSymbol = p.symbol;
          } catch(e) { parsedSymbol = 'error: ' + e.message; }
        }
        const cleanSym = str.replace(/^[A-Za-z0-9_\\-\\s]+:/, '').replace(/[{"}'\\\\]/g, '').trim().toUpperCase();
        const cacheKey = cleanSym + '_1';
        const cached = window._securityCache ? window._securityCache.get(cacheKey) : null;
        return {
            raw,
            parsedSymbol,
            cleanSym,
            cacheKey,
            hasCached: !!cached,
            cachedBarsCount: cached ? cached.bars?.length : 0
        };
    }""")
    print("Inspection result:", res)
    browser.close()
