#!/bin/bash

set -e

VENV_DIR=".venv.nosync"

if ! command -v python3.12 &> /dev/null; then
    echo "Python 3.12 not found. Installing via Homebrew..."
    brew install python@3.12
fi

PYTHON312_PATH=$(command -v python3.12)
echo "Found $($PYTHON312_PATH --version)"

if [ -d "$VENV_DIR" ]; then
    if [ -f "$VENV_DIR/bin/python" ]; then
        VENV_PYTHON_VERSION=$("$VENV_DIR/bin/python" --version 2>&1)
        if [[ ! "$VENV_PYTHON_VERSION" =~ "Python 3.12" ]]; then
            echo "Existing venv uses $VENV_PYTHON_VERSION. Remove it with: rm -rf $VENV_DIR"
            exit 1
        fi
    fi
    echo "Virtual environment ready"
else
    echo "Creating virtual environment..."
    $PYTHON312_PATH -m venv "$VENV_DIR"
    source "$VENV_DIR/bin/activate"
    pip install --upgrade pip -q
    
    [ ! -f "requirements.txt" ] && echo "requirements.txt not found" && exit 1
    echo "Installing dependencies..."ç
    pip install -r requirements.txt
fi

if [ ! -f "models/pose_landmarker_full.task" ]; then
    echo "Downloading MediaPipe model..."
    mkdir -p models
    wget -q --show-progress -P models https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_full/float16/latest/pose_landmarker_full.task
fi

echo "Starting backend server..."
source "$VENV_DIR/bin/activate" && python app.py

