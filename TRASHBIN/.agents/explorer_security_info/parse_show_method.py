with open('charting_library/bundles/symbol-info-dialog-impl.23e8feddd0326a1feabb.js', encoding='utf-8') as f:
    c = f.read()

start = c.find('async show(e){')
end = c.find('static getInstance()', start)
print(c[start:end])
