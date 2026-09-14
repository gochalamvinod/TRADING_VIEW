from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    b = p.chromium.launch(headless=True)
    page = b.new_page()
    page.goto('http://127.0.0.1:9000')
    
    res = page.evaluate("""() => {
        const code = `//@version=5
indicator("Custom Symbol Candles", overlay=false)
sym = input.symbol("AAPL", "Symbol")
res = input.timeframe("D", "Timeframe")
showCandles = input.bool(true, "Show Candles")
upCol = input.color(color.green, "Up Color")
dnCol = input.color(color.red, "Down Color")
upWick = input.color(color.green, "Up Wick")
dnWick = input.color(color.red, "Down Wick")
upBorder = input.color(color.green, "Up Border")
dnBorder = input.color(color.red, "Down Border")
[o, h, l, c] = request.security(sym, res, [open, high, low, close])
plotcandle(showCandles ? o : na, h, l, c, color=c >= o ? upCol : dnCol, wickcolor=c >= o ? upWick : dnWick, bordercolor=c >= o ? upBorder : dnBorder)
`;
        const ind = window.PineTSLib.Indicator.from(code);
        return {
            inputs: ind.getInputsMeta(),
            props: ind.getPropsMeta(),
            decl: ind.getDeclarationType(),
            p2js: window.PineTSLib.pineToJS(code).success
        };
    }""")
    print("In-browser Indicator parsing:", res)
    b.close()
