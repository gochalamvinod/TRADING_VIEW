import glob
import re

bundles = glob.glob('charting_library/bundles/*.js')
print("Searching for LibrarySymbolInfo...")
found = set()
for b in bundles:
    with open(b, encoding='utf-8') as f:
        c = f.read()
    if 'LibrarySymbolInfo' in c:
        found.add(b)
print("Found in:", found)
