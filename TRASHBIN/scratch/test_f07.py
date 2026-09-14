import httpx

code = """//@version=6
indicator("Feature 07: Hline Levels", overlay=true)
h1 = hline(4400.0, "Resistance Level", color=color.red, linestyle=hline.style_dashed, linewidth=2)
h2 = hline(4390.0, "Support Level", color=color.green, linestyle=hline.style_solid, linewidth=2)
"""

r = httpx.post('http://127.0.0.1:9000/pine/transpile', json={'source': code})
print("Keys:", list(r.json().keys()))
print("Response:", r.json())
