from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import socketio
import uvicorn
import logging

import config
from utils.logger import setup_project_logging
from core.websocket_handler import WebSocketHandler

setup_project_logging(level=logging.DEBUG if config.DEBUG else logging.INFO)
logger = logging.getLogger(__name__)

websocket_handler = None

def _get_gpu_info() -> dict:
    """Detect GPU availability for diagnostics."""
    info = {"device": "cpu", "cuda_available": False, "providers": []}
    try:
        import onnxruntime as ort
        info["providers"] = ort.get_available_providers()
        if "CUDAExecutionProvider" in info["providers"]:
            info["cuda_available"] = True
            info["device"] = "cuda"
    except ImportError:
        info["onnxruntime"] = "not installed"
    return info

@asynccontextmanager
async def lifespan(app: FastAPI):
    gpu_info = _get_gpu_info()
    logger.info(f"Starting Pose Vision Studio v1.1")
    logger.info(f"Host: {config.HOST}:{config.PORT}")
    logger.info(f"GPU: {gpu_info['device']} | CUDA: {gpu_info['cuda_available']} | Providers: {gpu_info['providers']}")
    yield
    logger.info("Shutting down server")
    if websocket_handler:
        websocket_handler.cleanup_all()

app = FastAPI(
    title="Pose Vision Studio API",
    version="1.1.0",
    description="Real-time 3D pose estimation and visualization",
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=config.SOCKETIO_CORS_ORIGINS,
    logger=False,
    engineio_logger=False
)
socket_app = socketio.ASGIApp(sio, app)
websocket_handler = WebSocketHandler(sio)

@app.get("/")
async def root():
    return {
        "message": "Pose Vision Studio API", 
        "version": "1.1.0",
        "status": "running"
    }

@app.get("/health")
async def health_check():
    stats = websocket_handler.get_stats()
    stats["gpu"] = _get_gpu_info()
    return stats

@app.get("/info")
async def info():
    return {
        "api_version": "1.1.0",
        "features": [
            "Real-time 3D pose estimation",
            "Multi-stream support",
            "MediaPipe integration",
            "WebSocket communication"
        ],
        "config": {
        }
    }

if __name__ == "__main__":
    uvicorn.run(
        "app:socket_app", 
        host=config.HOST, 
        port=config.PORT, 
        reload=config.DEBUG
    )
