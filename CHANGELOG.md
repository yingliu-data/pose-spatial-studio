# Changelog

All notable changes to the Pose Spatial Studio project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.3.3] - 19 February 2026

### Fixed
- YOLO+TCPFormer initialization failure: replace super_gradients (dependency conflicts with rtmlib) with ultralytics YOLOv8-Pose
- Remove standalone YOLO-NAS-Pose (`yolo3d`) model; consolidate to single YOLO+TCPFormer pipeline

## [1.3.2] - 19 February 2026

### Fixed
- RTMPose avatar tracking: use per-joint depth-corrected perspective unprojection instead of constant root depth, producing accurate 3D bone directions for FK quaternion computation
- RTMPose world landmark jitter: smooth z_root estimate across frames with MedianFilter to reduce scale fluctuation

## [1.3.1] - 19 February 2026

### Fixed
- Avatar stuck in T-pose: bone name mismatch (`mixamorig:Hips` vs `mixamorigHips`) caused all bone lookups to fail silently
- Avatar not initializing: `useEffect` fired before R3F reconciler assigned group ref; rewrote with `useFrame` lazy initialization
- FK data silently dropped: `kinetic.py` returned non-serializable Python `set` on insufficient joints, failing JSON serialization
- Deploy workflow: TCPFormer variables defined inside unquoted SSH heredoc expanded to empty strings

## [1.3.0] - 19 February 2026

### Added
- YOLO+TCPFormer 2D→3D pose lifting: new `yolo_tcpformer` processor combining YOLO-NAS-Pose 2D detection with TCPFormer temporal transformer for real 3D pose estimation
- TCPFormer model (AAAI 2025) consolidated as lean inference-only module at `backend/models/tcpformer/`
- Auto-download of TCPFormer H36M-81 checkpoint from Google Drive via gdown
- CI/CD pre-downloads TCPFormer checkpoint in both staging and production deploy workflows

## [1.2.2] - 18 February 2026

### Fixed
- Deploy workflows: install cmake, build-essential, protobuf-compiler for Python package builds
- Pin onnx>=1.15.0, pycocotools>=2.0.7 for Python 3.12 wheel compatibility
- Install super-gradients with --no-deps to resolve onnxruntime version conflict with rtmlib
- Add all super-gradients transitive deps to requirements.txt (stringcase, onnxsim, rapidfuzz, pandas, etc.)
- YOLO-NAS-Pose API compatibility with super-gradients 3.7.x (predict() return type change)
- Pre-download YOLO model weights from NVIDIA S3 mirror (sghub.deci.ai defunct post-acquisition)
- Add YOLO-NAS-Pose to frontend model selector dropdown

## [1.2.1] - 18 February 2026

### Fixed
- App title mismatch: `index.html` said "Pose Vision Studio" instead of "Pose Spatial Studio"
- Rewrite `pose-validation.spec.ts` with correct selectors matching current Controls.tsx UI
- Install missing Playwright browsers (Firefox, WebKit) for cross-browser testing

## [1.2.0] - 18 February 2026

### Added
- Model selector dropdown: choose pose estimation model (MediaPipe, RTMPose) at stream creation and switch models live during an active stream without restarting
- Backend `switch_model` WebSocket event for hot-swapping the pose processor while preserving the rest of the pipeline
- YOLO-NAS-Pose processor: new `yolo3d` processor type using super-gradients for pose estimation with COCO 17 keypoints mapped to unified MediaPipe skeleton structure

## [1.1.6] - 18 February 2026

### Performance
- Multi-stream MediaPipe concurrency: dynamic thread pool sizing (POSE_WORKERS), BLAS thread pinning, dual running mode (LIVE_STREAM for camera, VIDEO for video), per-stream timing metrics on /health

## [1.1.5] - 17 February 2026

### Fixed
- RTMPose3D z-depth decoding: rtmlib decodes z using image height (384) instead of codec z input size (288), causing 33% depth compression and systematic offset — re-decode from raw simcc pixel values with correct divisor
- 3D world landmark x,y scale: replace fixed model-crop-space scale with image-space 2D keypoints and approximate perspective unprojection for consistent x,y,z proportions

## [1.1.4] - 15 February 2026

