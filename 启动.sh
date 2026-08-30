#!/bin/bash
# ===========================================
#   作文副驾驶 (Style Co-Pilot) - One-Click Launcher
#   v4 - 与 .bat 对齐：单窗口前台模式，去掉所有可选外部命令
#   macOS / Linux
# ===========================================

cd "$(dirname "$0")"

echo
echo "============================================"
echo "  Zuowen Co-Pilot v0.1"
echo "============================================"
echo
echo "Working dir: $(pwd)"
echo

# ===== Step 1: Node =====
echo "[1/4] Checking node..."
if ! command -v node >/dev/null 2>&1; then
    echo
    echo "[ERROR] Node.js not found"
    echo
    echo "Install from https://nodejs.org/ (LTS version)"
    echo "On macOS: brew install node"
    echo "On Ubuntu: sudo apt install nodejs npm"
    echo
    read -p "Press Enter to close..."
    exit 1
fi
echo "     OK ($(node --version))"

# ===== Step 2: npm =====
echo "[2/4] Checking npm..."
if ! command -v npm >/dev/null 2>&1; then
    echo
    echo "[ERROR] Node.js was found but npm was not."
    echo "Reinstall Node.js from https://nodejs.org/ (LTS)"
    echo
    read -p "Press Enter to close..."
    exit 1
fi
echo "     OK ($(npm --version))"

# ===== Step 3: Dependencies =====
echo "[3/4] Checking dependencies..."
if [ ! -d "node_modules/next" ]; then
    echo "     Installing (this may take a few minutes)..."
    if ! npm install --no-audit --no-fund --ignore-scripts; then
        echo
        echo "[ERROR] npm install failed. Try running it manually:"
        echo "  npm install"
        echo
        read -p "Press Enter to close..."
        exit 1
    fi
fi
echo "     OK"

# ===== Step 4: .env =====
echo "[4/4] Checking config..."
if [ ! -f ".env.local" ] && [ ! -f ".env" ]; then
    if [ -f ".env.example" ]; then
        echo "     Creating .env.local from template"
        cp .env.example .env.local
    fi
fi
if [ -f ".env.local" ]; then
    if grep -q "OPENROUTER_API_KEY" .env.local 2>/dev/null && ! grep -q "your-key-here" .env.local 2>/dev/null; then
        echo "     OK"
    else
        echo "     WARN: OPENROUTER_API_KEY not set or still placeholder"
        echo "     Edit .env.local to set a real key"
    fi
else
    echo "     WARN: No .env.local found"
    echo "     Create .env.local with: OPENROUTER_API_KEY=sk-or-v1-..."
fi

echo
echo "============================================"
echo "  Starting dev server on port 3000..."
echo "  Once you see 'Ready', open http://localhost:3000"
echo "  Press Ctrl+C in this window to stop the server"
echo "============================================"
echo

# v4 关键：前台直接跑 npm run dev
# 终端被 npm 接管，所有日志实时可见
npm run dev
EXITCODE=$?

echo
echo "============================================"
echo "  Server stopped (exit code $EXITCODE)"
echo "============================================"
read -p "Press Enter to close..."
exit $EXITCODE
