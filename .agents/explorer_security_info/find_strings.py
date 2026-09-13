import os
import glob
import re

# Search translation files
with open('charting_library/bundles/en.8622.9181e2b364297c860b4f.js', encoding='utf-8') as f:
    c = f.read()

matches = re.findall(r'(\d+):e=>\{e\.exports=\{en:\["([^"]+)"\]\}\}', c)
print(f"Total string entries: {len(matches)}")
target_keywords = ['point', 'pip', 'tick', 'currency', 'value', 'size', 'lot', 'contract', 'symbol', 'security', 'min']
relevant = {}
for code, text in matches:
    if any(kw in text.lower() for kw in target_keywords):
        relevant[code] = text
        print(f"[{code}]: {text}")

# Now let's search symbol-info-dialog-impl.23e8feddd0326a1feabb.js for these codes
with open('charting_library/bundles/symbol-info-dialog-impl.23e8feddd0326a1feabb.js', encoding='utf-8') as f:
    impl = f.read()

print("\n--- Matching Codes in symbol-info-dialog-impl ---")
for code, text in relevant.items():
    if code in impl:
        print(f"FOUND IN DIALOG: [{code}] -> '{text}'")
