# Pose Spatial Studio

Real-time 3D pose detection and avatar rendering system with WebSocket-based multi-stream support.

## Features

- 🎥 **Real-time Pose Detection** - MediaPipe-powered 3D pose estimation with configurable confidence thresholds
- 🎭 **Interactive 3D Visualization** - Ball-and-stick skeleton model with Three.js rendering
- 📹 **Multi-Camera Support** - Process multiple camera streams simultaneously (up to 10 concurrent streams)
- ⚡ **WebSocket Communication** - Low-latency real-time bi-directional streaming
- 🎮 **Interactive Controls** - Zoom, rotate, and pan controls for 3D visualization
- 🔧 **Modular Architecture** - Extensible processor pipeline with custom processor support
- 📺 **Video Feed Overlay** - Live camera feed rendered on XY plane in 3D space
- 🧪 **Automated Testing** - Playwright-based UI testing with MCP integration
- 🚀 **Auto-Deployment** - GitHub Actions CI/CD pipeline for production deployment

## Quick Start

### Prerequisites

- Python 3.12+
- Node.js 18+
- Modern web browser with camera access

### Installation

1. **Clone the repository:**
   ```bash
   git clone <repository-url>
   cd pose-spatial-studio
   ```

2. **Install dependencies:**
   ```bash
   # Backend
   cd backend
   pip install -r requirements.txt

   # Frontend
   cd ../frontend
   npm install

   # Testing (optional)
   cd ..
   npm install
   ```

### Running the Application

1. **Start the backend server:**
   ```bash
   cd backend
   ./run_server.sh
   ```
   Backend runs on `http://localhost:8000`

2. **Start the frontend:**
   ```bash
   cd frontend
   ./run_ui.sh
   ```
   Frontend runs on `http://localhost:8585`

3. **Open your browser:**
   Navigate to `http://localhost:8585`

## Usage

### Getting Started

1. **Start the camera:**
   - Click "Start Camera" or "Add Stream" button
   - Grant camera permissions when prompted
   - Select your camera from the dropdown (if multiple cameras available)

2. **View the 3D skeleton:**
   - The 3D skeleton will appear in real-time as you move
   - Video feed is overlaid on the XY plane in the 3D space

3. **Interact with the 3D view:**
   - **Left-click + drag**: Rotate the view
   - **Right-click + drag**: Pan the camera
   - **Mouse scroll**: Zoom in/out
   - **Reset**: Refresh the page to reset the view

4. **Multiple streams:**
   - Click "Add Stream" to add additional camera feeds
   - Each stream runs independently with its own processor
   - Maximum 10 concurrent streams (configurable in `config.py`)

5. **Configure processors:**
   - Upload JSON configuration to adjust detection parameters
   - See Configuration section for available options

## Testing

### Automated UI Testing with Playwright

The project includes comprehensive automated UI tests using Playwright.

**Run tests:**
```bash
npm test              # Run all tests
npm run test:headed   # Run with visible browser
npm run test:debug    # Debug mode
npm run test:report   # View HTML report
```

**Playwright MCP Integration:**
If using Claude Code, you can run tests via Playwright MCP:
```
Use ToolSearch with query: "playwright"
Ask: "Run the pose validation tests"
```

See [PLAYWRIGHT_SETUP.md](./.claude/PLAYWRIGHT_SETUP.md) for detailed setup instructions.

## Architecture

### System Overview

```
┌─────────────┐         WebSocket         ┌──────────────────┐
│   Browser   │ ◄─────────────────────► │  FastAPI Server  │
│  (Frontend) │                           │    (Backend)     │
└─────────────┘                           └──────────────────┘
      │                                            │
      │ Camera Feed                                │
      │ (10 FPS JPEG)                              │ Processor Pipeline
      │                                            │
      ▼                                            ▼
┌─────────────┐                           ┌──────────────────┐
│  Three.js   │                           │   ImageProcessor │
│   Canvas    │                           │        ↓         │
│             │     Annotated Frame       │ MediaPipe Pose   │
│ ► Skeleton  │ ◄───────────────────────  │   Estimation     │
└─────────────┘                           └──────────────────┘
```

### Directory Structure

