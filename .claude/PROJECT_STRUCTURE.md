# Project Structure

## Directory Layout

```
pose-spatial-studio/
├── backend/
│   ├── app.py                        # FastAPI + Socket.IO server, health endpoint
│   ├── config.py                     # Settings (host, port, CORS, MediaPipe params)
│   ├── requirements.txt              # Python deps (FastAPI, MediaPipe, torch, CLIP)
│   ├── run_server.sh                 # Local dev startup script
│   ├── core/
│   │   └── websocket_handler.py      # Socket.IO stream management
│   ├── processors/
│   │   ├── base_processor.py         # Abstract processor interface
│   │   ├── image_processor.py        # Frame preprocessing
│   │   ├── mediapipe_processor.py    # Pose estimation (2D/3D landmarks)
│   │   └── yolo_pose_processor.py    # YOLO-NAS-Pose estimation (COCO 17 keypoints)
│   ├── utils/
│   │   ├── cache.py                  # Caching utilities
│   │   ├── locate_path.py            # Path resolution helpers
│   │   └── logger.py                 # Structured logging
│   └── models/                       # MediaPipe model files (.task, .tflite)
│
├── frontend/
│   ├── src/
│   │   ├── main.tsx                  # App entry point
│   │   ├── App.tsx                   # Root component, stream + WebSocket management
│   │   ├── components/
│   │   │   ├── CameraCapture.tsx     # Camera access, 10 FPS capture, JPEG encoding
│   │   │   ├── Controls.tsx          # Stream management, camera selection, config upload
│   │   │   ├── MultiViewGrid.tsx     # Multi-stream grid layout
│   │   │   ├── Skeleton3DViewer.tsx  # Three.js canvas with video + 3D skeleton
│   │   │   └── StreamViewer.tsx      # Stream container (camera + 3D viewer + overlays)
│   │   ├── hooks/
│   │   │   ├── useCameraDevices.ts   # Camera device enumeration
│   │   │   └── useWebSocket.ts       # Socket connection + pose results
│   │   ├── services/
│   │   │   ├── socketService.ts      # Socket.IO client (reads VITE_BACKEND_URL)
│   │   │   ├── streamService.ts      # Stream lifecycle management
│   │   │   └── streamInitService.ts  # Async stream initialization
│   │   ├── three/
│   │   │   ├── SkeletonRenderer.tsx  # 3D skeleton ball-and-stick rendering
│   │   │   ├── VideoPlane.tsx        # Video feed texture on XY plane
│   │   │   └── connections.ts        # Skeleton bone connection definitions
│   │   └── types/
│   │       └── pose.ts              # Pose/landmark TypeScript types
│   ├── public/
│   │   └── avatars/                  # Avatar model files (.glb)
│   ├── .env.local                    # Dev: VITE_BACKEND_URL=http://localhost:49101
│   ├── .env.production               # Prod: VITE_BACKEND_URL=https://pose-backend.yingliu.site
│   ├── package.json
│   ├── vite.config.ts                # Vite config (port 8585, path aliases)
│   └── run_ui.sh                     # Local dev startup script
│
├── .github/workflows/
│   ├── deploy_backend.yml            # CI/CD: rsync → docker cp → restart in container
│   └── deploy_frontend.yml           # CI/CD: build → rsync → nginx reload
│
├── .claude/
│   ├── PROJECT_STRUCTURE.md          # This file
│   ├── PLAYWRIGHT_SETUP.md           # Playwright testing setup guide
│   ├── TODO.md                       # Project roadmap and task tracking
│   └── skills/
│       ├── develop/SKILL.md          # Full development workflow
│       └── code-review/SKILL.md      # Code review workflow
│
├── tests/
│   ├── pose-validation.spec.ts       # Playwright test suite
│   └── README.md                     # Testing guide
│
├── playwright.config.ts              # Playwright config (multi-browser, auto server start)
├── package.json                      # Root package (test scripts + Playwright dep)
├── CHANGELOG.md                      # Version history
├── README.md                         # Project overview and setup guide
├── LLMprompt.md                      # LLM prompting reference
├── output/                           # Processing output directory
├── logs/                             # Backend log files (date-stamped)
└── .cache/                           # Runtime cache
```

## Core Components

### Backend

**app.py** - FastAPI server with Socket.IO, CORS, health endpoint (`/health`), root info endpoint (`/`)

