import pytest
import httpx
import os
import json

BASE_URL = "http://127.0.0.1:9000"


def test_pine_catalog_endpoint():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        res = client.get("/pine/catalog")
        assert res.status_code == 200
        catalog = res.json()
        assert isinstance(catalog, list)
        assert len(catalog) >= 20
        first = catalog[0]
        assert "name" in first
        assert "pineName" in first


def test_pine_transpile_indicator():
    source = """//@version=5
indicator("Pytest SMA Indicator", overlay=true)
length = input.int(14, "Length")
val = ta.sma(close, length)
plot(val, "SMA Plot", color=color.blue)
"""
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        res = client.post("/pine/transpile", json={"source": source})
        assert res.status_code == 200
        data = res.json()
        assert data.get("success") is True
        code = data.get("code", "")
        assert len(code) > 50
        meta = data.get("meta", [])
        assert len(meta) >= 1
        assert meta[0]["varId"] == "length"


def test_pine_transpile_strategy():
    source = """//@version=5
strategy("Pytest Strategy", overlay=true)
fast = ta.sma(close, 9)
slow = ta.sma(close, 21)
if ta.crossover(fast, slow)
    strategy.entry("Long", strategy.long)
if ta.crossunder(fast, slow)
    strategy.close("Long")
"""
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        res = client.post("/pine/transpile", json={"source": source})
        assert res.status_code == 200
        data = res.json()
        assert data.get("success") is True
        assert len(data.get("code", "")) > 50


def test_pine_source_and_js_endpoints():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        # Source
        r_src = client.get("/pine/source/Folded_RSI.pine")
        assert r_src.status_code == 200
        assert "//@version=5" in r_src.text


def test_pine_static_assets():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        for asset in [
            "/pinets.bundle.js",
            "/pine_indicators.js",
            "/pine_editor_ide.js",
            "/pine_editor.css"
        ]:
            res = client.get(asset)
            assert res.status_code == 200, f"Asset {asset} failed with {res.status_code}"
            assert len(res.content) > 100


def test_index_contains_pine_integration():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        res = client.get("/")
        assert res.status_code == 200
        html = res.text
        assert "pinets.bundle.js" in html
        assert "pine_indicators.js" in html
        assert "pine_editor_ide.js" in html
        assert "pine_editor.css" in html
        assert "custom_indicators_getter" in html
        assert "app_root" in html


def test_pine_indicators_catalog_and_pinets_metadata():
    with httpx.Client(base_url=BASE_URL, timeout=15.0) as client:
        # Verify /pine/indicators/catalog returns 200
        r_cat = client.get("/pine/indicators/catalog")
        assert r_cat.status_code == 200
        catalog = r_cat.json()
        assert isinstance(catalog, list)
        assert len(catalog) >= 20

        # Verify PineTS Indicator introspection in /pine/transpile
        source = """//@version=5
indicator("Pytest PineTS Indicator", overlay=true)
length = input.int(14, "Length")
source_val = input.source(close, "Source")
plot(ta.sma(source_val, length))
"""
        r_trans = client.post("/pine/transpile", json={"source": source})
        assert r_trans.status_code == 200
        data = r_trans.json()
        assert data.get("success") is True
        assert data.get("declarationType") == "indicator"
        assert data.get("usesVisibleRange") is False
        assert isinstance(data.get("inputs"), list)
        assert len(data.get("inputs")) == 2
        assert data.get("inputs")[0]["varId"] == "length"
        assert isinstance(data.get("props"), list)
        assert len(data.get("props")) > 0
        assert len(data.get("code", "")) > 50


def test_index_contains_pinets_browser_and_legend_styles():
    with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
        res = client.get("/")
        assert res.status_code == 200
        html = res.text
        assert "PineTS-main/dist/pinets.min.browser.js" in html
        assert "window.PineTS.Indicator = window.PineTSLib.Indicator" in html
        assert "legend-interval-show-hide-action" in html
        assert "intervalEye" in html
        assert "white-space: nowrap !important" in html

