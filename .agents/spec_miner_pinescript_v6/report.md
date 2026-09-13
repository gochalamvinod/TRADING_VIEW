# Pine Script v6 Specification Mining Report

**Mining Agent:** `spec_miner_pinescript_v6`  
**Working Directory:** `E:\TRADINGVIEW ADVANCED\.agents\spec_miner_pinescript_v6`  
**Primary Specification Source:** Official TradingView Pine Script™ v6 Reference Manual & User Manual via `https://github.com/codenamedevan/pinescriptv6.git`, live TradingView documentation, and reference indicator codebases (`scratch_luxalgo.pine`, `pine_examples/`, `PineTS-main`).  
**Timestamp:** 2026-09-10T04:28:00Z  

---

## Executive Summary

Pine Script® version 6 introduces critical syntax extensions, compiler optimizations, strict type guarantees, and visual plotting enhancements. This report provides an authoritative, word-for-word specification mining for the Pine Script v6 compiler, runtime evaluator, and high-fidelity TradingView Charting Library plotter across all 8 mandatory domains:
1. **Header Directives and Compiler Directives:** `//@version=6`, `indicator()`, `strategy()`, `library()`, and compiler annotations (`//@description`, `//@function`, `//@param`, `//@returns`, `//@type`, `//@field`, `//@enum`, `//@variable`, `//@strategy_alert_message`).
2. **Input Functions & Type Forms:** All 9 standard types (`input.int`, `input.float`, `input.bool`, `input.string`, `input.color`, `input.timeframe`, `input.symbol`, `input.session`, `input.source`) plus extended inputs (`input.price`, `input.time`, `input.enum`, `input.text_area`, and generic `input()`), featuring the new v6 `active` parameter for dynamic conditional interactivity.
3. **User-Defined Types (UDT), Custom Methods, Tuples, and Namespaces:** Object definitions (`type`), constructor semantics (`TypeName.new()`), user-defined methods (`method <name>(<Type> this, ...)`), method overloading, tuple unpacks (`[a, b] = ...`), and module namespaces.
4. **Compile-Time Diagnostics:** Exact diagnostic schema (`line <Line>:<Col>: <Message>`), error severities (Compile Error, Compile Warning, Runtime Error, Pine Logs), and verbatim diagnostic messages.
5. **Visual Output and Plotting Rules:** Comprehensive interfaces and rendering invariants for `plot()`, `plotcandle()`, `plotbar()`, `plotshape()`, `plotchar()`, `plotarrow()`, `hline()`, and `fill()` (solid and gradient).
6. **Strict `na`/`NaN` Invariance:** Non-bridging of inactive intervals (`plot.style_linebr`, `plot.style_areabr`, `plot.style_steplinebr`), suppression of synthetic price scale badges, and numeric `NaN` serialization.
7. **Drawings and Display Primitives:** Object lifecycles and parameters for `line.new()`, `box.new()`, `polyline.new()`, `table.new()`, `table.cell()`, and `label.new()`.
8. **Session Shading & Time Dividers:** Formal syntax for session specifications (`"HHMM-HHMM"`), state tracking (`time()`), dynamic boundary tracking, LuxAlgo range box expansion, and vertical day dividers with `extend.both`.

---

## Features Discovered

