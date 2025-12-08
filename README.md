# Pose Spatial Studio

A real-time 3D human pose estimation and visualization system using MediaPipe, React, Three.js, and Python.

## Features

- Real-time 3D pose estimation using MediaPipe
- Interactive 3D skeleton visualization with ball-and-stick model
- Video feed overlay on XY plane
- Multi-stream support for multiple cameras
- WebSocket-based communication for low latency
- Support for different pose estimation models and configurations
- Zoom, rotate, and pan controls for 3D visualization

## Architecture

### Backend (Python)
- FastAPI server with Socket.IO for WebSocket communication
- MediaPipe pose estimation processor
- Modular processor architecture supporting multiple models
- Utility modules for logging, caching, and path management

### Frontend (React + TypeScript + Three.js)
- React 18 with TypeScript
- Three.js with React Three Fiber for 3D rendering
- Socket.IO client for real-time communication
- Modular component architecture

## Prerequisites

- Python 3.12+
- Node.js 16+
- npm or yarn
- Webcam (for live camera feed)

## Installation

### Backend Setup

```bash
cd backend
chmod +x run_server.sh
./run_server.sh
```

The script will:
1. Check for Python 3.12
2. Create a virtual environment
3. Install dependencies
4. Download MediaPipe model
5. Start the server on http://localhost:8000

### Frontend Setup

```bash
cd frontend
chmod +x run_ui.sh
./run_ui.sh
```

The script will:
1. Check for Node.js
2. Install dependencies
3. Start the development server on http://localhost:5173

## Usage

1. Start the backend server first
2. Start the frontend application
3. Click "Start Camera" to begin capturing video
4. The 3D skeleton will appear in real-time
5. Use mouse to interact with the 3D view:
   - Left-click + drag: Rotate
   - Right-click + drag: Pan
   - Scroll: Zoom
6. Click "Add Stream" to add multiple camera feeds

## Deployment

The frontend is currently hosted on [robot.yingliu.site](https://robot.yingliu.site). Every push from the `develop` branch to the `main` branch on GitHub will trigger a GitHub Action for automatic deployment.

## API Endpoints

### WebSocket Events

#### Client to Server
- `process_frame` - Send frame for processing
- `cleanup_processor` - Clean up processor

#### Server to Client
- `connection_status` - Connection confirmation
- `pose_result` - Processed frame with pose data
- `error` - Error notifications

## Configuration

### Backend Configuration (backend/config.py)

- `HOST`: Server host (default: 0.0.0.0)
- `PORT`: Server port (default: 8000)
- `TARGET_FPS`: Target processing FPS (default: 15)
- `MIN_DETECTION_CONFIDENCE`: Pose detection threshold (default: 0.5)
- `MAX_STREAMS`: Maximum concurrent streams (default: 10)

### Frontend Configuration

- Socket URL: Configured in `src/services/socketService.ts`
- Camera resolution: Configured in `src/components/CameraCapture.tsx`

## License

MIT

## Acknowledgments

- MediaPipe by Google
- Three.js community
- React Three Fiber team