```
pose-spatial-studio/
├── backend/              # Python FastAPI server
│   ├── app.py           # Main server application
│   ├── core/            # WebSocket handler
│   ├── processors/      # Pose estimation pipeline
│   └── utils/           # Logging, caching utilities
│
├── frontend/            # React TypeScript UI
│   ├── src/
│   │   ├── components/  # React components
│   │   ├── three/       # Three.js rendering
│   │   ├── hooks/       # Custom React hooks
│   │   └── services/    # WebSocket services
│   └── vite.config.ts   # Vite configuration
│
├── tests/               # Playwright test suite
│   ├── pose-validation.spec.ts
│   └── README.md
│
├── playwright.config.ts # Test configuration
└── package.json         # Test dependencies
```

See [PROJECT_STRUCTURE.md](./.claude/PROJECT_STRUCTURE.md) for detailed documentation.

## API Endpoints

### WebSocket Events

The application uses Socket.IO for real-time communication between the frontend and backend.

#### Client → Server Events

| Event | Payload | Description |
|-------|---------|-------------|
| `initialize_stream` | `{ stream_id, processor_type, processor_config }` | Initialize a new processing stream |
| `process_frame` | `{ stream_id, frame (base64), timestamp_ms }` | Send a frame for pose processing |
| `cleanup_processor` | `{ stream_id }` | Clean up and remove a processor |

#### Server → Client Events

| Event | Payload | Description |
|-------|---------|-------------|
| `connection_status` | `{ status, sid }` | Connection confirmation with session ID |
| `stream_initialized` | `{ stream_id, status, message }` | Stream initialization confirmation |
| `stream_error` | `{ stream_id, message }` | Stream-specific error notification |
| `pose_result` | `{ stream_id, frame (base64), pose_data, timestamp_ms }` | Processed frame with pose landmarks |
| `error` | `{ message }` | General error notification |

### REST Endpoints

- `GET /health` - Health check endpoint
- `GET /` - API root with server information

## Deployment

### Production Deployment