### Fixed
- Multi-stream latency buildup: add frontend backpressure (wait for result before sending next frame) and backend frame dropping (only process latest frame per stream, discard stale queued frames)
- Reduce stale result timeout from 10s to 3s to drop delayed frames more aggressively

## [1.1.3] - 15 February 2026

### Performance
- Concurrent multi-stream processing: offload inference to ThreadPoolExecutor so streams process in parallel instead of sequentially
- CUDA GPU acceleration for RTMPose: add `onnxruntime-gpu` dependency and auto-detect GPU device at startup
- Add RTMPose default config fields (openpose_skeleton, mode, backend, device) to config_template.json

## [1.1.2] - 14 February 2026

### Fixed
- Frontend deploy workflow skipped on merge: switch from pull_request trigger to push trigger on main, matching backend pattern

## [1.1.1] - 14 February 2026

### Fixed
- 3D Viewer GLB load failure in production: move skeleton.glb to public directory so Vite includes it in build output
- Black screen after creating stream: show live video feed immediately while waiting for backend pose processing
- VideoPlane texture leak: dispose old texture when switching from video to processed canvas
- Result timeout too aggressive (2s → 10s): prevents silent frame drops during model cold start
- flush_stream backend crash: fix dict unpacked as tuple in processor pipeline access
- process_frame crash: skip emit when buffer is None instead of crashing on base64.b64encode(None)
- DataProcessor FPS throttling: update last_processed_time so throttle actually works
- numpy.float64 JSON serialization: convert all np.mean() and FK outputs to native Python float for Socket.IO emit

## [1.1.0] - 2025-02-13

### Added
- 3D avatar rendering with Mixamo skeleton (skeleton.glb) driven by real-time pose data
- Forward kinematics engine (`kinetic.py`) for converting 3D joint coordinates to bone rotations
- Wrist rotation from hand plane using index + thumb landmarks for full 3DOF pronation/supination
- Ankle/foot rotation from toe landmark with correct forward offset direction
- Bone mapping system (`boneMapping.ts`) translating unified joint names to Mixamo bone hierarchy
- Quaternion conjugation pipeline: intermediate bone map for arms/thighs, accumulated world quaternion for deeper bones (knees, feet, hands)
- Z-axis negation for leg bones to correct FK/Mixamo convention mismatch
- SLERP smoothing for avatar bone rotations
- Collapsible sidebar for full-screen streaming view
- Apple Glass-inspired UI redesign
- Automated UI testing with Playwright MCP integration
- Playwright test suite for pose capture validation
- Development workflow skill (`.claude/skills/develop/SKILL.md`)

### Fixed
- Knee rotation inversion: use parent's accumulated T-pose world quaternion for leg bone conjugation
- Ankle constant dorsiflexion: corrected toe offset direction from downward `[0,-1,0]` to forward `[0,0,1]`
- Wrist not rotating: switched hand bones from simple intermediate conjugation to accumulated parent world quaternion
- Wrist near-zero FK: replaced single-finger Get_R2 with hand-plane (index + thumb) 3DOF rotation
- Stream grid takes full height when no video controls
- Host config interfering with pre-existing environment variables

### Changed
- Bumped version to 1.1.0 across all packages and backend API
- Updated deploy workflow to Docker container-based deployment with configurable host
- Reorganized project documentation under `.claude/`

### Infrastructure
- Configured Playwright MCP server
- Added `@playwright/test` dependency and test scripts
- Docker container deploy workflow with SSH via Cloudflare

## [1.0.0] - Initial Release

### Backend
- FastAPI server with Socket.IO integration
- WebSocket-based real-time communication
- MediaPipe pose estimation processor
- Image preprocessing pipeline
- Modular processor architecture
- Health check endpoints
- Debug logging system

### Frontend
- React 18 + TypeScript application
- Three.js 3D skeleton visualization
- Real-time camera capture (10 FPS)
- Multi-stream support
- WebSocket client integration
- Responsive UI controls
- Video plane rendering with pose overlay

### Features
- Real-time pose detection and tracking
- 3D skeleton rendering
- Multi-camera support
- Configurable detection parameters
- Stream lifecycle management
- Base64 image encoding/decoding
- Error handling and recovery
