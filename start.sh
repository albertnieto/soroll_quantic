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

# Install/Update dependencies
echo "📦 Installing dependencies..."
./.venv/bin/pip install -r requirements.txt

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