The frontend is currently hosted on **[robot.yingliu.site](https://robot.yingliu.site)**.

**Automatic Deployment:**
- Every push from `develop` branch to `main` branch triggers GitHub Actions
- Automated build and deployment pipeline
- Zero-downtime deployment

**Manual Deployment:**

1. Build the frontend:
   ```bash
   cd frontend
   npm run build
   ```

2. Deploy the backend:
   ```bash
   cd backend
   # Use your preferred deployment method (Docker, systemd, etc.)
   ```

3. Configure environment variables:
   - Set `HOST` and `PORT` in `backend/config.py`
   - Update Socket.IO URL in `frontend/src/services/socketService.ts`

### Docker Deployment (Planned)

Docker configurations are planned for:
- `docker/compose.edge.yml` - Nginx + Certbot for edge deployment
- `docker/compose.gpu.yml` - Backend with GPU support
- `nginx/conf.d/app.conf` - Reverse proxy + TLS + WebSocket support

## Development Workflow

This project uses Claude Code skills for structured development:

```bash
# Use the develop skill for full workflow
/develop "Add new feature"
```

The workflow includes:
1. ✅ Understanding requirements
2. ✅ Creating feature branch
3. ✅ Implementation with code conventions
4. ✅ **Automated testing** (Playwright or manual)
5. ✅ Documentation updates
6. ✅ Code review (optional)
7. ✅ Commit with conventional messages
8. ✅ Push and create PR

See [.claude/skills/develop/SKILL.md](./.claude/skills/develop/SKILL.md) for details.

## Technology Stack

### Backend
- **Python 3.13** - Runtime
- **FastAPI** - Web framework
- **Socket.IO** - Real-time communication
- **MediaPipe** - Pose estimation
- **OpenCV** - Image processing
- **NumPy** - Numerical operations

### Frontend
- **React 18** - UI framework
- **TypeScript** - Type safety
- **Three.js** - 3D rendering
- **React Three Fiber** - React renderer for Three.js
- **Socket.IO Client** - WebSocket client
- **Vite** - Build tool

### Testing
- **Playwright** - Browser automation
- **Playwright MCP** - Claude Code integration

## Configuration

### Backend Settings

Edit `backend/config.py` to customize server behavior:

```python
# Server Configuration
HOST = "0.0.0.0"              # Server host (0.0.0.0 for all interfaces)
PORT = 8000                    # Server port
DEBUG = True                   # Enable debug logging

# MediaPipe Configuration
MIN_DETECTION_CONFIDENCE = 0.5  # Pose detection threshold (0.0-1.0)
MIN_TRACKING_CONFIDENCE = 0.5   # Pose tracking threshold (0.0-1.0)
MEDIAPIPE_MODEL_PATH = "..."    # Path to MediaPipe model

# Performance Settings
TARGET_FPS = 15                 # Target processing frame rate
JPEG_QUALITY = 80               # JPEG compression quality (0-100)
MAX_STREAMS = 10                # Maximum concurrent streams

# Paths
OUTPUT_DIR = "./output"         # Output directory for processed files
LOG_DIR = "./logs"              # Log file directory
CACHE_DIR = "./.cache"          # Cache directory
```

### Frontend Settings

**Socket Connection:**
Configure in `frontend/src/services/socketService.ts`:
```typescript
const SOCKET_URL = 'http://localhost:8000';
```

**Camera Resolution:**
Configure in `frontend/src/components/CameraCapture.tsx`:
```typescript
const constraints = {
  video: {
    width: { ideal: 1280 },
    height: { ideal: 720 }
  }
};
```

**Runtime Configuration (via UI):**
Upload JSON config to adjust processor parameters:
```json
{
  "min_detection_confidence": 0.7,
  "min_tracking_confidence": 0.7,
  "num_poses": 2
}
```

## Extending the System

### Add a Custom Processor

1. Create a new processor in `backend/processors/`:
   ```python
   from processors.base_processor import BaseProcessor

   class CustomProcessor(BaseProcessor):
       def initialize(self) -> bool:
           # Setup logic
           return True

       def process_frame(self, frame, timestamp_ms):
           # Processing logic
           return {'processed_frame': frame, 'data': {}}

       def cleanup(self):
           # Cleanup logic
           pass
   ```

2. Register in `backend/core/websocket_handler.py`

### Add a Custom Visualization

1. Create a new component in `frontend/src/three/`:
   ```typescript
   export function CustomRenderer({ landmarks }: Props) {
     return (
       <group>
         {/* Your Three.js objects */}
       </group>
     );
   }
   ```

2. Import and use in `Skeleton3DViewer.tsx`

## Performance Optimization

- **Camera capture rate**: 10 FPS (adjustable in `CameraCapture.tsx`)
- **JPEG quality**: 0.8 (configurable in `config.py`)
- **Processor pipeline**: Independent optimization per stage
- **React refs**: Avoid unnecessary re-renders
- **Processor persistence**: Survive React remounts

## Troubleshooting

### Camera not starting?
- Check browser permissions for camera access
- Verify camera is not in use by another application

### No pose results?
- Check backend logs: `tail -f backend/logs/$(date +%Y-%m-%d).log`
- Verify MediaPipe model is downloaded
- Check processor initialization status

### Tests failing?
- Ensure backend is running on port 8000
- Ensure frontend is running on port 8585
- Update test selectors to match your UI components
- See [tests/README.md](./tests/README.md) for troubleshooting

### Low performance?
- Reduce camera capture FPS
- Lower JPEG quality
- Decrease video resolution
- Check CPU/GPU utilization

## Contributing

1. Create a feature branch: `git checkout -b feat/your-feature`
2. Make changes following code conventions
3. Run tests: `npm test`
4. Update documentation
5. Commit with conventional messages: `feat: add new feature`
6. Create a pull request

## License

MIT License

## Acknowledgments

- [MediaPipe](https://google.github.io/mediapipe/) by Google for pose estimation
- [Three.js](https://threejs.org/) community for 3D rendering
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/) team for React integration
- [Playwright](https://playwright.dev/) for testing automation
- [FastAPI](https://fastapi.tiangolo.com/) for the backend framework
- [Socket.IO](https://socket.io/) for real-time communication

---

**Need help?** Check the documentation:
- [Project Structure](./.claude/PROJECT_STRUCTURE.md)
- [Development Workflow](./.claude/skills/develop/SKILL.md)
- [Testing Guide](./tests/README.md)
- [Playwright Setup](./.claude/PLAYWRIGHT_SETUP.md)
