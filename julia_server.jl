using Sockets

# Include the fast indicators engine
include("indicators_engine.jl")
using .JuliaIndicatorsEngine

const PORT = 8085
const HOST = IPv4("127.0.0.1")

function json_serialize_array(arr::Vector{Float64})
    io = IOBuffer()
    write(io, "[")
    n = length(arr)
    for i in 1:n
        v = arr[i]
        if isnan(v) || isinf(v)
            write(io, "null")
        else
            # 6 decimal places for high precision
            Base.print(io, round(v, digits=6))
        end
        if i < n
            write(io, ",")
        end
    end
    write(io, "]")
    return String(take!(io))
end

function json_serialize_dict(dict::Dict{String, Any})
    io = IOBuffer()
    write(io, "{")
    first = true
    for (k, v) in dict
        if !first
            write(io, ",")
        end
        first = false
        write(io, "\"", k, "\":")
        if v isa Vector{Float64}
            write(io, json_serialize_array(v))
        elseif v isa Vector{Int}
            write(io, "[", join(v, ","), "]")
        elseif v isa Number
            if isnan(v) || isinf(v)
                write(io, "null")
            else
                write(io, string(v))
            end
        elseif v isa String
            write(io, "\"", escape_string(v), "\"")
        else
            write(io, "\"", string(v), "\"")
        end
    end
    write(io, "}")
    return String(take!(io))
end

# Simple fast parser for numbers in JSON arrays "[1.2, 3.4, ...]"
function parse_float_array(str::AbstractString)::Vector{Float64}
    out = Float64[]
    s = strip(str)
    if startswith(s, "[") && endswith(s, "]")
        s = s[2:end-1]
    end
    for part in split(s, ",")
        p = strip(part)
        if !isempty(p)
            val = tryparse(Float64, p)
            push!(out, val === nothing ? NaN : val)
        end
    end
    return out
end

function parse_simple_json(body::String)::Dict{String, Any}
    res = Dict{String, Any}()
    # Match basic key-value patterns: "key": [...] or "key": 123 or "key": "abc"
    for m in eachmatch(r"\"([^\"]+)\"\s*:\s*(\[[^\]]*\]|\"[^\"]*\"|[-+0-9.eE]+|true|false|null)", body)
        k = m.captures[1]
        raw_val = strip(m.captures[2])
        if startswith(raw_val, "[") && endswith(raw_val, "]")
            res[k] = parse_float_array(raw_val)
        elseif startswith(raw_val, "\"") && endswith(raw_val, "\"")
            res[k] = raw_val[2:end-1]
        elseif raw_val in ("true", "false")
            res[k] = raw_val == "true"
        elseif raw_val == "null"
            res[k] = nothing
        else
            f = tryparse(Float64, raw_val)
            res[k] = f !== nothing ? f : raw_val
        end
    end
    return res
end

function handle_client(sock)
    try
        # Read HTTP Request
        request_line = readline(sock)
        if isempty(request_line)
            close(sock)
            return
        end
        parts = split(request_line, " ")
        if length(parts) < 2
            close(sock)
            return
        end
        method = parts[1]
        target = parts[2]
        
        # Read Headers
        headers = Dict{String, String}()
        content_len = 0
        while true
            line = readline(sock)
            if isempty(line) || line == "\r"
                break
            end
            h_parts = split(line, ":", limit=2)
            if length(h_parts) == 2
                k = lowercase(strip(h_parts[1]))
                v = strip(h_parts[2])
                headers[k] = v
                if k == "content-length"
                    content_len = parse(Int, v)
                end
            end
        end
        
        # Read Body if POST
        body = ""
        if content_len > 0
            body = String(read(sock, content_len))
        end
        
        # Handle CORS OPTIONS
        if method == "OPTIONS"
            response = "HTTP/1.1 204 No Content\r\n" *
                       "Access-Control-Allow-Origin: *\r\n" *
                       "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n" *
                       "Access-Control-Allow-Headers: *\r\n\r\n"
            write(sock, response)
            close(sock)
            return
        end
        
        # Route
        path_only = split(target, "?")[1]
        
        if path_only in ("/", "/health")
            resp_json = "{\"status\":\"ok\",\"engine\":\"Julia LLVM SIMD Engine v1.13.0\",\"port\":$(PORT)}"
            resp = "HTTP/1.1 200 OK\r\n" *
                   "Content-Type: application/json; charset=utf-8\r\n" *
                   "Access-Control-Allow-Origin: *\r\n" *
                   "Content-Length: $(sizeof(resp_json))\r\n\r\n" * resp_json
            write(sock, resp)
            close(sock)
            return
        end
        
        if path_only in ("/compute", "/julia/compute")
            t_start = time_ns()
            payload = parse_simple_json(body)
            
            # If empty payload or test GET, provide default synthetic result
            c_data = get(payload, "c", Float64[])
            if isempty(c_data)
                c_data = get(payload, "close", Float64[])
            end
            
            if isempty(c_data)
                # Quick test benchmark data (500 bars)
                c_data = [100.0 + sin(i * 0.05) * 5.0 for i in 1:500]
                payload["c"] = c_data
            end
            
            # Execute compute
            results = JuliaIndicatorsEngine.compute_all(payload)
            t_duration_us = (time_ns() - t_start) / 1000.0
            
            results["engine"] = "Julia LLVM SIMD Engine v1.13.0"
            results["duration_us"] = round(t_duration_us, digits=2)
            results["bar_count"] = length(c_data)
            
            resp_json = json_serialize_dict(results)
            resp = "HTTP/1.1 200 OK\r\n" *
                   "Content-Type: application/json; charset=utf-8\r\n" *
                   "Access-Control-Allow-Origin: *\r\n" *
                   "Content-Length: $(sizeof(resp_json))\r\n\r\n" * resp_json
            write(sock, resp)
            close(sock)
            return
        end
        
        # 404 Not Found
        not_found = "{\"error\":\"Not Found\"}"
        resp = "HTTP/1.1 404 Not Found\r\n" *
               "Content-Type: application/json\r\n" *
               "Access-Control-Allow-Origin: *\r\n" *
               "Content-Length: $(sizeof(not_found))\r\n\r\n" * not_found
        write(sock, resp)
        close(sock)
    catch e
        try
            err_json = "{\"error\":\"$(escape_string(string(e)))\"}"
            resp = "HTTP/1.1 500 Internal Server Error\r\n" *
                   "Content-Type: application/json\r\n" *
                   "Access-Control-Allow-Origin: *\r\n" *
                   "Content-Length: $(sizeof(err_json))\r\n\r\n" * err_json
            write(sock, resp)
            close(sock)
        catch
        end
    end
end

println("[JuliaServer] Pre-warming LLVM JIT for indicators engine...")
# Warm up JIT
dummy_c = [100.0 + sin(i * 0.05) for i in 1:200]
dummy_payload = Dict{String, Any}("c" => dummy_c)
JuliaIndicatorsEngine.compute_all(dummy_payload)

server = listen(HOST, PORT)
println("[JuliaServer] Listening on http://127.0.0.1:$(PORT)")
println("[JuliaServer] Endpoints: GET /health, POST /compute (LLVM SIMD Sub-millisecond)")

while true
    sock = accept(server)
    @async handle_client(sock)
end
