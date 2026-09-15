import pytest
import httpx

BASE_URL = "http://127.0.0.1:9000"

def test_transpile_v6_typed_tuples_and_inputs():
    source = """//@version=6
indicator("v6 Full Test", overlay=true)
i_int = input.int(10, "Integer Parameter", minval=1, maxval=100, step=1)
i_flt = input.float(2.5, "Float Parameter", minval=0.1, maxval=10.0, step=0.1)
i_bool = input.bool(true, "Boolean Parameter")
i_str = input.string("default_val", "String Parameter")
i_col = input.color(color.blue, "Color Parameter")
i_tf = input.timeframe("15", "Timeframe Parameter")
i_sym = input.symbol("AAPL", "Symbol Parameter")
i_ses = input.session("1300-2200", "Session Parameter")
i_src = input.source(close, "Source Parameter")
calc() =>
    [10, 20.5]
[int a, float b] = calc()
x = 5 / 2
plot(x + a + b)
"""
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        res = client.post("/pine/transpile", json={"source": source})
        assert res.status_code == 200
        data = res.json()
        assert data.get("success") is True, f"Failed: {data.get('error')}"
        assert data.get("declarationType") == "indicator"
        assert len(data.get("inputs", [])) == 9
        code = data.get("code", "")
        assert "glb1_a" in code and "glb1_b" in code
        assert "5 / 2" in code

def test_transpile_v6_library_directive():
    source = """//@version=6
library("MyTestLib", overlay=false)
export add(int x, int y) => x + y
"""
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        res = client.post("/pine/transpile", json={"source": source})
        assert res.status_code == 200
        data = res.json()
        assert data.get("success") is True, f"Failed: {data.get('error')}"
        assert data.get("declarationType") == "library"

def test_transpile_v6_exact_diagnostics():
    source = """//@version=6
indicator("Syntax Error Test")
var int val = 100
invalid_expr = 5 + * 2
plot(val)
"""
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        res = client.post("/pine/transpile", json={"source": source})
        assert res.status_code == 200
        data = res.json()
        assert data.get("success") is False
        assert data.get("line") == 4
        assert data.get("column") == 21
        assert len(data.get("errors", [])) >= 1
        err = data.get("errors")[0]
        assert err.get("line") == 4
        assert err.get("column") == 21
