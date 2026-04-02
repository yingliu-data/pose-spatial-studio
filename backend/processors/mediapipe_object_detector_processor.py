"""MediaPipe Object Detection processor.

Detects all object categories using MediaPipe ObjectDetector (EfficientDet).
Draws colored bounding boxes and category labels on the video frame.
Supports both LIVE_STREAM (camera) and VIDEO (file) running modes.
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
from processors.mediapipe_processor import MODEL_LINK
import config

logger = logging.getLogger(__name__)

# Color palette for different object categories (BGR)
_CATEGORY_COLORS = [
    (0, 255, 0),    # green
    (255, 0, 0),    # blue
    (0, 0, 255),    # red
    (255, 255, 0),  # cyan
    (0, 255, 255),  # yellow
    (255, 0, 255),  # magenta
    (128, 255, 0),  # spring green
    (255, 128, 0),  # sky blue
    (0, 128, 255),  # orange
    (128, 0, 255),  # violet
]


def _color_for_category(name: str) -> tuple:
    """Deterministic color for a category name."""
    return _CATEGORY_COLORS[hash(name) % len(_CATEGORY_COLORS)]


class MediaPipeObjectDetectorProcessor(BaseProcessor):
    """Object detection processor using MediaPipe ObjectDetector."""

    def __init__(self, processor_id: str,
                 config_dict: Optional[Dict[str, Any]] = None):
        super().__init__(processor_id, config_dict)
        pose_cfg = self.config['pose_processor']
        self.model_path = pose_cfg.get('object_detector_model_name',
                                       'efficientdet_lite2.tflite')
        self.frame_width = int(pose_cfg.get('object_detector_frame_width', 640))
        self.frame_height = int(pose_cfg.get('object_detector_frame_height', 480))
        self.min_detection_confidence = pose_cfg.get('min_detection_confidence', 0.5)
        self.max_results = int(pose_cfg.get('max_results', 10))
        self.device = pose_cfg.get('device', 'cpu')
        self.source_type = pose_cfg.get('source_type', 'camera')
        self.object_detector = None
        self.last_timestamp = 0

        if self.source_type == 'camera':
            self.result_lock = threading.Lock()
            self.latest_object_result = None

    def _detection_result_callback(self, result, output_image, timestamp_ms):
        with self.result_lock:
            self.latest_object_result = result

    def _get_delegate(self):
        if self.device == 'cuda':
            logger.info("ObjectDetector: using GPU delegate")
            return mp.tasks.BaseOptions.Delegate.GPU
        logger.info("ObjectDetector: using CPU delegate")
        return mp.tasks.BaseOptions.Delegate.CPU

    def _try_initialize_with_delegate(self, delegate) -> bool:
        if not os.path.exists(self.model_path):
            model_url = MODEL_LINK.get(os.path.basename(self.model_path))
            if model_url is None:
                raise ValueError(
                    f"No download URL for model {self.model_path}")
            subprocess.run(
                ["wget", "-O", self.model_path, model_url], check=True)

        use_live = self.source_type == 'camera'
        running_mode = (mp.tasks.vision.RunningMode.LIVE_STREAM if use_live
                        else mp.tasks.vision.RunningMode.VIDEO)
        logger.info(f"ObjectDetector running mode: {running_mode.name}")

        od_kwargs = dict(
            base_options=mp.tasks.BaseOptions(
                model_asset_path=self.model_path,
                delegate=delegate),
            running_mode=running_mode,
            max_results=self.max_results,
            score_threshold=self.min_detection_confidence)
        if use_live:
            od_kwargs['result_callback'] = self._detection_result_callback
        self.object_detector = (
            mp.tasks.vision.ObjectDetector.create_from_options(
                mp.tasks.vision.ObjectDetectorOptions(**od_kwargs)))
        return True

    def initialize(self) -> bool:
        try:
            delegate = self._get_delegate()
            try:
                self._try_initialize_with_delegate(delegate)
            except Exception as gpu_err:
                if delegate == mp.tasks.BaseOptions.Delegate.GPU:
                    logger.warning(
                        f"ObjectDetector GPU delegate failed ({gpu_err}), "
                        "falling back to CPU")
                    self._try_initialize_with_delegate(
                        mp.tasks.BaseOptions.Delegate.CPU)
                else:
                    raise
            self._is_initialized = True
            logger.info(
                f"ObjectDetector processor {self.processor_id} initialized")
            return True
        except Exception as e:
            logger.error(
                f"Failed to initialize ObjectDetector {self.processor_id}: {e}")
            return False

    def cleanup(self):
        if self.object_detector:
            self.object_detector.close()
            self.object_detector = None
        if self.source_type == 'camera':
            with self.result_lock:
                self.latest_object_result = None
        self._is_initialized = False
        logger.info(
            f"ObjectDetector processor {self.processor_id} cleaned up")

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

        # Create annotated frame at detector resolution
        annotated = cv2.resize(
            frame_rgb, (self.frame_width, self.frame_height)).copy()

        # Create MediaPipe image
        mp_image = mp.Image(
            image_format=mp.ImageFormat.SRGB,
            data=cv2.resize(frame_rgb,
                            (self.frame_width, self.frame_height)))

        # Run detection
        if self.source_type == 'camera':
            self.object_detector.detect_async(mp_image, timestamp_ms)
            with self.result_lock:
                object_result = self.latest_object_result
        else:
            object_result = self.object_detector.detect_for_video(
                mp_image, timestamp_ms)

        objects = []
        if object_result and object_result.detections:
            for det in object_result.detections:
                if not det.categories:
                    continue
                cat = det.categories[0]
                name = cat.category_name
                score = float(cat.score)
                bb = det.bounding_box
                color = _color_for_category(name)

                x1 = int(bb.origin_x)
                y1 = int(bb.origin_y)
                x2 = int(bb.origin_x + bb.width)
                y2 = int(bb.origin_y + bb.height)

                # Draw bounding box
                cv2.rectangle(annotated, (x1, y1), (x2, y2), color, 2)

                # Draw label background
                label = f"{name} {score:.0%}"
                (tw, th), _ = cv2.getTextSize(
                    label, cv2.FONT_HERSHEY_SIMPLEX, 0.5, 1)
                cv2.rectangle(
                    annotated,
                    (x1, y1 - th - 8), (x1 + tw + 4, y1),
                    color, -1)
                cv2.putText(
                    annotated, label,
                    (x1 + 2, y1 - 4),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.5,
                    (255, 255, 255), 1, cv2.LINE_AA)

                objects.append({
                    "name": name,
                    "confidence": score,
                    "bbox": {
                        "x": int(bb.origin_x),
                        "y": int(bb.origin_y),
                        "width": int(bb.width),
                        "height": int(bb.height),
                    }
                })

        # Convert back to BGR
        annotated = cv2.cvtColor(annotated, cv2.COLOR_RGB2BGR)

        return {
            "processed_frame": annotated,
            "data": {
                "objects": objects,
                "num_objects": len(objects),
            },
            "timestamp_ms": timestamp_ms,
            "processor_id": self.processor_id,
        }
