# Changelog

All notable changes to the Pose Spatial Studio project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

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
