import httpx

r = httpx.get('http://127.0.0.1:8080/history?symbol=EURUSD.&resolution=1&countback=20')
data = r.json()
print('Res 1:', data.get('s'), len(data.get('t', [])))
if data.get('t'):
    last_t = data['t'][-1]
    cutoff = data['t'][-5]
    print('Last bar ts:', last_t, 'Cutoff ts:', cutoff)
    
    r2 = httpx.get(f'http://127.0.0.1:8080/history?symbol=EURUSD.&resolution=15S&from={cutoff}&to={last_t}')
    d2 = r2.json()
    print('Res 15S from cutoff to last_t:', d2.get('s'), len(d2.get('t', [])))
    if d2.get('t'):
        print('15S first:', d2['t'][0], 'last:', d2['t'][-1])
        
    r3 = httpx.get(f'http://127.0.0.1:8080/history?symbol=EURUSD.&resolution=10T&from={cutoff}&to={last_t}&countback=500')
    d3 = r3.json()
    print('Res 10T from cutoff to last_t:', d3.get('s'), len(d3.get('t', [])))
    if d3.get('t'):
        print('10T first:', d3['t'][0], 'last:', d3['t'][-1])
