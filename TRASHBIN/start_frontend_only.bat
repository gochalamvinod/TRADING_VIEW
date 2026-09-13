@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
chcp 65001 >nul
title TradingView Node.js Frontend & Proxy [Port 8080]

echo ================================================================================
echo   TRADINGVIEW NODE.JS FRONTEND & PROXY SERVER (Port 8080)
echo ================================================================================
node frontend_server.js
