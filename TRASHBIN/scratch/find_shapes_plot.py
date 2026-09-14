import re

with open('charting_library/bundles/library.e8d44337c84d65489d2c.js', 'r', encoding='utf-8', errors='ignore') as f:
    c = f.read()

matches = [m.start() for m in re.finditer(r'[\'"]shapes[\'"]', c)]
print(f"Found {len(matches)} occurrences")
for idx in matches[:10]:
    print(c[max(0, idx-60):min(len(c), idx+120)])
    print('---')
