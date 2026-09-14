import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://127.0.0.1:8080/ws/quotes"
    print(f"Connecting to WebSocket via Node Proxy: {uri}")
    try:
        async with websockets.connect(uri, open_timeout=5.0) as ws:
            print("Connected successfully! Waiting for quote frames...")
            for i in range(5):
                msg = await asyncio.wait_for(ws.recv(), timeout=5.0)
                data = json.loads(msg)
                print(f"  [Frame {i+1}] type={data.get('type')}, count={len(data.get('data', []))}")
            print("WebSocket reverse proxy verification SUCCESSFUL!")
    except Exception as e:
        print(f"WebSocket verification failed: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())
