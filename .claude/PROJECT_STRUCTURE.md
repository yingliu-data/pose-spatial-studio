# Project Structure

## Directory Layout

```
pose-spatial-studio/
├── backend/
│   ├── app.py                        # FastAPI + Socket.IO server, health/info endpoints
│   ├── config.py                     # Settings (host, port, CORS, GPU detection, config merging)
│   ├── config_template.json          # Default processor configuration template
│   ├── requirements.txt              # Python deps (FastAPI, MediaPipe, torch, rtmlib, ultralytics)
│   ├── run_server.sh                 # Local dev startup script
│   ├── yolov8m-pose.pt              # YOLOv8-M Pose model weights
│   ├── core/
│   │   └── websocket_handler.py      # Socket.IO stream management, processor pipeline, log streaming
│   ├── processors/
│   │   ├── __init__.py
│   │   ├── base_processor.py         # Abstract processor interface
│   │   ├── data_processor.py         # Temporal smoothing, windowing, feature extraction
│   │   ├── image_processor.py        # Frame preprocessing (resize, flip, normalize)
│   │   ├── mediapipe_processor.py    # MediaPipe pose estimation (2D/3D landmarks)
│   │   ├── mediapipe_object_detector_processor.py  # Object detection (EfficientDet)
│   │   ├── mediapipe_hand_gesture_processor.py     # Hand gesture recognition
│   │   ├── rtmpose_processor.py      # RTMPose3D via rtmlib (RTMW3D-X + YOLOX-M, FK output)
│   │   ├── yolo_pose_2d_processor.py # YOLOv8-Pose 2D detection
│   │   └── yolo_tcpformer_processor.py # YOLO 2D + TCPFormer 3D lifting (81-frame temporal)
│   ├── utils/
│   │   ├── __init__.py
│   │   ├── cache.py                  # Model caching utilities
│   │   ├── filters.py               # MedianFilter, GaussianFilter for temporal smoothing
│   │   ├── io.py                     # Frame I/O, encoding/decoding
│   │   ├── kinetic.py               # Landmark format conversion (MediaPipe 33 / COCO 17 → unified 24)
│   │   ├── locate_path.py           # Project root detection
│   │   ├── log_streamer.py          # SocketIOLogHandler for real-time log streaming
│   │   └── logger.py                # Structured logging setup
│   └── models/
│       ├── tcpformer/                # TCPFormer 2D→3D lifting model (AAAI 2025)
│       │   ├── model.py
│       │   └── *.pth.tr             # Checkpoint (auto-downloaded)
│       ├── efficientdet_lite2.tflite # MediaPipe object detection model
│       └── pose_landmarker_full.task # MediaPipe pose landmarker model
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx                  # App entry point
│   │   ├── App.tsx                   # Root layout: sidebar + viewer + log panel
│   │   ├── App.css                   # Global styles
│   │   ├── components/
│   │   │   ├── CameraCapture.tsx     # Camera/video source lifecycle, 10 FPS capture, backpressure
│   │   │   ├── Controls.tsx          # Function selector, source/device picker, start/stop
│   │   │   ├── FunctionViewer.tsx    # Routes to View2D, View3D, or placeholder by viewMode
│   │   │   ├── View2D.tsx            # 2D canvas viewer with camera mirroring
│   │   │   ├── View3D.tsx            # 3D scene with model selector, renderer toggle
│   │   │   ├── Skeleton3DViewer.tsx  # Three.js canvas: video plane + skeleton + controls
│   │   │   ├── LogPanel.tsx          # Real-time backend log viewer (right sidebar)
│   │   │   └── DataAnalysis_.tsx     # Placeholder (unused)
│   │   ├── hooks/
│   │   │   ├── useCameraDevices.ts   # Camera device enumeration + permission management
│   │   │   ├── useLogStream.ts       # Backend log subscription (rolling 1000-entry buffer)
│   │   │   └── useWebSocket.ts       # Socket connection + stale result filtering
│   │   ├── services/
│   │   │   ├── socketService.ts      # Socket.IO singleton client (VITE_BACKEND_URL)
│   │   │   ├── streamInitService.ts  # Async stream init with model switching, 60s timeout
│   │   │   └── streamService.ts      # Per-stream frame transmission
│   │   ├── stores/
│   │   │   └── appStore.ts           # Zustand store (function, source, stream, renderer state)
│   │   ├── three/
│   │   │   ├── AvatarRenderer.tsx    # Mixamo rigged avatar with FK quaternion animation
│   │   │   ├── StickBallRenderer.tsx # Procedural ball-and-stick skeleton
│   │   │   ├── VideoPlane.tsx        # Video feed texture on XY plane, camera mirroring
│   │   │   ├── boneMapping.ts        # Mixamo bone names, joint→bone maps, FK transforms
│   │   │   └── connections.ts        # Skeleton bone connection topology
│   │   └── types/
│   │       ├── functions.ts          # Function definitions, processor types, view modes
│   │       └── pose.ts              # Landmark, PoseData, DetectedObject, DetectedHand types
│   ├── public/
│   │   └── avatars/skeleton.glb      # Mixamo rigged skeleton model
│   ├── .env.local                    # Dev: VITE_BACKEND_URL=http://localhost:49101
│   ├── .env.production               # Prod: VITE_BACKEND_URL=https://pose-backend.yingliu.site
│   ├── package.json
│   ├── vite.config.ts                # Vite config (port 8585, @ path alias)
│   └── run_ui.sh                     # Local dev startup script
│
├── .github/workflows/
│   ├── deploy_backend.yml            # CI/CD: backend to production (main branch)
│   ├── deploy_backend_staging.yml    # CI/CD: backend to staging (staging branch)
│   ├── deploy_frontend.yml           # CI/CD: frontend to production (main branch)
│   └── deploy_frontend_staging.yml   # CI/CD: frontend to staging (staging branch)
│
├── .claude/
│   ├── PROJECT_STRUCTURE.md          # This file
│   └── skills/
│       ├── develop/SKILL.md          # Full development workflow
│       ├── code-review/SKILL.md      # Code review workflow
│       ├── test/SKILL.md             # Test workflow
│       └── ssh-servers/SKILL.md      # Remote server access
│
├── tests/
│   ├── playwright.config.ts          # Playwright config (production)
│   ├── playwright.staging.config.ts  # Playwright config (staging)
│   └── specs/
│       ├── pose-validation.spec.ts   # E2E pose detection + 3D rendering tests
│       └── staging-video-test.spec.ts # Staging-specific video upload tests
│
├── README.md                         # Project overview and setup guide
├── CHANGELOG.md                      # Version history
├── output/                           # Processing output directory
├── logs/                             # Backend log files (date-stamped)
└── .cache/                           # Runtime model cache
```