| # | Category | Feature | Description | Inputs | Outputs | Error Behavior | Discovered Via |
|---|----------|---------|-------------|--------|---------|----------------|----------------|
| 1 | Header Directives | `//@version=6` | Compiler directive specifying that Pine Script v6 compiler semantics must be enforced. If omitted, compiler defaults to v1. | None (comment pragma) | Directs compiler to v6 engine | Failure to include produces v1 compilation or warnings; invalid version throws syntax error. | `reference/annotations.md`, `pinescriptv6_complete_reference.md` |
| 2 | Header Directives | `indicator()` | Primary declaration statement designating the script as an indicator and establishing script-wide properties. | `(title, shorttitle, overlay, format, precision, scale, max_bars_back, timeframe, timeframe_gaps, explicit_plot_zorder, max_lines_count, max_labels_count, max_boxes_count, calc_bars_count, max_polylines_count, dynamic_requests, behind_chart)` | Script metadata & execution context | Calling more than once per script throws compile error: "Script can have only one indicator() or strategy() or library() declaration". | `pinescriptv6_complete_reference.md:5616`, `visuals/overview.md` |
| 3 | Header Directives | `strategy()` | Declaration statement designating script as a backtesting strategy with order execution simulation. | `(title, shorttitle, overlay, format, precision, scale, pyramiding, calc_on_order_fills, calc_on_every_tick, max_bars_back, backtest_fill_limits_assumption, default_qty_type, default_qty_value, initial_capital, currency, slippage, commission_type, commission_value, process_orders_on_close, close_entries_rule, margin_long, margin_short, explicit_plot_zorder, max_lines_count, max_labels_count, max_boxes_count, calc_bars_count, max_polylines_count, dynamic_requests, behind_chart, risk_free_rate, use_bar_magnifier)` | Strategy execution context | Exceeding 9000 orders in v6 trims oldest orders instead of throwing fatal execution error. | `pinescriptv6_complete_reference.md:251618`, official v6 release notes |
| 4 | Header Directives | `library()` | Declaration statement identifying script as a shareable library exporting reusable functions, UDTs, and enums. | `(title, overlay)` (in v6 `overlay` is optional/deprecated) | Library module definition | Calling plotting functions not permitted in libraries; must export at least one function or UDT. | `pinescriptv6_complete_reference.md:6183`, `reference/annotations.md` |
| 5 | Compiler Annotations | `//@description` | Specifies descriptive summary text for a library or exported module to pre-fill publication dialogue. | Free text comment string | Metadata attachment | Ignored if not followed by valid declaration. | `reference/annotations.md:4` |
| 6 | Compiler Annotations | `//@function` | Specifies custom description for a function to appear in autosuggest and hover tooltips. | Free text comment string | Tooltip metadata | Must precede function definition. | `reference/annotations.md:37` |
| 7 | Compiler Annotations | `//@param` | Documents a specific parameter name and type in function hover documentation. | Parameter identifier and documentation text | Parameter metadata | Parameter name must match function signature. | `reference/annotations.md:48` |
| 8 | Compiler Annotations | `//@returns` | Documents what the preceding function returns. | Return description string | Return metadata | Must precede function definition. | `reference/annotations.md:60` |
| 9 | Compiler Annotations | `//@type` | Documents a user-defined type (UDT) for IDE autocomplete and hover tooltips. | Description string | Type metadata | Must precede `type <Name>` definition. | `reference/annotations.md:82` |
| 10 | Compiler Annotations | `//@field` | Documents an individual field within a UDT or enum. | Field name and description | Field tooltip metadata | Field name must exist in declared type/enum. | `reference/annotations.md:24` |
| 11 | Compiler Annotations | `//@enum` | Documents an enumeration type for IDE autocomplete and hover tooltips. | Description string | Enum metadata | Must precede `enum <Name>` definition. | `reference/annotations.md:14` |
| 12 | Compiler Annotations | `//@variable` | Documents an individual variable declaration. | Description string | Variable tooltip metadata | Must precede variable declaration. | `reference/annotations.md:94` |
| 13 | Compiler Annotations | `//@strategy_alert_message` | Defines default alert message string in alert creation modal for strategy alerts. | Format message string | Alert message template | Allowed only in strategy scripts. | `reference/annotations.md:72` |
| 14 | Inputs | `input.int()` | Adds an integer input field or dropdown to script's Settings -> Inputs tab. | `(defval, title, minval, maxval, step, tooltip, inline, group, confirm, display, active)` OR `(defval, title, options, tooltip, inline, group, confirm, display, active)` | `input int` | Passing both `options` and `minval`/`maxval`/`step` causes compile error. | `pinescriptv6_complete_reference.md:5773`, TV v6 reference |
| 15 | Inputs | `input.float()` | Adds a floating-point numeric input field or dropdown to script's Settings tab. | `(defval, title, minval, maxval, step, tooltip, inline, group, confirm, display, active)` OR `(defval, title, options, tooltip, inline, group, confirm, display, active)` | `input float` | Incompatible default type or options elements throw compile error. | `pinescriptv6_complete_reference.md:5744`, TV v6 reference |
| 16 | Inputs | `input.bool()` | Adds a boolean toggle checkbox to script's Settings tab. | `(defval, title, tooltip, inline, group, confirm, display, active)` | `input bool` | In v6, bool inputs cannot be `na`; must be `true` or `false`. | `pinescriptv6_complete_reference.md:5667` |
| 17 | Inputs | `input.string()` | Adds a text input field or dropdown selection to script's Settings tab. | `(defval, title, options, tooltip, inline, group, confirm, display, active)` OR `(defval, title, tooltip, inline, group, confirm, display, active)` | `input string` | Invalid option value selection defaults to `defval`. | `pinescriptv6_complete_reference.md:5864` |
| 18 | Inputs | `input.color()` | Adds an interactive color and opacity picker widget to script's Settings tab. | `(defval, title, tooltip, inline, group, confirm, display, active)` | `input color` | Passing invalid color format throws compile error. | `pinescriptv6_complete_reference.md:5687` |
| 19 | Inputs | `input.timeframe()` | Adds a resolution/timeframe picker dropdown to script's Settings tab. | `(defval, title, options, tooltip, inline, group, confirm, display, active)` OR `(defval, title, tooltip, inline, group, confirm, display, active)` | `input string` | Non-timeframe formatted string triggers runtime invalid resolution error. | `pinescriptv6_complete_reference.md:5928` |
| 20 | Inputs | `input.symbol()` | Adds a TradingView symbol search widget to script's Settings tab. | `(defval, title, tooltip, inline, group, confirm, display, active)` | `input string` | Empty or non-existent ticker resolves to `syminfo.tickerid` or throws symbol resolution warning. | `pinescriptv6_complete_reference.md:5895` |
| 21 | Inputs | `input.session()` | Adds a session time range selector (two dropdowns for start and end times). | `(defval, title, options, tooltip, inline, group, confirm, display, active)` OR `(defval, title, tooltip, inline, group, confirm, display, active)` | `input string` | Invalid format (not "HHMM-HHMM") causes `time()` to return `na` or compile failure. | `pinescriptv6_complete_reference.md:5805` |
| 22 | Inputs | `input.source()` | Adds a dropdown allowing user to select a series data source (`close`, `open`, `hl2`, or another study plot). | `(defval, title, tooltip, inline, group, confirm, display, active)` | `series float` | Binding to cyclic dependency or non-existent external plot fails study calculation. | `pinescriptv6_complete_reference.md:5835` |
| 23 | Inputs | `input.price()` | Adds an interactive on-chart price point input widget. | `(defval, title, tooltip, inline, group, confirm, display, active)` | `input float` | Non-numerical input rejected. | `pinescriptv6_complete_reference.md:5791` |
| 24 | Inputs | `input.time()` | Adds an interactive on-chart date/time picker widget. | `(defval, title, tooltip, inline, group, confirm, display, active)` | `input int` (UNIX ms) | Negative or non-timestamp values rejected. | `pinescriptv6_complete_reference.md:5916` |
| 25 | Inputs | `input.enum()` | Adds a dropdown whose options are automatically populated from the fields of an `enum`. | `(defval, title, options, tooltip, inline, group, confirm, display, active)` | `input <EnumName>` | All fields in `defval` and `options` must belong to the exact same enum type. | `pinescriptv6_complete_reference.md:5707` |
| 26 | Inputs | `input.text_area()` | Adds a multiline textarea input field to script's Settings tab. | `(defval, title, tooltip, group, confirm, display, active)` | `input string` | Inline placement is not allowed for multiline text areas. | `pinescriptv6_complete_reference.md:5906` |
| 27 | Inputs | `active` Parameter (v6) | Dynamically enables or disables (grays out) an input widget based on a boolean expression or toggle. | `active = <bool_expr>` | Modifies UI state of the input widget | Passing a non-boolean expression throws compile-time type mismatch error. | TV v6 Release Notes, `traderspost.io`, `tradingview.com` |
| 28 | UDT & Methods | `type <TypeName>` | Declares a User-Defined Type (composite struct) with typed fields and optional default values. | Struct field list (`<type> <name> = <default>`) | UDT definition & constructor namespace | Circular type definitions without nullable references throw compilation error. | `concepts/objects.md`, `reference/keywords.md` |
| 29 | UDT & Methods | `<TypeName>.new()` | Built-in constructor function automatically synthesized for every declared UDT. | Positional or keyword field values | Instance ID of `<TypeName>` | Passing incorrect argument types or unknown field names throws compilation error. | `concepts/objects.md:46` |
| 30 | UDT & Methods | `method <name>()` | Defines a custom method callable using dot-notation on variables of the first parameter's type. | `method <name>(<Type> this, <params>) => <expr>` | Result of method expression | Method must have at least one parameter; first parameter cannot be generic untyped. | `concepts/methods.md:14`, `reference/keywords.md` |
| 31 | UDT & Methods | Method Overloading | Allows multiple methods with the identical name but distinct first-parameter receiver types. | Overloaded method definitions | Dispatched based on receiver type | Ambiguous signatures that cannot be resolved at compile time throw compilation error. | `concepts/methods.md:65` |
| 32 | UDT & Methods | Tuples | Enables packing multiple values into `[a, b, ...]` and unpacking into distinct variables. | `[v1, v2, ...] = <expr>` | Multiple distinct variables | Cannot assign tuple to a single variable; nested tuples `[[a, b], c]` are invalid. | `scratch_luxalgo.pine:202`, `pinescriptv6_complete_reference.md` |
| 33 | UDT & Methods | Namespaces | Logical grouping of related functions and constants under dot-separated prefixes (`ta.*`, `math.*`, etc.). | `<Namespace>.<function>()` | Namespace function return | Accessing nonexistent identifier in namespace throws "Undeclared identifier" error. | `pinescriptv6_complete_reference.md`, `PineTS-main` |
| 34 | Diagnostics | Compile Error Format | Canonical diagnostic string emitted by compiler indicating exact error position and reason. | `line <LineNumber>:<Col>: <Message>` | Terminal / UI diagnostic badge | Blocks script compilation; returns exit code != 0. | `concepts/common_errors.md`, Pine Editor IDE |
| 35 | Diagnostics | "The if statement is too long" | Triggered when bytecode/AST generated by local block of an `if` construct exceeds internal parser limit. | Large nested block | Compiler diagnostic | Split block into helper functions or sequential conditionals. | `concepts/common_errors.md:5` |
| 36 | Diagnostics | "Script requesting too many securities" | Emitted when a script exceeds the maximum limit of 40 unique `request.security` calls. | > 40 security calls | Compiler diagnostic | Reduce security requests or merge calls into tuple requests. | `concepts/common_errors.md:27` |
| 37 | Diagnostics | "Loop is too long (> 500 ms)" | Runtime execution watchdog diagnostic when a loop takes more than 500ms on a single bar/tick. | Long / infinite while or for loop | Runtime abort | Loop terminated; study displays runtime error badge. | `concepts/common_errors.md:54` |
| 38 | Diagnostics | "Script has too many local variables" | Emitted when total number of unique local variables in script scopes exceeds JVM/compiler table capacity. | Too many variable declarations | Compiler diagnostic | Refactor variables into UDT fields, arrays, or maps. | `concepts/common_errors.md:60` |
| 39 | Diagnostics | "Historical offset is beyond buffer limit" | Emitted when `[offset]` lookback references a bar deeper than `max_bars_back` buffer allocation. | `var[N]` where `N > max_bars_back` | Runtime calculation error | Increase `max_bars_back` in declaration statement. | `concepts/common_errors.md:66` |
| 40 | Diagnostics | "Memory limits exceeded" | Emitted when memory consumed by arrays, matrices, maps, or UDT objects exceeds threshold. | Massive collection allocations | Runtime abort | Prune collections using `.shift()` / `.clear()`. | `concepts/common_errors.md:72` |
| 41 | Visual Output | `plot()` | Plots a continuous or discontinuous numerical series on chart canvas. | `(series, title, color, linewidth, style, trackprice, histbase, offset, join, editable, show_last, display)` | `plot` object ID (usable in `fill()`) | Passing non-numerical series throws compile error. | `visuals/plots.md`, `pinescriptv6_complete_reference.md` |
| 42 | Visual Output | `plotcandle()` | Renders authentic OHLC candlesticks in price pane or subpane. | `(open, high, low, close, title, color, wickcolor, editable, show_last, bordercolor, display)` | None | If any of `open`, `high`, `low`, or `close` is `na`, bar is completely omitted (no candle drawn). | `visuals/bar_plotting.md`, `pinescriptv6_complete_reference.md` |
| 43 | Visual Output | `plotbar()` | Renders authentic four-price OHLC bars in price pane or subpane. | `(open, high, low, close, title, color, editable, show_last, display)` | None | If any coordinate is `na`, bar is completely omitted. | `visuals/bar_plotting.md`, `pinescriptv6_complete_reference.md` |
| 44 | Visual Output | `plotshape()` | Plots predefined geometric or symbolic shapes at specified vertical anchors on the chart. | `(series, title, style, location, color, offset, text, textcolor, editable, size, show_last, display)` | None | Evaluates `series` as condition; if false or 0 or na, no shape is plotted. | `visuals/texts_and_shapes.md`, `pinescriptv6_complete_reference.md` |
| 45 | Visual Output | `plotchar()` | Plots arbitrary single Unicode characters or emojis on chart bars. | `(series, title, char, location, color, offset, text, textcolor, editable, size, show_last, display)` | None | Character must be exactly one character; string length > 1 causes compile error. | `visuals/texts_and_shapes.md`, `pinescriptv6_complete_reference.md` |
| 46 | Visual Output | `plotarrow()` | Plots directional indicator arrows scaled proportionally to the magnitude of the series value. | `(series, title, colorup, colordown, offset, minheight, maxheight, editable, show_last, display)` | None | Values of 0 or `na` produce no arrow. Positive values plot up arrow; negative plot down arrow. | `visuals/texts_and_shapes.md`, `pinescriptv6_complete_reference.md` |
| 47 | Visual Output | `hline()` | Renders a fixed, static horizontal price level line across the entire chart. | `(price, title, color, linestyle, linewidth, editable, display)` | `hline` object ID (usable in `fill()`) | Price argument MUST be `const int/float` or `input int/float`; cannot be a `series`. | `visuals/levels.md`, `pinescriptv6_complete_reference.md` |
| 48 | Visual Output | `fill()` | Shades background area between two `plot` IDs or two `hline` IDs using solid or gradient coloring. | `(plot1, plot2, color, title, editable, show_last, fillgaps)` OR `(plot1, plot2, top_value, bottom_value, top_color, bottom_color, title, editable)` | None | Plots must originate from the same indicator pane; mixing hline and plot is invalid. | `visuals/fills.md`, `pinescriptv6_complete_reference.md` |
| 49 | Invariance | `plot.style_linebr` | Plots discontinuous line segments that do NOT bridge across `na` gaps. | Style constant passed to `plot(..., style = plot.style_linebr)` | Discontinuous line rendering | Connecting line segments strictly suppressed on `na` bars; zero horizontal bridging. | `visuals/plots.md:75`, `scratch_luxalgo.pine:458` |
| 50 | Invariance | `plot.style_areabr` | Area plot that does NOT bridge across `na` gaps and recalculates scale solely from non-na points. | Style constant passed to `plot(..., style = plot.style_areabr)` | Discontinuous filled area | Gaps left completely transparent; zero artificial baseline fills. | `visuals/plots.md:85` |
| 51 | Invariance | Price Scale Badge Suppression | Prevents rendering price pill badges on the chart axis when a plot's latest value is `na` / `NaN`. | Evaluated plot series equals `NaN` | Price scale label omitted | Emitting 0.0 or synthetic value produces invalid price scale badges; strictly prohibited. | TradingView Charting Library Invariant |
| 52 | Drawings | `line.new()` | Instantiates an interactive line primitive between two chart coordinates. | `(x1, y1, x2, y2, xloc, extend, color, style, width, force_overlay)` OR `(first_point, second_point, ...)` | `series line` | If both points are identical, line has 0 length and does not render. Exceeding `max_lines_count` deletes oldest line. | `visuals/lines_and_boxes.md`, `pinescriptv6_complete_reference.md` |
| 53 | Drawings | `box.new()` | Instantiates a rectangular box primitive defined by opposing diagonal corner points. | `(left, top, right, bottom, border_color, border_width, border_style, extend, xloc, bgcolor, text, text_size, text_color, text_halign, text_valign, text_wrap, text_font_family, force_overlay, text_formatting)` | `series box` | Exceeding `max_boxes_count` automatically deletes the oldest box on chart. | `visuals/lines_and_boxes.md`, `pinescriptv6_complete_reference.md` |
| 54 | Drawings | `polyline.new()` | Connects an array of `chart.point` objects sequentially with straight or curved segments. | `(points, curved, closed, xloc, line_color, fill_color, line_style, line_width, force_overlay)` | `series polyline` | Points array must contain at least 2 points; exceeding `max_polylines_count` deletes oldest polyline. | `visuals/lines_and_boxes.md`, `pinescriptv6_complete_reference.md` |
| 55 | Drawings | `table.new()` | Creates an anchored on-chart UI grid table container. | `(position, columns, rows, bgcolor, frame_color, frame_width, border_color, border_width, force_overlay)` | `series table` | Max 1 table per anchor position; table not visible until at least one cell populated. | `visuals/tables.md`, `pinescriptv6_complete_reference.md` |
| 56 | Drawings | `table.cell()` | Populates or updates an individual cell in a table. | `(table_id, column, row, text, width, height, text_color, text_halign, text_valign, text_size, bgcolor, tooltip, text_font_family, text_formatting)` | None | Out of bounds row/column triggers runtime error; overwrites previously uncommitted cell attributes. | `visuals/tables.md`, `scratch_luxalgo.pine:138` |
| 57 | Drawings | `label.new()` | Instantiates an on-chart text and pointer label anchored to a bar or price coordinate. | `(x, y, text, xloc, yloc, color, style, textcolor, size, textalign, tooltip, text_font_family, force_overlay, text_formatting)` | `series label` | Exceeding `max_labels_count` deletes oldest label. | `visuals/texts_and_shapes.md`, `pinescriptv6_complete_reference.md` |
| 58 | Session Shading | Session Time Determination | Evaluates whether current bar timestamp falls within a user-specified session window. | `time(timeframe.period, sessionString, timezone)` | UNIX timestamp if in session, `na` if outside | Returns `na` if session string is invalid or bar falls outside session. | `scratch_luxalgo.pine:266`, `concepts/timeframes.md` |
| 59 | Session Shading | Dynamic Range Box Expansion | Dynamically expands session high/low bounding box on every intrabar tick during active session. | `box.set_top(high)`, `box.set_rightbottom(bar_index, low)` | Mutates box dimensions | When session concludes, box coordinates freeze to encapsulate entire session range. | `scratch_luxalgo.pine:255` |
| 60 | Session Shading | Multi-Day Vertical Dividers | Renders full-height vertical dashed dividers separating calendar days across charts. | `line.new(bar_index, close + mintick, bar_index, close - mintick, extend = extend.both, style = line.style_dashed)` | Vertical divider line | `extend = extend.both` ensures line spans entire vertical chart height without distorting timescale. | `scratch_luxalgo.pine:494` |

