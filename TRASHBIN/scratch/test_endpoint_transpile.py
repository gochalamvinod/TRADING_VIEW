import httpx

broken = """//@version=5
indicator("Broken")
x = 10 +
"""

valid = """//@version=5
indicator("Valid")
x = close > open ? 1 : 0
plot(x)
"""

with httpx.Client(timeout=5.0) as client:
    r1 = client.post("http://127.0.0.1:9000/pine/transpile", json={"source": broken})
    print("Broken status:", r1.status_code)
    print("Broken json:", r1.json())

    r2 = client.post("http://127.0.0.1:9000/pine/transpile", json={"source": valid})
    print("Valid status:", r2.status_code)
    print("Valid success:", r2.json().get("success"))