**config.py** - Centralized settings with env var support:
- `POSE_STUDIO_HOST` (default `0.0.0.0`), `POSE_STUDIO_PORT` (default `49101`)
- `POSE_WORKERS` — thread pool size for concurrent stream processing (default `min(cpu_count, 16)`, tunable via env var)
- BLAS thread pinning (`OMP_NUM_THREADS=1`, `MKL_NUM_THREADS=1`, `OPENBLAS_NUM_THREADS=1`) to prevent per-operation thread explosion
- CORS origins: `localhost:8585`, `robot.yingliu.site`
- MediaPipe params, FPS, JPEG quality, max streams

**websocket_handler.py** - Manages:
- Client connections/disconnections
- Stream initialization with processor pipeline (injects `source_type` into processor config)
- Concurrent frame processing via `ThreadPoolExecutor(max_workers=POSE_WORKERS)`
- Per-stream timing metrics exposed on `/health`
- Result emission
- Processor cleanup

**base_processor.py** - Abstract class requiring:
- `initialize()` → bool
- `process_frame(frame, timestamp_ms)` → Dict
- `cleanup()` → void

**image_processor.py** - Preprocessing stage (filters, transforms, adjustments)

**mediapipe_processor.py** - Pose estimation (2D/3D landmarks, skeleton overlay). Dual running mode: `LIVE_STREAM` (async callbacks) for camera, `VIDEO` (synchronous, no frame delay) for video uploads

**yolo_pose_processor.py** - YOLO-NAS-Pose estimation via super-gradients. Outputs COCO 17 keypoints mapped to unified MediaPipe skeleton structure. Uses perspective unprojection for 3D world landmarks. Config `processor_type: "yolo3d"`.

### Frontend

**App.tsx** - Root component, manages streams and WebSocket connection

**Controls.tsx** - Stream management: add/delete streams, camera selection, model selection, config upload

**CameraCapture.tsx** - Camera access, 10 FPS capture, JPEG encoding, receives processed frames

**StreamViewer.tsx** - Container combining camera + 3D viewer + overlays

**Skeleton3DViewer.tsx** - Three.js canvas with video plane + 3D skeleton

**useWebSocket.ts** - Socket connection, pose results Map, connection status

**socketService.ts** - Socket.IO client, reads backend URL from `VITE_BACKEND_URL` env var

**streamInitService.ts** - Async stream initialization with backend

## Architecture

### Processor Pipeline

```
Camera Frame → ImageProcessor → MediaPipeProcessor → Annotated Frame + Pose Data
```

### Data Flow

```
Camera (10 FPS) → encode JPEG/Base64 → WebSocket
    ↓
WebSocket Handler → decode → ImageProcessor → MediaPipeProcessor
    ↓
encode JPEG/Base64 → WebSocket → Frontend
    ↓
Canvas → Three.js Texture → Render (VideoPlane + Skeleton)
```

### Stream Lifecycle

**Initialize:**
```
UI → StreamInitService.initializeStream() → Backend creates processors
→ stream_initialized event → UI adds stream → Camera starts
```

**Process:**
```
Camera captures → process_frame event → Pipeline → pose_result event
→ Update canvas → Three.js renders
```

**Cleanup:**
```
Delete button → cleanup_processor event → Backend releases processors
→ UI removes stream → Camera stops
```

## Deployment Architecture

