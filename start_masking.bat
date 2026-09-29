@echo off
title Masking Firebase Feeder
cd /d "%~dp0"
echo ====================================================
echo   Starting Masking Firebase Feeder (Continuous Mode)
echo ====================================================
echo.
npm.cmd run dev
pause
