@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
chcp 65001 >nul

title TradingView Advanced Charts Enterprise System

echo.
echo ================================================================================
echo   TRADINGVIEW ADVANCED CHARTS ENTERPRISE SYSTEM
echo ================================================================================
echo   [STEP 1/2] SELECT BROKER / DATAFEED BACKEND:
echo.
echo     [1] MetaTrader 5 (Local Terminal64 IPC / Orbex Global) - [DEFAULT]
echo     [2] OANDA v20 REST API (Practice Account: 101-001-40395350-001)
echo.
echo ================================================================================
set "BROKER_CHOICE=1"
set /p "BROKER_CHOICE=Enter broker choice [1=MT5, 2=OANDA, default: 1]: "
if "%BROKER_CHOICE%"=="" set "BROKER_CHOICE=1"

if /i "%BROKER_CHOICE%"=="2" goto :set_oanda
if /i "%BROKER_CHOICE%"=="oanda" goto :set_oanda
if /i "%BROKER_CHOICE%"=="o" goto :set_oanda

set "BROKER_BACKEND=MT5"
set "BACKEND_LABEL=MetaTrader 5 IPC (Terminal64 / Orbex Global)"
goto :done_broker

:set_oanda
set "BROKER_BACKEND=OANDA"
set "OANDA_ACCOUNT_ID=101-001-40395350-001"
set "OANDA_API_TOKEN=f2be2aaf1443ae8071a5982196c9e217-13d1b5a73efca27fd1c07b068bdd0832"
set "BACKEND_LABEL=OANDA v20 REST API (101-001-40395350-001)"

:done_broker

echo.
echo ================================================================================
echo   [STEP 2/2] SELECT PRICE TYPE (FOR CANDLES, TICKS ^& QUOTES):
echo.
echo     [1] Mid price (Standard / Average of Bid ^& Ask) - [DEFAULT]
echo     [2] Bid price (Sell rate / Traditional MT5 OHLC)
echo     [3] Ask price (Buy rate)
echo.
echo ================================================================================
set "PRICE_CHOICE=1"
set /p "PRICE_CHOICE=Enter price type [1=Mid, 2=Bid, 3=Ask, default: 1]: "
if "%PRICE_CHOICE%"=="" set "PRICE_CHOICE=1"

if /i "%PRICE_CHOICE%"=="2" goto :set_bid
if /i "%PRICE_CHOICE%"=="bid" goto :set_bid
if /i "%PRICE_CHOICE%"=="b" goto :set_bid

if /i "%PRICE_CHOICE%"=="3" goto :set_ask
if /i "%PRICE_CHOICE%"=="ask" goto :set_ask
if /i "%PRICE_CHOICE%"=="a" goto :set_ask

set "PRICE_TYPE=MID"
set "PRICE_LABEL=Mid Price (Average)"
goto :done_price

:set_bid
set "PRICE_TYPE=BID"
set "PRICE_LABEL=Bid Price (Sell)"
goto :done_price

:set_ask
set "PRICE_TYPE=ASK"
set "PRICE_LABEL=Ask Price (Buy)"
goto :done_price

:done_price

title TradingView Advanced Charts [%BROKER_BACKEND% - %PRICE_TYPE%]

echo.
echo ================================================================================
echo   ACTIVE CONFIGURATION: %BACKEND_LABEL%
echo   PRICE TYPE:           %PRICE_LABEL% (%PRICE_TYPE%)
echo ================================================================================
echo   App URL (Proxy):   http://127.0.0.1:9999 (Interactive TradingView Chart UI)
echo   Website URL:       http://localhost:9000 (Static Server ^& Bundles)
echo   Python Backend:    http://127.0.0.1:8080 (FastAPI + %BACKEND_LABEL%)
echo   Julia Accelerator: http://127.0.0.1:8085 (High-Performance Indicators)
echo   WebSocket Stream:  ws://127.0.0.1:9999/ws/quotes (Real-Time Tick Streaming)
echo   Logs Directory:    %~dp0logs\
echo ================================================================================
echo.

:: Ensure logs directory exists
if not exist "%~dp0logs" mkdir "%~dp0logs"

:: Step 1: Pre-flight cleanup and port release
echo [1/5] Releasing ports and terminating stale instances...
call "%~dp0kill_services.bat" >nul 2>&1
echo   [OK] Target ports 9000, 9999, 8080, 8085 released cleanly.
echo.

