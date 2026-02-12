#!/bin/bash

# Lluc Llum Production Start Script
# Usage: ./start.sh [--dev]

MODE="production"
if [[ "$1" == "--dev" ]]; then
    MODE="dev"
fi

echo "🌟 Starting Lluc Llum in $MODE mode..."

# Ensure we are in the right directory
cd "$(dirname "$0")"

# Check if .venv exists
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python3 -m venv .venv
fi

# Optimization: Only install if requirements.txt updated or fresh install
LAST_INSTALL=".venv/.last_install"
if [ ! -f "$LAST_INSTALL" ] || [ requirements.txt -nt "$LAST_INSTALL" ]; then
    echo "📦 Updating dependencies (this may take a moment)..."
    ./.venv/bin/pip install -r requirements.txt --quiet
    touch "$LAST_INSTALL"
fi

# npm dependency check (handles 'man' typo/requirement)
if [ -f "package.json" ] && grep -qE "\"dependencies\"|\"devDependencies\"" package.json; then
    if [ ! -d "node_modules" ] || [ package.json -nt "node_modules" ]; then
        echo "📦 Updating npm modules..."
        npm install --quiet
    fi
fi

start_server() {
    echo "🚀 Server launching at http://localhost:8050"
    if [[ "$MODE" == "production" ]]; then
        # Production: Auto-restart on crash
        while true; do
            ./.venv/bin/python3 server.py >> server.log 2>&1
            EXIT_CODE=$?
            echo "⚠️ Server crashed with exit code $EXIT_CODE. Restarting in 2 seconds..."
            sleep 2
        done
    else
        # Dev: Just run it
        ./.venv/bin/python3 server.py
    fi
}

start_server