---

## Edge Cases

| # | Feature | Input | Observed Behavior |
|---|---------|-------|-------------------|
| 1 | `plot()` with `na` values | `plot.style_line` on series containing intermittent `na` values | Draws continuous connecting line between last non-na point and next non-na point, bridging across gaps. |
| 2 | `plot()` with `plot.style_linebr` | `plot.style_linebr` on series containing `na` values | Stops drawing at the `na` bar; does NOT bridge across gap; resumes cleanly at next non-na bar with zero joining segment. |
| 3 | Price Scale Badges on `na` | Series evaluation produces `NaN` on the latest chart bar | Charting Library price scale suppresses price pill label completely; zero synthetic badges displayed on price axis. |
| 4 | `plotcandle()` with partial `na` | `open = 100`, `high = 105`, `low = na`, `close = 102` | Candlestick is completely omitted from the chart. No partial wick or body is drawn when ANY of OHLC is `na`. |
| 5 | `plotbar()` with inverted prices | `open = 105`, `high = 100`, `low = 110`, `close = 102` | TradingView automatically normalizes prices: highest value (`110`) is assigned to high, and lowest value (`100`) is assigned to low. |
| 6 | `plotchar()` with multiple characters | `plotchar(true, char = "ABCD")` | Compilation error: `char` argument must be exactly one character. |
| 7 | `input.int()` with `options` and `minval` | `input.int(10, "Length", options = [5, 10, 20], minval = 1)` | Compile-time error: `minval`, `maxval`, and `step` cannot be combined with `options`. |
| 8 | `input.bool()` value equality | `input.bool(true, "Toggle") == na` | Always evaluates to `false` in Pine Script v6 because `bool` type in v6 is strictly two-state (`true` or `false`) and can never be `na`. |
| 9 | `time()` session spanning midnight | `session = "2100-0600"` (e.g. Sydney session) | Correctly spans across midnight; returns bar timestamp for all bars from 21:00 UTC through 06:00 UTC of following day. |
| 10 | `line.new()` with identical coordinates | `line.new(bar_index, close, bar_index, close)` | Object is allocated in memory, but 0-pixel length means no line segment is rendered on the chart canvas. |
| 11 | `table.new()` without populated cells | `t = table.new(position.top_right, 3, 3)` without `table.cell()` calls | Table container exists in indicator memory but remains completely invisible on chart canvas until cells are populated. |
| 12 | `polyline.new()` with 1 point | `polyline.new([chart.point.now(close)])` | Polyline requires at least 2 points to render segments; calling with < 2 points results in no visible drawing. |
| 13 | UDT field defaulting | `type Point\n  int x\n  float y = 0.0` instantiated as `Point.new(10)` | Field `x` takes argument `10`; field `y` takes declared default value `0.0`. Omitted fields without defaults initialize to `na`. |
| 14 | Method dispatch on `na` receiver | `float x = na\nx.getType()` where method has `method getType(float this) => na(this) ? "float(na)" : "float"` | Dispatches correctly to `float` overload and receives `na` as argument, returning `"float(na)"`. Does not crash. |
| 15 | Tuple conditional assignment | `[a, b] = if condition\n  [1, 2.0]\nelse\n  [3, 4.0]` | Valid; both branches return 2-element tuples with identical types (`int`, `float`). Mismatched types or arities cause compile error. |
| 16 | `fill()` between plots in different panes | `p1` in overlay pane, `p2` in separate indicator pane | Compilation or runtime error: `fill()` can only shade between plots residing in the identical pane. |
| 17 | `hline()` with series price | `hline(close, "Dynamic Level")` | Compilation error: `hline()` price parameter requires `const float` or `input float`; dynamic `series float` prohibited. |
| 18 | `request.security()` tuple with OHLC | `[o, h, l, c] = request.security("AAPL", "D", [open, high, low, close])` | Returns atomic 4-element tuple for requested symbol without creating 4 independent security network requests. |
| 19 | `box.new()` with `xloc.bar_index` into future | `box.new(bar_index, high, bar_index + 600, low)` | Clamped to max 500 bars into the future; coordinates > 500 bars beyond dataset boundary are rejected or clamped. |
| 20 | Day divider with `extend = extend.both` | `line.new(bar_index, close + mintick, bar_index, close - mintick, extend = extend.both)` | Line extends indefinitely up and down, spanning the full vertical chart height across all price movements. |

