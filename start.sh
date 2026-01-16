#!/bin/bash

# Lluc Llum Production Start Script
echo "🌟 Starting Lluc Llum Production Server..."

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

# Start the server
echo "🚀 Server launching at http://localhost:8000"
./.venv/bin/python3 server.py
