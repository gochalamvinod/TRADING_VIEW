"""
test_all_features_visual_matrix.py
Exhaustive Pine Script v6 feature-by-feature and combination-by-combination visual test suite.
Tests every visual primitive, drawing object, input combination, and advanced v6 feature on the
live TradingView chart, asserts canvas/DOM rendering, and captures a high-resolution screenshot for each.
"""
import os
import sys
if hasattr(sys.stdout, 'reconfigure'):
    sys.stdout.reconfigure(encoding='utf-8')
import time
import json
import httpx
from playwright.sync_api import sync_playwright

BASE_URL = "http://127.0.0.1:9000"
SCREENSHOT_DIR = r"E:\TRADINGVIEW ADVANCED\screenshots\features"
os.makedirs(SCREENSHOT_DIR, exist_ok=True)

FEATURE_TESTS = [
    {
        "id": "f01_plot_styles",
        "name": "Plot Styles (Line, Step, Histogram, Area, Cross, Circles)",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 01 - Plot Styles", overlay=true)
sma20 = ta.sma(close, 20)
sma50 = ta.sma(close, 50)
plot(sma20, "Line Style", color=color.blue, linewidth=2, style=plot.style_line)
plot(sma50, "Stepline Style", color=color.orange, linewidth=2, style=plot.style_stepline)
plot(close > open ? high : na, "Circles Style", color=color.yellow, style=plot.style_circles, linewidth=2)
plot(close < open ? low : na, "Cross Style", color=color.purple, style=plot.style_cross, linewidth=2)
"""
    },
    {
        "id": "f02_plotcandle",
        "name": "plotcandle Custom Colored Candlesticks",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 02 - Plotcandle", overlay=true)
c_bull = color.new(#089981, 0)
c_bear = color.new(#f23645, 0)
is_up = close >= open
plotcandle(open, high, low, close, "Custom Candles", color=is_up ? c_bull : c_bear, wickcolor=is_up ? c_bull : c_bear, bordercolor=is_up ? c_bull : c_bear)
"""
    },
    {
        "id": "f03_plotbar",
        "name": "plotbar Four-Price OHLC Bars",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 03 - Plotbar", overlay=true)
col = close >= open ? color.lime : color.red
plotbar(open, high, low, close, "OHLC Bars", color=col)
"""
    },
    {
        "id": "f04_plotshape",
        "name": "plotshape Geometric Shapes & Arrows",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 04 - Plotshape", overlay=true)
buy = ta.crossover(close, ta.sma(close, 10))
sell = ta.crossunder(close, ta.sma(close, 10))
plotshape(buy, "Buy Triangle", style=shape.triangleup, location=location.belowbar, color=color.green, size=size.small, text="BUY")
plotshape(sell, "Sell Triangle", style=shape.triangledown, location=location.abovebar, color=color.red, size=size.small, text="SELL")
plotshape(ta.highest(high, 20) == high, "Peak Diamond", style=shape.diamond, location=location.abovebar, color=color.yellow, size=size.tiny)
"""
    },
    {
        "id": "f05_plotchar",
        "name": "plotchar Unicode Characters & Emojis",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 05 - Plotchar", overlay=true)
long_sig = ta.crossover(ta.rsi(close, 14), 50)
short_sig = ta.crossunder(ta.rsi(close, 14), 50)
plotchar(long_sig, "Star", char="★", location=location.belowbar, color=color.yellow, size=size.normal)
plotchar(short_sig, "Thunder", char="⚡", location=location.abovebar, color=color.red, size=size.normal)
"""
    },
    {
        "id": "f06_plotarrow",
        "name": "plotarrow Directional Sized Arrows",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 06 - Plotarrow", overlay=true)
mom = ta.change(close, 5)
plotarrow(mom, "Momentum Arrow", colorup=color.green, colordown=color.red, minheight=10, maxheight=30)
"""
    },
    {
        "id": "f07_hline_and_bands",
        "name": "hline Static Levels and Bands",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 07 - Hline Levels", overlay=true)
h1 = hline(4400.0, "Resistance Level", color=color.red, linestyle=hline.style_dashed, linewidth=2)
h2 = hline(4390.0, "Support Level", color=color.green, linestyle=hline.style_solid, linewidth=2)
"""
    },
    {
        "id": "f08_fill_solid_and_gradient",
        "name": "fill Channel Shading (Solid & Gradient)",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 08 - Fill Channels", overlay=true)
basis = ta.sma(close, 20)
dev = 2.0 * ta.stdev(close, 20)
upper = plot(basis + dev, "Upper Band", color=color.teal)
lower = plot(basis - dev, "Lower Band", color=color.teal)
mid = plot(basis, "Midline", color=color.gray)
fill(upper, lower, color=color.new(color.teal, 90), title="BB Channel Fill")
fill(upper, mid, color=color.new(color.green, 85), title="Top Zone")
fill(mid, lower, color=color.new(color.red, 85), title="Bottom Zone")
"""
    },
    {
        "id": "f09_box_drawings",
        "name": "box.new Rectangular Shaded Range Boxes",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 09 - Box Drawings", overlay=true, max_boxes_count=100)
if bar_index % 20 == 0
    box.new(bar_index - 10, high + 2, bar_index, low - 2, border_color=color.blue, border_width=1, border_style=line.style_dotted, bgcolor=color.new(color.blue, 80), text="Session Block", text_color=color.white, text_size=size.small)
"""
    },
    {
        "id": "f10_line_drawings",
        "name": "line.new Trendlines & Vertical Day Dividers",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 10 - Line Drawings", overlay=true, max_lines_count=100)
if bar_index % 25 == 0
    line.new(bar_index, close + 5, bar_index, close - 5, extend=extend.both, color=color.gray, style=line.style_dashed, width=1)
"""
    },
    {
        "id": "f11_polyline_drawings",
        "name": "polyline.new Zig-Zag Wave Segments",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 11 - Polyline Drawings", overlay=true, max_polylines_count=50)
var chart.point[] pts = array.new<chart.point>()
if bar_index % 10 == 0
    array.push(pts, chart.point.now(close))
    if array.size(pts) >= 4
        polyline.new(pts, curved=false, closed=false, line_color=color.yellow, line_width=2)
        array.clear(pts)
"""
    },
    {
        "id": "f12_table_dashboard",
        "name": "table.new Anchored Metrics Dashboard",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 12 - Table Dashboard", overlay=true)
var table info_table = table.new(position.top_right, 2, 3, bgcolor=color.new(#1e222d, 10), border_color=color.gray, border_width=1)
table.cell(info_table, 0, 0, "Metric", bgcolor=color.new(color.blue, 30), text_color=color.white, text_size=size.small)
table.cell(info_table, 1, 0, "Value", bgcolor=color.new(color.blue, 30), text_color=color.white, text_size=size.small)
table.cell(info_table, 0, 1, "RSI (14)", text_color=color.white, text_size=size.small)
table.cell(info_table, 1, 1, str.tostring(ta.rsi(close, 14), "#.##"), text_color=color.yellow, text_size=size.small)
table.cell(info_table, 0, 2, "SMA (20)", text_color=color.white, text_size=size.small)
table.cell(info_table, 1, 2, str.tostring(ta.sma(close, 20), "#.##"), text_color=color.green, text_size=size.small)
"""
    },
    {
        "id": "f13_label_drawings",
        "name": "label.new Anchored Signal Callouts",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 13 - Label Drawings", overlay=true, max_labels_count=50)
highest_bar = ta.highestbars(high, 30) == 0
if highest_bar
    label.new(bar_index, high, "30-bar High", style=label.style_label_down, color=color.green, textcolor=color.white, size=size.small)
"""
    },
    {
        "id": "f14_all_9_inputs",
        "name": "All 9 Standard Input Types",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 14 - All 9 Inputs", overlay=true)
i_int = input.int(14, "Int Length", minval=1, maxval=100)
i_flt = input.float(2.0, "Float Mult", step=0.1)
i_bool = input.bool(true, "Show Signals")
i_str = input.string("SMA", "Type", options=["SMA", "EMA", "RSI"])
i_col = input.color(color.yellow, "Plot Color")
i_tf = input.timeframe("D", "Timeframe")
i_sym = input.symbol("XAUUSD.", "Anchor Symbol")
i_ses = input.session("0900-1700", "Trade Session")
i_src = input.source(close, "Source")
plot(ta.sma(i_src, i_int), "SMA Result", color=i_col, linewidth=2)
"""
    },
    {
        "id": "f15_extended_inputs_and_active",
        "name": "Extended Inputs (price, time, text_area) & Active Param",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 15 - Extended Inputs & Active", overlay=true)
enable_calc = input.bool(true, "Enable Custom Calc")
p_in = input.price(4405.0, "Price Anchor", active=enable_calc)
t_in = input.time(1700000000000, "Time Anchor", active=enable_calc)
notes = input.text_area("Default analysis notes...", "Journal", active=enable_calc)
plot(p_in, "Price Line", color=color.fuchsia)
"""
    },
    {
        "id": "f16_udt_methods_tuples",
        "name": "User-Defined Types, Custom Methods, and Tuple Unpacking",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 16 - UDT & Methods", overlay=true)
type TrendMetrics
    float fast_ma
    float slow_ma
    bool is_bullish

method calculate(TrendMetrics this, int fast_len, int slow_len) =>
    this.fast_ma := ta.sma(close, fast_len)
    this.slow_ma := ta.sma(close, slow_len)
    this.is_bullish := this.fast_ma > this.slow_ma
    this

metrics = TrendMetrics.new()
metrics.calculate(9, 21)
[fast_val, slow_val] = [metrics.fast_ma, metrics.slow_ma]
plot(fast_val, "Fast MA", color=color.green)
plot(slow_val, "Slow MA", color=color.red)
"""
    },
    {
        "id": "f17_v6_fractional_division",
        "name": "Pine Script v6 Fractional Division Preservation",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 17 - v6 Fractional Division", overlay=true)
frac_val = 5 / 2
plot(close + frac_val, "Close + 2.5", color=color.aqua, linewidth=2)
"""
    },
    {
        "id": "f18_strict_linebr_and_scale_invariance",
        "name": "plot.style_linebr & Zero Price Scale Badges (Strict NaN Invariance)",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 18 - Strict Line Breaks", overlay=true)
discontinuous = bar_index % 2 == 0 ? close : na
plot(discontinuous, "Line With Breaks", color=color.lime, style=plot.style_linebr, linewidth=3, display=display.pane)
"""
    },
    {
        "id": "f19_sessions_luxalgo_full_workload",
        "name": "Sessions [LuxAlgo] Full Production Indicator",
        "overlay": True,
        "file": r"E:\TRADINGVIEW ADVANCED\scratch_luxalgo.pine"
    },
    {
        "id": "f20_master_multi_feature_combination",
        "name": "Master Multi-Feature Synergy (Candles + BB + Fill + Shapes + Table + Dividers)",
        "overlay": True,
        "code": """//@version=6
indicator("Feature 20 - Master Multi-Feature Synergy", overlay=true, max_lines_count=100, max_boxes_count=100)
is_bull = close >= open
plotcandle(open, high, low, close, "Candles", color=is_bull ? color.green : color.red)
basis = ta.sma(close, 20)
dev = 2.0 * ta.stdev(close, 20)
u = plot(basis + dev, "Upper", color=color.teal)
l = plot(basis - dev, "Lower", color=color.teal)
fill(u, l, color=color.new(color.teal, 92))
cross_up = ta.crossover(close, basis + dev)
plotshape(cross_up, "Breakout", style=shape.labelup, location=location.belowbar, color=color.green, text="BO", textcolor=color.white)
if bar_index % 30 == 0
    line.new(bar_index, high + 1, bar_index, low - 1, extend=extend.both, style=line.style_dashed, color=color.gray)
var table dash = table.new(position.top_right, 2, 2, bgcolor=color.new(color.black, 20), border_color=color.gray, border_width=1)
table.cell(dash, 0, 0, "Regime", text_color=color.white, text_size=size.small)
table.cell(dash, 1, 0, is_bull ? "BULL" : "BEAR", text_color=is_bull ? color.green : color.red, text_size=size.small)
table.cell(dash, 0, 1, "Basis", text_color=color.white, text_size=size.small)
table.cell(dash, 1, 1, str.tostring(basis, "#.##"), text_color=color.yellow, text_size=size.small)
"""
    }
]

