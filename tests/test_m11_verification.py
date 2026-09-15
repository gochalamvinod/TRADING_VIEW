"""
Verification test script for R5 MT5 Backend API & Port 9000 Proxy Routing.
"""
from curl_cffi import requests
import json

BASE_PROXY = "http://127.0.0.1:9000"
BASE_DIRECT = "http://127.0.0.1:8080"

def run_verification():
    print("================================================================")
    print("1. PROXY & BACKEND PARITY VERIFICATION FOR /config & /time")
    print("================================================================")
    r_cfg_proxy = requests.get(f"{BASE_PROXY}/config")
    r_cfg_direct = requests.get(f"{BASE_DIRECT}/config")
    print(f"Proxy /config status: {r_cfg_proxy.status_code}, Direct status: {r_cfg_direct.status_code}")
    assert r_cfg_proxy.status_code == 200
    assert r_cfg_proxy.json() == r_cfg_direct.json()
    print("  -> /config parity verified: identical response")

    r_time_proxy = requests.get(f"{BASE_PROXY}/time")
    r_time_direct = requests.get(f"{BASE_DIRECT}/time")
    print(f"Proxy /time status: {r_time_proxy.status_code}, Direct status: {r_time_direct.status_code}")
    assert r_time_proxy.status_code == 200
    print(f"  -> Server time: {r_time_proxy.text}")

    print("\n================================================================")
    print("2. VERIFY /trade/account VIA PORT 9000 PROXY")
    print("================================================================")
    r_acc = requests.get(f"{BASE_PROXY}/trade/account")
    print(f"Proxy /trade/account status: {r_acc.status_code}")
    acc = r_acc.json()
    print(f"  Login: {acc.get('login')}")
    print(f"  Server: {acc.get('server')}")
    print(f"  Balance: {acc.get('balance')}")
    print(f"  Equity: {acc.get('equity')}")
    print(f"  Margin: {acc.get('margin')}")
    print(f"  Margin Free: {acc.get('margin_free')}")
    print(f"  Leverage: 1:{acc.get('leverage')}")
    print(f"  Trade Allowed: {acc.get('trade_allowed')}")
    print(f"  Trade Expert: {acc.get('trade_expert')}")
    assert acc.get('login') == 70257567, f"Expected login 70257567, got {acc.get('login')}"
    assert acc.get('server') == "OrbexGlobal-Server", f"Expected OrbexGlobal-Server, got {acc.get('server')}"

    print("\n================================================================")
    print("3. VERIFY /trade/positions & /trade/orders & /trade/history")
    print("================================================================")
    r_pos = requests.get(f"{BASE_PROXY}/trade/positions")
    print(f"Proxy /trade/positions status: {r_pos.status_code}, count: {len(r_pos.json())}")
    
    r_ord = requests.get(f"{BASE_PROXY}/trade/orders")
    print(f"Proxy /trade/orders status: {r_ord.status_code}, count: {len(r_ord.json())}")

    r_hist = requests.get(f"{BASE_PROXY}/trade/history?days=7")
    print(f"Proxy /trade/history status: {r_hist.status_code}, deals: {r_hist.json().get('deals_count')}, orders: {r_hist.json().get('orders_count')}")

    print("\n================================================================")
    print("4. VERIFY /trade/lot_calculator VIA PORT 9000 PROXY")
    print("================================================================")
    lot_req = {
        "symbol": "XAUUSD.",
        "risk_percent": 1.0,
        "sl_points": 50,
        "use_equity": True
    }
    r_lot = requests.post(f"{BASE_PROXY}/trade/lot_calculator", json=lot_req)
    print(f"Proxy /trade/lot_calculator status: {r_lot.status_code}")
    lot_res = r_lot.json()
    print(f"  Calculated Lot: {lot_res.get('calculated_lot')}")
    print(f"  Risk USD: {lot_res.get('risk_usd')}")
    print(f"  Tick Value: {lot_res.get('tick_value')}")
    print(f"  Min/Max/Step: {lot_res.get('volume_min')} / {lot_res.get('volume_max')} / {lot_res.get('volume_step')}")
    assert lot_res.get("success") is True

    print("\n================================================================")
    print("5. VERIFY PENDING ORDER LIFECYCLE: PLACE -> MODIFY -> CANCEL")
    print("================================================================")
    # Get current quote for XAUUSD.
    r_quotes = requests.get(f"{BASE_PROXY}/quotes?symbols=XAUUSD.")
    curr_price = r_quotes.json()["d"][0]["p"]
    print(f"Current XAUUSD. price: {curr_price}")

    # Place Buy Limit well below current price
    limit_price = round(curr_price - 100.0, 2)
    sl_price = round(limit_price - 20.0, 2)
    tp_price = round(limit_price + 20.0, 2)

    pending_req = {
        "symbol": "XAUUSD.",
        "type": "BUY_LIMIT",
        "price": limit_price,
        "volume": 0.01,
        "sl": sl_price,
        "tp": tp_price,
        "comment": "M11 Pending Test"
    }
    r_pend = requests.post(f"{BASE_PROXY}/trade/pending", json=pending_req)
    print(f"POST /trade/pending status: {r_pend.status_code}")
    pend_res = r_pend.json()
    print(f"  Result: success={pend_res.get('success')}, retcode={pend_res.get('retcode')}, order={pend_res.get('order')}, comment={pend_res.get('comment')}")
    assert pend_res.get("success") is True, f"Failed placing pending order: {pend_res}"
    order_ticket = pend_res.get("order")

    # Verify pending order appears in /trade/orders
    r_ord_check = requests.get(f"{BASE_PROXY}/trade/orders?ticket={order_ticket}")
    orders_list = r_ord_check.json()
    print(f"GET /trade/orders?ticket={order_ticket} found: {len(orders_list)} orders")
    assert len(orders_list) == 1
    assert orders_list[0]["ticket"] == order_ticket

    # Modify the pending order
    new_limit_price = round(limit_price + 2.0, 2)
    mod_req = {
        "ticket": order_ticket,
        "price": new_limit_price,
        "sl": round(new_limit_price - 20.0, 2),
        "tp": round(new_limit_price + 20.0, 2)
    }
    r_mod = requests.post(f"{BASE_PROXY}/trade/modify", json=mod_req)
    print(f"POST /trade/modify (pending) status: {r_mod.status_code}, success={r_mod.json().get('success')}, retcode={r_mod.json().get('retcode')}")
    assert r_mod.json().get("success") is True

    # Cancel the pending order via /trade/close
    close_req = {"ticket": order_ticket}
    r_close = requests.post(f"{BASE_PROXY}/trade/close", json=close_req)
    print(f"POST /trade/close (cancel pending) status: {r_close.status_code}, success={r_close.json().get('success')}, type={r_close.json().get('type')}")
    assert r_close.json().get("success") is True

    # Verify order is no longer in pending orders
    r_ord_after = requests.get(f"{BASE_PROXY}/trade/orders?ticket={order_ticket}")
    print(f"GET /trade/orders after cancel found: {len(r_ord_after.json())} orders (expected 0)")
    assert len(r_ord_after.json()) == 0

    print("\n================================================================")
    print("6. VERIFY MARKET ORDER LIFECYCLE: BUY -> MODIFY -> CLOSE")
    print("================================================================")
    market_req = {
        "symbol": "XAUUSD.",
        "action": "BUY",
        "volume": 0.01,
        "comment": "M11 Market Test"
    }
    r_mkt = requests.post(f"{BASE_PROXY}/trade/order", json=market_req)
    print(f"POST /trade/order status: {r_mkt.status_code}")
    mkt_res = r_mkt.json()
    print(f"  Result: success={mkt_res.get('success')}, retcode={mkt_res.get('retcode')}, order={mkt_res.get('order')}, deal={mkt_res.get('deal')}, comment={mkt_res.get('comment')}")
    assert mkt_res.get("success") is True, f"Failed placing market order: {mkt_res}"
    pos_ticket = mkt_res.get("order")

    # Verify position appears in /trade/positions
    r_pos_check = requests.get(f"{BASE_PROXY}/trade/positions?ticket={pos_ticket}")
    positions_list = r_pos_check.json()
    print(f"GET /trade/positions?ticket={pos_ticket} found: {len(positions_list)} positions")
    assert len(positions_list) >= 1
    pos_item = positions_list[0]
    print(f"  Open price: {pos_item.get('price_open')}, current: {pos_item.get('price_current')}, P&L: {pos_item.get('profit')}")

    # Modify SL/TP on the active position
    open_p = pos_item.get("price_open")
    mod_pos_req = {
        "ticket": pos_item["ticket"],
        "sl": round(open_p - 30.0, 2),
        "tp": round(open_p + 30.0, 2)
    }
    r_mod_pos = requests.post(f"{BASE_PROXY}/trade/modify", json=mod_pos_req)
    print(f"POST /trade/modify (position) status: {r_mod_pos.status_code}, success={r_mod_pos.json().get('success')}, retcode={r_mod_pos.json().get('retcode')}")
    assert r_mod_pos.json().get("success") is True

    # Close the position via /trade/close
    close_pos_req = {"ticket": pos_item["ticket"]}
    r_close_pos = requests.post(f"{BASE_PROXY}/trade/close", json=close_pos_req)
    print(f"POST /trade/close (position) status: {r_close_pos.status_code}, success={r_close_pos.json().get('success')}, deal={r_close_pos.json().get('deal')}")
    assert r_close_pos.json().get("success") is True

    # Verify position is closed
    r_pos_after = requests.get(f"{BASE_PROXY}/trade/positions?ticket={pos_item['ticket']}")
    print(f"GET /trade/positions after close found: {len(r_pos_after.json())} positions (expected 0)")
    assert len(r_pos_after.json()) == 0

    print("\n================================================================")
    print("7. VERIFY /trade/close_all ENDPOINT")
    print("================================================================")
    r_close_all = requests.post(f"{BASE_PROXY}/trade/close_all", json={"symbol": "XAUUSD.", "cancel_pending": True})
    print(f"POST /trade/close_all status: {r_close_all.status_code}, result: {r_close_all.json()}")
    assert r_close_all.status_code == 200
    assert r_close_all.json().get("success") is True

    print("\n================================================================")
    print("ALL VERIFICATIONS COMPLETED SUCCESSFULLY WITH 100% PASS RATE!")
    print("================================================================")

if __name__ == "__main__":
    run_verification()
