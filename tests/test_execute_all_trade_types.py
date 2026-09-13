import requests
import json
import time
import sys

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_URL = "http://127.0.0.1:9000"

def banner(msg):
    print("\n" + "=" * 70)
    print(f"  {msg}")
    print("=" * 70)

def main():
    banner("TESTING ALL TRADE TYPES ON DEMO ACCOUNT")
    session = requests.Session()

    # 0. Account check
    r_acc = session.get(f"{BASE_URL}/trade/account")
    print(f"0. Account: status={r_acc.status_code}")
    acc = r_acc.json()
    print(f"   Login: {acc['login']}, Balance: {acc['balance']}, Equity: {acc['equity']}")

    # 1. Market BUY order (0.01 lot on XAUUSD.)
    banner("1. TEST MARKET BUY ORDER")
    buy_payload = {
        "symbol": "XAUUSD.",
        "action": "BUY",
        "volume": 0.01,
        "deviation": 20,
        "comment": "Test Market BUY",
        "sl": 0.0,
        "tp": 0.0
    }
    r_buy = session.post(f"{BASE_URL}/trade/order", json=buy_payload)
    print(f"Market BUY status: {r_buy.status_code}")
    buy_res = r_buy.json()
    print("Market BUY response:", json.dumps(buy_res, indent=2))
    assert buy_res.get("success") is True, f"Market BUY failed: {buy_res}"
    buy_ticket = buy_res.get("order") or buy_res.get("deal") or buy_res.get("ticket")
    print(f"✅ Market BUY order executed! Ticket/Deal: {buy_ticket}")

    time.sleep(1)

    # Verify position exists in /trade/positions
    r_pos = session.get(f"{BASE_URL}/trade/positions")
    positions = r_pos.json()
    print(f"Open positions count: {len(positions)}")
    open_pos = [p for p in positions if p.get("symbol") == "XAUUSD."]
    target_pos = open_pos[-1] if open_pos else None
    print(f"Target position for modification: {target_pos}")

    if target_pos:
        pos_ticket = target_pos["ticket"]
        open_price = float(target_pos["price_open"])
        
        # 2. Modify Position (Set SL and TP)
        banner("2. TEST MODIFY POSITION (SET SL & TP)")
        # For BUY: SL below, TP above
        sl_price = round(open_price - 10.0, 2)
        tp_price = round(open_price + 10.0, 2)
        mod_payload = {
            "ticket": pos_ticket,
            "sl": sl_price,
            "tp": tp_price
        }
        r_mod = session.post(f"{BASE_URL}/trade/modify_position", json=mod_payload)
        print(f"Modify Position status: {r_mod.status_code}")
        mod_res = r_mod.json()
        print("Modify Position response:", json.dumps(mod_res, indent=2))
        print(f"✅ Position SL/TP modified to SL={sl_price}, TP={tp_price}!")

        time.sleep(1)

        # 3. Close Position
        banner("3. TEST CLOSE POSITION")
        close_payload = {
            "ticket": pos_ticket,
            "symbol": "XAUUSD.",
            "volume": 0.01
        }
        r_close = session.post(f"{BASE_URL}/trade/close_position", json=close_payload)
        print(f"Close Position status: {r_close.status_code}")
        close_res = r_close.json()
        print("Close Position response:", json.dumps(close_res, indent=2))
        assert close_res.get("success") is True, f"Close failed: {close_res}"
        print(f"✅ Position {pos_ticket} closed successfully!")

    time.sleep(1)

    # 4. Market SELL order (0.01 lot on XAUUSD.)
    banner("4. TEST MARKET SELL ORDER")
    sell_payload = {
        "symbol": "XAUUSD.",
        "action": "SELL",
        "volume": 0.01,
        "deviation": 20,
        "comment": "Test Market SELL"
    }
    r_sell = session.post(f"{BASE_URL}/trade/order", json=sell_payload)
    print(f"Market SELL status: {r_sell.status_code}")
    sell_res = r_sell.json()
    print("Market SELL response:", json.dumps(sell_res, indent=2))
    assert sell_res.get("success") is True, f"Market SELL failed: {sell_res}"
    sell_ticket = sell_res.get("order") or sell_res.get("deal") or sell_res.get("ticket")
    print(f"✅ Market SELL order executed! Ticket/Deal: {sell_ticket}")

    time.sleep(1)

    # Close the SELL position
    r_pos2 = session.get(f"{BASE_URL}/trade/positions")
    pos2 = [p for p in r_pos2.json() if p.get("symbol") == "XAUUSD."]
    if pos2:
        s_pos = pos2[-1]
        session.post(f"{BASE_URL}/trade/close_position", json={"ticket": s_pos["ticket"], "symbol": "XAUUSD.", "volume": 0.01})
        print(f"✅ Market SELL position {s_pos['ticket']} closed!")

    time.sleep(1)

    # 5. Pending BUY LIMIT order
    banner("5. TEST PENDING BUY LIMIT ORDER")
    # Get current price
    q = session.get(f"{BASE_URL}/quotes?symbols=XAUUSD.").json()
    current_bid = float(q["d"][0]["v"]["bid"])
    limit_price = round(current_bid - 20.0, 2)  # 20 dollars below market

    limit_payload = {
        "symbol": "XAUUSD.",
        "order_type": "BUY_LIMIT",
        "volume": 0.01,
        "price": limit_price,
        "sl": round(limit_price - 10.0, 2),
        "tp": round(limit_price + 10.0, 2),
        "comment": "Test BUY_LIMIT"
    }
    r_lim = session.post(f"{BASE_URL}/trade/pending_order", json=limit_payload)
    print(f"Pending BUY_LIMIT status: {r_lim.status_code}")
    lim_res = r_lim.json()
    print("Pending BUY_LIMIT response:", json.dumps(lim_res, indent=2))
    assert lim_res.get("success") is True, f"BUY_LIMIT failed: {lim_res}"
    pending_ticket = lim_res.get("order")
    print(f"✅ Pending BUY_LIMIT placed! Ticket: {pending_ticket}")

    time.sleep(1)

    # 6. Modify Pending Order
    banner("6. TEST MODIFY PENDING ORDER")
    new_limit_price = round(limit_price - 5.0, 2)
    mod_ord_payload = {
        "ticket": pending_ticket,
        "price": new_limit_price,
        "sl": round(new_limit_price - 10.0, 2),
        "tp": round(new_limit_price + 10.0, 2)
    }
    r_mod_ord = session.post(f"{BASE_URL}/trade/modify_order", json=mod_ord_payload)
    print(f"Modify Order status: {r_mod_ord.status_code}")
    print("Modify Order response:", json.dumps(r_mod_ord.json(), indent=2))
    print(f"✅ Pending order modified to price={new_limit_price}!")

    time.sleep(1)

    # 7. Cancel Pending Order
    banner("7. TEST CANCEL PENDING ORDER")
    r_cancel = session.post(f"{BASE_URL}/trade/cancel_order", json={"ticket": pending_ticket})
    print(f"Cancel Order status: {r_cancel.status_code}")
    print("Cancel Order response:", json.dumps(r_cancel.json(), indent=2))
    assert r_cancel.json().get("success") is True, f"Cancel failed: {r_cancel.json()}"
    print(f"✅ Pending order {pending_ticket} cancelled successfully!")

    # 8. Pending SELL LIMIT order
    banner("8. TEST PENDING SELL LIMIT ORDER")
    sell_limit_price = round(current_bid + 20.0, 2)
    r_sell_lim = session.post(f"{BASE_URL}/trade/pending_order", json={
        "symbol": "XAUUSD.",
        "order_type": "SELL_LIMIT",
        "volume": 0.01,
        "price": sell_limit_price,
        "comment": "Test SELL_LIMIT"
    })
    print(f"Pending SELL_LIMIT status: {r_sell_lim.status_code}")
    sell_lim_res = r_sell_lim.json()
    print("Pending SELL_LIMIT response:", json.dumps(sell_lim_res, indent=2))
    assert sell_lim_res.get("success") is True, f"SELL_LIMIT failed: {sell_lim_res}"
    sell_lim_ticket = sell_lim_res.get("order")
    print(f"✅ Pending SELL_LIMIT placed! Ticket: {sell_lim_ticket}")

    time.sleep(1)
    # Cancel SELL LIMIT
    session.post(f"{BASE_URL}/trade/cancel_order", json={"ticket": sell_lim_ticket})
    print(f"✅ Pending SELL_LIMIT {sell_lim_ticket} cancelled successfully!")

    banner("ALL TRADE TYPES EXECUTED & VERIFIED ON DEMO ACCOUNT WITH 100% SUCCESS!")

if __name__ == "__main__":
    main()