:: Step 2: Check Broker and Acceleration Core
if /I "!BROKER_BACKEND!"=="OANDA" (
    echo [2/5] OANDA API mode active.
    echo   [OK] OANDA Account: %OANDA_ACCOUNT_ID% [Practice Server]
) else (
    echo [2/5] Checking MetaTrader 5 terminal status...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$proc = Get-Process terminal64 -ErrorAction SilentlyContinue; " ^
        "if ($proc) { " ^
        "    Write-Host ('  [OK] MetaTrader 5 terminal is active (PID: ' + $proc.Id + ')') -ForegroundColor Green; " ^
        "} else { " ^
        "    Write-Host '  [WARN] MetaTrader 5 terminal (terminal64.exe) not detected!' -ForegroundColor Yellow; " ^
        "    Write-Host '  [INFO] Please ensure MT5 is running and logged in for live streaming.' -ForegroundColor Cyan; " ^
        "}"
)
if exist "%~dp0fast_engine.dll" (
    echo   [OK] Native C++ AVX2 Acceleration Engine [fast_engine.dll] is active.
) else (
    echo   [INFO] fast_engine.dll not found - using Python fallback engine.
)
echo.

:: Step 3: Launch Julia Acceleration Server (if available)
echo [3/5] Initializing Indicator Acceleration Engine...
where julia >nul 2>&1
if %ERRORLEVEL% equ 0 (
    if exist "%~dp0julia_server.jl" (
        start /B julia "%~dp0julia_server.jl" > "%~dp0logs\julia_out.log" 2> "%~dp0logs\julia_err.log"
        echo   [OK] Julia Indicator Acceleration Server launched on port 8085.
    ) else (
        echo   [INFO] julia_server.jl not found; using Python indicator engine.
    )
) else (
    echo   [INFO] Julia runtime not detected; using high-performance Python engine.
)
echo.

:: Step 4: Launch Python Backend and Health Gate
echo [4/5] Launching Python Backend (!BACKEND_LABEL!) on port 8080...
if /I "!BROKER_BACKEND!"=="OANDA" (
    start /B python -m uvicorn server_oanda:app --host 0.0.0.0 --port 8080 --log-level warning --no-access-log > "%~dp0logs\backend_out.log" 2> "%~dp0logs\backend_err.log"
    echo   [INFO] Using OANDA-dedicated server ^(server_oanda.py^).
) else (
    start /B python -m uvicorn server:app --host 0.0.0.0 --port 8080 --log-level warning --no-access-log > "%~dp0logs\backend_out.log" 2> "%~dp0logs\backend_err.log"
    echo   [INFO] Using MT5-dedicated server ^(server.py^).
)

:: Readiness probe (polling http://127.0.0.1:8080/config up to 15 seconds)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ready = $false; " ^
    "for ($i = 0; $i -lt 30; $i++) { " ^
    "    try { " ^
    "        $r = Invoke-WebRequest -Uri 'http://127.0.0.1:8080/config' -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop; " ^
    "        if ($r.StatusCode -eq 200) { $ready = $true; break; } " ^
    "    } catch {} " ^
    "    Start-Sleep -Milliseconds 500; " ^
    "} " ^
    "if ($ready) { " ^
    "    Write-Host '  [OK] Python Backend is ready and responding on port 8080.' -ForegroundColor Green; " ^
    "} else { " ^
    "    Write-Host '  [WARN] Python Backend taking longer to initialize; continuing...' -ForegroundColor Yellow; " ^
    "}"
echo.

:: Step 5: Launch Browser then Start Node.js Engine (FOREGROUND keeps window alive)
echo [5/5] Starting Node.js Engine (Website: 9000, Proxy: 9999)...
start "" http://127.0.0.1:9999
echo.
echo ================================================================================
echo   TRADINGVIEW ADVANCED CHARTS IS RUNNING!
echo   App URL: http://127.0.0.1:9999
echo   Press [Ctrl+C] in this window to stop all services cleanly.
echo ================================================================================
echo.

node frontend_server.js

:: Node exited (user pressed Ctrl+C or process ended) -- clean up
echo.
echo [INFO] Shutting down all background services...
call "%~dp0kill_services.bat" >nul 2>&1
echo [OK] All services terminated cleanly.