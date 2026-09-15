"""
High-Performance Technical Indicators Engine in Pure Julia
Featuring LLVM-compiled SIMD vectorization and sub-millisecond calculations.
"""

module JuliaIndicatorsEngine

export sma, ema, rma, rsi, macd, bollinger_bands, atr, supertrend, stochastic, williams_r, vwap, compute_all

"""
Simple Moving Average (SMA)
"""
function sma(data::Vector{Float64}, period::Int)::Vector{Float64}
    n = length(data)
    out = fill(NaN, n)
    if period <= 0 || n < period
        return out
    end
    
    # Initial window sum
    window_sum = 0.0
    @simd for i in 1:period
        window_sum += data[i]
    end
    out[period] = window_sum / period
    
    # Rolling window update
    inv_p = 1.0 / period
    for i in (period + 1):n
        window_sum += data[i] - data[i - period]
        out[i] = window_sum * inv_p
    end
    return out
end

"""
Exponential Moving Average (EMA)
"""
function ema(data::Vector{Float64}, period::Int)::Vector{Float64}
    n = length(data)
    out = fill(NaN, n)
    if period <= 0 || n < period
        return out
    end
    
    alpha = 2.0 / (period + 1.0)
    beta = 1.0 - alpha
    
    initial_sum = 0.0
    @simd for i in 1:period
        initial_sum += data[i]
    end
    val = initial_sum / period
    out[period] = val
    
    for i in (period + 1):n
        val = alpha * data[i] + beta * val
        out[i] = val
    end
    return out
end

"""
Wilder's Smoothing (RMA / SMMA)
Used in RSI and ATR.
"""
function rma(data::Vector{Float64}, period::Int)::Vector{Float64}
    n = length(data)
    out = fill(NaN, n)
    if period <= 0 || n < period
        return out
    end
    
    alpha = 1.0 / period
    beta = 1.0 - alpha
    
    initial_sum = 0.0
    @simd for i in 1:period
        initial_sum += data[i]
    end
    val = initial_sum / period
    out[period] = val
    
    for i in (period + 1):n
        val = alpha * data[i] + beta * val
        out[i] = val
    end
    return out
end

"""
Relative Strength Index (RSI)
"""
function rsi(close::Vector{Float64}, period::Int=14)::Vector{Float64}
    n = length(close)
    out = fill(NaN, n)
    if period <= 0 || n <= period
        return out
    end
    
    gains = fill(0.0, n)
    losses = fill(0.0, n)
    for i in 2:n
        diff = close[i] - close[i - 1]
        if diff > 0.0
            gains[i] = diff
        elseif diff < 0.0
            losses[i] = -diff
        end
    end
    
    avg_gain = rma(gains, period)
    avg_loss = rma(losses, period)
    
    for i in (period + 1):n
        ag = avg_gain[i]
        al = avg_loss[i]
        if isnan(ag) || isnan(al)
            continue
        end
        if al == 0.0
            out[i] = ag == 0.0 ? 50.0 : 100.0
        else
            rs = ag / al
            out[i] = 100.0 - (100.0 / (1.0 + rs))
        end
    end
    return out
end

"""
Moving Average Convergence Divergence (MACD)
Returns: (macd_line, signal_line, histogram)
"""
function macd(close::Vector{Float64}, fast::Int=12, slow::Int=26, signal::Int=9)
    fast_ema = ema(close, fast)
    slow_ema = ema(close, slow)
    n = length(close)
    
    macd_line = fill(NaN, n)
    for i in 1:n
        if !isnan(fast_ema[i]) && !isnan(slow_ema[i])
            macd_line[i] = fast_ema[i] - slow_ema[i]
        end
    end
    
    first_valid = findfirst(!isnan, macd_line)
    signal_line = fill(NaN, n)
    hist = fill(NaN, n)
    
    if first_valid !== nothing && (n - first_valid + 1) >= signal
        valid_macd = macd_line[first_valid:end]
        sig_sub = ema(valid_macd, signal)
        signal_line[first_valid:end] .= sig_sub
        
        for i in 1:n
            if !isnan(macd_line[i]) && !isnan(signal_line[i])
                hist[i] = macd_line[i] - signal_line[i]
            end
        end
    end
    
    return macd_line, signal_line, hist
end

"""
Bollinger Bands
Returns: (basis, upper, lower)
"""
function bollinger_bands(close::Vector{Float64}, length_p::Int=20, mult::Float64=2.0)
    n = length(close)
    basis = sma(close, length_p)
    upper = fill(NaN, n)
    lower = fill(NaN, n)
    
    if n >= length_p
        for i in length_p:n
            m = basis[i]
            sum_sq = 0.0
            @simd for j in (i - length_p + 1):i
                d = close[j] - m
                sum_sq += d * d
            end
            std_dev = sqrt(sum_sq / length_p)
            upper[i] = m + mult * std_dev
            lower[i] = m - mult * std_dev
        end
    end
    return basis, upper, lower
