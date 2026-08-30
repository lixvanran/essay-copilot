@echo off
setlocal EnableExtensions

REM ==============================================================
REM   Stop dev server (fallback cleanup)
REM   v4 - 去掉中文 + 去掉 netstat/findstr
REM   Pure ASCII, no BOM, no chcp
REM ==============================================================

cd /d "%~dp0"

echo.
echo Stopping Zuowen Co-Pilot...
echo.

REM Try PID file first
if exist "%TEMP%\zcf-dev.pid" (
    for /f "usebackq" %%P in ("%TEMP%\zcf-dev.pid") do (
        echo   stopping PID %%P
        taskkill /F /PID %%P >nul 2>&1
    )
    del "%TEMP%\zcf-dev.pid" >nul 2>&1
)

REM Try tasklist + find (Win95+ 都有) to find next dev
echo   cleaning next dev / next-server processes...
for /f "tokens=2" %%P in ('tasklist /FI "IMAGENAME eq node.exe" 2^>nul ^| find "node.exe"') do (
    echo     stopping node.exe PID %%P
    taskkill /F /PID %%P >nul 2>&1
)

echo.
echo Done.
echo.
echo Tip: If you started the server, just press Ctrl+C in that window.
echo       This script is fallback cleanup only.
echo.
pause
endlocal
exit /b 0
