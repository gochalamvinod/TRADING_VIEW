@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
title Terminating TradingView Services...

echo ========================================================================
echo   Terminating Services on Ports 9000, 8080, 8081, 8888...
echo ========================================================================

:: 1. Precise kernel-level listener termination via PowerShell (Strict Listen state only)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "$ports = @(9000, 9999, 8080, 8085, 8081, 8888); " ^
    "$conns = Get-NetTCPConnection -LocalPort $ports -State Listen -ErrorAction SilentlyContinue; " ^
    "if ($conns) { " ^
    "    $pids = $conns | Select-Object -ExpandProperty OwningProcess -Unique; " ^
    "    foreach ($p in $pids) { " ^
    "        if ($p -gt 0 -and $p -ne $PID) { " ^
    "            try { " ^
    "                $proc = Get-Process -Id $p -ErrorAction SilentlyContinue; " ^
    "                if ($proc -and $proc.ProcessName -like '*terminal*') { " ^
    "                    Write-Host ('  [PROTECT] Preserving MetaTrader 5 (PID: ' + $p + ')') -ForegroundColor Cyan; " ^
    "                    continue; " ^
    "                } " ^
    "                $pname = if ($proc) { $proc.ProcessName } else { 'process' }; " ^
    "                Write-Host ('  [KILL] Terminating ' + $pname + ' (PID: ' + $p + ')...') -ForegroundColor Yellow; " ^
    "                Stop-Process -Id $p -Force -ErrorAction SilentlyContinue; " ^
    "            } catch {} " ^
    "        } " ^
    "    } " ^
    "} else { " ^
    "    Write-Host '  [INFO] No active listeners detected on target ports.' -ForegroundColor Gray; " ^
    "}"

:: 2. Fail-safe cmd fallback with Process Tree Kill (/T) strictly filtering for LISTENING sockets
for /f "tokens=5" %%a in ('netstat -aon 2^>nul ^| findstr ":9000 :9999 :8080 :8085 :8081 :8888" ^| findstr "LISTENING"') do (
    if not "%%a"=="0" (
        set "IS_MT5="
        for /f "tokens=1" %%m in ('tasklist /FI "PID eq %%a" 2^>nul ^| findstr /I "terminal"') do (
            set "IS_MT5=1"
        )
        if not defined IS_MT5 (
            taskkill /F /T /PID %%a >nul 2>&1
        ) else (
            echo   [PROTECT] Skipping MetaTrader 5 PID %%a
        )
    )
)

:: 3. Port release verification loop (polls up to 3 seconds until all ports are released)
echo   Verifying port release...
for /L %%i in (1,1,10) do (
    set "STILL_LISTENING="
    for /f "tokens=5" %%p in ('netstat -aon 2^>nul ^| findstr ":9000 :9999 :8080 :8085 :8081 :8888" ^| findstr "LISTENING"') do (
        set "STILL_LISTENING=%%p"
    )
    if not defined STILL_LISTENING (
        goto :cleanup_done
    )
    powershell -NoProfile -Command "Start-Sleep -Milliseconds 300"
)

:cleanup_done
:: Final check
set "REMAINING_PORTS="
for /f "tokens=2,5" %%p in ('netstat -aon 2^>nul ^| findstr ":9000 :9999 :8080 :8085 :8081 :8888" ^| findstr "LISTENING"') do (
    set "REMAINING_PORTS=!REMAINING_PORTS! %%p[PID:%%q]"
)
if defined REMAINING_PORTS (
    echo   [WARN] Sockets still bound: !REMAINING_PORTS!
) else (
    echo   [OK] Target ports 9000, 9999, 8080, 8081, 8888 are clear and released.
)
echo ========================================================================
echo   Cleanup Complete.
echo ========================================================================
