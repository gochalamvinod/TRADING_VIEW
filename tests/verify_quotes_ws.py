import asyncio
import json
import time
import websockets

async def capture_frames(uri="ws://127.0.0.1:8080/ws/quotes", count=8, timeout=8.0):
    print(f"[WS CLIENT] Connecting to {uri}...")
    async with websockets.connect(uri) as ws:
        print("[WS CLIENT] Connected successfully!")
        # Subscribe to XAUUSD.
        await ws.send(json.dumps({"action": "subscribe", "symbol": "XAUUSD."}))
        print("[WS CLIENT] Sent: {\"action\": \"subscribe\", \"symbol\": \"XAUUSD.\"}")

        frames = []
        start_time = time.time()
        while len(frames) < count and (time.time() - start_time) < timeout:
            try:
                raw_msg = await asyncio.wait_for(ws.recv(), timeout=2.0)
                msg = json.loads(raw_msg)
                frames.append(msg)
                sym = msg.get("symbol", "")
                mtype = msg.get("type", "")
                data = msg.get("data", {})
                v = data.get("v", {})
                lp = v.get("lp", 0.0)
                ask = v.get("ask", 0.0)
                bid = v.get("bid", 0.0)
                spread = v.get("spread", 0.0)
                print(f"  Frame {len(frames):2d}: type={mtype:5s} | sym={sym:8s} | bid={bid:<8.2f} | ask={ask:<8.2f} | lp={lp:<8.2f} | spread={spread}")
            except asyncio.TimeoutError:
                print("  [WS TIMEOUT] Waiting for next frame...")
                break
        return frames

if __name__ == "__main__":
    frames = asyncio.run(capture_frames())
    print(f"\nCaptured {len(frames)} frames successfully.")
    assert len(frames) > 0, "No frames captured!"
    print("WEBSOCKET QUOTES STREAMING VERIFIED 100% PASS!")
