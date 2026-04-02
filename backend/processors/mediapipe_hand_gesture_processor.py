"""MediaPipe Hand Gesture Recognition processor.

Uses MediaPipe GestureRecognizer for combined hand landmark detection
and gesture classification. Draws hand bounding boxes, 21-point hand
skeleton with connections, and gesture/handedness labels on the frame.
Supports LIVE_STREAM (camera) and VIDEO (file) running modes.
"""

import cv2
import mediapipe as mp
import numpy as np
from typing import Dict, Any, Optional
import logging
import threading
import subprocess
import os

from processors.base_processor import BaseProcessor
import config

logger = logging.getLogger(__name__)

# Model download URL
_GESTURE_MODEL_URL = (
    "https://storage.googleapis.com/mediapipe-models/"
    "gesture_recognizer/gesture_recognizer/float16/latest/"
    "gesture_recognizer.task"
)

# MediaPipe hand landmark connections (21 landmarks)
HAND_CONNECTIONS = frozenset([
    # Thumb
    (0, 1), (1, 2), (2, 3), (3, 4),
    # Index finger
    (0, 5), (5, 6), (6, 7), (7, 8),
    # Middle finger
    (0, 9), (9, 10), (10, 11), (11, 12),
    # Ring finger
    (0, 13), (13, 14), (14, 15), (15, 16),
    # Pinky
    (0, 17), (17, 18), (18, 19), (19, 20),
    # Palm
    (5, 9), (9, 13), (13, 17),
])

# Colors (BGR)
_LEFT_HAND_COLOR = (255, 255, 0)   # cyan
_RIGHT_HAND_COLOR = (255, 0, 255)  # magenta
_JOINT_COLOR = (0, 255, 0)         # green
_BONE_COLOR = (255, 128, 0)        # light blue


