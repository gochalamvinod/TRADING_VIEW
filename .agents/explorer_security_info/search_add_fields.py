import glob

bundles = glob.glob('charting_library/bundles/*.js')
for b in bundles:
    with open(b, encoding='utf-8') as f:
        c = f.read()
    if 'additional_symbol_info_fields' in c or 'getAdditionalSymbolInfoFields' in c:
        print(f"Found in {b}")
        idx = 0
        while True:
            idx = c.find('getAdditionalSymbolInfoFields', idx)
            if idx == -1:
                break
            print(c[max(0, idx-100):min(len(c), idx+300)])
            idx += 20