---

## Detailed Domain Analysis

### 1. Header Directives and Compiler Directives

#### `//@version=6`
- Must appear at the head of the script (or preceding executable statements).
- Enforces Pine Script version 6 compiler semantics:
  - Lazy evaluation of `and` / `or` logical operators.
  - Strict two-state boolean types (`true` and `false`; booleans cannot be `na`).
  - Dynamic `request.*()` calls supporting series string parameters.
  - Negative indexing support for array access (`array.get(arr, -1)` accesses the last element).
  - Trimming of oldest strategy orders when exceeding 9,000 orders rather than crashing.
  - Improved line-wrapping syntax inside parentheses without 4-space multiple restrictions.

#### `indicator()`
```pinescript
indicator(title, shorttitle, overlay, format, precision, scale, max_bars_back, timeframe, timeframe_gaps, explicit_plot_zorder, max_lines_count, max_labels_count, max_boxes_count, calc_bars_count, max_polylines_count, dynamic_requests, behind_chart)
```
- **Defaults:**
  - `title`: Required `const string`.
  - `shorttitle`: Default equals `title`.
  - `overlay`: Default `false` (renders in separate subpane). Set to `true` to overlay on main price candles.
  - `format`: Default `format.inherit` (also `format.price`, `format.volume`, `format.percent`).
  - `precision`: Default `2` (range `0` to `16`).
  - `scale`: Default `scale.right` (also `scale.left`, `scale.none`).
  - `max_bars_back`: Default `500` (can be configured up to `5000`).
  - `max_lines_count`: Default `50` (max configurable: `500`).
  - `max_labels_count`: Default `50` (max configurable: `500`).
  - `max_boxes_count`: Default `50` (max configurable: `500`).
  - `max_polylines_count`: Default `50` (max configurable: `100`).
  - `behind_chart`: Default `true` (drawings and plots appear behind price bars).

