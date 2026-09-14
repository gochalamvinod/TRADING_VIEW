import time
from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={'width': 1280, 'height': 720})
    page.goto('http://127.0.0.1:9000')
    page.wait_for_selector('#tv_chart_container iframe')
    page.wait_for_timeout(4000)

    # Add a study and shapes
    test_info = page.evaluate('''async () => {
        const chart = window.widget.activeChart();
        // 1. Create a rectangle shape
        const shapeId = await chart.createMultipointShape([
            { time: Math.floor(Date.now() / 1000) - 3600, price: 4410 },
            { time: Math.floor(Date.now() / 1000), price: 4420 }
        ], {
            shape: 'rectangle',
            overrides: {
                color: '#ff5d00',
                backgroundColor: '#ff5d00',
                fillBackground: true
            }
        });
        
        const shapeApi = chart.getShapeById(shapeId);
        const shapeProto = Object.getOwnPropertyNames(Object.getPrototypeOf(shapeApi));
        const canSetVisible = typeof shapeApi.setVisible === 'function';
        
        return {
            shapeId,
            canSetVisible,
            shapeProto: shapeProto.filter(m => /visib|hide|show|remove/i.test(m))
        };
    }''')
    print('Shape test:', test_info)

    # Test toggling setVisible(false) on shape
    hide_shape_res = page.evaluate('''() => {
        const chart = window.widget.activeChart();
        const shapes = chart.getAllShapes();
        if (shapes.length > 0) {
            const sApi = chart.getShapeById(shapes[0].id);
            sApi.setVisible(false);
            return {
                shapeCount: shapes.length,
                isHidden: sApi.isHidden ? sApi.isHidden() : 'no isHidden'
            };
        }
        return null;
    }''')
    print('Hide shape res:', hide_shape_res)

    page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/shape_hidden_test.png')

    # Test toggling setVisible(true) on shape
    show_shape_res = page.evaluate('''() => {
        const chart = window.widget.activeChart();
        const shapes = chart.getAllShapes();
        if (shapes.length > 0) {
            const sApi = chart.getShapeById(shapes[0].id);
            sApi.setVisible(true);
            return {
                shapeCount: shapes.length,
                isHidden: sApi.isHidden ? sApi.isHidden() : 'no isHidden'
            };
        }
        return null;
    }''')
    print('Show shape res:', show_shape_res)

    page.screenshot(path='C:/Users/gocha/.gemini/antigravity/brain/33ae35fd-c4b4-474e-a08a-28c2840b311f/scratch/shape_shown_test.png')

    browser.close()