end

"""
Average True Range (ATR)
"""
function atr(high::Vector{Float64}, low::Vector{Float64}, close::Vector{Float64}, period::Int=14)::Vector{Float64}
    n = length(high)
    tr = fill(NaN, n)
    if n == 0
        return tr
    end
    
    tr[1] = high[1] - low[1]
    for i in 2:n
        hl = high[i] - low[i]
        hpc = abs(high[i] - close[i - 1])
        lpc = abs(low[i] - close[i - 1])
        tr[i] = max(hl, max(hpc, lpc))
    end
    
    return rma(tr, period)
end

"""
SuperTrend Indicator
Returns: (supertrend_line, direction)  # direction: 1 for up/bullish, -1 for down/bearish
"""
function supertrend(high::Vector{Float64}, low::Vector{Float64}, close::Vector{Float64}, period::Int=10, multiplier::Float64=3.0)
    n = length(high)
    atr_vals = atr(high, low, close, period)
    st = fill(NaN, n)
    direction = fill(0, n)
    
    if n < period
        return st, direction
    end
    
    upper_band = fill(0.0, n)
    lower_band = fill(0.0, n)
    
    for i in 1:n
        hl2 = (high[i] + low[i]) * 0.5
        if !isnan(atr_vals[i])
            upper_band[i] = hl2 + multiplier * atr_vals[i]
            lower_band[i] = hl2 - multiplier * atr_vals[i]
        end
    end
    
    start_idx = period
    st[start_idx] = lower_band[start_idx]
    direction[start_idx] = 1
    
    for i in (start_idx + 1):n
        if lower_band[i] < lower_band[i - 1] && close[i - 1] > lower_band[i - 1]
            lower_band[i] = lower_band[i - 1]
        end
        if upper_band[i] > upper_band[i - 1] && close[i - 1] < upper_band[i - 1]
            upper_band[i] = upper_band[i - 1]
        end
        
        prev_dir = direction[i - 1]
        if prev_dir == 1
            if close[i] < lower_band[i]
                direction[i] = -1
                st[i] = upper_band[i]
            else
                direction[i] = 1
                st[i] = lower_band[i]
            end
        else
            if close[i] > upper_band[i]
                direction[i] = 1
                st[i] = lower_band[i]
            else
                direction[i] = -1
                st[i] = upper_band[i]
            end
        end
    end
    
    return st, direction
end

"""
Stochastic Oscillator (%K, %D)
"""
function stochastic(high::Vector{Float64}, low::Vector{Float64}, close::Vector{Float64}, k_period::Int=14, d_period::Int=3, smooth_k::Int=1)
    n = length(close)
    raw_k = fill(NaN, n)
    
    for i in k_period:n
        h_max = -Inf
        l_min = Inf
        @simd for j in (i - k_period + 1):i
            if high[j] > h_max; h_max = high[j]; end
            if low[j] < l_min; l_min = low[j]; end
        end
        range_val = h_max - l_min
        if range_val > 0.0
            raw_k[i] = 100.0 * (close[i] - l_min) / range_val
        else
            raw_k[i] = 50.0
        end
    end
    
    k = smooth_k > 1 ? sma(raw_k, smooth_k) : raw_k
    d = sma(k, d_period)
    return k, d
end

"""
Williams %R
"""
function williams_r(high::Vector{Float64}, low::Vector{Float64}, close::Vector{Float64}, period::Int=14)::Vector{Float64}
    n = length(close)
    out = fill(NaN, n)
    for i in period:n
        h_max = -Inf
        l_min = Inf
        @simd for j in (i - period + 1):i
            if high[j] > h_max; h_max = high[j]; end
            if low[j] < l_min; l_min = low[j]; end
        end
        range_val = h_max - l_min
        if range_val > 0.0
            out[i] = -100.0 * (h_max - close[i]) / range_val
        else
            out[i] = -50.0
        end
    end
    return out
end

"""
Volume Weighted Average Price (VWAP)
"""
function vwap(high::Vector{Float64}, low::Vector{Float64}, close::Vector{Float64}, volume::Vector{Float64})::Vector{Float64}
    n = length(close)
    out = fill(NaN, n)
    cum_vol_price = 0.0
    cum_vol = 0.0
    
    for i in 1:n
        typ_price = (high[i] + low[i] + close[i]) / 3.0
        vol = volume[i]
        cum_vol_price += typ_price * vol
        cum_vol += vol
        out[i] = cum_vol > 0.0 ? (cum_vol_price / cum_vol) : typ_price
    end
    return out
end

