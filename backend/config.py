import os

# Prevent per-operation thread over-subscription in multi-stream scenarios.
# Must be set before numpy/cv2/BLAS are imported.
if "OMP_NUM_THREADS" not in os.environ:
    os.environ["OMP_NUM_THREADS"] = "1"
if "MKL_NUM_THREADS" not in os.environ:
    os.environ["MKL_NUM_THREADS"] = "1"
if "OPENBLAS_NUM_THREADS" not in os.environ:
    os.environ["OPENBLAS_NUM_THREADS"] = "1"

from pathlib import Path
import json
import logging
from utils.locate_path import get_project_root

logger = logging.getLogger(__name__)

HOST = os.getenv("POSE_STUDIO_HOST", "0.0.0.0")
PORT = int(os.getenv("POSE_STUDIO_PORT", 49101))
DEBUG = False

# Thread pool workers for concurrent stream processing (tunable via env var)
POSE_WORKERS = int(os.getenv("POSE_WORKERS", str(min(os.cpu_count() or 4, 16))))

# Maximum number of concurrent streams allowed server-wide
MAX_CONCURRENT_STREAMS = int(os.getenv("MAX_CONCURRENT_STREAMS", "3"))

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
    """Detect available GPU device for inference acceleration."""
    # Check ONNX Runtime CUDA provider (used by RTMPose)
    try:
        import onnxruntime as ort
        if 'CUDAExecutionProvider' in ort.get_available_providers():
            logger.info("GPU detected: ONNX Runtime CUDAExecutionProvider")
            return 'cuda'
    except ImportError:
        pass
    # Check PyTorch CUDA (also indicates a usable NVIDIA GPU)
    try:
        import torch
        if torch.cuda.is_available():
            logger.info(f"GPU detected: PyTorch CUDA ({torch.cuda.get_device_name(0)})")
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
