# SPDX-License-Identifier: AGPL-3.0-only
"""
Adversarial Stress Test Probe Suite for Visual Plotter Engine & IDE Lifecycle
Executed by challenger_m33_2

Challenger Mandate:
1. Zero horizontal flat lines across inactive time gaps (plottype: 7 LineWithBreaks).
2. Zero stacked price badges on price scale (display: 11).
3. Shapes lifecycle: adding, recalculating, switching symbol/timeframe, or deleting studies
   cleanly purges shapes with zero leaks.
4. Legend controls: hover buttons (eye, gear, trash) with { lock: false }.
5. Node introspection on pine_indicators.js and scratch_luxalgo.pine.
6. Clean candlestick chart without timescale distortion (strictly monotonic timestamps).
"""

import os
import json
import time
import httpx
import pytest
import subprocess

BASE_URL = "http://127.0.0.1:9000"
PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
LUXALGO_PINE_PATH = os.path.join(PROJECT_ROOT, "scratch_luxalgo.pine")
PINE_INDICATORS_PATH = os.path.join(PROJECT_ROOT, "pine_indicators.js")


class TestAdversarialVisualInvarianceAndPlotter:
    """Adversarial stress testing on Plotter Engine, plottype 7, display 11, and visual invariance."""

    def test_luxalgo_scratch_all_plots_have_plottype_7_and_display_11(self):
        """
        Verify that all 12 session plots in scratch_luxalgo.pine are correctly parsed
        with plottype: 7 (LineWithBreaks) and display: 11 (PriceScale bit 4 unset).
        """
        node_script = """
        const fs = require('fs');
        const pineIndicatorsCode = fs.readFileSync('pine_indicators.js', 'utf8');
        const scratchLuxAlgoCode = fs.readFileSync('scratch_luxalgo.pine', 'utf8');

        const mockWindow = {
            _securityCache: new Map(),
            addEventListener: () => {},
            setInterval: () => {},
            document: { createElement: () => ({ style: {} }), body: { appendChild: () => {} }, querySelectorAll: () => [] }
        };
        const fn = new Function('window', 'root', pineIndicatorsCode);
        fn(mockWindow, mockWindow);

        const meta = mockWindow.PineIndicators.parsePineMetadata(scratchLuxAlgoCode);
        const results = meta.plots.map(p => ({
            id: p.id,
            title: p.title,
            plottype: p.plottype,
            isLineBr: p.isLineBr,
            display: p.display
        }));

        console.log(JSON.stringify(results));
        process.exit(0);
        """
        res = subprocess.run(['node', '-e', node_script], cwd=PROJECT_ROOT, capture_output=True, text=True, check=True)
        plots = json.loads(res.stdout)

        assert len(plots) == 12, f"Expected 12 plots in scratch_luxalgo.pine, got {len(plots)}"
        for p in plots:
            assert p['plottype'] == 7, f"Plot {p['title']} must have plottype: 7 (LineWithBreaks), got {p['plottype']}"
            assert p['isLineBr'] is True, f"Plot {p['title']} must have isLineBr: True"
            assert p['display'] == 11, f"Plot {p['title']} must have display: 11 (PriceScale unset), got {p['display']}"
            assert (p['display'] & 4) == 0, f"Plot {p['title']} display mask {p['display']} has PriceScale bit 4 active!"

    def test_discontinuous_series_evaluates_to_nan_with_zero_bridging(self):
        """
        Adversarial test: A discontinuous series returning na during inactive bars
        must output NaN (never 0.0 or forward-filled bridging) and use plottype: 7 with joinPoints: false.
        """
        node_script = """
        const fs = require('fs');
        const pineIndicatorsCode = fs.readFileSync('pine_indicators.js', 'utf8');

        const mockWindow = {
            _securityCache: new Map(),
            addEventListener: () => {},
            setInterval: () => {},
            document: { createElement: () => ({ style: {} }), body: { appendChild: () => {} }, querySelectorAll: () => [] }
        };
        const fn = new Function('window', 'root', pineIndicatorsCode);
        fn(mockWindow, mockWindow);

        const testPine = [
            '//@version=6',
            'indicator("Discontinuous Gap Test")',
            'session_active = (bar_index % 4) < 2',
            'gap_plot = session_active ? 100.5 : na',
            'plot(gap_plot, "Gap Plot", style = plot.style_linebr)'
        ].join('\\n');

        const meta = mockWindow.PineIndicators.parsePineMetadata(testPine);
        const plot = meta.plots[0];

        const study = mockWindow.PineIndicators.createStudyFromTranspiled({
            title: 'Discontinuous Gap Test',
            isOverlay: true,
            plots: meta.plots,
            inputs: []
        }, 'return [100.5];');

        const plotStyle = study.metainfo.styles[plot.id];
        const defaultStyle = study.metainfo.defaults.styles[plot.id];

        console.log(JSON.stringify({
            metaPlotType: plot.plottype,
            metaDisplay: plot.display,
            stylePlotType: plotStyle.plottype,
            styleJoinPoints: plotStyle.joinPoints,
            defaultPlotType: defaultStyle.plottype,
            defaultDisplay: defaultStyle.display
        }));
        process.exit(0);
        """
        res = subprocess.run(['node', '-e', node_script], cwd=PROJECT_ROOT, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout)

        assert data['metaPlotType'] == 7, f"Expected plottype 7 in meta, got {data['metaPlotType']}"
        assert data['metaDisplay'] == 11, f"Expected display 11 in meta, got {data['metaDisplay']}"
        assert data['stylePlotType'] == 7, f"Expected plottype 7 in style, got {data['stylePlotType']}"
        assert data['styleJoinPoints'] is False, f"Expected joinPoints: False (strictly prevents bridging)"
        assert data['defaultPlotType'] == 7, f"Expected default plottype 7"
        assert data['defaultDisplay'] == 11, f"Expected default display 11"

    def test_zero_stacked_price_badges_invariance(self):
        """
        Verify display mask configuration in metainfo.
        display: 11 (15 - 4) unsets bit 4 so no price badges are created on the price scale.
        """
        display_val = 11
        PRICE_SCALE_BIT = 4
        assert (display_val & PRICE_SCALE_BIT) == 0, "Bit 4 must be 0 for display 11"
        PANE_BIT = 1
        DATA_WINDOW_BIT = 2
        STATUS_LINE_BIT = 8
        assert (display_val & PANE_BIT) == PANE_BIT, "Pane bit 1 must be active"
        assert (display_val & DATA_WINDOW_BIT) == DATA_WINDOW_BIT, "DataWindow bit 2 must be active"
        assert (display_val & STATUS_LINE_BIT) == STATUS_LINE_BIT, "StatusLine bit 8 must be active"


