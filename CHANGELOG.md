# Changelog

All notable changes to the Pose Spatial Studio project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## Unreleased


### Added
- Wrist and ankle rotation: compute hand/foot joint angles from finger/toe coordinates

### Fixed
- Ankle dorsiflexion: correct toe offset direction from downward to forward
- Wrist rotation: use accumulated parent world quaternion conjugation for hand bones
- Collapsible sidebar: toggle button to expand streaming window to full screen
- Automated UI testing with Playwright MCP integration
- Playwright test suite for pose capture validation
- Test infrastructure: playwright.config.ts and test scripts
- Comprehensive testing documentation (tests/README.md)
- NPM scripts for running tests (test, test:headed, test:debug, test:report)

### Fixed
- Knee rotation inversion: use parent's accumulated T-pose world quaternion for leg bone conjugation

### Changed
- Updated development workflow (.claude/skills/develop/SKILL.md) to include automated testing option in Step 6

### Infrastructure
- Configured Playwright MCP server in ~/.claude/mcp_settings.json
- Added @playwright/test dependency to project
- Created test-results directory for screenshots and reports

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
