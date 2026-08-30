@echo off
setlocal EnableExtensions

REM ==============================================================
REM   Zuowen Co-Pilot - One-Click Launcher
REM   v6 - 极简化：只调 node start.js，不直接碰 npm
REM   所有复杂度都收敛到 start.js
REM   Pure ASCII, no BOM, no chcp
REM ==============================================================

cd /d "%~dp0"

REM 检查 node 在不在 PATH（最少的依赖）
where /Q node 2>nul
if errorlevel 1 (
    echo.
    echo [ERROR] Node.js not found in PATH.
    echo Install from https://nodejs.org/ ^(LTS^)
    echo During install, check "Add to PATH"
    echo Then close this window and run the launcher again.
    echo.
    pause
    exit /b 1
)

REM 唯一关键动作：调 node start.js
REM 错误会被 start.js 自己处理（里面有 try/catch）
echo Starting Zuowen Co-Pilot via node start.js...
echo.
node start.js
set "EX=%errorlevel%"

echo.
echo ============================================================
if %EX% NEQ 0 (
    echo   [ERROR] start.js exited with code %EX%
    echo.
    echo   If you saw "Welcome to Node.js" before errors,
    echo   your .bat file is associated with Node REPL, not cmd.
    echo   Fix: right-click the launcher .bat ^> Open With ^> Command Prompt
    echo   Or just run manually in cmd:
    echo       cd /d "%~dp0"
    echo       node start.js
    echo ============================================================
) else (
    echo   Server stopped cleanly.
)
echo.
pause
endlocal
exit /b %EX%
