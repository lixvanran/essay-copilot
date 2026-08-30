#!/bin/bash
# ===========================================
#   Diagnostic - saves report to file
#   v4 - 去掉 powershell 风格代码（保持 sh 原生）
#   macOS / Linux
# ===========================================

cd "$(dirname "$0")"

REPORT="diagnose.txt"

echo "Saving diagnostic to $REPORT..."

{
    echo "============================================"
    echo "  Diagnostic Report"
    echo "  $(date)"
    echo "============================================"
    echo
    echo "--- Working Dir ---"
    pwd
    echo
    echo "--- System ---"
    uname -a 2>/dev/null || echo "unknown"
    echo
    echo "--- Node.js ---"
    if command -v node >/dev/null 2>&1; then
        node --version
    else
        echo "node: NOT FOUND"
    fi
    if command -v npm >/dev/null 2>&1; then
        npm --version
    else
        echo "npm: NOT FOUND"
    fi
    echo "npm config:"
    npm config get registry 2>/dev/null
    echo
    echo "--- Port 3000 ---"
    if command -v lsof >/dev/null 2>&1; then
        lsof -i:3000 2>/dev/null || echo "  (port 3000 free)"
    else
        netstat -ano 2>/dev/null | grep ":3000" || echo "  (netstat not available)"
    fi
    echo
    echo "--- Project files ---"
    ls -1
    echo
    echo "--- Dependencies ---"
    if [ -d "node_modules" ]; then
        echo "node_modules: OK ($(du -sh node_modules 2>/dev/null | cut -f1))"
    else
        echo "node_modules: MISSING"
    fi
    if [ -f "package.json" ]; then
        echo "package.json: OK"
    else
        echo "package.json: MISSING"
    fi
    echo
    echo "--- Environment ---"
    if [ -f ".env.local" ]; then
        echo ".env.local: exists"
        if grep -q "OPENROUTER_API_KEY" .env.local 2>/dev/null; then
            if grep -q "your-key-here" .env.local 2>/dev/null; then
                echo "  OPENROUTER_API_KEY: SET TO PLACEHOLDER (edit to use real key)"
            else
                echo "  OPENROUTER_API_KEY: SET"
            fi
        else
            echo "  OPENROUTER_API_KEY: NOT SET"
        fi
    else
        echo ".env.local: MISSING"
    fi
    if [ -f ".env.example" ]; then
        echo ".env.example: exists"
    else
        echo ".env.example: MISSING"
    fi
    echo
    echo "--- Recent dev log (last 20 lines) ---"
    if [ -f /tmp/zcf-dev.log ]; then
        tail -20 /tmp/zcf-dev.log
    else
        echo "no dev log found at /tmp/zcf-dev.log"
    fi
    echo
    echo "--- API self-test (if server is running) ---"
    if [ -d "node_modules" ]; then
        echo "Testing /api/analyze endpoint..."
        if command -v curl >/dev/null 2>&1; then
            HTTP=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 \
                -X POST -H "Content-Type: application/json" \
                -d '{}' http://localhost:3000/api/analyze 2>&1) || true
            if [ -n "$HTTP" ] && [ "$HTTP" != "000" ]; then
                echo "  HTTP $HTTP"
            else
                echo "  Server not responding (HTTP $HTTP)"
            fi
        else
            echo "  curl not available, skipping HTTP test"
        fi
    else
        echo "  Skipped (no node_modules)"
    fi
} > "$REPORT" 2>&1

echo
echo "Done. Report: $(pwd)/$REPORT"
echo
echo "Please send this file to support."
echo
