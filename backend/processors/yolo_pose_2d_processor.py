"""YOLOv8-Pose 2D-only skeleton detection processor.

Runs YOLOv8-Pose for COCO-17 keypoint detection and draws 2D skeleton overlay.
No 3D lifting, no temporal buffer, no FK computation.
"""

import cv2
import numpy as np
from typing import Optional, Dict, Any

from processors.base_processor import BaseProcessor
from processors.yolo_tcpformer_processor import (
    COCO_KEYPOINT_NAMES,
    COCO_SKELETON,
    COCO17_TO_OUTPUT_JOINTS,
    _YOLO_MODEL_MAP,
)
import logging

logger = logging.getLogger(__name__)


class YoloPose2DProcessor(BaseProcessor):
    """2D-only YOLO pose detection processor."""

    def __init__(self, processor_id: str,
                 config_dict: Optional[Dict[str, Any]] = None):
        super().__init__(processor_id, config_dict)
        pose_cfg = self.config['pose_processor']
        self.confidence_threshold = pose_cfg.get('confidence_threshold', 0.5)
        self.device = pose_cfg.get('device', 'cpu')
        self.model_size = pose_cfg.get('model_size', 'm')
        self.yolo_model = None

    def initialize(self) -> bool:
        try:
            from ultralytics import YOLO
            model_file = _YOLO_MODEL_MAP.get(self.model_size, 'yolov8m-pose.pt')
            logger.info(f"Loading YOLOv8-Pose: {model_file} on {self.device}")
            self.yolo_model = YOLO(model_file)
            if self.device == 'cuda':
                self.yolo_model.to('cuda')
            self._is_initialized = True
            logger.info(
                f"YoloPose2D processor {self.processor_id} initialized "
                f"(YOLOv8-Pose-{self.model_size} on {self.device})")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize YoloPose2D: {e}", exc_info=True)
            return False

    def cleanup(self):
        self.yolo_model = None
        self._is_initialized = False
        logger.info(f"YoloPose2D processor {self.processor_id} cleaned up")

    def process_frame(self, frame: np.ndarray,
                      timestamp_ms: int) -> Dict[str, Any]:
        if not self._is_initialized:
            raise RuntimeError("Processor not initialized")
        if frame is None or np.isnan(frame).any():
            return None

        frame = np.ascontiguousarray(frame)
        h, w = frame.shape[:2]
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        results = self.yolo_model.predict(
            frame_rgb, conf=self.confidence_threshold, verbose=False)
        result = results[0]

        annotated = frame.copy()

        if result.keypoints is None or len(result.keypoints) == 0:
            return {
                "processed_frame": cv2.resize(annotated, (640, 480)),
                "data": {"landmarks": [], "num_poses": 0},
                "timestamp_ms": timestamp_ms,
                "processor_id": self.processor_id,
            }

        kpts_2d = result.keypoints.xy.cpu().numpy()       # [N, 17, 2]
        kpt_scores = result.keypoints.conf.cpu().numpy()   # [N, 17]
        bboxes = result.boxes.xyxy.cpu().numpy()           # [N, 4]

        # Draw skeleton overlay
        self._draw_skeleton(annotated, kpts_2d, kpt_scores, bboxes)

        # Build 2D landmarks
        landmarks_2d = self._build_2d_landmarks(kpts_2d, kpt_scores, w, h)

        annotated = cv2.resize(annotated, (640, 480))

        return {
            "processed_frame": annotated,
            "data": {
                "landmarks": landmarks_2d,
                "num_poses": int(len(kpts_2d)),
            },
            "timestamp_ms": timestamp_ms,
            "processor_id": self.processor_id,
        }

    def _draw_skeleton(self, frame, kpts_2d, kpt_scores, bboxes):
        """Draw COCO skeleton overlay on the frame."""
        for pidx in range(len(kpts_2d)):
            kpts = kpts_2d[pidx]
            scores = kpt_scores[pidx]
            if pidx < len(bboxes):
                x1, y1, x2, y2 = bboxes[pidx].astype(int)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
            for i, (pt, s) in enumerate(zip(kpts, scores)):
                if s > self.confidence_threshold:
                    cv2.circle(frame, (int(pt[0]), int(pt[1])), 5,
                               (0, 255, 0), -1)
            for si, ei in COCO_SKELETON:
                if (scores[si] > self.confidence_threshold and
                        scores[ei] > self.confidence_threshold):
                    p1 = (int(kpts[si][0]), int(kpts[si][1]))
                    p2 = (int(kpts[ei][0]), int(kpts[ei][1]))
                    cv2.line(frame, p1, p2, (255, 0, 0), 2)

    @staticmethod
    def _build_2d_landmarks(kpts_2d, kpt_scores, w, h):
        """Build normalized 2D landmarks in unified joint format."""
        result = []
        for person_kpts, person_scores in zip(kpts_2d, kpt_scores):
            lm = {}
            for joint_name, indices in COCO17_TO_OUTPUT_JOINTS.items():
                valid = [i for i in indices if i < len(person_kpts)]
                if not valid:
                    lm[joint_name] = {"x": 0.0, "y": 0.0, "z": 0.0,
                                      "visibility": 0.0, "presence": 0.0}
                    continue
                lm[joint_name] = {
                    "x": float(np.mean([person_kpts[i][0] / w for i in valid])),
                    "y": float(np.mean([person_kpts[i][1] / h for i in valid])),
                    "z": 0.0,
                    "visibility": float(np.mean([person_scores[i] for i in valid])),
                    "presence": float(np.mean([person_scores[i] for i in valid])),
                }
            result.append(lm)
        return result
