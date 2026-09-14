with open('charting_library/bundles/symbol-info-dialog-impl.23e8feddd0326a1feabb.js', encoding='utf-8') as f:
    c = f.read()

target_codes = ['981314', '39245', '424431', '381849', '13197', '417502', '912272']

for code in target_codes:
    idx = 0
    print(f"\n==================== CODE: {code} ====================")
    while True:
        idx = c.find(code, idx)
        if idx == -1:
            break
        print(f"--- Occurrence at {idx} ---")
        start = max(0, idx - 200)
        end = min(len(c), idx + 300)
        print(c[start:end])
        idx += len(code)