## Function Modes

The app operates in single-function mode with five available functions:

| Function | Processor | View | Description |
|----------|-----------|------|-------------|
| 2D Pose Estimation | `yolo_pose_2d` | 2D | YOLOv8-Pose 2D keypoint detection |
| 3D Pose Estimation | `mediapipe` or `rtmpose` | 3D | Switchable 3D model with avatar/skeleton rendering |
| Object Detection | `mediapipe_object_detection` | 2D | EfficientDet bounding boxes + labels |
| Hand Gesture Recognition | `mediapipe_hand_gesture` | 2D | Per-hand landmarks + gesture classification |
| Avatar Voice Control | — | placeholder | Coming soon |

## Core Components

### Backend

**app.py** - FastAPI server with Socket.IO, CORS, endpoints: `/` (info), `/health` (stats), `/info` (features)

**config.py** - Centralized settings with env var support:
- `POSE_STUDIO_HOST` (default `0.0.0.0`), `POSE_STUDIO_PORT` (default `49101`)
- `POSE_WORKERS` — thread pool size (default `min(cpu_count, 16)`)
- `MAX_CONCURRENT_STREAMS` — server-wide limit (default `3`)
- BLAS thread pinning (`OMP_NUM_THREADS=1`, `MKL_NUM_THREADS=1`, `OPENBLAS_NUM_THREADS=1`)
- CORS origins: `localhost:8585`, `robot.yingliu.site`, `staging.robot.yingliu.site`
- GPU detection (ONNX Runtime CUDA, PyTorch CUDA)
- Config merging from `config_template.json`

