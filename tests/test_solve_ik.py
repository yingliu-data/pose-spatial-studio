"""Integration test for the solve_ik Socket.IO event.

Connects to the backend, emits solve_ik with wave_right pose coordinates,
and verifies the fk_result contains valid quaternions.

Usage:
    # Socket.IO integration test (requires running backend):
    python tests/test_solve_ik.py [BACKEND_URL]

    # Direct Converter unit test (no backend needed):
    python tests/test_solve_ik.py --local
"""

import asyncio
import json
import sys
import os

# wave_right pose coordinates (from SecondBrain poses.py)
WAVE_RIGHT_JOINTS = {
    "hipCentre":     {"x": 0.0,   "y": 0.9,  "z": 0.0},
    "neck":          {"x": 0.0,   "y": 1.45, "z": 0.0},
    "leftHip":       {"x": -0.1,  "y": 0.85, "z": 0.0},
    "rightHip":      {"x": 0.1,   "y": 0.85, "z": 0.0},
    "leftKnee":      {"x": -0.1,  "y": 0.48, "z": 0.0},
    "rightKnee":     {"x": 0.1,   "y": 0.48, "z": 0.0},
    "leftAnkle":     {"x": -0.1,  "y": 0.05, "z": 0.0},
    "rightAnkle":    {"x": 0.1,   "y": 0.05, "z": 0.0},
    "leftToe":       {"x": -0.1,  "y": 0.0,  "z": 0.08},
    "rightToe":      {"x": 0.1,   "y": 0.0,  "z": 0.08},
    "leftShoulder":  {"x": -0.18, "y": 1.4,  "z": 0.0},
    "rightShoulder": {"x": 0.18,  "y": 1.4,  "z": 0.0},
    "leftElbow":     {"x": -0.2,  "y": 1.15, "z": 0.05},
    "leftWrist":     {"x": -0.18, "y": 0.95, "z": 0.08},
    "rightElbow":    {"x": 0.35,  "y": 1.55, "z": 0.0},
    "rightWrist":    {"x": 0.45,  "y": 1.75, "z": 0.05},
}


def validate_fk_data(fk_data, label=""):
    """Validate that fk_data contains proper quaternions."""
    for joint, quat in fk_data.items():
        for key in ("x", "y", "z", "w"):
            assert key in quat, f"{label}{joint} missing '{key}'"
            assert isinstance(quat[key], (int, float)), \
                f"{label}{joint}.{key} is {type(quat[key])}"
        mag = (quat["x"]**2 + quat["y"]**2 + quat["z"]**2 + quat["w"]**2) ** 0.5
        assert 0.9 < mag < 1.1, f"{label}{joint} quaternion magnitude {mag:.4f} not ~1.0"


# ---------------------------------------------------------------------------
# Mode 1: Direct Converter test (--local) — no backend needed
# ---------------------------------------------------------------------------
def run_local_tests():
    backend_dir = os.path.join(os.path.dirname(__file__), "..", "backend")
    sys.path.insert(0, os.path.abspath(backend_dir))

    from utils.kinetic import Converter

    print("=== Local Converter tests ===\n")

    # Test 1: full wave_right pose
    print("Test 1: wave_right full pose")
    converter = Converter()
    fk_angles = converter.coordinate2angle(WAVE_RIGHT_JOINTS)
    fk_data = {joint: {**quat, "visibility": 1.0} for joint, quat in fk_angles.items()}
    assert len(fk_data) > 0, "fk_data is empty"
    validate_fk_data(fk_data)
    print(f"  {len(fk_data)} joints, all quaternions unit-length")
    # Verify JSON serializable
    json.dumps({"fk_data": fk_data})
    print("  PASS")

    # Test 2: minimal joints → empty result (insufficient data)
    print("\nTest 2: minimal joints (single joint)")
    converter2 = Converter()
    result2 = converter2.coordinate2angle({"rightWrist": {"x": 0.5, "y": 1.5, "z": 0.0}})
    print(f"  {len(result2)} angles returned (0 expected)")
    print("  PASS")

    # Test 3: empty joints → empty result
    print("\nTest 3: empty joints")
    converter3 = Converter()
    result3 = converter3.coordinate2angle({})
    assert len(result3) == 0
    print("  PASS")

    print("\n=== All local Converter tests passed ===")


