from pathlib import Path
import os
import json
from utils.locate_path import get_project_root

HOST = os.getenv("HOST", "0.0.0.0")
PORT = int(os.getenv("PORT", 49101))  # Using 49101 as it's already exposed in Docker
DEBUG = False

CORS_ORIGINS = [
    # Local development
    "http://localhost:8585",
    "http://127.0.0.1:8585",
    # Production
    "https://robot.yingliu.site",
]

SOCKETIO_CORS_ORIGINS = "*"

PROJECT_ROOT = get_project_root(marker_dirs=['backend'])
BASE_DIR = PROJECT_ROOT / "backend"
MODELS_DIR = BASE_DIR / "models"
OUTPUT_DIR = PROJECT_ROOT / "output"
LOGS_DIR = PROJECT_ROOT / "logs"
CACHE_DIR = PROJECT_ROOT / ".cache"

DEFAULT_CONFIG = json.load(open(BASE_DIR / "config_template.json", "r"))

def merge_configs(user_config: dict) -> dict:
    """Merge user config with defaults. User config overwrites defaults."""
    import copy
    merged = copy.deepcopy(DEFAULT_CONFIG)
    
    if not user_config:
        return _convert_model_paths(merged)
    
    for processor in ["image_processor", "pose_processor", "data_processor"]:
        if processor in user_config:
            for key, value in user_config[processor].items():
                merged[processor][key] = value
    
    return _convert_model_paths(merged)

def _convert_model_paths(config: dict) -> dict:
    if "pose_processor" in config:
        for key in ["pose_landmarker_model_name", "object_detector_model_name"]:
            if key in config["pose_processor"]:
                model_name = config["pose_processor"][key]
                if isinstance(model_name, str) and not model_name.startswith('/'):
                    config["pose_processor"][key] = str(MODELS_DIR / model_name)
    return config

for directory in [MODELS_DIR, OUTPUT_DIR, LOGS_DIR, CACHE_DIR]:
    directory.mkdir(parents=True, exist_ok=True)