**websocket_handler.py** - Manages:
- Client connections/disconnections with per-client cleanup
- Stream initialization with multi-processor pipeline
- Concurrent frame processing via `ThreadPoolExecutor(max_workers=POSE_WORKERS)`
- Per-stream timing metrics exposed on `/health`
- Real-time log streaming (`subscribe_logs` / `unsubscribe_logs`)
- Model switching (`switch_model` event)
- Concurrent stream limit enforcement

**Processors** (all inherit from `base_processor.py`):

| Processor | Output | Notes |
|-----------|--------|-------|
| `mediapipe_processor` | 2D/3D landmarks (33→24 unified) | LIVE_STREAM for camera, VIDEO for uploads |
| `rtmpose_processor` | FK quaternions + root position | RTMW3D-X + YOLOX-M, depth-corrected z |
| `yolo_pose_2d_processor` | 2D landmarks (17 COCO keypoints) | YOLOv8-M Pose |
| `yolo_tcpformer_processor` | FK + world landmarks | YOLO 2D → TCPFormer temporal 3D lifting |
| `mediapipe_object_detector_processor` | Bounding boxes + labels | EfficientDet-Lite2 |
| `mediapipe_hand_gesture_processor` | Hand landmarks + gestures | Per-hand classification |
| `image_processor` | Preprocessed frame | Resize, flip, normalize |
| `data_processor` | Feature vectors | Temporal smoothing, windowing |

**Utilities:**
- `kinetic.py` — Landmark format conversion (MediaPipe 33 / COCO 17 → unified 24 joints)
- `filters.py` — MedianFilter, GaussianFilter for temporal smoothing
- `io.py` — Frame encoding/decoding
- `log_streamer.py` — SocketIOLogHandler for real-time log streaming to clients

### Frontend

**App.tsx** - Root layout: left sidebar (Controls), center (FunctionViewer), right sidebar (LogPanel). Animated background orbs, connection status indicator, error boundary.

**Controls.tsx** - Function selector (radio buttons), source type toggle (camera/video), device picker, start/stop buttons. Camera permission requested on Start (not on mount).

**FunctionViewer.tsx** - Routes to View2D, View3D, or placeholder based on `functionDef.viewMode`.

**View2D.tsx** - Canvas-based 2D viewer. Displays annotated frames from backend. Camera source mirroring via `scaleX(-1)`.

**View3D.tsx** - 3D scene wrapper. Model selector dropdown (MediaPipe / YOLO+RTMPose). Avatar/skeleton renderer toggle. Manages video/canvas refs for Skeleton3DViewer.

**Skeleton3DViewer.tsx** - Three.js Canvas with VideoPlane background + AvatarRenderer or StickBallRenderer. Orbit controls, grid, lighting, error boundary.

**CameraCapture.tsx** - Camera/video source lifecycle. 10 FPS capture with backpressure (waits for backend result before sending next frame).

**LogPanel.tsx** - Real-time backend log viewer. Severity-colored entries (DEBUG/INFO/WARNING/ERROR), auto-scroll, expand/collapse.

**appStore.ts** (Zustand) - Centralized state: `activeFunction`, `sourceType`, `deviceId`, `videoFile`, `isStreamActive`, `isInitializing`, `initMessage`, `backendResult`, `rendererType` (avatar/stickball), `pose3dProcessorType` (mediapipe/rtmpose), sidebar collapse states.

**Three.js renderers:**
- `AvatarRenderer` — Loads skeleton.glb, applies FK quaternions to Mixamo bones, T-pose caching, smooth interpolation
- `StickBallRenderer` — Procedural green spheres + lines using POSE_CONNECTIONS topology
- `VideoPlane` — Video texture on XY plane, camera source mirroring
- `boneMapping` — Mixamo bone names, joint→bone maps, conjugation rules, z-axis negation for legs

## Architecture

### Data Flow

```
Source (Camera 10 FPS / Video) → encode JPEG/Base64 → WebSocket
    ↓
WebSocket Handler → decode → ImageProcessor → DataProcessor → PoseProcessor
    ↓
encode JPEG/Base64 → WebSocket → Frontend
    ↓
View2D: Canvas render (annotated frame)
View3D: Three.js (VideoPlane + AvatarRenderer or StickBallRenderer)
```

### Stream Lifecycle

**Initialize:**
```
UI Start → requestPermission() → StreamInitService.initializeStream()
→ Backend creates processor pipeline → stream_initialized → Camera starts
```