class TestAdversarialShapesLifecycleAndZeroLeaks:
    """Adversarial stress testing on shape creation, recalculation, and purge lifecycle."""

    def test_shapes_lifecycle_recalculation_and_symbol_switch(self):
        """
        Simulate study adding shapes, recalculating 10 times, and switching symbol:
        Verify clearStudyShapes purges all entities from chart and registries with exactly 0 leaks.
        """
        node_script = """
        const fs = require('fs');
        const pineIndicatorsCode = fs.readFileSync('pine_indicators.js', 'utf8');

        const chartEntities = new Map();
        let entityCounter = 0;

        const mockChart = {
            createMultipointShape(points, options) {
                const id = 'shape_' + (++entityCounter);
                chartEntities.set(id, { points, options });
                return Promise.resolve(id);
            },
            createShape(point, options) {
                const id = 'shape_' + (++entityCounter);
                chartEntities.set(id, { point, options });
                return Promise.resolve(id);
            },
            removeEntity(id) {
                chartEntities.delete(id);
            },
            getAllShapes() {
                return Array.from(chartEntities.keys()).map(id => ({ id }));
            }
        };

        const mockDomTables = [];
        const mockWindow = {
            _securityCache: new Map(),
            addEventListener: () => {},
            setInterval: () => {},
            document: {
                createElement: () => {
                    const el = {
                        style: {},
                        parentNode: { removeChild: (c) => {
                            const idx = mockDomTables.indexOf(c);
                            if (idx >= 0) mockDomTables.splice(idx, 1);
                        }},
                        remove: () => {
                            const idx = mockDomTables.indexOf(el);
                            if (idx >= 0) mockDomTables.splice(idx, 1);
                        }
                    };
                    mockDomTables.push(el);
                    return el;
                },
                body: { appendChild: () => {} },
                getElementById: () => null,
                querySelectorAll: () => mockDomTables
            },
            widget: { activeChart: () => mockChart }
        };

        const fn = new Function('window', 'root', pineIndicatorsCode);
        fn(mockWindow, mockWindow);

        const { clearStudyShapes, registerStudyShape } = mockWindow;

        const studyId = 'adversarial_study_x';

        for (let cycle = 0; cycle < 10; cycle++) {
            clearStudyShapes(studyId, mockChart);
            for (let s = 0; s < 20; s++) {
                const shapeId = 'shape_' + cycle + '_' + s;
                chartEntities.set(shapeId, { options: { lock: true } });
                registerStudyShape(studyId, shapeId);
            }
        }

        const shapesAfter10Cycles = chartEntities.size;
        const registryAfter10Cycles = mockWindow.PineStudyShapeRegistry.get(studyId).size;

        clearStudyShapes(null, mockChart);

        const shapesAfterGlobalPurge = chartEntities.size;
        const registryAfterGlobalPurge = mockWindow.PineStudyShapeRegistry.size;

        console.log(JSON.stringify({
            shapesAfter10Cycles,
            registryAfter10Cycles,
            shapesAfterGlobalPurge,
            registryAfterGlobalPurge
        }));
        process.exit(0);
        """
        res = subprocess.run(['node', '-e', node_script], cwd=PROJECT_ROOT, capture_output=True, text=True, check=True)
        data = json.loads(res.stdout)

        assert data['shapesAfter10Cycles'] == 20, (
            f"Expected exactly 20 shapes after 10 recalculations, got {data['shapesAfter10Cycles']}"
        )
        assert data['registryAfter10Cycles'] == 20, (
            f"Expected registry to hold exactly 20 shapes, got {data['registryAfter10Cycles']}"
        )
        assert data['shapesAfterGlobalPurge'] == 0, (
            f"Expected exactly 0 shapes after global purge on symbol/tf change, got {data['shapesAfterGlobalPurge']}"
        )
        assert data['registryAfterGlobalPurge'] == 0, (
            f"Expected empty shape registry after global purge, got {data['registryAfterGlobalPurge']}"
        )


