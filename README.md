# Pose Spatial Studio

Real-time pose estimation, object detection, and 3D avatar rendering with WebSocket streaming.

## Features

- **2D Pose Estimation** — YOLOv8-Pose real-time 2D keypoint detection
- **3D Pose Estimation** — Switchable models (MediaPipe / YOLO+RTMPose) with avatar or skeleton rendering
- **Object Detection** — EfficientDet-Lite2 bounding boxes and labels
- **Hand Gesture Recognition** — Per-hand landmark tracking with gesture classification
- **Live 3D Avatar** — Mixamo-rigged avatar driven by FK quaternions from pose estimation
- **Avatar Voice Control** — Voice/text commands to control 3D avatar via SecondBrain AI
- **Camera & Video Input** — Live camera streams or video file upload
- **Real-time Log Streaming** — Backend logs streamed live to the frontend
- **Auto-Deployment** — GitHub Actions CI/CD to production and staging

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- Modern web browser with camera access

### Installation

```bash
git clone <repository-url>
cd pose-spatial-studio

# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install
```

### Running

```bash
# Terminal 1: Backend (port 49101)
cd backend
./run_server.sh

# Terminal 2: Frontend (port 8585)
cd frontend
./run_ui.sh
```

Open `http://localhost:8585` in your browser.

## Usage

1. **Select a function** from the left sidebar (2D Pose, 3D Pose, Object Detection, Hand Gesture)
2. **Choose input source** — camera or video file upload
3. **Click Start** — grants camera permission if needed, initializes the processing pipeline
4. **Interact with results:**
   - 2D views show annotated frames directly on canvas
   - 3D view supports orbit controls (rotate, pan, zoom) and toggle between Avatar and Skeleton rendering
   - 3D Pose supports model switching between MediaPipe and YOLO+RTMPose
5. **View logs** in the right sidebar panel for real-time backend diagnostics
6. **Avatar Voice Control** — select from function menu, type or speak commands like "wave your right hand"

## Architecture

```
┌─────────────┐         WebSocket         ┌──────────────────────┐
│   Browser    │ ◄──────────────────────► │  FastAPI + Socket.IO  │
│  (React/TS)  │                          │  (Python 3.13)        │
└──────┬───────┘                          └──────────┬────────────┘
       │                                             │
       │ 10 FPS JPEG frames                          │ Processor Pipeline
       │                                             │
       ▼                                             ▼
┌──────────────┐                          ┌──────────────────────┐
│ View2D/View3D│                          │ Image → Data →       │
│ Three.js     │    Annotated frames      │ Pose/Detection       │
│ Avatar/Skel  │ ◄──────────────────────  │ Processor            │
└──────────────┘                          └──────────────────────┘
```

### Directory Structure

```
pose-spatial-studio/
├── backend/              # Python FastAPI server
│   ├── app.py           # Server entry point
│   ├── config.py        # Configuration + GPU detection
│   ├── core/            # WebSocket handler + log streaming
│   ├── processors/      # 8 processors (pose, detection, gesture)
│   ├── models/          # ML model files (MediaPipe, TCPFormer)
│   └── utils/           # Kinetic converter, filters, I/O
│
├── frontend/            # React TypeScript UI
│   ├── src/
│   │   ├── components/  # Controls, View2D, View3D, LogPanel, etc.
│   │   ├── three/       # AvatarRenderer, StickBallRenderer, VideoPlane
│   │   ├── stores/      # Zustand state management
│   │   ├── hooks/       # Camera devices, WebSocket, log stream
│   │   ├── services/    # Socket client, stream init, frame transmission
│   │   └── types/       # Function definitions, pose data types
│   └── public/avatars/  # Mixamo skeleton.glb
│
├── tests/               # Playwright E2E tests (production + staging)
├── .github/workflows/   # CI/CD: deploy frontend/backend to prod/staging
└── .claude/             # Project docs + Claude Code skills
```

See [PROJECT_STRUCTURE.md](./.claude/PROJECT_STRUCTURE.md) for detailed documentation.

## WebSocket Events

### Client → Server

| Event | Payload | Description |
|-------|---------|-------------|
| `initialize_stream` | `{ stream_id, processor_type, processor_config, source_type }` | Initialize processing pipeline |
| `process_frame` | `{ stream_id, frame (base64), timestamp_ms }` | Send frame for processing |
| `cleanup_processor` | `{ stream_id }` | Tear down processor |
| `switch_model` | `{ stream_id, processor_type }` | Switch 3D pose model |
| `subscribe_logs` | `{}` | Start receiving backend logs |
| `solve_ik` | `{ request_id, joints, root_position }` | Send joint coordinates for IK solving |