class MediaPipeHandGestureProcessor(BaseProcessor):
    """Hand gesture recognition processor using MediaPipe GestureRecognizer."""

    def __init__(self, processor_id: str,
                 config_dict: Optional[Dict[str, Any]] = None):
        super().__init__(processor_id, config_dict)
        pose_cfg = self.config['pose_processor']
        self.model_path = pose_cfg.get('gesture_recognizer_model_name',
                                       'gesture_recognizer.task')
        self.frame_width = int(pose_cfg.get('frame_width', 640))
        self.frame_height = int(pose_cfg.get('frame_height', 480))
        self.min_detection_confidence = pose_cfg.get(
            'min_detection_confidence', 0.5)
        self.min_tracking_confidence = pose_cfg.get(
            'min_tracking_confidence', 0.5)
        self.num_hands = int(pose_cfg.get('num_hands', 2))
        self.device = pose_cfg.get('device', 'cpu')
        self.source_type = pose_cfg.get('source_type', 'camera')
        self.gesture_recognizer = None
        self.last_timestamp = 0

        if self.source_type == 'camera':
            self.result_lock = threading.Lock()
            self.latest_gesture_result = None

    def _gesture_result_callback(self, result, output_image, timestamp_ms):
        with self.result_lock:
            self.latest_gesture_result = result

    def _get_delegate(self):
        if self.device == 'cuda':
            logger.info("HandGesture: using GPU delegate")
            return mp.tasks.BaseOptions.Delegate.GPU
        logger.info("HandGesture: using CPU delegate")
        return mp.tasks.BaseOptions.Delegate.CPU

    def _try_initialize_with_delegate(self, delegate) -> bool:
        # Auto-download model if missing
        if not os.path.exists(self.model_path):
            logger.info(f"Downloading gesture_recognizer model to "
                        f"{self.model_path}")
            os.makedirs(os.path.dirname(self.model_path) or '.', exist_ok=True)
            subprocess.run(
                ["wget", "-O", self.model_path, _GESTURE_MODEL_URL],
                check=True)

        use_live = self.source_type == 'camera'
        running_mode = (mp.tasks.vision.RunningMode.LIVE_STREAM if use_live
                        else mp.tasks.vision.RunningMode.VIDEO)
        logger.info(f"HandGesture running mode: {running_mode.name}")

        gr_kwargs = dict(
            base_options=mp.tasks.BaseOptions(
                model_asset_path=self.model_path,
                delegate=delegate),
            running_mode=running_mode,
            num_hands=self.num_hands,
            min_hand_detection_confidence=self.min_detection_confidence,
            min_hand_presence_confidence=self.min_detection_confidence,
            min_tracking_confidence=self.min_tracking_confidence,
        )
        if use_live:
            gr_kwargs['result_callback'] = self._gesture_result_callback
        self.gesture_recognizer = (
            mp.tasks.vision.GestureRecognizer.create_from_options(
                mp.tasks.vision.GestureRecognizerOptions(**gr_kwargs)))
        return True

    def initialize(self) -> bool:
        try:
            delegate = self._get_delegate()
            try:
                self._try_initialize_with_delegate(delegate)
            except Exception as gpu_err:
                if delegate == mp.tasks.BaseOptions.Delegate.GPU:
                    logger.warning(
                        f"HandGesture GPU delegate failed ({gpu_err}), "
                        "falling back to CPU")
                    self._try_initialize_with_delegate(
                        mp.tasks.BaseOptions.Delegate.CPU)
                else:
                    raise
            self._is_initialized = True
            logger.info(
                f"HandGesture processor {self.processor_id} initialized")
            return True
        except Exception as e:
            logger.error(
                f"Failed to initialize HandGesture {self.processor_id}: {e}")
            return False

    def cleanup(self):
        if self.gesture_recognizer:
            self.gesture_recognizer.close()
            self.gesture_recognizer = None
        if self.source_type == 'camera':
            with self.result_lock:
                self.latest_gesture_result = None
        self._is_initialized = False
        logger.info(
            f"HandGesture processor {self.processor_id} cleaned up")

    def process_frame(self, frame: np.ndarray,
                      timestamp_ms: int) -> Dict[str, Any]:
        if not self._is_initialized:
            raise RuntimeError("Processor not initialized")
        if frame is None or np.isnan(frame).any():
            return None

        # Monotonic timestamp enforcement
        if timestamp_ms <= self.last_timestamp:
            timestamp_ms = self.last_timestamp + 1
        self.last_timestamp = timestamp_ms

        # Convert to RGB
        if len(frame.shape) == 2:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_GRAY2RGB)
        else:
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Resize to processing resolution
        annotated = cv2.resize(
            frame_rgb, (self.frame_width, self.frame_height)).copy()
        h, w = annotated.shape[:2]

        # Create MediaPipe image
        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=annotated.copy())

        # Run gesture recognition
        if self.source_type == 'camera':
            self.gesture_recognizer.recognize_async(mp_image, timestamp_ms)
            with self.result_lock:
                gesture_result = self.latest_gesture_result
        else:
            gesture_result = (
                self.gesture_recognizer.recognize_for_video(
                    mp_image, timestamp_ms))

        hands = []
        if (gesture_result and gesture_result.hand_landmarks
                and len(gesture_result.hand_landmarks) > 0):
            for hand_idx in range(len(gesture_result.hand_landmarks)):
                hand_lms = gesture_result.hand_landmarks[hand_idx]

                # Get gesture
                gesture_name = "None"
                gesture_conf = 0.0
                if (gesture_result.gestures
                        and hand_idx < len(gesture_result.gestures)
                        and len(gesture_result.gestures[hand_idx]) > 0):
                    gesture_name = (
                        gesture_result.gestures[hand_idx][0].category_name)
                    gesture_conf = float(
                        gesture_result.gestures[hand_idx][0].score)

                # Get handedness
                handedness = "Unknown"
                if (gesture_result.handedness
                        and hand_idx < len(gesture_result.handedness)
                        and len(gesture_result.handedness[hand_idx]) > 0):
                    handedness = (
                        gesture_result.handedness[hand_idx][0].category_name)

                # Collect landmarks as pixel coords
                pts = []
                landmarks_out = []
                for lm in hand_lms:
                    px = int(lm.x * w)
                    py = int(lm.y * h)
                    pts.append((px, py))
                    landmarks_out.append({
                        "x": float(lm.x),
                        "y": float(lm.y),
                        "z": float(lm.z),
                    })

                # Compute bounding box
                xs = [p[0] for p in pts]
                ys = [p[1] for p in pts]
                margin = 15
                bx1 = max(0, min(xs) - margin)
                by1 = max(0, min(ys) - margin)
                bx2 = min(w, max(xs) + margin)
                by2 = min(h, max(ys) + margin)

                # Choose color by handedness
                box_color = (_LEFT_HAND_COLOR if handedness == "Left"
                             else _RIGHT_HAND_COLOR)

                # Draw bounding box
                cv2.rectangle(
                    annotated, (bx1, by1), (bx2, by2), box_color, 2)

                # Draw hand skeleton connections
                for si, ei in HAND_CONNECTIONS:
                    if si < len(pts) and ei < len(pts):
                        cv2.line(annotated, pts[si], pts[ei],
                                 _BONE_COLOR, 2, cv2.LINE_AA)

                # Draw landmark joints
                for px, py in pts:
                    cv2.circle(annotated, (px, py), 3, _JOINT_COLOR, -1)

                # Draw gesture label
                label = f"{handedness}: {gesture_name}"
                if gesture_conf > 0:
                    label += f" ({gesture_conf:.0%})"
                (tw, th), _ = cv2.getTextSize(
                    label, cv2.FONT_HERSHEY_SIMPLEX, 0.55, 1)
                cv2.rectangle(
                    annotated,
                    (bx1, by1 - th - 10), (bx1 + tw + 6, by1),
                    box_color, -1)
                cv2.putText(
                    annotated, label,
                    (bx1 + 3, by1 - 5),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.55,
                    (255, 255, 255), 1, cv2.LINE_AA)

                hands.append({
                    "landmarks": landmarks_out,
                    "gesture": gesture_name,
                    "confidence": gesture_conf,
                    "handedness": handedness,
                    "bbox": {
                        "x": bx1,
                        "y": by1,
                        "width": bx2 - bx1,
                        "height": by2 - by1,
                    }
                })

        # Convert back to BGR
        annotated = cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR)

        return {
            "processed_frame": annotated,
            "data": {
                "hands": hands,
                "num_hands": len(hands),
            },
            "timestamp_ms": timestamp_ms,
            "processor_id": self.processor_id,
        }