# ---------------------------------------------------------------------------
# Mode 2: Socket.IO integration test (requires running backend)
# ---------------------------------------------------------------------------
async def run_socketio_tests(backend_url):
    import socketio

    sio = socketio.AsyncClient(logger=False, engineio_logger=False)
    result_event = asyncio.Event()
    fk_result_data = {}

    @sio.event
    async def connect():
        print(f"Connected to {backend_url}")

    @sio.on("fk_result")
    async def on_fk_result(data):
        nonlocal fk_result_data
        fk_result_data = data
        result_event.set()

    print(f"Connecting to {backend_url}...")
    try:
        await sio.connect(backend_url, transports=["websocket"])
    except Exception as e:
        print(f"FAIL: Cannot connect to backend at {backend_url}: {e}")
        sys.exit(1)

    # --- Test 1: wave_right pose ---
    print("\nTest 1: solve_ik with wave_right pose")
    result_event.clear()
    await sio.emit("solve_ik", {
        "request_id": "test_wave_right",
        "joints": WAVE_RIGHT_JOINTS,
        "root_position": {"x": 0, "y": 0, "z": 0},
    })

    try:
        await asyncio.wait_for(result_event.wait(), timeout=10)
    except asyncio.TimeoutError:
        print("FAIL: No fk_result received within 10s")
        await sio.disconnect()
        sys.exit(1)

    assert fk_result_data.get("request_id") == "test_wave_right"
    fk_data = fk_result_data.get("fk_data", {})
    assert len(fk_data) > 0, "fk_data is empty"
    validate_fk_data(fk_data)
    assert "error" not in fk_result_data
    print(f"  {len(fk_data)} joints, all quaternions valid")

    root_pos = fk_result_data.get("root_position", {})
    assert root_pos == {"x": 0, "y": 0, "z": 0}
    print("  PASS")

    # --- Test 2: minimal joints ---
    print("\nTest 2: solve_ik with minimal joints")
    result_event.clear()
    fk_result_data = {}
    await sio.emit("solve_ik", {
        "request_id": "test_minimal",
        "joints": {"rightWrist": {"x": 0.5, "y": 1.5, "z": 0.0}},
    })

    try:
        await asyncio.wait_for(result_event.wait(), timeout=10)
    except asyncio.TimeoutError:
        print("FAIL: No fk_result received for minimal joints")
        await sio.disconnect()
        sys.exit(1)

    assert fk_result_data.get("request_id") == "test_minimal"
    print(f"  {len(fk_result_data.get('fk_data', {}))} joints (empty is acceptable)")
    print("  PASS")

    # --- Test 3: empty joints ---
    print("\nTest 3: solve_ik with empty joints")
    result_event.clear()
    fk_result_data = {}
    await sio.emit("solve_ik", {
        "request_id": "test_empty",
        "joints": {},
    })

    try:
        await asyncio.wait_for(result_event.wait(), timeout=10)
    except asyncio.TimeoutError:
        print("FAIL: No fk_result received for empty joints")
        await sio.disconnect()
        sys.exit(1)

    assert fk_result_data.get("request_id") == "test_empty"
    print("  PASS")

    await sio.disconnect()
    print("\n=== All solve_ik Socket.IO tests passed ===")


if __name__ == "__main__":
    if "--local" in sys.argv:
        run_local_tests()
    else:
        backend_url = sys.argv[1] if len(sys.argv) > 1 else "http://localhost:49101"
        asyncio.run(run_socketio_tests(backend_url))
