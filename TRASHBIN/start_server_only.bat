@echo off
setlocal enabledelayedexpansion
cd /d "%~dp0"
chcp 65001 >nul
title MT5 Python Backend Server [Port 9000]

echo ================================================================================
echo   MT5 PYTHON BACKEND SERVER (Port 9000)
echo ================================================================================
python server.py
