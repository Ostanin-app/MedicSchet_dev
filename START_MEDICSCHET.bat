@echo off
title MedicSchet - local server (DO NOT CLOSE)
cd /d "%~dp0"
chcp 65001 >nul

echo.
echo   MedicSchet - local dev server
echo.
echo   Address: http://127.0.0.1:8765/index.html
echo   Browser opens automatically in a moment.
echo   If not - copy the address above into the browser.
echo.
echo   Do NOT open index.html by double-click.
echo   Keep this window OPEN while working.
echo   To stop the server: close this window.
echo.

start "" http://127.0.0.1:8765/index.html
python -m http.server 8765 --bind 127.0.0.1

echo.
echo Server stopped.
pause
