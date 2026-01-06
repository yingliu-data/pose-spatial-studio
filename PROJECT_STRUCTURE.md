# Project Structure

## Directory Layout

```
pose-spatial-studio/
├── backend/                                       [Done] (Phase 1 foundation)
│   ├── app.py                                     [Done] (P1)
│   ├── config.py                                  [Done → wire .env] (P1)
│   ├── requirements.txt                           [Done → review CUDA/ML libs] (P1)
│   ├── run_server.sh                              [Done] (P1)
│   ├── Dockerfile                                 [Todo: CUDA base image] (P1)
│   ├── core/
│   │   └── websocket_handler.py                   [Done] (P1)
│   ├── processors/
│   │   ├── base_processor.py                      [Done] (P1)
│   │   ├── image_processor.py                     [Done] (P1)
│   │   └── mediapipe_processor.py                 [Done] (P1)
│   ├── utils/
│   │   ├── cache.py                               [Done] (P1)
│   │   ├── locate_path.py                         [Done] (P1)
│   │   └── logger.py                              [Done] (P1)
│   └── models/                                    [Done → ensure bind‑mount] (P1)
│
├── agent/                                         [Todo: new service] (Phase 2)
│   ├── app.py                                     [Todo] (P2)
│   ├── tools/                                     [Todo: allowlisted tools] (P2)
│   ├── requirements.txt                           [Todo] (P2)
│   └── Dockerfile                                 [Todo] (P2)
│
├── frontend/
│   ├── src/                                       [Done] (P1 foundation)
│   │   ├── main.tsx                               [Done] (P1)
│   │   ├── App.tsx                                [Done] (P1)
│   │   ├── components/
│   │   │   ├── CameraCapture.tsx                  [Done] (P1)
│   │   │   ├── Controls.tsx                       [Done] (P1)
│   │   │   ├── MultiViewGrid.tsx                  [Done] (P1)
│   │   │   ├── Skeleton3DViewer.tsx               [Done] (P1)
│   │   │   └── StreamViewer.tsx                   [Done] (P1)
│   │   ├── hooks/
│   │   │   ├── useCameraDevices.ts                [Done] (P1)
│   │   │   └── useWebSocket.ts                    [Done → point to api domain] (P1)
│   │   ├── services/
│   │   │   ├── socketService.ts                   [Done] (P1)
│   │   │   ├── streamService.ts                   [Done] (P1)
│   │   │   └── streamInitService.ts               [Done] (P1)
│   │   ├── three/
│   │   │   ├── SkeletonRenderer.tsx               [Done] (P1)
│   │   │   ├── VideoPlane.tsx                     [Done] (P1)
│   │   │   └── connections.ts                     [Done] (P1)
│   │   └── types/
│   │       └── pose.ts                            [Done] (P1)
│   ├── package.json                               [Done] (P1)
│   ├── vite.config.ts                             [Done] (P1)
│   └── run_ui.sh                                  [Done] (P1)
│
├── docker/                                        [Todo: infra configs] (P1/P2)
│   ├── compose.edge.yml                           [Todo: Nginx+Certbot] (P1)
│   ├── compose.gpu.yml                            [Todo: backend(+redis)] (P1)
│   └── nginx/conf.d/app.conf                      [Todo: proxy + TLS + WS] (P1)
│
├── infra/                                         [Todo: optional] (P1/P3)
│   ├── monitoring/ (Prometheus, Grafana)          [Todo] (P1)
│   └── systemd/ (service units)                   [Todo] (P1)
│
├── output/                                        [Done] (P1)
├── logs/                                          [Done] (P1)
├── .cache/                                        [Done] (P1)
├── PROJECT_STRUCTURE.md                           [Done → minor cleanup] (P1)
├── README.md                                      [Done → add deploy notes] (P1)
└── TIPS.md
```

## Core Components

### Backend

**app.py** - FastAPI server with Socket.IO, CORS, health endpoints, debug logging

**config.py** - Centralized settings (paths, MediaPipe params, FPS, quality, max streams)

**websocket_handler.py** - Manages:
- Client connections/disconnections
- Stream initialization with processor pipeline
- Frame routing through processors
- Result emission
- Processor cleanup

**base_processor.py** - Abstract class requiring:
- `initialize()` → bool
- `process_frame(frame, timestamp_ms)` → Dict
- `cleanup()` → void

**image_processor.py** - Preprocessing stage (filters, transforms, adjustments)

**mediapipe_processor.py** - Pose estimation (2D/3D landmarks, skeleton overlay)

### Frontend

**App.tsx** - Root component, manages streams and WebSocket connection

**Controls.tsx** - Stream management: add/delete streams, camera selection, config upload

**CameraCapture.tsx** - Camera access, 10 FPS capture, JPEG encoding, receives processed frames

**StreamViewer.tsx** - Container combining camera + 3D viewer + overlays

**Skeleton3DViewer.tsx** - Three.js canvas with video plane + 3D skeleton

**useWebSocket.ts** - Socket connection, pose results Map, connection status

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

## WebSocket Events

### Client → Server

| Event | Payload |
|-------|---------|
| `initialize_stream` | `{ stream_id, processor_type, processor_config }` |
| `process_frame` | `{ stream_id, frame (base64), timestamp_ms }` |
| `cleanup_processor` | `{ stream_id }` |

### Server → Client

| Event | Payload |
|-------|---------|
| `connection_status` | `{ status, sid }` |
| `stream_initialized` | `{ stream_id, status, message }` |
| `stream_error` | `{ stream_id, message }` |
| `pose_result` | `{ stream_id, frame (base64), pose_data, timestamp_ms }` |
| `error` | `{ message }` |

## Configuration

### Backend (config.py)
```python
HOST, PORT, DEBUG
MEDIAPIPE_MODEL_PATH
MIN_DETECTION_CONFIDENCE = 0.5
MIN_TRACKING_CONFIDENCE = 0.5
TARGET_FPS = 15
JPEG_QUALITY = 80
MAX_STREAMS = 10
```

### Frontend (JSON upload)
```json
{
  "min_detection_confidence": 0.7,
  "min_tracking_confidence": 0.7,
  "num_poses": 2
}
```

## Tech Stack

**Backend:** Python 3.13, FastAPI, Socket.IO, MediaPipe, OpenCV, NumPy

**Frontend:** React 18, TypeScript, Three.js, React Three Fiber, Socket.IO Client, Vite

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

- **10 FPS capture** reduces bandwidth/CPU (configurable via `TARGET_FPS` constant)
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

**Frontend console:**
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

