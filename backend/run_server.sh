#!/bin/bash

set -e

VENV_DIR=".venv.nosync"

# Find Python 3.8+ (prefer 3.12, fallback to 3.11, 3.10, 3.9, 3.8)
PYTHON_CMD=""
for ver in python3.12 python3.11 python3.10 python3.9 python3.8 python3; do
    if command -v $ver &> /dev/null; then
        PYTHON_CMD=$ver
        break
    fi
done

if [ -z "$PYTHON_CMD" ]; then
    echo "Python 3.8+ not found. Please install Python first."
    exit 1
fi

echo "Found $($PYTHON_CMD --version)"

if [ -d "$VENV_DIR" ]; then
    echo "Virtual environment ready"
else
    echo "Creating virtual environment..."
    $PYTHON_CMD -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"
    pip install --upgrade pip -q
    
    [ ! -f "requirements.txt" ] && echo "requirements.txt not found" && exit 1
    echo "Installing dependencies..."
    pip install -r requirements.txt
fi

if [ ! -f "models/pose_landmarker_full.task" ]; then
    echo "Downloading MediaPipe model..."
    mkdir -p models
    wget -q --show-progress -P models https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
fi

echo "Starting backend server on http://localhost:49101"
source "$VENV_DIR/bin/activate" && python app.py
