import urllib.request, json

g = json.loads(urllib.request.urlopen('http://127.0.0.1:9000/history?symbol=GBPUSD.&resolution=1&countback=85').read())
e = json.loads(urllib.request.urlopen('http://127.0.0.1:9000/history?symbol=EURUSD.&resolution=1&countback=85').read())

print("Number of bars:", len(g['t']), len(e['t']))
print("First 5 GBP c:", g['c'][:5])
print("First 5 EUR c:", e['c'][:5])

# Calculate normalized shapes (0 to 1) to compare visual shapes
g_c = g['c']
e_c = e['c']
min_g, max_g = min(g_c), max(g_c)
min_e, max_e = min(e_c), max(e_c)

norm_g = [(x - min_g) / (max_g - min_g) for x in g_c]
norm_e = [(x - min_e) / (max_e - min_e) for x in e_c]

diffs = [abs(ng - ne) for ng, ne in zip(norm_g, norm_e)]
print("Average normalized difference between EURUSD and GBPUSD:", sum(diffs) / len(diffs))
print("Max normalized difference:", max(diffs))
