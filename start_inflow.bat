@echo off
title Trax Inflow Monitor (Deno RPH > 60)
cd /d "%~dp0"
:loop
echo ===================================================
echo   Starting Trax Inflow Telegram Alert Monitor
echo   Filtering: Google Sheet (Deno RPH > 60)
echo   [Continuous Mode - Auto-Restart Enabled]
echo ===================================================
node src/inflow_feeder.js
echo.
echo [!] Inflow Monitor stopped or crashed. Auto-restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
