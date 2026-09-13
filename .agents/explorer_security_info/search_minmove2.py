import glob
import re

bundles = glob.glob('charting_library/bundles/*.js')
print("Searching for minmove2 in all bundles...")
for b in bundles:
    with open(b, encoding='utf-8') as f:
        c = f.read()
    if 'minmove2' in c:
        matches = [m.start() for m in re.finditer(r'minmove2', c)]
        print(f"\nFile: {b}, count: {len(matches)}")
        for m in matches[:5]:
            print(c[max(0, m-80):min(len(c), m+120)])
            print('---')
