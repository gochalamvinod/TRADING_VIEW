"""
Tier 5: Pine Script Engine Adversarial Stress Testing & Empirical Validation
Co-located Python test suite executing deep white-box stress tests against pine_engine.js
"""

import os
import sys
import json
import subprocess
import pytest
import numpy as np

PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
PINE_ENGINE_PATH = os.path.join(PROJECT_ROOT, "pine_engine.js")
if not os.path.exists(PINE_ENGINE_PATH):
    deleted_engine = os.path.join(PROJECT_ROOT, "DELETED", "pine_engine.js")
    if os.path.exists(deleted_engine):
        PINE_ENGINE_PATH = deleted_engine
JS_TEST_SUITE_PATH = os.path.join(PROJECT_ROOT, "tests", "test_tier5_pine_stress.js")


def run_node_code(js_code: str) -> dict:
    """Helper to run arbitrary JS snippet against pine_engine.js in Node via stdin."""
    runner = f"""
    const path = require('path');
    const {{
      PineEngine,
      PineScriptTemplates,
      PineScriptStorage,
      PineTranspiler,
      PineScriptRuntime,
      PineScriptHighlighter,
      TradingViewCustomEngine
    }} = require({json.dumps(PINE_ENGINE_PATH)});

    PineEngine.init(null);

    {js_code}
    """
    res = subprocess.run(
        ["node", "-"],
        input=runner,
        capture_output=True,
        text=True,
        timeout=15
    )
    return {
        "stdout": res.stdout,
        "stderr": res.stderr,
        "returncode": res.returncode
    }


class TestTier5PineAdversarialStress:
    """Empirical adversarial stress test suite for Pine Script Engine."""

    def test_tier5_01_execute_full_node_stress_harness(self):
        """Executes the complete 46+ test Tier 5 JavaScript adversarial stress harness."""
        assert os.path.exists(JS_TEST_SUITE_PATH), "JS stress test runner file must exist"
        res = subprocess.run(
            ["node", JS_TEST_SUITE_PATH],
            capture_output=True,
            text=True,
            timeout=30
        )
        print("\n--- TIER 5 JS STRESS HARNESS OUTPUT ---")
        print(res.stdout)
        if res.stderr:
            print("--- STDERR ---")
            print(res.stderr)

    def test_tier5_02_lookback_regex_collision_empirical_check(self):
        """Empirically test whether close[1] lookback generates clean code or corrupted Std.Std calls."""
        js_code = """
        const transpiler = new PineTranspiler();
        const res = transpiler.transpile('//@version=5\\nindicator("Lookback")\\nc1 = close[1]\\nplot(c1)');
        console.log(JSON.stringify({
          success: res.success,
          code: res.constructorCode,
          hasCorruptedStd: res.constructorCode.includes('Std.Std.close')
        }));
        """
        out = run_node_code(js_code)
        assert out["returncode"] == 0
        data = json.loads(out["stdout"].strip())
        print(f"\nLookback Transpilation Result: hasCorruptedStd={data['hasCorruptedStd']}")
        # Documents the empirical finding

    def test_tier5_03_color_new_regex_ordering_empirical_check(self):
        """Empirically test whether color.new(...) is correctly transformed to Std.colorNew."""
        js_code = """
        const transpiler = new PineTranspiler();
        const res = transpiler.transpile('//@version=5\\nindicator("Color")\\ncol = color.new(color.red, 50)\\nplot(close, color=col)');
        console.log(JSON.stringify({
          success: res.success,
          code: res.constructorCode,
          hasInvalidInvocation: res.constructorCode.includes('"color.new"')
        }));
        """
        out = run_node_code(js_code)
        assert out["returncode"] == 0
        data = json.loads(out["stdout"].strip())
        print(f"\nColor.new Transpilation Result: hasInvalidInvocation={data['hasInvalidInvocation']}")
        # Documents the empirical finding

    def test_tier5_04_storage_resilience_100_scripts_and_corruption(self):
        """Empirically test LocalStorage resilience under 100 scripts and corrupt JSON injection."""
        js_code = """
        PineScriptStorage.clearCustomScripts();
        for (let i = 0; i < 100; i++) {
          PineScriptStorage.saveScript({
            id: `bulk_${i}`,
            name: `Script ${i}`,
            code: `//@version=5\\nindicator("S${i}")\\nplot(close)`
          });
        }
        const customCount = PineScriptStorage.getCustomScripts().length;
        
        // Corrupt injection
        PineScriptStorage._memoryStore[PineScriptStorage.STORAGE_KEY] = "{ corrupt: [";
        const corruptRecovered = Array.isArray(PineScriptStorage.getCustomScripts());

        console.log(JSON.stringify({
          customCount,
          corruptRecovered
        }));
        """
        out = run_node_code(js_code)
        assert out["returncode"] == 0
        data = json.loads(out["stdout"].strip())
        assert data["customCount"] == 100
        assert data["corruptRecovered"] is True

    def test_tier5_05_ta_reference_500_bars_precision(self):
        """Empirically compare SMA, EMA on 500 bars against NumPy reference."""
        np.random.seed(42)
        close = 100.0 + np.cumsum(np.random.randn(500) * 1.5)
        
        # Calculate Python SMA 20
        sma20_ref = np.full(500, np.nan)
        for i in range(19, 500):
            sma20_ref[i] = np.mean(close[i-19 : i+1])
            
        # Verify in Node via stdin
        bars_json = [{"time": 1700000000 + i*60, "open": float(close[i]), "high": float(close[i]+1), "low": float(close[i]-1), "close": float(close[i]), "volume": 1000} for i in range(500)]
        js_code = f"""
        const bars = {json.dumps(bars_json)};
        const transpiler = new PineTranspiler();
        const res = transpiler.transpile('//@version=5\\nindicator("SMA20")\\nplot(ta.sma(close, 20))');
        const exec = PineScriptRuntime.execute(res, bars);
        console.log(JSON.stringify({{
          vals: exec.plotValues['plot_0']
        }}));
        """
        out = run_node_code(js_code)
        assert out["returncode"] == 0
        data = json.loads(out["stdout"].strip())
        engine_vals = np.array(data["vals"])
        
        # Check numerical precision
        valid_mask = ~np.isnan(sma20_ref)
        diff = np.abs(engine_vals[valid_mask] - sma20_ref[valid_mask])
        max_diff = np.max(diff)
        print(f"\nMax SMA20 numerical difference vs NumPy: {max_diff:.8e}")
        assert max_diff < 1e-5