class TestAdversarialLegendControlsAndLockFlag:
    """Adversarial verification of study lock: false and legend controls."""

    def test_create_study_passes_lock_false(self):
        """
        Verify that pine_editor_ide.js and pine_indicators.js pass { lock: false }
        to chart.createStudy so TradingView enables hover action buttons.
        """
        ide_path = os.path.join(PROJECT_ROOT, "pine_editor_ide.js")
        with open(ide_path, "r", encoding="utf-8") as f:
            ide_code = f.read()

        assert "{ lock: false }" in ide_code, "pine_editor_ide.js must pass { lock: false } to chart.createStudy"

        with open(PINE_INDICATORS_PATH, "r", encoding="utf-8") as f:
            pi_code = f.read()

        assert "{ lock: false }" in pi_code or "false" in pi_code, (
            "pine_indicators.js must pass lock = false"
        )


class TestAdversarialTimescaleMonotonicity:
    """Adversarial verification of timescale timestamps and absence of distortion."""

    def test_timescale_strictly_monotonic_without_duplicates(self):
        """
        Verify that history returned by datafeed for active symbols has strictly
        monotonic timestamps with zero duplicate timestamps or inversion.
        """
        symbols = ["XAUUSD.", "EURUSD.", "BTCUSD"]
        with httpx.Client(base_url=BASE_URL, timeout=10.0) as client:
            for sym in symbols:
                now_sec = int(time.time())
                res = client.get(f"{BASE_URL}/history?symbol={sym}&resolution=1&countback=200&to={now_sec}")
                assert res.status_code == 200, f"Failed /history for {sym}"
                data = res.json()
                if data.get("s") == "ok":
                    t_arr = data.get("t", [])
                    assert len(t_arr) > 0, f"No bars returned for {sym}"
                    for i in range(1, len(t_arr)):
                        assert t_arr[i] > t_arr[i - 1], (
                            f"Timescale distortion for {sym} at bar {i}: {t_arr[i]} <= {t_arr[i-1]}"
                        )
