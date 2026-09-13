import os

p = os.path.abspath('charting_library/bundles/library.e8d44337c84d65489d2c.js')
with open(p, 'r', encoding='utf-8') as f:
    content = f.read()

target = '_createActionAddChildStudy(e){throw new Error("unsupported")}'
if target in content:
    new_content = content.replace(target, '_createActionAddChildStudy(e){return null}')
    with open(p, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print('SUCCESS: Patched library bundle!')
else:
    print('ALREADY PATCHED or NOT FOUND')
