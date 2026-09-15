// SPDX-License-Identifier: AGPL-3.0-only
// Copyright (C) 2026 LuxAlgo

import { describe, it, expect } from 'vitest';
import { pineToJS } from '../../src/transpiler/pineToJS/pineToJS.index';
import { transpile } from '../../src/transpiler';
import { Indicator } from '../../src/Indicator';

describe('Pine Script v6 Features & Compiler Enhancements', () => {
    describe('Typed Tuple Destructuring', () => {
        it('should parse and transpile primitive typed tuple destructuring [int a, float b]', () => {
            const code = `//@version=6
indicator("Typed Tuple Test")
calc() =>
    [1, 2.5]

[int a, float b] = calc()
plot(a + b)
`;
            const result = pineToJS(code);
            expect(result.success).toBe(true);
            expect(result.code).toContain('const [a, b] =');

            const fn = transpile(code);
            expect(fn).toBeDefined();
        });

        it('should parse and transpile qualified typed tuple destructuring [series float a, simple int b]', () => {
            const code = `//@version=6
indicator("Qualified Tuple Test")
calc() =>
    [close, 10]

[series float a, simple int b] = calc()
plot(a)
`;
            const result = pineToJS(code);
            expect(result.success).toBe(true);
            expect(result.code).toContain('const [a, b] =');

            const fn = transpile(code);
            expect(fn).toBeDefined();
        });

        it('should parse and transpile mixed typed and untyped tuple destructuring [int a, b, float c]', () => {
            const code = `//@version=6
indicator("Mixed Tuple Test")
calc() =>
    [1, 2, 3.5]

[int a, b, float c] = calc()
plot(a + b + c)
`;
            const result = pineToJS(code);
            expect(result.success).toBe(true);
            expect(result.code).toContain('const [a, b, c] =');

            const fn = transpile(code);
            expect(fn).toBeDefined();
        });

        it('should parse and transpile tuple destructuring with array and generic types', () => {
            const code = `//@version=6
indicator("Complex Types Tuple Test")
calc() =>
    [array.new_float(5), array.new_int(5)]

[float[] a, array<int> b] = calc()
plot(0)
`;
            const result = pineToJS(code);
            expect(result.success).toBe(true);
            expect(result.code).toContain('const [a, b] =');

            const fn = transpile(code);
            expect(fn).toBeDefined();
        });

        it('should parse and transpile tuple destructuring with discard identifier [int a, _]', () => {
            const code = `//@version=6
indicator("Tuple Discard Test")
calc() =>
    [10, 20]

[int a, _] = calc()
plot(a)
`;
            const result = pineToJS(code);
            expect(result.success).toBe(true);
            expect(result.code).toContain('const [a, _] =');

            const fn = transpile(code);
            expect(fn).toBeDefined();
        });

        it('should parse multiline typed tuple destructuring', () => {
            const code = `//@version=6
indicator("Multiline Tuple Test")
calc() =>
    [1, 2.0]

[
    int a,
    float b
] = calc()
plot(a + b)
`;
            const result = pineToJS(code);
            expect(result.success).toBe(true);
            expect(result.code).toContain('const [a, b] =');
        });

        it('should support var tuple destructuring: var [a, b] = ...', () => {
            const code = `//@version=6
indicator("Var Tuple Test")
calc() =>
    [10, 20]

var [int a, int b] = calc()
plot(a + b)
`;
            const result = pineToJS(code);
            expect(result.success).toBe(true);
        });
    });

    describe('Directives: indicator, strategy, library', () => {
        it('should detect indicator directive and properties', () => {
            const code = `//@version=6
indicator("My Indicator", overlay = true, max_bars_back = 500)
plot(close)
`;
            const ind = Indicator.from(code);
            expect(ind.getDeclarationType()).toBe('indicator');
            const props = ind.getPropsMeta();
            expect(props.length).toBeGreaterThan(0);
            expect(ind.prop.overlay).toBe(true);
            expect(ind.prop.max_bars_back).toBe(500);
        });

        it('should detect strategy directive and properties', () => {
            const code = `//@version=6
strategy("My Strategy", overlay = true, initial_capital = 10000)
plot(close)
`;
            const ind = Indicator.from(code);
            expect(ind.getDeclarationType()).toBe('strategy');
            expect(ind.prop.initial_capital).toBe(10000);
        });

        it('should detect library directive and properties', () => {
            const code = `//@version=6
library("MyLibrary", overlay = false)
export add(int x, int y) => x + y
`;
            const ind = Indicator.from(code);
            expect(ind.getDeclarationType()).toBe('library');
        });

        it('should parse export functions in library', () => {
            const code = `//@version=6
library("MathLib")
export doubleVal(float x) =>
    x * 2.0
`;
            const result = pineToJS(code);
            expect(result.success).toBe(true);
        });
    });

    describe('All 9 Pine Script Input Types & v6 active parameter', () => {
        it('should cleanly extract metadata for all 9 input types with defaults and parameters', () => {
            const code = `//@version=6
indicator("Inputs All 9 Types Test")

// 1. input.int
i1 = input.int(14, "Integer Length", minval = 1, maxval = 100, step = 1, tooltip = "Int tooltip", group = "Numeric", active = true)

// 2. input.float
f1 = input.float(1.5, "Float Factor", minval = 0.1, maxval = 10.0, step = 0.1, group = "Numeric", active = true)

// 3. input.bool
b1 = input.bool(true, "Enable Signal", tooltip = "Toggle", inline = "sig", active = true)

// 4. input.string
s1 = input.string("SMA", "Method", options = ["SMA", "EMA", "RMA"], group = "Settings", active = true)

// 5. input.color
c1 = input.color(#089981, "Bullish Color", group = "Colors", active = true)

// 6. input.timeframe
tf1 = input.timeframe("60", "Resolution", group = "Time", active = true)

// 7. input.symbol
sym1 = input.symbol("NASDAQ:AAPL", "Ticker", group = "Symbol", active = true)

// 8. input.session
sess1 = input.session("0930-1600", "Trading Session", group = "Time", active = true)

// 9. input.source
src1 = input.source(close, "Calculation Source", group = "Calculation", active = true)

plot(close)
`;
            const ind = Indicator.from(code);
            const inputs = ind.getInputsMeta();

            expect(inputs.length).toBe(9);

            const byVar = new Map(inputs.map(inp => [inp.varId, inp]));

            // 1. int
            const inpI1 = byVar.get('i1')!;
            expect(inpI1).toBeDefined();
            expect(inpI1.type).toBe('int');
            expect(inpI1.defval).toBe(14);
            expect(inpI1.title).toBe('Integer Length');
            expect(inpI1.minval).toBe(1);
            expect(inpI1.maxval).toBe(100);
            expect(inpI1.step).toBe(1);
            expect(inpI1.tooltip).toBe('Int tooltip');
            expect(inpI1.group).toBe('Numeric');
            expect(inpI1.active).toBe(true);

            // 2. float
            const inpF1 = byVar.get('f1')!;
            expect(inpF1).toBeDefined();
            expect(inpF1.type).toBe('float');
            expect(inpF1.defval).toBe(1.5);
            expect(inpF1.minval).toBe(0.1);
            expect(inpF1.maxval).toBe(10.0);
            expect(inpF1.step).toBe(0.1);
            expect(inpF1.active).toBe(true);

            // 3. bool
            const inpB1 = byVar.get('b1')!;
            expect(inpB1).toBeDefined();
            expect(inpB1.type).toBe('bool');
            expect(inpB1.defval).toBe(true);
            expect(inpB1.inline).toBe('sig');
            expect(inpB1.active).toBe(true);

            // 4. string
            const inpS1 = byVar.get('s1')!;
            expect(inpS1).toBeDefined();
            expect(inpS1.type).toBe('string');
            expect(inpS1.defval).toBe('SMA');
            expect(inpS1.options).toEqual(['SMA', 'EMA', 'RMA']);
            expect(inpS1.active).toBe(true);

            // 5. color
            const inpC1 = byVar.get('c1')!;
            expect(inpC1).toBeDefined();
            expect(inpC1.type).toBe('color');
            expect(inpC1.active).toBe(true);

            // 6. timeframe
            const inpTf = byVar.get('tf1')!;
            expect(inpTf).toBeDefined();
            expect(inpTf.type).toBe('timeframe');
            expect(inpTf.defval).toBe('60');
            expect(inpTf.active).toBe(true);

            // 7. symbol
            const inpSym = byVar.get('sym1')!;
            expect(inpSym).toBeDefined();
            expect(inpSym.type).toBe('symbol');
            expect(inpSym.defval).toBe('NASDAQ:AAPL');
            expect(inpSym.active).toBe(true);

            // 8. session
            const inpSess = byVar.get('sess1')!;
            expect(inpSess).toBeDefined();
            expect(inpSess.type).toBe('session');
            expect(inpSess.defval).toBe('0930-1600');
            expect(inpSess.active).toBe(true);

            // 9. source
            const inpSrc = byVar.get('src1')!;
            expect(inpSrc).toBeDefined();
            expect(inpSrc.type).toBe('source');
            expect(inpSrc.active).toBe(true);
        });
    });

    describe('UDTs, Methods, Tuples and Namespaces', () => {
        it('should compile and transpile UDT with fields and methods', () => {
            const code = `//@version=6
indicator("UDT Method Test")

type PivotPoint
    int barIndex
    float price
    bool isHigh = true

method updatePrice(PivotPoint this, float newPrice) =>
    this.price := newPrice

p = PivotPoint.new(bar_index, high, true)
p.updatePrice(high + 1.0)
plot(p.price)
`;
            const result = pineToJS(code);
            expect(result.success).toBe(true);
            const fn = transpile(code);
            expect(fn).toBeDefined();
        });
    });

    describe('Compiler Diagnostics: Exact Line and Column', () => {
        it('should report exact line and column on syntax error', () => {
            const code = `//@version=6
indicator("Error Test")
val = 1 +
plot(val)
`;
            const result = pineToJS(code);
            expect(result.success).toBe(false);
            expect(result.line).toBeDefined();
            expect(result.column).toBeDefined();
            expect(typeof result.line).toBe('number');
            expect(typeof result.column).toBe('number');
            expect(result.line).toBeGreaterThan(0);
            expect(result.errors).toBeDefined();
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].line).toBe(result.line);
            expect(result.errors[0].column).toBe(result.column);
        });
    });
});
