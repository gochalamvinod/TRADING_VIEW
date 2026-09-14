import re

for fn in ['pine_editor_ide.js', 'index.html']:
    with open(fn, 'r', encoding='utf-8') as f:
        text = f.read()
    print(f'=== {fn} ===')
    for m in re.finditer(r'<button([^>]*)>', text):
        attrs = m.group(1)
        if 'title' in attrs or 'id' in attrs or 'class' in attrs:
            print(' ', attrs[:120].strip())