### Server → Client

| Event | Payload | Description |
|-------|---------|-------------|
| `stream_initialized` | `{ stream_id, status, message, processor_type }` | Pipeline ready |
| `pose_result` | `{ stream_id, frame (base64), pose_data, timestamp_ms }` | Processed frame + data |
| `stream_error` | `{ stream_id, message, active_streams?, max_streams? }` | Error with capacity info |
| `log_batch` | `[{ level, message, timestamp, logger }]` | Batched log entries |
| `fk_result` | `{ request_id, fk_data, root_position, error? }` | FK quaternion result |

### REST Endpoints

- `GET /health` — Health check with per-stream metrics
- `GET /` — Server info
- `GET /info` — Feature capabilities

## Deployment

**Production:** [robot.yingliu.site](https://robot.yingliu.site)
**Staging:** staging.robot.yingliu.site

Push to `main` deploys to production. Push to `staging` deploys to staging. Both trigger GitHub Actions workflows with Cloudflare Access authentication.

```
VM1 (Frontend)               VM2 (GPU Backend)
┌──────────────┐             ┌──────────────────────┐
│ Nginx        │    WS       │ Docker container      │
│ Cloudflare   │ ──────────► │ FastAPI + Socket.IO   │
│ TLS          │             │ CUDA GPU              │
└──────────────┘             └──────────────────────┘
```

## Technology Stack

| Layer | Technologies |
|-------|-------------|
| **Backend** | Python 3.13, FastAPI, Socket.IO, MediaPipe, rtmlib (RTMPose3D), Ultralytics (YOLOv8), PyTorch (TCPFormer), OpenCV |
| **Frontend** | React 19, TypeScript, Three.js, React Three Fiber, Drei, Zustand, Socket.IO Client, SecondBrain (guest chat API), Vite |
| **Testing** | Playwright (E2E, production + staging) |
| **CI/CD** | GitHub Actions, Cloudflare Tunnels, rsync |
| **Infra** | Nginx, Docker, NVIDIA CUDA, Cloudflare (TLS, WAF) |

## Configuration

### Backend (`config.py`)
```python
HOST = os.getenv("POSE_STUDIO_HOST", "0.0.0.0")  # Server host
PORT = int(os.getenv("POSE_STUDIO_PORT", 49101))  # Server port
POSE_WORKERS = min(cpu_count, 16)                  # Thread pool size
MAX_CONCURRENT_STREAMS = 3                         # Server-wide limit
```

### Frontend (environment files)
- `.env.local` → `VITE_BACKEND_URL=http://localhost:49101`
- `.env.production` → `VITE_BACKEND_URL=https://pose-backend.yingliu.site`
- `VITE_SECOND_BRAIN_URL` → SecondBrain guest chat API base URL

## Testing

```bash
cd tests
npx playwright test                                          # All tests
npx playwright test --config playwright.staging.config.ts    # Staging
npx playwright test --headed                                 # Visible browser
npx playwright show-report                                   # HTML report
```

## Troubleshooting

- **Camera not starting** — Check browser permissions, ensure camera isn't used by another app
- **No pose results** — Check LogPanel (right sidebar) or `tail -f logs/$(date +%Y-%m-%d).log`
- **Stream limit reached** — Max 3 concurrent streams (configurable via `MAX_CONCURRENT_STREAMS`)
- **Low performance** — Reduce FPS, lower JPEG quality, decrease resolution

## Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes following code conventions
3. Run tests: `cd tests && npx playwright test`
4. Commit with conventional messages: `feat: add new feature`
5. Create a pull request to `staging`, then merge to `main`

## License

MIT License

## Acknowledgments

- [MediaPipe](https://google.github.io/mediapipe/) — Pose estimation, object detection, gesture recognition
- [rtmlib](https://github.com/Tau-J/rtmlib) — RTMPose3D inference
- [Three.js](https://threejs.org/) / [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) — 3D rendering
- [FastAPI](https://fastapi.tiangolo.com/) / [Socket.IO](https://socket.io/) — Backend framework
- [Playwright](https://playwright.dev/) — E2E testing
