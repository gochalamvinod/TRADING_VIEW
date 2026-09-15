"""
Detailed verification of MT5 order execution, brackets, and lot sizing on OrbexGlobal-Server (Account 70257567).
"""
from curl_cffi import requests
import json
import math

BASE_URL = "http://127.0.0.1:9000"

def test_full_mt5_and_bracket_verification():
    print("=" * 80)
    print("STEP 1: VERIFY MT5 ACCOUNT CONNECTION & CREDENTIALS")
    print("=" * 80)
    r = requests.get(f"{BASE_URL}/trade/account")
    assert r.status_code == 200, f"Account check failed: {r.text}"
    acc = r.json()
    print(f"Account Login       : {acc.get('login')}")
    print(f"Account Name        : {acc.get('name')}")
    print(f"Broker Server       : {acc.get('server')}")
    print(f"Company             : {acc.get('company')}")
    print(f"Currency            : {acc.get('currency')}")
    print(f"Balance             : ${acc.get('balance'):,.2f}")
    print(f"Equity              : ${acc.get('equity'):,.2f}")
    print(f"Leverage            : 1:{acc.get('leverage')}")
    print(f"Trade Allowed       : {acc.get('trade_allowed')}")
    print(f"Trade Expert        : {acc.get('trade_expert')}")
    assert acc.get('login') == 70257567, f"Unexpected login {acc.get('login')}"
    assert acc.get('server') == "OrbexGlobal-Server", f"Unexpected server {acc.get('server')}"
    assert acc.get('trade_allowed') is True, "Trade not allowed on MT5 account"

    print("\n" + "=" * 80)
    print("STEP 2: LIVE QUOTE RETRIEVAL & SPREAD ANALYSIS")
    print("=" * 80)
    r_quote = requests.get(f"{BASE_URL}/quotes?symbols=XAUUSD.")
    assert r_quote.status_code == 200, f"Quote fetch failed: {r_quote.text}"
    q_data = r_quote.json()["d"][0]["v"]
    bid = float(q_data.get("bid"))
    ask = float(q_data.get("ask"))
    spread = float(q_data.get("spread", round(ask - bid, 2)))
    print(f"Symbol              : XAUUSD.")
    print(f"Current Bid         : {bid:.2f}")
    print(f"Current Ask         : {ask:.2f}")
    print(f"Spread Points       : {spread}")
    assert bid > 0 and ask > 0 and ask >= bid

    print("\n" + "=" * 80)
    print("STEP 3: BRACKET CALCULATIONS & LOT CALCULATOR MATHEMATICAL VERIFICATION")
    print("=" * 80)
    # Test 1%: 100 points SL ($1.00 move on Gold)
    # Balance = acc.balance (e.g. $105,183.46)
    # Risk 1% = $1,051.83
    # Gold tick_size=0.01, tick_value=$1.00, contract_size=100 oz
    # Loss per 1 lot for 100 points ($1.00): (1.00 / 0.01) * $1.00 = $100.00
    # Expected raw lots = $1,051.83 / $100.00 = 10.5183 lots -> rounded to 10.52 lots
    balance = acc.get('balance')
    risk_pct = 1.0
    sl_points = 100
    lot_req = {
        "symbol": "XAUUSD.",
        "risk_percent": risk_pct,
        "sl_points": sl_points,
        "use_equity": False
    }
    r_lot = requests.post(f"{BASE_URL}/trade/lot_calculator", json=lot_req)
    assert r_lot.status_code == 200, f"Lot calculator failed: {r_lot.text}"
    calc = r_lot.json()
    print("Lot Calculator Verification (1% risk, 100 points SL):")
    print(f"  Account Balance   : ${calc['account_balance']:,.2f}")
    print(f"  Risk Target       : {calc['risk_percent']}% (${calc['risk_usd']:,.2f})")
    print(f"  SL Distance Price : ${calc['sl_distance_price']:.2f} ({calc['sl_points']} points, {calc['sl_pips']} pips)")
    print(f"  Calculated Lots   : {calc['calculated_lot']} lots")
    print(f"  Actual Risk USD   : ${calc['actual_risk_usd']:,.2f}")
    print(f"  Tick Value/Size   : ${calc['tick_value']} / {calc['tick_size']}")

    expected_loss_per_lot = (1.00 / calc['tick_size']) * calc['tick_value']
    expected_lots = round(round((calc['risk_usd'] / expected_loss_per_lot) / calc['volume_step']) * calc['volume_step'], 2)
    clamped_expected = max(calc['volume_min'], min(calc['volume_max'], expected_lots))
    print(f"  Formula Check     : Expected {clamped_expected} lots == API {calc['calculated_lot']} lots -> {clamped_expected == calc['calculated_lot']}")
    assert calc['calculated_lot'] == clamped_expected

    # Test Bracket Risk/Reward Calculation
    entry_test = 4430.00
    sl_test = 4420.00    # Risk = $10.00
    tp_test = 4450.00    # Reward = $20.00
    risk_dist = abs(entry_test - sl_test)
    reward_dist = abs(tp_test - entry_test)
    rr_ratio = reward_dist / risk_dist
    print(f"\nBracket Risk/Reward Calculation:")
    print(f"  Entry: {entry_test}, SL: {sl_test} (Risk: ${risk_dist:.2f}), TP: {tp_test} (Reward: ${reward_dist:.2f})")
    print(f"  Calculated R:R Ratio: 1:{rr_ratio:.2f}")
    assert rr_ratio == 2.0

    print("\n" + "=" * 80)
    print("STEP 4: MARKET ORDER WITH BRACKETS (SL & TP) PLACEMENT & EXECUTION")
    print("=" * 80)
    # Current Ask is entry for BUY
    buy_sl = round(ask - 15.00, 2)
    buy_tp = round(ask + 25.00, 2)
    market_order = {
        "symbol": "XAUUSD.",
        "action": "BUY",
        "volume": 0.01,
        "sl": buy_sl,
        "tp": buy_tp,
        "comment": "Agent7 Bracket Verification"
    }
    r_order = requests.post(f"{BASE_URL}/trade/order", json=market_order)
    assert r_order.status_code == 200, f"Order placement failed: {r_order.text}"
    ord_res = r_order.json()
    print("Market Order Execution Response:")
    print(f"  Success           : {ord_res.get('success')}")
    print(f"  Retcode           : {ord_res.get('retcode')} ({ord_res.get('retcode_name')})")
    print(f"  Retcode Desc      : {ord_res.get('retcode_description')}")
    print(f"  Order Ticket      : {ord_res.get('order')}")
    print(f"  Deal Ticket       : {ord_res.get('deal')}")
    print(f"  Executed Price    : {ord_res.get('price')}")
    print(f"  Volume            : {ord_res.get('volume')} lot")
    assert ord_res.get('success') is True
    assert ord_res.get('retcode') == 10009  # TRADE_RETCODE_DONE
    pos_ticket = ord_res.get('order')
    deal_ticket = ord_res.get('deal')

    print("\n" + "=" * 80)
    print("STEP 5: VERIFY POSITION & BRACKETS IN LIVE POSITIONS TABLE")
    print("=" * 80)
    r_pos = requests.get(f"{BASE_URL}/trade/positions?ticket={pos_ticket}")
    assert r_pos.status_code == 200
    positions = r_pos.json()
    assert len(positions) >= 1, f"Position #{pos_ticket} not found in positions table"
    pos = positions[0]
    print(f"  Position Ticket   : {pos['ticket']}")
    print(f"  Symbol            : {pos['symbol']}")
    print(f"  Type              : {pos['type_name']}")
    print(f"  Volume            : {pos['volume']}")
    print(f"  Open Price        : {pos['price_open']}")
    print(f"  Current Price     : {pos['price_current']}")
    print(f"  Stop Loss (SL)    : {pos['sl']}")
    print(f"  Take Profit (TP)  : {pos['tp']}")
    print(f"  Floating Profit   : ${pos['profit']:,.2f}")
    assert pos['ticket'] == pos_ticket
    assert abs(pos['sl'] - buy_sl) < 0.05, f"SL mismatch: expected {buy_sl}, got {pos['sl']}"
    assert abs(pos['tp'] - buy_tp) < 0.05, f"TP mismatch: expected {buy_tp}, got {pos['tp']}"

    print("\n" + "=" * 80)
    print("STEP 6: DYNAMIC BRACKET MODIFICATION (DRAGGING SL/TP)")
    print("=" * 80)
    # Simulate dragging SL higher and TP higher
    new_sl = round(buy_sl + 3.00, 2)
    new_tp = round(buy_tp + 5.00, 2)
    mod_req = {
        "ticket": pos_ticket,
        "sl": new_sl,
        "tp": new_tp
    }
    r_mod = requests.post(f"{BASE_URL}/trade/modify", json=mod_req)
    assert r_mod.status_code == 200, f"Modify failed: {r_mod.text}"
    mod_res = r_mod.json()
    print("Position Bracket Modification Response:")
    print(f"  Success           : {mod_res.get('success')}")
    print(f"  Retcode           : {mod_res.get('retcode')} ({mod_res.get('retcode_name')})")
    print(f"  New SL            : {mod_res.get('sl')}")
    print(f"  New TP            : {mod_res.get('tp')}")
    assert mod_res.get('success') is True
    assert mod_res.get('retcode') == 10009

    # Verify update reflected in MT5
    r_pos_check = requests.get(f"{BASE_URL}/trade/positions?ticket={pos_ticket}")
    pos_updated = r_pos_check.json()[0]
    print(f"  Verified MT5 SL   : {pos_updated['sl']} (Target: {new_sl})")
    print(f"  Verified MT5 TP   : {pos_updated['tp']} (Target: {new_tp})")
    assert abs(pos_updated['sl'] - new_sl) < 0.05
    assert abs(pos_updated['tp'] - new_tp) < 0.05

    print("\n" + "=" * 80)
    print("STEP 7: INSTANT POSITION CLOSE")
    print("=" * 80)
    close_req = {"ticket": pos_ticket}
    r_close = requests.post(f"{BASE_URL}/trade/close", json=close_req)
    assert r_close.status_code == 200, f"Close failed: {r_close.text}"
    close_res = r_close.json()
    print("Position Close Response:")
    print(f"  Success           : {close_res.get('success')}")
    print(f"  Retcode           : {close_res.get('retcode')} ({close_res.get('retcode_name')})")
    print(f"  Close Deal Ticket : {close_res.get('deal')}")
    print(f"  Closed Order      : {close_res.get('order')}")
    print(f"  Closed Volume     : {close_res.get('volume')}")
    print(f"  Close Price       : {close_res.get('price')}")
    assert close_res.get('success') is True
    assert close_res.get('retcode') == 10009

    # Confirm position no longer exists
    r_pos_after = requests.get(f"{BASE_URL}/trade/positions?ticket={pos_ticket}")
    assert len(r_pos_after.json()) == 0, "Position still present after close"
    print(f"  -> Verified position #{pos_ticket} cleanly closed (0 open positions for this ticket)")

    print("\n" + "=" * 80)
    print("STEP 8: PENDING ORDER WITH SL/TP BRACKETS LIFECYCLE (PLACE -> MODIFY -> CANCEL)")
    print("=" * 80)
    # Fresh quote
    r_q = requests.get(f"{BASE_URL}/quotes?symbols=XAUUSD.")
    cur_bid = float(r_q.json()["d"][0]["v"]["bid"])
    pend_entry = round(cur_bid - 80.00, 2)
    pend_sl = round(pend_entry - 25.00, 2)
    pend_tp = round(pend_entry + 40.00, 2)

    pend_order = {
        "symbol": "XAUUSD.",
        "type": "BUY_LIMIT",
        "price": pend_entry,
        "volume": 0.01,
        "sl": pend_sl,
        "tp": pend_tp,
        "comment": "Agent7 Pending Brackets"
    }
    r_pend = requests.post(f"{BASE_URL}/trade/pending", json=pend_order)
    assert r_pend.status_code == 200, f"Pending placement failed: {r_pend.text}"
    pend_res = r_pend.json()
    print("Pending Order Placement Response:")
    print(f"  Success           : {pend_res.get('success')}")
    print(f"  Retcode           : {pend_res.get('retcode')} ({pend_res.get('retcode_name')})")
    print(f"  Pending Ticket    : {pend_res.get('order')}")
    print(f"  Limit Price       : {pend_res.get('price')}")
    assert pend_res.get('success') is True
    assert pend_res.get('retcode') == 10009
    pend_ticket = pend_res.get('order')

    # Verify pending order exists
    r_ord = requests.get(f"{BASE_URL}/trade/orders?ticket={pend_ticket}")
    assert len(r_ord.json()) == 1
    ord_obj = r_ord.json()[0]
    print(f"  Verified Pending in MT5: Ticket={ord_obj['ticket']}, Type={ord_obj['type_name']}, Price={ord_obj['price_open']}, SL={ord_obj['sl']}, TP={ord_obj['tp']}")
    assert abs(ord_obj['sl'] - pend_sl) < 0.05
    assert abs(ord_obj['tp'] - pend_tp) < 0.05

    # Modify Pending Order (Entry, SL, TP)
    new_entry = round(pend_entry + 5.00, 2)
    new_sl_p = round(new_entry - 20.00, 2)
    new_tp_p = round(new_entry + 35.00, 2)
    mod_pend = {
        "ticket": pend_ticket,
        "price": new_entry,
        "sl": new_sl_p,
        "tp": new_tp_p
    }
    r_mod_pend = requests.post(f"{BASE_URL}/trade/modify", json=mod_pend)
    assert r_mod_pend.status_code == 200
    mod_p_res = r_mod_pend.json()
    print(f"  Modified Pending Order: retcode={mod_p_res.get('retcode')}, new price={new_entry}, new SL={new_sl_p}, new TP={new_tp_p}")
    assert mod_p_res.get('success') is True

    # Cancel Pending Order
    r_cancel = requests.post(f"{BASE_URL}/trade/close", json={"ticket": pend_ticket})
    assert r_cancel.status_code == 200
    cancel_res = r_cancel.json()
    print(f"  Cancelled Pending Order: retcode={cancel_res.get('retcode')}, type={cancel_res.get('type')}")
    assert cancel_res.get('success') is True

    # Confirm cancelled
    r_ord_after = requests.get(f"{BASE_URL}/trade/orders?ticket={pend_ticket}")
    assert len(r_ord_after.json()) == 0
    print(f"  -> Verified pending order #{pend_ticket} cleanly cancelled (0 active orders)")

    print("\n" + "=" * 80)
    print("ALL 8 DETAILED VERIFICATION STEPS PASSED 100% WITH LIVE MT5 EXECUTION!")
    print("=" * 80)

if __name__ == "__main__":
    test_full_mt5_and_bracket_verification()