#### `strategy()`
```pinescript
strategy(title, shorttitle, overlay, format, precision, scale, pyramiding, calc_on_order_fills, calc_on_every_tick, max_bars_back, backtest_fill_limits_assumption, default_qty_type, default_qty_value, initial_capital, currency, slippage, commission_type, commission_value, process_orders_on_close, close_entries_rule, margin_long, margin_short, explicit_plot_zorder, max_lines_count, max_labels_count, max_boxes_count, calc_bars_count, max_polylines_count, dynamic_requests, behind_chart, risk_free_rate, use_bar_magnifier)
```
- Includes all visual parameters of `indicator()` (except `timeframe` and `timeframe_gaps`).
- Manages portfolio simulation, margin requirements, order execution, and trade metrics.

#### `library()`
```pinescript
library(title, overlay)
```
- Defines reusable module containing exported functions, UDTs, and enums via `export` keyword.
- Cannot contain standalone `plot()` or drawing outputs in global scope.

---

### 2. All 9 Input Types & Parameters

| Function | Default Typing | Key Parameters & Typing | Return Type | UI Presentation |
|---|---|---|---|---|
| `input.int()` | `defval`: `const int` | `defval`, `title`, `minval`, `maxval`, `step`, `options`, `tooltip`, `inline`, `group`, `confirm`, `display`, `active` | `input int` | Number spinbox or dropdown |
| `input.float()` | `defval`: `const float` | `defval`, `title`, `minval`, `maxval`, `step`, `options`, `tooltip`, `inline`, `group`, `confirm`, `display`, `active` | `input float` | Float spinbox or dropdown |
| `input.bool()` | `defval`: `const bool` | `defval`, `title`, `tooltip`, `inline`, `group`, `confirm`, `display`, `active` | `input bool` | Checkbox toggle |
| `input.string()` | `defval`: `const string` | `defval`, `title`, `options`, `tooltip`, `inline`, `group`, `confirm`, `display`, `active` | `input string` | Textbox or dropdown |
| `input.color()` | `defval`: `const color` | `defval`, `title`, `tooltip`, `inline`, `group`, `confirm`, `display`, `active` | `input color` | Color & opacity picker |
| `input.timeframe()` | `defval`: `const string` | `defval`, `title`, `options`, `tooltip`, `inline`, `group`, `confirm`, `display`, `active` | `input string` | Timeframe dropdown list |
| `input.symbol()` | `defval`: `const string` | `defval`, `title`, `tooltip`, `inline`, `group`, `confirm`, `display`, `active` | `input string` | Symbol search dialog |
| `input.session()` | `defval`: `const string` | `defval`, `title`, `options`, `tooltip`, `inline`, `group`, `confirm`, `display`, `active` | `input string` | Session start/end time pickers |
| `input.source()` | `defval`: `series float` | `defval`, `title`, `tooltip`, `inline`, `group`, `confirm`, `display`, `active` | `series float` | Source series dropdown |
| `input.price()` | `defval`: `const float` | `defval`, `title`, `tooltip`, `inline`, `group`, `confirm`, `display`, `active` | `input float` | Interactive chart price picker |
| `input.time()` | `defval`: `const int` | `defval`, `title`, `tooltip`, `inline`, `group`, `confirm`, `display`, `active` | `input int` | Interactive date/time picker |
| `input.enum()` | `defval`: `const enum` | `defval`, `title`, `options`, `tooltip`, `inline`, `group`, `confirm`, `display`, `active` | `input <Enum>` | Enum field dropdown |
| `input.text_area()`| `defval`: `const string` | `defval`, `title`, `tooltip`, `group`, `confirm`, `display`, `active` | `input string` | Multiline textarea box |