```
GitHub Actions (push to main)
    │
    ├─ deploy_frontend.yml
    │   └─ npm build → rsync dist/ → nginx reload
    │   └─ Target: VM1 via Cloudflare tunnel
    │   └─ Serves: https://robot.yingliu.site
    │
    └─ deploy_backend.yml
        └─ rsync → docker cp → pip install → restart → health check
        └─ Target: VM2 via Cloudflare tunnel (pose-backend-ssh.yingliu.site)
        └─ Container: pose-spatial-studio-backend (port 49101)
        └─ Serves: https://pose-backend.yingliu.site

VM1 (Frontend Edge)          VM2 (GPU Backend)
┌─────────────────┐          ┌──────────────────────────┐
│ Nginx            │          │ Docker container          │
│ /var/www/frontend│  ──WS──► │ FastAPI + Socket.IO       │
│ Cloudflare TLS   │          │ MediaPipe + GPU (CUDA)    │
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

### Server → Client

| Event | Payload |
|-------|---------|
| `connection_status` | `{ status, sid }` |
| `stream_initialized` | `{ stream_id, status, message, processor_type }` |
| `stream_error` | `{ stream_id, message }` |
| `pose_result` | `{ stream_id, frame (base64), pose_data, timestamp_ms }` |
| `model_switched` | `{ stream_id, processor_type, message }` |
| `error` | `{ message }` |

## Configuration

### Backend (config.py)
```python
HOST = os.getenv("POSE_STUDIO_HOST", "0.0.0.0")
PORT = int(os.getenv("POSE_STUDIO_PORT", 49101))
MIN_DETECTION_CONFIDENCE = 0.5
MIN_TRACKING_CONFIDENCE = 0.5
TARGET_FPS = 15
JPEG_QUALITY = 80
MAX_STREAMS = 10
```

### Frontend (environment files)
- `.env.local` → `VITE_BACKEND_URL=http://localhost:49101`
- `.env.production` → `VITE_BACKEND_URL=https://pose-backend.yingliu.site`

### Frontend (JSON config upload)
```json
{
  "min_detection_confidence": 0.7,
  "min_tracking_confidence": 0.7,
  "num_poses": 2
}
```

## Tech Stack

**Backend:** Python 3.13, FastAPI, Socket.IO, MediaPipe, OpenCV, NumPy, PyTorch, CLIP

**Frontend:** React 18, TypeScript, Three.js, React Three Fiber, Socket.IO Client, Vite

**Testing:** Playwright (automated UI testing), Playwright MCP (Claude Code integration)

**CI/CD:** GitHub Actions, Cloudflare Tunnels (SSH access), rsync deployment

**Infrastructure:** Nginx, Docker, NVIDIA CUDA, Cloudflare (TLS, DDoS, WAF)

## Testing

### Playwright Automated Testing

**Running tests:**
```bash
npm test                # Run all tests
npm run test:headed     # Run with visible browser
npm run test:debug      # Debug mode
npm run test:report     # View HTML report
```

**Playwright MCP Integration:**
Claude Code can run tests using Playwright MCP:
```
Use ToolSearch with query: "playwright"
```

**Test results:** Screenshots in `test-results/`, videos on failure, HTML reports via `npm run test:report`

## Extension Guide

### Add New Processor

```python
from processors.base_processor import BaseProcessor

class CustomProcessor(BaseProcessor):
    def initialize(self) -> bool:
        self._is_initialized = True
        return True

    def process_frame(self, frame, timestamp_ms):
        return {'processed_frame': frame, 'data': {}}

    def cleanup(self):
        self._is_initialized = False
```

Add to `websocket_handler.py`:
```python
custom_processor = CustomProcessor(processor_id, config)
```

### Add New Visualization

```typescript
export function CustomRenderer({ landmarks }: Props) {
  return (
    <group>
      {landmarks.map((lm, i) => (
        <mesh key={i} position={[lm.x, -lm.y, -lm.z]}>
          <sphereGeometry args={[0.05]} />
          <meshStandardMaterial color="#ff0000" />
        </mesh>
      ))}
    </group>
  );
}
```

## Performance Tips

- **10 FPS capture** reduces bandwidth/CPU (configurable via `TARGET_FPS`)
- **JPEG quality 0.8** balances size vs quality
- **Processor pipeline** allows independent optimization
- **React optimization** uses refs to avoid unnecessary re-renders
- **Processor persistence** survives React remounts (no redundant initialization)

## Debugging

**Backend logs:**
```bash
tail -f logs/$(date +%Y-%m-%d).log
grep ERROR logs/*.log
```

**Frontend console prefixes:**
```
[useWebSocket] - Socket events
[CameraCapture] - Frame capture
[StreamViewer] - Component lifecycle
```

**Common issues:**
- Camera not starting → Check browser permissions
- No pose results → Check backend logs for initialization errors
- Low performance → Reduce FPS or resolution

## Design Principles

1. **Modular** - Clear processor pipeline, independent components
2. **Type-safe** - TypeScript interfaces, Python type hints, abstract classes
3. **Lifecycle management** - Processors initialized once, explicit cleanup
4. **Performance-first** - 10 FPS, compression, optimized rendering
5. **Extensible** - Easy to add processors, visualizations, configs
