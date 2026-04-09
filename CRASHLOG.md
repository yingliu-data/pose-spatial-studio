# Crash Log

Backend server crash incidents and root cause analysis.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [2026-04-09] GPU Segfault — Rapid Processor Switching

### Summary
Backend server crashed twice in ~1 minute during rapid GPU processor switching. Supervisord auto-restarted both times; server stabilized on third boot.

### Timeline
| Time (UTC) | Event |
|------------|-------|
| 13:45:29 | Client `x_5wve` initialized YOLO Pose 2D (GPU) |
| 13:45:47 | YOLO cleaned up → race condition: `RuntimeError: Processor not initialized` (frame processed after cleanup) |
| 13:45:50 | YOLO re-initialized (GPU), cleaned up 1s later |
| 13:45:54 | Switched to Object Detection (GPU delegate) |
| ~13:47:00 | **CRASH #1** — process killed, no graceful shutdown logged |
| 13:47:03 | Supervisord restarted app (PID 344) |
| 13:47:39 | Hand Gesture processor: GPU delegate failed → CPU fallback |
| 13:47:57 | **CRASH #2** — process killed again, no shutdown log |
| 13:47:57 | Supervisord restarted app (PID 404) |
| 13:48:00 | MediaPipe pose: GPU failed → CPU fallback. Object Detection initialized then cleaned up |
| 13:48:23 | All processors cleaned up. Server stable since |

### Root Cause
**Segfault in native GPU code** during rapid model load/unload cycles.

- No Python traceback for either crash — process was killed by signal (SIGSEGV), not a Python exception
- Both crashes followed rapid GPU allocation/deallocation: YOLO → cleanup → YOLO → cleanup → Object Detection, all within ~25 seconds
- After second restart, MediaPipe GPU delegates failed and fell back to CPU; server has been stable since — confirms GPU native code as the culprit
- `nvidia-smi` showed no GPU processes after recovery (everything running on CPU)
- MediaPipe GPU delegate consistently fails on this container: `ImageCloneCalculator: GPU processing is disabled in build flags` — this is a build-level issue, not runtime

### Environment
- GPU: NVIDIA GeForce RTX 5080 (16GB), Driver 580.95.05, CUDA 13.0
- Deployed version: v1.2.2 (local is v1.4.0)
- Container: `pose-spatial-studio-backend`, managed by supervisord (`autorestart=true`, `startretries=10`)
- ONNX Runtime providers: TensorRT, CUDA, CPU

### Related
- Race condition in YOLO processor cleanup (`Processor not initialized` after cleanup) may be fixed in local v1.4.0
- MediaPipe GPU delegate is broken at the build level — processors fall back to CPU, which masks this crash path going forward
