import glob
import re

bundles = glob.glob('charting_library/bundles/*.js')
print("Searching for pip_size in all bundles...")
for b in bundles:
    with open(b, encoding='utf-8') as f:
        c = f.read()
    if 'pip_size' in c or 'pipsize' in c.lower():
        matches = [m.start() for m in re.finditer(r'pip_size|pipsize', c, re.I)]
        print(f"\nFile: {b}, count: {len(matches)}")
        for m in matches[:10]:
            print(c[max(0, m-80):min(len(c), m+120)])
            print('---')
