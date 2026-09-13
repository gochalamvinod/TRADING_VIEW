const { Indicator, pineToJS } = require('../../pinets.min.cjs');

console.log("=== TEST 1: //@version=6 basic script ===");
const code1 = `//@version=6
indicator("Test v6", overlay=true)
plot(close)
`;
const res1 = pineToJS(code1);
console.log("res1 success:", res1.success, "version:", res1.version);
if (!res1.success) console.log("res1 error:", res1.error);

console.log("\n=== TEST 2: All 9 input.* functions ===");
const code2 = `//@version=6
indicator("Inputs Test")
i_int = input.int(10, "Integer Input", minval=1, maxval=100)
i_float = input.float(1.5, "Float Input", step=0.1)
i_bool = input.bool(true, "Bool Input")
i_str = input.string("hello", "String Input", options=["hello", "world"])
i_col = input.color(#ff0000, "Color Input")
i_tf = input.timeframe("60", "Timeframe Input")
i_sym = input.symbol("AAPL", "Symbol Input")
i_sess = input.session("0930-1600", "Session Input")
i_src = input.source(close, "Source Input")
plot(close)
`;
const res2 = pineToJS(code2);
console.log("res2 success:", res2.success);
if (res2.success) {
    const ind2 = Indicator.from(code2);
    const meta2 = ind2.getInputsMeta();
    console.log("Extracted inputs count:", meta2.length);
    meta2.forEach(inp => console.log(` - varId: ${inp.varId}, type: ${inp.type}, title: "${inp.title}", defval: ${inp.defval}`));
} else {
    console.log("res2 error:", res2.error);
}

console.log("\n=== TEST 3: User-Defined Types (UDT) & Methods ===");
const code3 = `//@version=6
indicator("UDT Test")
type Point
    float x = 0.0
    float y = 0.0

method distance(Point this, Point other) =>
    math.sqrt(math.pow(this.x - other.x, 2) + math.pow(this.y - other.y, 2))

p1 = Point.new(1.0, 2.0)
p2 = Point.new(4.0, 6.0)
d = p1.distance(p2)
plot(d)
`;
const res3 = pineToJS(code3);
console.log("res3 success:", res3.success);
if (!res3.success) console.log("res3 error:", res3.error);

console.log("\n=== TEST 4: Tuples ===");
const code4 = `//@version=6
indicator("Tuple Test")
calc() =>
    [open, close]

[o, c] = calc()
plot(c)
`;
const res4 = pineToJS(code4);
console.log("res4 declaration success:", res4.success);
if (!res4.success) console.log("res4 error:", res4.error);

const code4b = `//@version=6
indicator("Tuple Reassignment Test")
var float a = 0.0
var float b = 0.0
[a, b] := [open, close]
plot(b)
`;
const res4b = pineToJS(code4b);
console.log("res4b reassignment success:", res4b.success);
if (!res4b.success) console.log("res4b error:", res4b.error);

console.log("\n=== TEST 5: library() and export method ===");
const code5 = `//@version=6
library("MyLib")
export method doubleVal(float x) =>
    x * 2.0
`;
const res5 = pineToJS(code5);
console.log("res5 success:", res5.success);
if (!res5.success) console.log("res5 error:", res5.error);

console.log("\n=== TEST 6: True Syntax Error Diagnostics Extraction ===");
const badCode = `//@version=6
indicator("Bad Code")
x = (10 + 5
plot(x)
`;
const badRes = pineToJS(badCode);
console.log("badRes success:", badRes.success);
console.log("badRes error:", badRes.error);

console.log("\n=== TEST 7: Drawing primitives (box, line, polyline, table, label) ===");
const code7 = `//@version=6
indicator("Drawings Test")
var b = box.new(bar_index - 5, high, bar_index, low, bgcolor=color.new(color.blue, 80))
var l = line.new(bar_index - 5, low, bar_index, high, color=color.red)
var lbl = label.new(bar_index, high, "Top", color=color.green)
var t = table.new(position.top_right, 2, 2)
table.cell(t, 0, 0, "Cell 0,0")
plot(close)
`;
const res7 = pineToJS(code7);
console.log("res7 success:", res7.success);
if (!res7.success) console.log("res7 error:", res7.error);
if (res7.success) {
    const ind7 = Indicator.from(code7);
    const prep7 = ind7.prepare();
    console.log("prep7 compiled successfully, fn exists:", typeof prep7.fn === 'function');
    
    // Run with mock data
    const PineTSClass = require('../../pinets.min.cjs').default || require('../../pinets.min.cjs').PineTS;
    if (PineTSClass) {
        const mockBars = [];
        const baseTime = 1700000000000;
        for (let i = 0; i < 20; i++) {
            mockBars.push({
                openTime: baseTime + i * 60000,
                closeTime: baseTime + (i + 1) * 60000,
                open: 100 + i,
                high: 105 + i,
                low: 95 + i,
                close: 102 + i,
                volume: 1000 + i * 10
            });
        }
        const pine = new PineTSClass(mockBars);
        pine.run(ind7).then(ctx => {

            console.log("Execution finished! Keys in ctx.plots:", Object.keys(ctx.plots));
            if (ctx.plots['__boxes__']) {
                console.log("Boxes count:", ctx.plots['__boxes__'].data[0]?.value?.length);
                console.log("Sample box:", ctx.plots['__boxes__'].data[0]?.value?.[0]);
            }
            if (ctx.plots['__lines__']) {
                console.log("Lines count:", ctx.plots['__lines__'].data[0]?.value?.length);
                console.log("Sample line:", ctx.plots['__lines__'].data[0]?.value?.[0]);
            }
            if (ctx.plots['__tables__']) {
                console.log("Tables count:", ctx.plots['__tables__'].data[0]?.value?.length);
                console.log("Sample table:", ctx.plots['__tables__'].data[0]?.value?.[0]);
            }
            if (ctx.plots['__labels__']) {
                console.log("Labels count:", ctx.plots['__labels__'].data[0]?.value?.length);
                console.log("Sample label:", ctx.plots['__labels__'].data[0]?.value?.[0]);
            }
        }).catch(err => {
            console.error("Execution error:", err);
        });
    }
}

