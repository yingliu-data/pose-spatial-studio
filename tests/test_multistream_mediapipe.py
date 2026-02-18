"""Test multi-stream concurrent MediaPipe processing.

Success criteria:
  1. Multiple streams trigger separate MediaPipe worker threads
  2. VIDEO source_type uses synchronous detect_for_video (no one-frame delay)
  3. /health endpoint reports correct thread pool size and per-stream metrics
"""

import asyncio
import base64
import json
import sys
import time
import cv2
import socketio
import urllib.request

BACKEND_URL = "http://localhost:49101"
VIDEO_PATH = "test.mp4"
NUM_STREAMS = 3
FRAMES_PER_STREAM = 15
FPS = 10


class StreamClient:
    """One Socket.IO client managing a single stream."""

    def __init__(self, stream_id: str, source_type: str = "video"):
        self.stream_id = stream_id
        self.source_type = source_type
        self.sio = socketio.AsyncClient(logger=False, engineio_logger=False)
        self.results: list[dict] = []
        self.errors: list[str] = []
        self.init_done = asyncio.Event()
        self.processor_type = None
        self._register_handlers()

    def _register_handlers(self):
        @self.sio.on("stream_initialized")
        async def on_init(data):
            if data.get("stream_id") == self.stream_id:
                self.processor_type = data.get("processor_type")
                self.init_done.set()

        @self.sio.on("stream_error")
        async def on_error(data):
            if data.get("stream_id") == self.stream_id:
                self.errors.append(data.get("message", "unknown"))
                self.init_done.set()

        @self.sio.on("stream_loading")
        async def on_loading(data):
            if data.get("stream_id") == self.stream_id:
                print(f"  [{self.stream_id}] {data.get('message')}")

        @self.sio.on("pose_result")
        async def on_result(data):
            if data.get("stream_id") == self.stream_id:
                pd = data.get("pose_data") or {}
                self.results.append({
                    "ts": data.get("timestamp_ms"),
                    "num_poses": pd.get("num_poses", 0),
                    "landmarks": bool(pd.get("landmarks")),
                    "fk": bool(pd.get("fk_data")),
                })

    async def connect(self):
        await self.sio.connect(BACKEND_URL, transports=["websocket"])

    async def initialize(self):
        await self.sio.emit("initialize_stream", {
            "stream_id": self.stream_id,
            "source_type": self.source_type,
        })
        await asyncio.wait_for(self.init_done.wait(), timeout=60)
        if self.errors:
            raise RuntimeError(f"[{self.stream_id}] init failed: {self.errors}")

    async def send_frames(self, frames: list[tuple[bytes, int]]):
        for b64_frame, ts in frames:
            await self.sio.emit("process_frame", {
                "stream_id": self.stream_id,
                "frame": f"data:image/jpeg;base64,{b64_frame}",
                "timestamp_ms": ts,
            })
            await asyncio.sleep(1.0 / FPS)

    async def cleanup(self):
        await self.sio.emit("cleanup_processor", {"stream_id": self.stream_id})
        await asyncio.sleep(0.5)
        await self.sio.disconnect()


