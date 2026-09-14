"""
Test script for RAM tick aggregation & dynamic broker timezone offset.
"""
import time
import datetime
import numpy as np
import MetaTrader5 as mt5

def test_dynamic_offset():
    if not mt5.initialize():
        print("MT5 init failed")
        return None
    
    # Account check
    acc = mt5.account_info()
    login = acc.login if acc else "unknown"
    server = acc.server if acc else "unknown"
    print(f"[ACCOUNT] Login: {login}, Server: {server}")
    
    tick = mt5.symbol_info_tick("XAUUSD.")
    if not tick:
        print("No tick for XAUUSD.")
        return None
    
    sys_time = time.time()
    diff = tick.time - sys_time
    # Quantize to 900s (15 min) or 1800s (30 min)
    offset = int(round(diff / 900.0) * 900)
    print(f"[OFFSET] Tick time: {tick.time}, Sys time: {sys_time:.2f}, Diff: {diff:.2f}s, Detected offset: {offset}s ({offset/3600:.2f}h)")
    return offset

def test_ram_tick_aggregation(offset):
    # Fetch 5000 recent ticks from MT5 using broker time
    now_utc = time.time()
    now_broker = now_utc + offset
    now_broker_dt = datetime.datetime.fromtimestamp(now_broker)
    start_broker_dt = now_broker_dt - datetime.timedelta(minutes=30)
    
    ticks = mt5.copy_ticks_range("XAUUSD.", start_broker_dt, now_broker_dt + datetime.timedelta(minutes=5), mt5.COPY_TICKS_ALL)
    print(f"[TICKS] Fetched {len(ticks)} ticks from MT5 between {start_broker_dt} and {now_broker_dt}")
    if len(ticks) == 0:
        return
    
    # Convert broker time_msc to true UTC milliseconds with 1ms precision
    has_msc = 'time_msc' in ticks.dtype.names
    raw_msc = ticks['time_msc'] if has_msc else (ticks['time'] * 1000).astype(np.int64)
    time_utc_msc = raw_msc - int(offset * 1000)
    prices = ticks['bid'].astype(np.float64)
    vols = ticks['volume_real'].astype(np.float64) if 'volume_real' in ticks.dtype.names else ticks['volume'].astype(np.float64)
    
    print(f"[UTC MSC] First tick UTC: {time_utc_msc[0]/1000.0:.3f}, Last tick UTC: {time_utc_msc[-1]/1000.0:.3f}, Current sys time: {now_utc:.3f}")
    print(f"[UTC MSC] Lag to real-time: {now_utc - (time_utc_msc[-1]/1000.0):.3f}s (sub-second!)")
    
    # Test 1T aggregation (1 tick per bar)
    t_sec_1t = np.round(time_utc_msc / 1000.0, 3)
    # Ensure strict monotonicity for TradingView
    t_arr = np.empty(len(t_sec_1t), dtype=np.float64)
    last_t = 0.0
    for i, x in enumerate(t_sec_1t):
        cur_t = float(x)
        if cur_t <= last_t:
            cur_t = round(last_t + 0.001, 3)
        t_arr[i] = cur_t
        last_t = cur_t
    
    print(f"[1T RESULT] Number of bars: {len(t_arr)}")
    print(f"[1T RESULT] Last 5 bar timestamps: {t_arr[-5:]}")
    print(f"[1T RESULT] Last 5 bar closes: {prices[-5:]}")
    print(f"[1T RESULT] Strictly monotonic: {np.all(np.diff(t_arr) > 0)}")
    
    # Test 1S aggregation (1 second OHLC bars)
    t_sec_floor = time_utc_msc // 1000
    sec = 1
    buckets = (t_sec_floor // sec) * sec
    boundary_mask = np.r_[True, buckets[1:] != buckets[:-1]]
    start_idx = np.flatnonzero(boundary_mask)
    end_idx = np.r_[start_idx[1:], len(prices)]
    
    epoch_s = buckets[start_idx]
    o_arr = prices[start_idx]
    c_arr = prices[end_idx - 1]
    h_arr = np.maximum.reduceat(prices, start_idx)
    l_arr = np.minimum.reduceat(prices, start_idx)
    v_arr = np.add.reduceat(vols, start_idx)
    
    print(f"[1S RESULT] Number of 1S bars: {len(epoch_s)}")
    print(f"[1S RESULT] Last 5 1S timestamps: {epoch_s[-5:]}")
    print(f"[1S RESULT] Last 5 1S closes: {c_arr[-5:]}")
    print(f"[1S RESULT] Strictly monotonic: {np.all(np.diff(epoch_s) > 0)}")
    print(f"[1S RESULT] Last 1S bar time vs now: {now_utc - epoch_s[-1]:.2f}s (LIVE!)")

if __name__ == "__main__":
    offset = test_dynamic_offset()
    if offset is not None:
        test_ram_tick_aggregation(offset)
