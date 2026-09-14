import httpx

urls = [
    '/pine_indicators.js',
    '/pine_editor_ide.js',
    '/',
    '/PineTS-main/dist/pinets.min.browser.js',
    '/charting_library/bundles/library.e8d44337c84d65489d2c.js'
]

for u in urls:
    r = httpx.get(f'http://127.0.0.1:9000{u}')
    print(f"{u:45} -> status: {r.status_code}, cache-control: {r.headers.get('cache-control')}")