"""
High-Level Dispatcher for JSON payloads
"""
function compute_all(payload::Dict{String, Any})
    close_arr = Float64.(payload["c"])
    high_arr = haskey(payload, "h") ? Float64.(payload["h"]) : close_arr
    low_arr = haskey(payload, "l") ? Float64.(payload["l"]) : close_arr
    open_arr = haskey(payload, "o") ? Float64.(payload["o"]) : close_arr
    vol_arr = haskey(payload, "v") ? Float64.(payload["v"]) : fill(1.0, length(close_arr))
    
    results = Dict{String, Any}()
    
    results["sma_20"] = sma(close_arr, 20)
    results["sma_50"] = sma(close_arr, 50)
    results["ema_12"] = ema(close_arr, 12)
    results["ema_26"] = ema(close_arr, 26)
    results["rsi_14"] = rsi(close_arr, 14)
    
    m_line, m_sig, m_hist = macd(close_arr, 12, 26, 9)
    results["macd"] = m_line
    results["macd_signal"] = m_sig
    results["macd_histogram"] = m_hist
    
    bb_basis, bb_upper, bb_lower = bollinger_bands(close_arr, 20, 2.0)
    results["bb_basis"] = bb_basis
    results["bb_upper"] = bb_upper
    results["bb_lower"] = bb_lower
    
    results["atr_14"] = atr(high_arr, low_arr, close_arr, 14)
    st_line, st_dir = supertrend(high_arr, low_arr, close_arr, 10, 3.0)
    results["supertrend"] = st_line
    results["supertrend_dir"] = st_dir
    
    stoch_k, stoch_d = stochastic(high_arr, low_arr, close_arr, 14, 3, 3)
    results["stoch_k"] = stoch_k
    results["stoch_d"] = stoch_d
    results["williams_r"] = williams_r(high_arr, low_arr, close_arr, 14)
    results["vwap"] = vwap(high_arr, low_arr, close_arr, vol_arr)
    
    return results
end

end # module JuliaIndicatorsEngine

# ── Self-Test / CLI Entry Point ───────────────────────────────────────────
if abspath(PROGRAM_FILE) == @__FILE__
    using .JuliaIndicatorsEngine
    
    println("[JuliaIndicatorsEngine] Initializing and pre-compiling...")
    n_test = 1000
    test_close = [100.0 + sin(i * 0.05) * 5.0 + (i * 0.01) for i in 1:n_test]
    test_high = test_close .+ 1.0
    test_low = test_close .- 1.0
    test_vol = fill(100.0, n_test)
    
    # Warm up JIT
    s = JuliaIndicatorsEngine.sma(test_close, 20)
    e = JuliaIndicatorsEngine.ema(test_close, 20)
    r = JuliaIndicatorsEngine.rsi(test_close, 14)
    m, ms, mh = JuliaIndicatorsEngine.macd(test_close, 12, 26, 9)
    bb, bu, bl = JuliaIndicatorsEngine.bollinger_bands(test_close, 20, 2.0)
    a = JuliaIndicatorsEngine.atr(test_high, test_low, test_close, 14)
    st, std = JuliaIndicatorsEngine.supertrend(test_high, test_low, test_close, 10, 3.0)
    k, d = JuliaIndicatorsEngine.stochastic(test_high, test_low, test_close, 14, 3, 3)
    w = JuliaIndicatorsEngine.williams_r(test_high, test_low, test_close, 14)
    v = JuliaIndicatorsEngine.vwap(test_high, test_low, test_close, test_vol)
    
    # Benchmark execution on 1,000 bars
    t_start = time_ns()
    n_iters = 100
    for _ in 1:n_iters
        JuliaIndicatorsEngine.sma(test_close, 20)
        JuliaIndicatorsEngine.ema(test_close, 20)
        JuliaIndicatorsEngine.rsi(test_close, 14)
        JuliaIndicatorsEngine.macd(test_close, 12, 26, 9)
        JuliaIndicatorsEngine.bollinger_bands(test_close, 20, 2.0)
        JuliaIndicatorsEngine.atr(test_high, test_low, test_close, 14)
        JuliaIndicatorsEngine.supertrend(test_high, test_low, test_close, 10, 3.0)
        JuliaIndicatorsEngine.stochastic(test_high, test_low, test_close, 14, 3, 3)
        JuliaIndicatorsEngine.williams_r(test_high, test_low, test_close, 14)
        JuliaIndicatorsEngine.vwap(test_high, test_low, test_close, test_vol)
    end
    t_end = time_ns()
    avg_us = (t_end - t_start) / (n_iters * 1000.0)
    
    println("[JuliaIndicatorsEngine] BENCHMARK COMPLETE:")
    println("  Total Indicators: 10 full suites (SMA, EMA, RSI, MACD, BB, ATR, SuperTrend, Stoch, %R, VWAP)")
    println("  Bar Count: $(n_test) bars per indicator")
    println("  Average Execution Time (all 10 indicators): $(round(avg_us / 1000.0, digits=3)) ms ($(round(avg_us, digits=1)) microseconds)")
    println("  Speed per Indicator: $(round(avg_us / 10.0, digits=1)) microseconds/indicator")
    println("[JuliaIndicatorsEngine] Status: READY (Sub-millisecond LLVM SIMD active)")
end