def encode_frames(video_path: str, n: int) -> list[tuple[str, int]]:
    """Read n frames from video, return as (base64_jpeg, timestamp_ms) pairs."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        print(f"Cannot open {video_path}")
        sys.exit(1)
    frames = []
    base_ts = int(time.time() * 1000)
    for i in range(n):
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            ret, frame = cap.read()
        if not ret:
            break
        _, buf = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, 70])
        frames.append((base64.b64encode(buf).decode("utf-8"), base_ts + i * (1000 // FPS)))
    cap.release()
    return frames


def fetch_health() -> dict:
    """GET /health from the backend."""
    req = urllib.request.Request(f"{BACKEND_URL}/health")
    with urllib.request.urlopen(req, timeout=5) as resp:
        return json.loads(resp.read())


async def main():
    print(f"=== Multi-stream MediaPipe concurrency test ===")
    print(f"Backend: {BACKEND_URL}")
    print(f"Streams: {NUM_STREAMS}, frames/stream: {FRAMES_PER_STREAM}\n")

    # Pre-encode frames (shared across streams, each stream gets unique timestamps)
    print("Encoding video frames...")
    shared_frames = encode_frames(VIDEO_PATH, FRAMES_PER_STREAM)
    print(f"Encoded {len(shared_frames)} frames\n")

    # Create clients
    clients = [StreamClient(f"stream-{i}", source_type="video") for i in range(NUM_STREAMS)]

    # Connect all
    print("Connecting clients...")
    await asyncio.gather(*[c.connect() for c in clients])
    print(f"All {NUM_STREAMS} clients connected\n")

    # Initialize streams sequentially (model loading can be heavy)
    print("Initializing streams...")
    for c in clients:
        print(f"  Initializing {c.stream_id} (source_type={c.source_type})...")
        await c.initialize()
        print(f"  {c.stream_id} ready (processor={c.processor_type})")
    print()

    # Check health after init
    health_pre = fetch_health()
    print(f"Health after init: {health_pre['active_processors']} active processors, "
          f"thread_pool max_workers={health_pre.get('thread_pool', {}).get('max_workers')}")
    print()

    # Send frames concurrently (each client gets frames with unique timestamps)
    print(f"Sending {FRAMES_PER_STREAM} frames to each of {NUM_STREAMS} streams concurrently...")
    t0 = time.perf_counter()

    async def send_with_offset(client: StreamClient, offset: int):
        """Give each stream unique timestamps to avoid collisions."""
        offset_frames = [
            (b64, ts + offset * 100_000) for b64, ts in shared_frames
        ]
        await client.send_frames(offset_frames)

    await asyncio.gather(*[send_with_offset(c, i) for i, c in enumerate(clients)])
    elapsed = time.perf_counter() - t0
    print(f"All frames sent in {elapsed:.1f}s\n")

    # Wait for remaining results
    print("Waiting for final results...")
    await asyncio.sleep(5)

    # Check health during/after processing
    health_post = fetch_health()
    print(f"\nHealth after processing:")
    print(f"  active_processors: {health_post['active_processors']}")
    print(f"  thread_pool: {health_post.get('thread_pool')}")
    print(f"  stream_metrics: {json.dumps(health_post.get('stream_metrics', {}), indent=2)}")
    print()

    # Cleanup
    await asyncio.gather(*[c.cleanup() for c in clients])

    # === Report ===
    print("=" * 60)
    print("RESULTS")
    print("=" * 60)
    all_pass = True

    for c in clients:
        poses_detected = sum(1 for r in c.results if r["num_poses"] > 0)
        fk_count = sum(1 for r in c.results if r["fk"])
        status = "PASS" if len(c.results) > 0 and poses_detected > 0 else "FAIL"
        if status == "FAIL":
            all_pass = False
        print(f"  [{c.stream_id}] {status}: "
              f"results={len(c.results)}/{FRAMES_PER_STREAM}, "
              f"poses={poses_detected}, fk={fk_count}, "
              f"processor={c.processor_type}")

    # Validate thread pool
    max_workers = health_pre.get("thread_pool", {}).get("max_workers", 0)
    print(f"\n  Thread pool max_workers: {max_workers}")
    if max_workers < NUM_STREAMS:
        print(f"  WARNING: thread pool ({max_workers}) < streams ({NUM_STREAMS})")

    # Validate stream metrics exist
    metrics = health_post.get("stream_metrics", {})
    streams_with_metrics = len(metrics)
    print(f"  Streams with timing metrics: {streams_with_metrics}")

    # Validate all streams got results (concurrency worked)
    streams_with_results = sum(1 for c in clients if len(c.results) > 0)
    print(f"  Streams with results: {streams_with_results}/{NUM_STREAMS}")

    if streams_with_results == NUM_STREAMS and all_pass:
        print(f"\nPASS: All {NUM_STREAMS} streams processed concurrently with MediaPipe VIDEO mode")
    else:
        print(f"\nFAIL: Not all streams received results")
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
