@echo off
title Masking Firebase Feeder
cd /d "%~dp0"
:loop
echo ====================================================
echo   Starting Masking Firebase Feeder (Continuous Mode)
echo   [Continuous Mode - Auto-Restart Enabled]
echo ====================================================
node src/masking_feeder.js
echo.
echo [!] Masking Feeder stopped or crashed. Auto-restarting in 5 seconds...
timeout /t 5 /nobreak >nul
goto loop