**Process (with backpressure):**
```
Camera captures → process_frame → Pipeline → pose_result
→ Update store → Render → next capture
```

**Cleanup:**
```
Stop button → cleanup_processor → Backend releases processors
→ Reset permission → UI idle
```

## Deployment Architecture

```
GitHub Actions
    │
    ├─ push to main ──────────────────────────────────────────────┐
    │   ├─ deploy_frontend.yml → build → rsync → nginx reload    │
    │   │   Serves: https://robot.yingliu.site                   │
    │   └─ deploy_backend.yml → rsync → docker cp → restart      │
    │       Serves: https://pose-backend.yingliu.site             │
    │                                                             │
    └─ push to staging ───────────────────────────────────────────┤
        ├─ deploy_frontend_staging.yml                            │
        │   Serves: https://staging.robot.yingliu.site            │
        └─ deploy_backend_staging.yml                             │
            Serves: staging backend container                     │

VM1 (Frontend Edge)          VM2 (GPU Backend)
┌─────────────────┐          ┌──────────────────────────┐
│ Nginx            │          │ Docker container          │
│ /var/www/frontend│  ──WS──► │ FastAPI + Socket.IO       │
│ Cloudflare TLS   │          │ CUDA GPU acceleration     │
└─────────────────┘          └──────────────────────────┘
```

## WebSocket Events

### Client → Server

| Event | Payload |
|-------|---------|
| `initialize_stream` | `{ stream_id, processor_type, processor_config, source_type }` |
| `process_frame` | `{ stream_id, frame (base64), timestamp_ms }` |
| `cleanup_processor` | `{ stream_id }` |
| `switch_model` | `{ stream_id, processor_type }` |
| `subscribe_logs` | `{}` |
| `unsubscribe_logs` | `{}` |

### Server → Client

| Event | Payload |
|-------|---------|
| `connection_status` | `{ status, sid }` |
| `stream_initialized` | `{ stream_id, status, message, processor_type }` |
| `stream_error` | `{ stream_id, message, code?, active_streams?, max_streams? }` |
| `stream_loading` | `{ stream_id, message }` |
| `pose_result` | `{ stream_id, frame (base64), pose_data, timestamp_ms }` |
| `model_switched` | `{ stream_id, processor_type, message }` |
| `log_batch` | `[{ level, message, timestamp, logger }]` |
| `error` | `{ message }` |

## Configuration

### Backend (config.py + config_template.json)
```python
HOST = os.getenv("POSE_STUDIO_HOST", "0.0.0.0")
PORT = int(os.getenv("POSE_STUDIO_PORT", 49101))
POSE_WORKERS = min(cpu_count, 16)       # env var override
MAX_CONCURRENT_STREAMS = 3              # env var override
```

### Frontend (environment files)
- `.env.local` → `VITE_BACKEND_URL=http://localhost:49101`
- `.env.production` → `VITE_BACKEND_URL=https://pose-backend.yingliu.site`

## Tech Stack

**Backend:** Python 3.13, FastAPI, Socket.IO, MediaPipe, rtmlib, Ultralytics (YOLOv8), PyTorch, OpenCV, NumPy

**Frontend:** React 19, TypeScript, Three.js, React Three Fiber, Drei, Zustand, Socket.IO Client, Vite

**Testing:** Playwright (E2E, production + staging configs)

**CI/CD:** GitHub Actions, Cloudflare Tunnels (SSH via cloudflared + Access service tokens), rsync deployment

**Infrastructure:** Nginx, Docker, NVIDIA CUDA, Cloudflare (TLS, DDoS, WAF)

## Testing

```bash
# From tests/ directory
npx playwright test                        # Run all tests
npx playwright test --config playwright.staging.config.ts  # Staging tests
npx playwright test --headed               # With visible browser
npx playwright show-report                 # View HTML report
```

## Debugging

**Backend logs:**
```bash
tail -f logs/$(date +%Y-%m-%d).log
grep ERROR logs/*.log
```

**Real-time logs:** Open LogPanel in the right sidebar (frontend streams backend logs live)

**Common issues:**
- Camera not starting → Check browser permissions
- No pose results → Check backend logs / LogPanel for initialization errors
- Low performance → Reduce FPS or resolution
- Stream limit reached → Max 3 concurrent streams (configurable)
