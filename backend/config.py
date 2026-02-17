from pathlib import Path
import os
import json
import logging
from utils.locate_path import get_project_root

logger = logging.getLogger(__name__)

HOST = os.getenv("POSE_STUDIO_HOST", "0.0.0.0")
PORT = int(os.getenv("POSE_STUDIO_PORT", 49101))
DEBUG = False

CORS_ORIGINS = [
    "http://localhost:8585",
    "http://127.0.0.1:8585",
    "https://robot.yingliu.site",
    "https://staging.robot.yingliu.site",
]

SOCKETIO_CORS_ORIGINS = "*"

PROJECT_ROOT = get_project_root(marker_dirs=['backend'])
BASE_DIR = PROJECT_ROOT / "backend"
MODELS_DIR = BASE_DIR / "models"
OUTPUT_DIR = PROJECT_ROOT / "output"
LOGS_DIR = PROJECT_ROOT / "logs"
CACHE_DIR = PROJECT_ROOT / ".cache"

DEFAULT_CONFIG = json.load(open(BASE_DIR / "config_template.json", "r"))

def detect_gpu_device() -> str:
    """Detect available GPU device for ONNX Runtime inference."""
    try:
        import onnxruntime as ort
        available_providers = ort.get_available_providers()
        if 'CUDAExecutionProvider' in available_providers:
            logger.info("GPU detected: CUDAExecutionProvider available")
            return 'cuda'
    except ImportError:
        pass
    logger.info("No GPU acceleration available, using CPU")
    return 'cpu'

def _resolve_auto_device(config: dict) -> dict:
    """Resolve 'auto' device setting to actual device."""
    if "pose_processor" in config:
        if config["pose_processor"].get("device") == "auto":
            config["pose_processor"]["device"] = detect_gpu_device()
    return config

def merge_configs(user_config: dict) -> dict:
    import copy
    merged = copy.deepcopy(DEFAULT_CONFIG)

    if not user_config:
        return _resolve_auto_device(_convert_model_paths(merged))

    for processor in ["image_processor", "pose_processor", "data_processor"]:
        if processor in user_config:
            for key, value in user_config[processor].items():
                merged[processor][key] = value

    return _resolve_auto_device(_convert_model_paths(merged))

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
