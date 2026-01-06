# Pose Spatial Studio - Mobile App

A Flutter iOS application for real-time human pose estimation with skeleton visualization. This app captures camera frames, streams them to a backend server, and displays the detected pose as a ball-and-stick skeleton.

## Features

- Real-time camera streaming via native iOS AVFoundation
- WebSocket communication with Socket.IO backend
- Ball-and-stick skeleton visualization with 33-point MediaPipe pose model
- Depth-aware rendering with Z-coordinate shading
- Front/back camera switching
- Connection status monitoring

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  Flutter UI                      │
│  ┌──────────────┐  ┌────────────────────────┐   │
│  │ MainScreen   │  │  SkeletonPainter       │   │
│  └──────┬───────┘  └────────────────────────┘   │
│         │                                        │
│  ┌──────▼───────┐                               │
│  │ PoseProvider │ (State Management)            │
│  └──────┬───────┘                               │
│         │                                        │
│  ┌──────▼───────┐  ┌────────────────────────┐   │
│  │SocketService │  │  CameraService         │   │
│  └──────┬───────┘  └──────────┬─────────────┘   │
└─────────┼─────────────────────┼─────────────────┘
          │                     │
          │              Platform Channels
          │                     │
┌─────────▼─────────┐  ┌───────▼─────────────────┐
│  Backend Server   │  │  CameraHandler.swift    │
│  (Socket.IO)      │  │  (AVFoundation)         │
└───────────────────┘  └─────────────────────────┘
```

## Project Structure

```
mobile_app/
├── lib/
│   ├── main.dart                    # App entry point
│   ├── app.dart                     # MaterialApp configuration
│   ├── config/
│   │   └── app_config.dart          # Server URLs, constants
│   ├── models/
│   │   ├── landmark.dart            # Pose landmark data model
│   │   └── pose_result.dart         # Pose result from backend
│   ├── services/
│   │   ├── socket_service.dart      # Socket.IO WebSocket client
│   │   └── camera_service.dart      # Platform channel bridge
│   ├── providers/
│   │   └── pose_provider.dart       # State management
│   ├── screens/
│   │   └── main_screen.dart         # Main UI screen
│   ├── widgets/
│   │   ├── skeleton_painter.dart    # 2D skeleton CustomPainter
│   │   └── connection_status.dart   # WebSocket status indicator
│   └── utils/
│       └── pose_connections.dart    # MediaPipe skeleton connections
├── ios/
│   └── Runner/
│       ├── AppDelegate.swift        # Flutter plugin registration
│       ├── CameraHandler.swift      # Native camera capture
│       └── Info.plist               # Permissions
├── pubspec.yaml
└── README.md
```

## Prerequisites

- Flutter SDK 3.2.0 or higher
- Xcode 15+ (for iOS development)
- iOS 15.0+ device or simulator
- Backend server running (pose-backend.yingliu.site)

## Setup

1. **Install dependencies:**
   ```bash
   cd mobile_app
   flutter pub get
   ```

2. **iOS setup:**
   ```bash
   cd ios
   pod install
   cd ..
   ```

3. **Run on device:**
   ```bash
   flutter run
   ```

## Configuration

Edit `lib/config/app_config.dart` to change:

- `serverUrl` - Backend WebSocket server URL
- `defaultStreamId` - Stream identifier
- `jpegQuality` - Camera frame compression (0.0-1.0)
- `targetFrameRate` - Frames per second to send

## Backend Protocol

The app communicates with the backend using Socket.IO events:

| Event | Direction | Data |
|-------|-----------|------|
| `initialize_stream` | Client → Server | `{stream_id, processor_config}` |
| `process_frame` | Client → Server | `{stream_id, frame (base64), timestamp_ms}` |
| `pose_result` | Server → Client | `{stream_id, pose_data, timestamp_ms}` |

## Pose Data Format

```json
{
  "pose_data": {
    "landmarks": [
      {"x": 0.5, "y": 0.3, "z": 0.1, "visibility": 0.99, "presence": 0.99}
    ],
    "world_landmarks": [...],
    "num_poses": 1
  }
}
```

## License

Part of the Pose Spatial Studio project.

