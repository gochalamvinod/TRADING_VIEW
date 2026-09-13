import glob
import re

bundles = glob.glob('charting_library/bundles/*.js')
for b in bundles:
    with open(b, encoding='utf-8') as f:
        c = f.read()
    if 'symbolOriginalCurrency' in c:
        print(f"Found in {b}")
        for m in re.finditer(r'function\s+([a-zA-Z0-9_$]+)?\s*\(?[^)]*\)?\s*\{[^}]*currency_code', c):
            pass
        idx = 0
        while True:
            idx = c.find('symbolOriginalCurrency', idx)
            if idx == -1:
                break
            print(f"--- Occurrence at {idx} in {b} ---")
            print(c[max(0, idx-100):min(len(c), idx+300)])
            idx += len('symbolOriginalCurrency')