#### Typing Hierarchy
`const` -> `input` -> `simple` -> `series`
An `input` value is resolved at script execution initialization and remains fixed across all bars (with the exception of `input.source`, which resolves to a time series).

---

### 3. User-Defined Types (UDT), Custom Methods, Tuples, & Namespaces

#### UDT Syntax:
```pinescript
type <TypeName>
    <field_type_1> <field_name_1> [= <default_value_1>]
    <field_type_2> <field_name_2> [= <default_value_2>]
```
- Instantiation: `<TypeName>.new(<arg1>, <arg2>, ...)` or `<TypeName>.new(<field1> = <arg1>, ...)`.
- Field access: `<object_id>.<field_name>`.
- Object references: Mutable reference semantics. Assigning an object to another variable copies the reference ID, not the object fields.

#### Custom Methods:
```pinescript
method <method_name>(<ReceiverType> this, <param2_type> <param2_name>, ...) =>
    <expression_or_block>
```
- Method invocation: `<variable>.<method_name>(<arg2>, ...)`.
- Methods can be overloaded based on the type of `this` (the first parameter).

#### Tuples:
- Multi-assignment syntax: `[a, b, c] = <tuple_returning_expr>`.
- Tuple returns from functions:
  ```pinescript
  calcStats(src) =>
      m = ta.sma(src, 20)
      s = ta.stdev(src, 20)
      [m, s]
  ```
