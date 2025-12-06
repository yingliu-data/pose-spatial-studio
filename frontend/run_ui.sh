#!/bin/bash

set -e

if ! command -v npm &> /dev/null; then
    echo "npm not found. Install Node.js first:"
    echo "  - macOS: brew install node"
    echo "  - Ubuntu/Debian: sudo apt install nodejs npm"
    exit 1
fi

NODE_MAJOR_VERSION=$(node -v | cut -d'.' -f1 | sed 's/v//')
echo "Found Node.js $(node --version) & npm $(npm --version)"

if [ "$NODE_MAJOR_VERSION" -lt 16 ]; then
    echo "Node.js $NODE_MAJOR_VERSION is older than recommended (16+)"
fi

echo "Installing dependencies..."
npm install || { echo "Failed to install dependencies"; exit 1; }

echo "Starting development server on http://localhost:8585"
npm run dev

