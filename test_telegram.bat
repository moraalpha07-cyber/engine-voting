@echo off
title Test Telegram Notification
cd /d "%~dp0"
echo ====================================================
echo   Testing Telegram Notification
echo ====================================================
echo.
node src/test_telegram.js
pause
