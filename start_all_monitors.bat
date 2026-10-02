@echo off
title Trax Monitors Launcher
cd /d "%~dp0"

echo ====================================================
echo   Launching Both Trax Telegram Monitors:
echo   1. Masking Drops Monitor  -> @NestPT
echo   2. Inflow Monitor         -> -1004486777652
echo ====================================================

start "1. Masking Drops Feeder (@NestPT)" cmd /k "start_masking.bat"
start "2. Inflow Monitor (-1004486777652)" cmd /k "start_inflow.bat"

echo.
echo Both monitors have been started in separate windows!
echo You can minimize this window.
timeout /t 5
