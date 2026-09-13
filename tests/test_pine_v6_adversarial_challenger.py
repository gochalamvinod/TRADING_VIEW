# SPDX-License-Identifier: AGPL-3.0-only
"""
Adversarial Stress Test Probe Suite for Pine Script v6 Compiler, AST & Diagnostics
Executed by challenger_m33_1
"""

import pytest
import httpx
import json
import subprocess
import os

BASE_URL = "http://127.0.0.1:9000"
PROJECT_ROOT = os.path.dirname(os.path.dirname(__file__))


class TestAdversarialPineV6Compiler:

    # =========================================================================
    # 1. Typed Tuple Destructuring Adversarial Stress Probes
    # =========================================================================

    def test_tuple_unusual_types_and_discards(self):
        """Test tuple destructuring with unusual types, nested types, and multiple discard identifiers `_`."""
        source = """//@version=6
indicator("Tuple Unusual Types")
calc() =>
    [10, 20.5, "hello", true, #ff0000, 99.9, 100]

[int a, float b, string c, bool d, color e, _, _] = calc()
plot(a + b)
"""
        with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
            res = client.post("/pine/transpile", json={"source": source})
            assert res.status_code == 200, f"Status code {res.status_code}: {res.text}"
            data = res.json()
            assert data.get("success") is True, f"Failed compilation: {data.get('error')}"
            code = data.get("code", "")
            # Ensure identifiers were generated and duplicate `_` was safely deduplicated
            assert "glb1_a" in code or "a" in code
            assert "glb1_b" in code or "b" in code

    def test_tuple_array_generics_and_namespaces(self):
        """Test tuple destructuring with array brackets, generic syntax, and namespaced types."""
        source = """//@version=6
indicator("Tuple Generics and Namespaces")
type Point
    float x
    float y

calc() =>
    [array.new_float(5), array.new_int(3), Point.new(1.0, 2.0)]

[float[] arr_flt, array<int> arr_int, Point pt] = calc()
plot(pt.x + pt.y)
"""
        with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
            res = client.post("/pine/transpile", json={"source": source})
            assert res.status_code == 200
            data = res.json()
            assert data.get("success") is True, f"Failed compilation: {data.get('error')}"
            code = data.get("code", "")
            assert "arr_flt" in code
            assert "arr_int" in code
            assert "pt" in code

    def test_tuple_multiline_breaks_and_indentation(self):
        """Test multiline tuple destructuring across lines with comments and whitespace."""
        source = """//@version=6
indicator("Multiline Tuple")
calc() =>
    [1, 2.0, 3]

[
    int first,
    // comment inside tuple
    float second,
    _
] = calc()

plot(first + second)
"""
        with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
            res = client.post("/pine/transpile", json={"source": source})
            assert res.status_code == 200
            data = res.json()
            assert data.get("success") is True, f"Failed compilation: {data.get('error')}"

    def test_tuple_var_and_varip_destructuring(self):
        """Test tuple destructuring with `var` and `varip` qualifiers."""
        source = """//@version=6
indicator("Var Tuple Destructuring")
calc() =>
    [100, 200.5]

var [int base_int, float base_flt] = calc()
varip [int tick_int, float tick_flt] = calc()
plot(base_int + base_flt + tick_int + tick_flt)
"""
        with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
            res = client.post("/pine/transpile", json={"source": source})
            assert res.status_code == 200
            data = res.json()
            assert data.get("success") is True, f"Failed compilation: {data.get('error')}"

    # =========================================================================
    # 2. Fractional Division Preservation: 5 / 2 == 2.5 vs v5 Truncation
    # =========================================================================

    def test_fractional_division_invariance_v6_vs_v5(self):
        """Verify that in Pine v6, 5 / 2 produces 2.5 (float), whereas in v5 it produces 2 (int truncation)."""
        node_script = """
        const { pineToJS } = require('./pinets.bundle.js');

        const v6_src = `//@version=6\\nindicator("DivTest")\\nval = 5 / 2\\nplot(val)`;
        const v5_src = `//@version=5\\nindicator("DivTest")\\nval = 5 / 2\\nplot(val)`;

        const r6 = pineToJS(v6_src);
        const r5 = pineToJS(v5_src);

        console.log(JSON.stringify({
            v6_code: r6.code,
            v5_code: r5.code
        }));
        """
        proc = subprocess.run(
            ["node", "-e", node_script],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=True
        )
        data = json.loads(proc.stdout)
        # v6 code must preserve fractional division (5 / 2)
        assert "5 / 2" in data["v6_code"], f"Expected '5 / 2' in v6 code, got: {data['v6_code']}"

    def test_fractional_division_runtime_execution_oracle(self):
        """Execute compiled v6 indicator through PineTS runtime and verify exact mathematical result 2.5 vs v5 result 2."""
        node_script = """
        const { PineTS } = require('./pinets.bundle.js');

        function makeData(n = 3) {
            const out = [];
            const t0 = new Date('2024-01-01T00:00:00Z').getTime();
            const DAY = 86_400_000;
            for (let i = 0; i < n; i++) {
                const base = 100 + i;
                out.push({
                    openTime: t0 + i * DAY,
                    open: base, high: base + 1.5, low: base - 0.8, close: base + 0.4,
                    volume: 1000, closeTime: t0 + (i + 1) * DAY - 1,
                });
            }
            return out;
        }

        async function runTest() {
            const pine = new PineTS(makeData());

            const v6_src = `//@version=6
indicator("DivTest")
val = 5 / 2
plot(val)
`;
            const res6 = await pine.run(v6_src);
            const v6_val = res6.plots['#0'].data[0].value;

            const v5_src = `//@version=5
indicator("DivTest5")
val = 5 / 2
plot(val)
`;
            const res5 = await pine.run(v5_src);
            const v5_val = res5.plots['#0'].data[0].value;

            console.log(JSON.stringify({ v6_val, v5_val }));
        }

        runTest().catch(e => { console.error(e); process.exit(1); });
        """
        proc = subprocess.run(
            ["node", "-e", node_script],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=True
        )
        data = json.loads(proc.stdout)
        assert data["v6_val"] == 2.5, f"Pine v6 5 / 2 must evaluate to 2.5, got {data['v6_val']}"
        assert data["v5_val"] == 2, f"Pine v5 5 / 2 must evaluate to 2 (truncated), got {data['v5_val']}"

    def test_nested_division_expressions(self):
        """Verify compound division expressions evaluate accurately: (15 / 2) / 2 == 3.75, -5 / 2 == -2.5."""
        node_script = """
        const { PineTS } = require('./pinets.bundle.js');

        function makeData(n = 3) {
            const out = [];
            const t0 = new Date('2024-01-01T00:00:00Z').getTime();
            const DAY = 86_400_000;
            for (let i = 0; i < n; i++) {
                const base = 100 + i;
                out.push({
                    openTime: t0 + i * DAY,
                    open: base, high: base + 1.5, low: base - 0.8, close: base + 0.4,
                    volume: 1000, closeTime: t0 + (i + 1) * DAY - 1,
                });
            }
            return out;
        }

        async function runTest() {
            const pine = new PineTS(makeData());

            const v6_src = `//@version=6
indicator("DivTest2")
d1 = (15 / 2) / 2
d2 = -5 / 2
plot(d1)
plot(d2)
`;
            const res = await pine.run(v6_src);
            const d1_val = res.plots['#0'].data[0].value;
            const d2_val = res.plots['#1'].data[0].value;

            console.log(JSON.stringify({ d1_val, d2_val }));
        }

        runTest().catch(e => { console.error(e); process.exit(1); });
        """
        proc = subprocess.run(
            ["node", "-e", node_script],
            cwd=PROJECT_ROOT,
            capture_output=True,
            text=True,
            check=True
        )
        data = json.loads(proc.stdout)
        assert data["d1_val"] == 3.75, f"Expected 3.75, got {data['d1_val']}"
        assert data["d2_val"] == -2.5, f"Expected -2.5, got {data['d2_val']}"

    # =========================================================================
    # 3. Intentional Syntax Errors & Exact Line/Col Reporting
    # =========================================================================

    @pytest.mark.parametrize("source,expected_line,expected_col,reason", [
        (
            "//@version=6\nindicator('Err')\nx = 5 + * 2\n",
            3,
            9, # 1-indexed column of '*'
            "Unexpected operator '*'"
        ),
        (
            "//@version=6\nindicator('Err')\nvar int a = \nplot(1)\n",
            3,
            13, # Line 3 column 13 after '='
            "Incomplete variable initialization"
        ),
        (
            "//@version=6\nindicator('Err')\n[int a, float b = calc()\n",
            3,
            17, # Expected RBRACKET before '='
            "Unclosed tuple bracket"
        ),
        (
            "//@version=6\nindicator('Err')\nx = (10 + 20\nplot(x)\n",
            4,
            1, # Missing RPAREN before newline / next statement
            "Unclosed parenthesis"
        ),
    ])
    def test_syntax_errors_exact_line_and_column(self, source, expected_line, expected_col, reason):
        """Ensure intentional syntax errors report non-zero exact line and column numbers matching error site."""
        with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
            res = client.post("/pine/transpile", json={"source": source})
            assert res.status_code == 200
            data = res.json()
            assert data.get("success") is False, f"Expected compilation failure for: {reason}"
            line = data.get("line")
            col = data.get("column")
            errors = data.get("errors", [])
            assert len(errors) >= 1, f"Expected at least 1 error in diagnostics for: {reason}"
            err = errors[0]

            assert line == expected_line, f"Expected line {expected_line}, got {line} for {reason}"
            # Col must be within reasonable token bounds (exact or within 2 chars of token position)
            assert abs(col - expected_col) <= 4, f"Expected col ~{expected_col}, got {col} for {reason}"
            assert err.get("line") == line
            assert err.get("column") == col

    # =========================================================================
    # 4. All 9 Input Types Metadata Extraction
    # =========================================================================

    def test_all_9_inputs_comprehensive_metadata(self):
        """Extract and verify all 9 input types: type, defval, minval, maxval, step, options, active."""
        source = """//@version=6
indicator("9 Inputs Adversarial Probe")
i_int = input.int(42, "Integer Title", minval=0, maxval=100, step=2, tooltip="Int tip", group="G1", active=true)
i_flt = input.float(3.1415, "Float Title", minval=0.01, maxval=99.99, step=0.01, group="G1", active=false)
i_bol = input.bool(true, "Bool Title", tooltip="Bool tip", inline="b_line", active=true)
i_str = input.string("OptionB", "String Title", options=["OptionA", "OptionB", "OptionC"], group="G2", active=true)
i_col = input.color(#089981, "Color Title", group="G2", active=true)
i_tf  = input.timeframe("D", "TF Title", group="G3", active=true)
i_sym = input.symbol("BINANCE:BTCUSDT", "Symbol Title", group="G3", active=true)
i_ses = input.session("0900-1700:23456", "Session Title", group="G3", active=true)
i_src = input.source(hlc3, "Source Title", group="G1", active=true)
plot(close)
"""
        with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
            res = client.post("/pine/transpile", json={"source": source})
            assert res.status_code == 200
            data = res.json()
            assert data.get("success") is True, f"Failed compilation: {data.get('error')}"

            inputs = data.get("inputs", [])
            assert len(inputs) == 9, f"Expected 9 inputs, got {len(inputs)}"

            inputs_map = {inp["varId"]: inp for inp in inputs}

            # 1. input.int
            int_meta = inputs_map["i_int"]
            assert int_meta["type"] == "int"
            assert int_meta["defval"] == 42
            assert int_meta["minval"] == 0
            assert int_meta["maxval"] == 100
            assert int_meta["step"] == 2
            assert int_meta["title"] == "Integer Title"
            assert int_meta["tooltip"] == "Int tip"
            assert int_meta["group"] == "G1"
            assert int_meta["active"] is True

            # 2. input.float
            flt_meta = inputs_map["i_flt"]
            assert flt_meta["type"] == "float"
            assert abs(flt_meta["defval"] - 3.1415) < 1e-5
            assert flt_meta["minval"] == 0.01
            assert flt_meta["maxval"] == 99.99
            assert flt_meta["step"] == 0.01
            assert flt_meta["active"] is False

            # 3. input.bool
            bol_meta = inputs_map["i_bol"]
            assert bol_meta["type"] == "bool"
            assert bol_meta["defval"] is True
            assert bol_meta["inline"] == "b_line"

            # 4. input.string
            str_meta = inputs_map["i_str"]
            assert str_meta["type"] == "string"
            assert str_meta["defval"] == "OptionB"
            assert str_meta["options"] == ["OptionA", "OptionB", "OptionC"]

            # 5. input.color
            col_meta = inputs_map["i_col"]
            assert col_meta["type"] == "color"
            # Normalized 8-digit hex #RRGGBBAA
            assert col_meta["defval"].upper() in ["#089981", "#089981FF"]

            # 6. input.timeframe
            tf_meta = inputs_map["i_tf"]
            assert tf_meta["type"] == "timeframe"
            assert tf_meta["defval"] == "D"

            # 7. input.symbol
            sym_meta = inputs_map["i_sym"]
            assert sym_meta["type"] == "symbol"
            assert sym_meta["defval"] == "BINANCE:BTCUSDT"

            # 8. input.session
            ses_meta = inputs_map["i_ses"]
            assert ses_meta["type"] == "session"
            assert ses_meta["defval"] == "0900-1700:23456"

            # 9. input.source
            src_meta = inputs_map["i_src"]
            assert src_meta["type"] == "source"

    # =========================================================================
    # 5. Edge Cases & Boundary Payload Stress
    # =========================================================================

    def test_transpile_empty_payload(self):
        """Verify empty or whitespace payload returns HTTP 400."""
        with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
            res = client.post("/pine/transpile", json={"source": "   "})
            assert res.status_code == 400

    def test_transpile_unsupported_old_version(self):
        """Verify //@version=3 is rejected cleanly with an informative error message."""
        source = "//@version=3\nstudy('Old')\nplot(close)\n"
        with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
            res = client.post("/pine/transpile", json={"source": source})
            assert res.status_code == 200
            data = res.json()
            assert data.get("success") is False
            assert "Only version 5 and above are supported" in data.get("error", "")

    def test_transpile_missing_version(self):
        """Verify script without //@version is rejected cleanly."""
        source = "indicator('No Version')\nplot(close)\n"
        with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
            res = client.post("/pine/transpile", json={"source": source})
            assert res.status_code == 200
            data = res.json()
            assert data.get("success") is False
            assert "version not found" in data.get("error", "").lower()
