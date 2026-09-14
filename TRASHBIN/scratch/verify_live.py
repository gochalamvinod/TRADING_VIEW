import urllib.request
import json

def main():
    try:
        cfg = json.loads(urllib.request.urlopen("http://127.0.0.1:8080/config").read())
        print("Backend Config resolutions:", len(cfg.get("supported_resolutions", [])))
    except Exception as e:
        print("Backend Config error:", e)

    try:
        bnd = json.loads(urllib.request.urlopen("http://127.0.0.1:9999/trade/bundle").read())
        acc = bnd.get("account", {})
        print("Bundle Online:", bnd.get("backendOnline"))
        print("Account Name:", acc.get("name"))
        print("Account Server:", acc.get("server"))
        print("Balance:", acc.get("balance"))
    except Exception as e:
        print("Bundle error:", e)

    try:
        html = urllib.request.urlopen("http://localhost:9000/").read().decode("utf-8")
        print("HTML Injected brokerBackend == 'OANDA':", '"brokerBackend":"OANDA"' in html)
        print("HTML Injected priceType == 'MID':", '"priceType":"MID"' in html)
    except Exception as e:
        print("HTML error:", e)

if __name__ == "__main__":
    main()