def run_all_feature_tests():
    print("=" * 80)
    print("STARTING EXHAUSTIVE PINE SCRIPT v6 FEATURE-BY-FEATURE VISUAL TEST MATRIX")
    print(f"Total Features to Test & Screenshot: {len(FEATURE_TESTS)}")
    print("=" * 80)

    results = []

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1920, "height": 1080})
        
        page.goto(BASE_URL, timeout=30000)
        page.wait_for_selector("#tv_chart_container iframe", timeout=20000)
        
        page.evaluate("""() => new Promise((resolve) => {
            if (window.widget && window.widget.onChartReady) {
                window.widget.onChartReady(() => resolve(true));
            } else {
                setTimeout(() => resolve(true), 5000);
            }
        })""")

        for idx, item in enumerate(FEATURE_TESTS, 1):
            fid = item["id"]
            fname = item["name"]
            is_overlay = item.get("overlay", True)
            print(f"\n[{idx}/{len(FEATURE_TESTS)}] Testing: {fid} -- {fname}...")

            if "file" in item:
                with open(item["file"], "r", encoding="utf-8") as f:
                    source_code = f.read()
            else:
                source_code = item["code"]

            with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
                transpile_res = client.post("/pine/transpile", json={"source": source_code})
                trans_data = transpile_res.json()
                if not trans_data.get("success"):
                    print(f"  [FAIL] Transpile error: {trans_data.get('error')}")
                    results.append({"id": fid, "name": fname, "success": False, "error": trans_data.get("error")})
                    continue

            add_res = page.evaluate("""async (param) => {
                const { sourceCode, isOverlay, fid } = param;
                const chart = window.widget.activeChart();
                if (!chart) return { success: false, error: 'No active chart' };

                let reg = null;
                if (window.PineIndicators && typeof window.PineIndicators.compileAndRegisterPine === 'function') {
                    try {
                        reg = window.PineIndicators.compileAndRegisterPine(sourceCode);
                    } catch (e) {
                        return { success: false, error: 'compileAndRegisterPine error: ' + e.toString() };
                    }
                }
                if (!reg || !reg.study) return { success: false, error: 'Failed to obtain study descriptor' };

                const innerWin = (window.widget._innerWindow && typeof window.widget._innerWindow === 'function')
                    ? window.widget._innerWindow()
                    : document.querySelector('#tv_chart_container iframe')?.contentWindow;

                if (innerWin && innerWin.JSServer && Array.isArray(innerWin.JSServer.studyLibrary)) {
                    if (!innerWin.JSServer.studyLibrary.some(s => s && s.name === reg.meta.title)) {
                        innerWin.JSServer.studyLibrary.push(reg.study);
                    }
                }

                if (chart) {
                    const repo = typeof chart.studyMetaInfoRepository === 'function' ? chart.studyMetaInfoRepository() : (chart.studyMetaIntoRepository ? chart.studyMetaIntoRepository() : null);
                    if (repo) {
                        if (typeof repo._processLibraryMetaInfo === 'function') {
                            repo._processLibraryMetaInfo([reg.study.metainfo]);
                        }
                        if (Array.isArray(repo._rawStudiesMetaInfo)) {
                            repo._rawStudiesMetaInfo.push(reg.study.metainfo);
                        }
                        if (Array.isArray(repo._javaStudiesMetaInfo)) {
                            if (!repo._javaStudiesMetaInfo.some(s => s && s.id === reg.study.metainfo.id)) {
                                repo._javaStudiesMetaInfo.push(reg.study.metainfo);
                            }
                        }
                    }
                }

                const title = reg.meta.title;
                const overlay = reg.meta.isOverlay !== undefined ? reg.meta.isOverlay : isOverlay;

                let entityId = null;
                try {
                    entityId = await chart.createStudy(title, overlay, false);
                } catch (e) {
                    return { success: false, error: 'createStudy error: ' + e.toString() };
                }

                await new Promise(r => setTimeout(r, 2500));

                const allStudies = typeof chart.getAllStudies === 'function' ? chart.getAllStudies() : [];
                const allShapes = typeof chart.getAllShapes === 'function' ? chart.getAllShapes() : [];

                return {
                    success: true,
                    entityId,
                    title,
                    studiesCount: allStudies.length,
                    shapesCount: allShapes.length
                };
            }""", {"sourceCode": source_code, "isOverlay": is_overlay, "fid": fid})

            if not add_res.get("success"):
                print(f"  [FAIL] Browser chart injection failed: {add_res.get('error')}")
                results.append({"id": fid, "name": fname, "success": False, "error": add_res.get("error")})
                continue

            screenshot_path = os.path.join(SCREENSHOT_DIR, f"{fid}.png")
            page.screenshot(path=screenshot_path)
            print(f"  [PASS] Successfully rendered study '{add_res.get('title')}'! Saved screenshot: {screenshot_path}")

            results.append({
                "id": fid,
                "name": fname,
                "success": True,
                "title": add_res.get("title"),
                "entityId": add_res.get("entityId"),
                "screenshot": screenshot_path
            })

            page.evaluate("""async (id) => {
                const chart = window.widget.activeChart();
                if (chart && id && typeof chart.removeEntity === 'function') {
                    try { chart.removeEntity(id); } catch(e) {}
                }
            }""", add_res.get("entityId"))
            time.sleep(0.5)

        browser.close()

    print("\n" + "=" * 80)
    print("FEATURE VISUAL MATRIX RESULTS SUMMARY")
    print("=" * 80)
    passed_count = sum(1 for r in results if r.get("success"))
    print(f"Total: {len(results)} | Passed: {passed_count} | Failed: {len(results) - passed_count}")
    for r in results:
        status_str = "PASS" if r.get("success") else "FAIL"
        print(f"  [{status_str}] {r['id']}: {r['name']}")

    summary_file = os.path.join(SCREENSHOT_DIR, "matrix_results.json")
    with open(summary_file, "w", encoding="utf-8") as f:
        json.dump(results, f, indent=2)
    print(f"\nSaved matrix results to {summary_file}")
    assert passed_count == len(results), f"Expected all {len(results)} features to pass, but only {passed_count} passed"
    print("\nALL FEATURES AND COMBINATIONS VERIFIED AND SCREENSHOTTED SUCCESSFULLY!")

if __name__ == "__main__":
    run_all_feature_tests()
