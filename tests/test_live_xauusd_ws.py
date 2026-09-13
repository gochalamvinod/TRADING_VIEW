import asyncio
import json
import time
import websockets

async def capture_xauusd():
    uri = "ws://127.0.0.1:8080/ws/quotes"
    async with websockets.connect(uri) as ws:
        await ws.send(json.dumps({"action": "subscribe", "symbol": "XAUUSD."}))
        print("[WS CLIENT] Subscribed to XAUUSD., waiting for frames...")
        count = 0
        start = time.time()
        while count < 5 and (time.time() - start) < 10.0:
            raw = await asyncio.wait_for(ws.recv(), timeout=4.0)
            msg = json.loads(raw)
            sym = msg.get("symbol", "")
            if "XAUUSD" in sym:
                count += 1
                v = msg["data"]["v"]
                print(f"  Live XAUUSD Frame #{count}: sym={sym} | bid={v['bid']} | ask={v['ask']} | lp={v['lp']} | spread={v['spread']} | high={v['high_price']} | low={v['low_price']}")
        return count

if __name__ == "__main__":
    c = asyncio.run(capture_xauusd())
    assert c > 0, "No XAUUSD quotes captured"
    print(f"SUCCESS: Captured {c} live XAUUSD quote frames via WebSocket!")
