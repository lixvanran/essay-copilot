#!/bin/bash
# ===========================================
#   Stop dev server (fallback cleanup)
#   v4 - 去掉中文（之前含"启动.sh"引用）
#   macOS / Linux
# ===========================================

cd "$(dirname "$0")"

echo
echo "Stopping Zuowen Co-Pilot..."
echo

# Try PID file first
if [ -f /tmp/zcf-dev.pid ]; then
    PID=$(cat /tmp/zcf-dev.pid 2>/dev/null)
    if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
        echo "  stopping PID $PID"
        kill "$PID" 2>/dev/null || true
        sleep 1
        kill -9 "$PID" 2>/dev/null || true
    fi
    rm -f /tmp/zcf-dev.pid
fi

# Port-based kill
if command -v lsof >/dev/null 2>&1; then
    PIDS=$(lsof -ti:3000 2>/dev/null || true)
    if [ -n "$PIDS" ]; then
        echo "  stopping port 3000: $PIDS"
        echo "$PIDS" | xargs kill -9 2>/dev/null || true
    fi
fi

if command -v fuser >/dev/null 2>&1; then
    fuser -k 3000/tcp 2>/dev/null || true
fi

# Fallback
pkill -f "next dev" 2>/dev/null || true
pkill -f "next-server" 2>/dev/null || true

echo
echo "Done."
echo
echo "Tip: If you started the server, just press Ctrl+C in that terminal."
echo "      This script is fallback cleanup only."
echo
