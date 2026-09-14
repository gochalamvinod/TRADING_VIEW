import re

with open('charting_library/bundles/library.e8d44337c84d65489d2c.js', 'r', encoding='utf-8', errors='ignore') as f:
    content = f.read()

idx = content.find('SuperTrend')
if idx != -1:
    print('=== SUPERTREND ===')
    print(content[idx:idx+2500])

idx2 = content.find('function d(e){return"shapes"===e.type}')
if idx2 != -1:
    print('=== SHAPES HANDLER ===')
    print(content[idx2:idx2+2000])
