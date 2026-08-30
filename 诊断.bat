@echo off
setlocal EnableExtensions

REM ==============================================================
REM   Diagnostic - saves report to file
REM   v4 - 去掉 powershell / netstat / findstr
REM   Pure ASCII, no BOM, no chcp
REM   全部用 cmd 内置 + Win95+ 必备命令
REM ==============================================================

cd /d "%~dp0"

set REPORT=diagnose.txt

echo Saving diagnostic to %REPORT%...

(
    echo ============================================
    echo   Diagnostic Report
    echo   %DATE% %TIME%
    echo ============================================
    echo.
    echo --- Working Dir ---
    echo %CD%
    echo.
    echo --- System ---
    ver
    echo.
    echo --- Node.js ---
    where node 2^>nul
    if errorlevel 1 (
        echo node: NOT FOUND
    ) else (
        node --version
    )
    where npm 2^>nul
    if errorlevel 1 (
        echo npm: NOT FOUND
    ) else (
        npm --version
    )
    echo npm config:
    npm config get registry 2^>nul
    echo.
    echo --- Project files ---
    dir /b
    echo.
    echo --- Dependencies ---
    if exist "node_modules" (
        echo node_modules: OK
    ) else (
        echo node_modules: MISSING
    )
    if exist "package.json" (
        echo package.json: OK
    ) else (
        echo package.json: MISSING
    )
    echo.
    echo --- Environment ---
    if exist ".env.local" (
        echo .env.local: exists
        find /C "OPENROUTER_API_KEY" .env.local ^>nul 2^>nul
        if errorlevel 1 (
            echo   OPENROUTER_API_KEY: NOT SET
        ) else (
            find /C "your-key-here" .env.local ^>nul 2^>nul
            if errorlevel 1 (
                echo   OPENROUTER_API_KEY: SET
            ) else (
                echo   OPENROUTER_API_KEY: SET TO PLACEHOLDER
            )
        )
    ) else (
        echo .env.local: MISSING
    )
    if exist ".env.example" (
        echo .env.example: exists
    ) else (
        echo .env.example: MISSING
    )
    echo.
    echo --- API self-test (if server is running) ---
    if exist "node_modules" (
        echo Testing /api/analyze endpoint...
        where /Q curl 2^>nul
        if errorlevel 1 (
            echo   curl not available, skipping HTTP test
        ) else (
            curl -s -o nul -w "  HTTP %%{http_code}" --max-time 5 -X POST -H "Content-Type: application/json" -d "{}" http://localhost:3000/api/analyze 2^>nul
            echo.
        )
    ) else (
        echo Skipped (no node_modules)
    )
) > "%REPORT%" 2>&1

echo.
echo Done. Report: %CD%\%REPORT%
echo.
echo Please send this file to support.
echo.
pause
endlocal
exit /b 0