- Tuples must be unpacked immediately in variable declarations or reassignments.

---

### 4. Compile-Time Diagnostics

#### Format Specification:
```
line <line_number>:<column_number>: <Error/Warning Message>
```

#### Categories and Severities:
1. **Compilation Errors (Fatal):**
   - Syntax errors (`no viable alternative at character`, `mismatched input`).
   - Type incompatibilities (`Cannot call '...' with argument '...' of type '...'. An argument of '...' type was used but a '...' is expected`).
   - Scope violations (`Cannot use '...' in local scope`, `Function '...' must be called from global scope`).
   - Limit violations (`Script requesting too many securities (> 40)`, `Script has too many local variables`).
2. **Compilation Warnings (Non-Fatal):**
   - Repainting warnings (`CW10003: The function request.security() was called with a lookahead flag that may cause repainting`).
   - Deprecated syntax warnings.
3. **Runtime Diagnostics:**
   - Watchdog timeouts (`Loop is too long (> 500 ms)`).
   - Buffer overflows (`Historical offset is beyond buffer limit`).
   - Memory capacity exceeded (`Memory limits exceeded`).

---

### 5. Visual Output and Plotting Rules

#### `plot()`
- Signatures:
  ```pinescript
  plot(series, title, color, linewidth, style, trackprice, histbase, offset, join, editable, show_last, display) -> plot
  ```
- Styles:
  - `plot.style_line`: Continuous line (bridges across na values).
  - `plot.style_linebr`: Discontinuous line (does NOT bridge across na values).
  - `plot.style_stepline`: Staircase line.
  - `plot.style_steplinebr`: Staircase line with breaks on na.
  - `plot.style_area`: Filled area between series and histbase.
  - `plot.style_areabr`: Discontinuous filled area.
  - `plot.style_columns`: Vertical histogram columns.
  - `plot.style_histogram`: Thin vertical bars from histbase.
  - `plot.style_circles`: Discrete circle markers.
  - `plot.style_cross`: Discrete cross markers.

#### `plotcandle()` & `plotbar()`
- `plotcandle(open, high, low, close, title, color, wickcolor, editable, show_last, bordercolor, display)`
- If ANY of OHLC is `na`, the candlestick or bar is NOT drawn.
- High is always the mathematical maximum of OHLC; Low is always the mathematical minimum.

#### `plotshape()` & `plotchar()`
- `plotshape(series, title, style, location, color, offset, text, textcolor, editable, size, show_last, display)`
- `plotchar(series, title, char, location, color, offset, text, textcolor, editable, size, show_last, display)`
- Location: `location.abovebar`, `location.belowbar`, `location.top`, `location.bottom`, `location.absolute`.
- Shape styles: `shape.xcross`, `shape.cross`, `shape.triangleup`, `shape.triangledown`, `shape.flag`, `shape.circle`, `shape.arrowup`, `shape.arrowdown`, `shape.labelup`, `shape.labeldown`, `shape.square`, `shape.diamond`.

#### `fill()`
- Plots: `fill(plot1, plot2, color, title, editable, show_last, fillgaps)`
- Levels: `fill(hline1, hline2, color, title, editable, fillgaps)`
- Gradients: `fill(p1, p2, top_value, bottom_value, top_color, bottom_color, title, editable)`

---

### 6. Strict `na`/`NaN` Invariance

1. **Numerical Series Invariance:**
   - When a formula evaluates to `na`, PineTS / runtime evaluator must output `NaN` (`null` or `NaN` in JavaScript / JSON).
   - In Pine Script, `na` arithmetic strictly propagates: `na + 1.0` -> `na`.
