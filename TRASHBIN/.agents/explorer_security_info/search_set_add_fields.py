with open('charting_library/bundles/library.e8d44337c84d65489d2c.js', encoding='utf-8') as f:
    c = f.read()

idx = 0
while True:
    idx = c.find('setAdditionalSymbolInfoFields', idx)
    if idx == -1:
        break
    print(f"--- setAdditionalSymbolInfoFields at {idx} ---")
    print(c[max(0, idx-100):min(len(c), idx+300)])
    idx += 20