2. **Plot Invariance (`plot.style_linebr`):**
   - For line plots using `plot.style_linebr`, when `series[i]` is `NaN`, NO line segment is generated between `i-1` and `i+1`.
   - Gaps remain empty, producing cleanly severed lines across inactive intervals.
3. **Price Scale Invariance:**
   - When the latest bar of a plotted series is `NaN`, the price scale badge (last value pill) MUST BE SUPPRESSED.
   - Zero synthetic 0.0 badges on the price scale; zero stacked badges for inactive indicator states.

---

### 7. Drawings & Display Primitives

#### `line.new()`
```pinescript
line.new(x1, y1, x2, y2, xloc, extend, color, style, width, force_overlay) -> series line
line.new(first_point, second_point, xloc, extend, color, style, width, force_overlay) -> series line
```
- Styles: `line.style_solid`, `line.style_dashed`, `line.style_dotted`, `line.style_arrow_left`, `line.style_arrow_right`, `line.style_arrow_both`.
- Extend: `extend.none`, `extend.left`, `extend.right`, `extend.both`.

#### `box.new()`
```pinescript
box.new(left, top, right, bottom, border_color, border_width, border_style, extend, xloc, bgcolor, text, text_size, text_color, text_halign, text_valign, text_wrap, text_font_family, force_overlay, text_formatting) -> series box
box.new(top_left, bottom_right, ...) -> series box
```
- Controls rectangular regions with background color and borders, plus internal label text.

#### `polyline.new()`
```pinescript
polyline.new(points, curved, closed, xloc, line_color, fill_color, line_style, line_width, force_overlay) -> series polyline
```
- Connects an array of `chart.point` structures. Supports Catmull-Rom or cubic spline curve interpolation when `curved = true`.

#### `table.new()` & `table.cell()`
```pinescript
table.new(position, columns, rows, bgcolor, frame_color, frame_width, border_color, border_width, force_overlay) -> series table
table.cell(table_id, column, row, text, width, height, text_color, text_halign, text_valign, text_size, bgcolor, tooltip, text_font_family, text_formatting)
```
- Fixed HUD table anchored to chart corners (`position.top_right`, `position.bottom_left`, etc.).

#### `label.new()`
```pinescript
label.new(x, y, text, xloc, yloc, color, style, textcolor, size, textalign, tooltip, text_font_family, force_overlay, text_formatting) -> series label
```
- Anchored callout balloons, tooltips, and markers.

---

### 8. Session Shading & Multi-Day Vertical Dividers

#### 1. Session String Syntax
- Formats:
  - `"HHMM-HHMM"` (every day, e.g. `"1300-2200"`)
  - `"HHMM-HHMM:1234567"` (specific days of week where 1=Sunday, 2=Monday, ..., 7=Saturday)
  - Multi-session: `"0900-1200,1300-1700"`
- Overnight sessions: when start time > end time (e.g. `"2100-0600"`), the session spans midnight into the following morning.

#### 2. Session Time Tracking
- Evaluation statement:
  ```pinescript
  bool sessionActive = not na(time(timeframe.period, sessionInput, sessionTimezone))
  bool sessionStarted = sessionActive and not sessionActive[1]
  bool sessionEnded = not sessionActive and sessionActive[1]
  ```

#### 3. Dynamic Session Range Shading (LuxAlgo Pattern)
- On `sessionStarted`:
  ```pinescript
  sessionHigh := high
  sessionLow := low
  rangeBoxId := box.new(bar_index, sessionHigh, bar_index, sessionLow, bgcolor = color.new(sessionColor, transparency), border_color = outline ? sessionColor : na, border_style = line.style_dotted)
  ```
- While `sessionActive`:
  ```pinescript
  sessionHigh := math.max(high, sessionHigh)
  sessionLow := math.min(low, sessionLow)
  rangeBoxId.set_top(sessionHigh)
  rangeBoxId.set_rightbottom(bar_index, sessionLow)
  ```
- Produces shaded rectangular background spanning the session without generating gaps or compressing candle timestamps.

#### 4. Multi-Day Vertical Dividers
- Calculation:
  ```pinescript
  int currentDay = dayofweek
  bool newDay = currentDay != currentDay[1]
  if newDay and showDividers
      line.new(bar_index, close + syminfo.mintick, bar_index, close - syminfo.mintick, color = color.gray, extend = extend.both, style = line.style_dashed)
  ```
- `extend.both` projects the line to positive and negative infinity along the y-axis, rendering a continuous full-pane vertical divider.

---

## Conclusion & Implementation Guide for Orchestrator

1. **AST & Parser Readiness:** The grammar must recognize `//@version=6`, typed UDT declarations (`type`), custom methods (`method`), tuple unpacked assignments (`[a, b] = ...`), and all 9 input signatures including `active = <expr>`.
2. **Runtime Plotter Rules:**
   - Treat `na` strictly: plot outputs with `na` must be mapped to `NaN`.
   - `plot.style_linebr` must break continuous lines across `na` gaps.
   - Suppress price scale badges when plot value is `NaN`.
   - For `plotcandle`, omit the entire candle when any of `open`, `high`, `low`, `close` is `NaN`.
3. **Drawings Engine:**
   - Map `box.new` and `line.new` to TradingView Charting Library custom shapes or multipoint drawing primitives.
   - Maintain object counts within `max_boxes_count`, `max_lines_count`, `max_labels_count`, `max_polylines_count`.
4. **Session Engine:**
   - Evaluate session intervals via time parsing matching `"HHMM-HHMM"`.
   - Update session boxes incrementally on bar arrival and intraday streaming ticks.
