import cv2
import numpy as np
from typing import Optional, List, Dict, Any
from processors.base_processor import BaseProcessor
from utils.kinetic import Converter
import logging

logger = logging.getLogger(__name__)

# COCO 17 keypoint indices
COCO_KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle"
]

# Map COCO 17 keypoints → unified output joint names
# Missing joints (fingers, toes) fall back to nearest available joint
COCO17_TO_OUTPUT_JOINTS = {
    'leftEye': [1],
    'rightEye': [2],
    'leftShoulder': [5],
    'rightShoulder': [6],
    'leftElbow': [7],
    'rightElbow': [8],
    'leftWrist': [9],
    'rightWrist': [10],
    'leftHip': [11],
    'rightHip': [12],
    'leftKnee': [13],
    'rightKnee': [14],
    'leftAnkle': [15],
    'rightAnkle': [16],
    'leftToe': [15],        # fallback to left_ankle
    'rightToe': [16],       # fallback to right_ankle
    'hipCentre': [11, 12],  # average of left/right hip
    'neck': [5, 6],         # average of left/right shoulder
    'leftThumb': [9],       # fallback to left_wrist
    'leftIndex': [9],       # fallback to left_wrist
    'leftPinky': [9],       # fallback to left_wrist
    'rightThumb': [10],     # fallback to right_wrist
    'rightIndex': [10],     # fallback to right_wrist
    'rightPinky': [10],     # fallback to right_wrist
}

# COCO skeleton connections for drawing overlay
COCO_SKELETON = [
    (0, 1), (0, 2), (1, 3), (2, 4),        # head
    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),  # arms
    (5, 11), (6, 12), (11, 12),              # torso
    (11, 13), (13, 15), (12, 14), (14, 16),  # legs
]

# Approximate shoulder-to-ankle height in meters (for depth estimation)
_TORSO_LEG_HEIGHT = 1.35


class YoloPoseProcessor(BaseProcessor):
    def __init__(self, processor_id: str, config_dict: Optional[Dict[str, Any]] = None):
        super().__init__(processor_id, config_dict)
        pose_config = self.config['pose_processor']
        self.confidence_threshold = pose_config.get('confidence_threshold', 0.5)
        self.device = pose_config.get('device', 'cpu')
        self.model_size = pose_config.get('model_size', 'l')
        self.model = None

    def initialize(self) -> bool:
        try:
            from super_gradients.training import models as sg_models

            model_name = f"yolo_nas_pose_{self.model_size}"
            logger.info(f"Loading YOLO-NAS-Pose model: {model_name} on {self.device}")

            self.model = sg_models.get(
                model_name,
                pretrained_weights="coco_pose"
            )

            if self.device == 'cuda':
                self.model = self.model.cuda()

            self.model.eval()
            self._is_initialized = True
            logger.info(f"YOLO-NAS-Pose processor {self.processor_id} initialized ({model_name})")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize YOLO-NAS-Pose processor {self.processor_id}: {e}")
            return False

    def process_frame(self, frame: np.ndarray, timestamp_ms: int) -> Dict[str, Any]:
        if not self._is_initialized:
            raise RuntimeError("Processor not initialized")

        if frame is None or np.isnan(frame).any():
            return None

        frame = np.ascontiguousarray(frame)
        h, w = frame.shape[:2]

        # Convert BGR to RGB for prediction
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # Run YOLO-NAS-Pose inference
        predictions = self.model.predict(frame_rgb, conf=self.confidence_threshold)
        # super-gradients 3.7.x returns ImagePoseEstimationPrediction directly
        # for a single image; older versions return a subscriptable list
        if hasattr(predictions, 'prediction'):
            prediction = predictions.prediction
        else:
            prediction = predictions[0].prediction

        # Extract detections: poses [N, 17, 3], bboxes [N, 4], scores [N]
        poses = prediction.poses         # (x, y, confidence) per joint
        bboxes = prediction.bboxes_xyxy
        det_scores = prediction.scores

        annotated_frame = frame.copy()

        if poses is None or len(poses) == 0:
            return {
                "processed_frame": annotated_frame,
                "data": {
                    "landmarks": [],
                    "world_landmarks": [],
                    "fk_data": {},
                    "root_position": None,
                    "num_poses": 0,
                },
                "timestamp_ms": timestamp_ms,
                "processor_id": self.processor_id
            }

        # Convert to numpy if needed
        poses = np.array(poses)
        bboxes = np.array(bboxes)
        det_scores = np.array(det_scores)

        # Separate keypoint coords and confidences
        keypoints_2d = poses[:, :, :2]   # [N, 17, 2] (x, y in pixel coords)
        kpt_scores = poses[:, :, 2]      # [N, 17] confidence per keypoint

        # Draw skeleton overlay
        self._draw_skeleton(annotated_frame, keypoints_2d, kpt_scores, bboxes)

        # Build unified landmark dicts
        landmarks = self._build_2d_landmarks(keypoints_2d, kpt_scores, w, h)
        world_landmarks = self._build_world_landmarks(keypoints_2d, kpt_scores, w, h)
        fk_data = self._fk_processing(world_landmarks)

        root_position = None
        if world_landmarks:
            hip_data = world_landmarks[0].get("hipCentre", {})
            if hip_data:
                root_position = {
                    "x": float(hip_data.get("x", 0)),
                    "y": float(-hip_data.get("y", 0)),
                    "z": float(-hip_data.get("z", 0))
                }

        return {
            "processed_frame": annotated_frame,
            "data": {
                "landmarks": landmarks,
                "world_landmarks": world_landmarks,
                "fk_data": fk_data,
                "root_position": root_position,
                "num_poses": len(poses),
            },
            "timestamp_ms": timestamp_ms,
            "processor_id": self.processor_id
        }

    def _draw_skeleton(self, frame: np.ndarray, keypoints_2d: np.ndarray,
                       kpt_scores: np.ndarray, bboxes: np.ndarray):
        """Draw COCO skeleton overlay on the frame."""
        for person_idx in range(len(keypoints_2d)):
            kpts = keypoints_2d[person_idx]
            scores = kpt_scores[person_idx]

            # Draw bounding box
            if person_idx < len(bboxes):
                x1, y1, x2, y2 = bboxes[person_idx].astype(int)
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

            # Draw keypoints
            for i, (pt, score) in enumerate(zip(kpts, scores)):
                if score > self.confidence_threshold:
                    x, y = int(pt[0]), int(pt[1])
                    cv2.circle(frame, (x, y), 5, (0, 255, 0), -1)

            # Draw skeleton connections
            for start_idx, end_idx in COCO_SKELETON:
                if (scores[start_idx] > self.confidence_threshold and
                        scores[end_idx] > self.confidence_threshold):
                    pt1 = (int(kpts[start_idx][0]), int(kpts[start_idx][1]))
                    pt2 = (int(kpts[end_idx][0]), int(kpts[end_idx][1]))
                    cv2.line(frame, pt1, pt2, (255, 0, 0), 2)

    def _build_2d_landmarks(self, keypoints_2d: np.ndarray, kpt_scores: np.ndarray,
                             w: int, h: int) -> List[Dict]:
        """Build normalized 2D screen-space landmarks from COCO 17 keypoints."""
        result = []
        for person_kpts, person_scores in zip(keypoints_2d, kpt_scores):
            landmark_dict = {}
            for joint_name, indices in COCO17_TO_OUTPUT_JOINTS.items():
                valid = [i for i in indices if i < len(person_kpts)]
                if not valid:
                    landmark_dict[joint_name] = {
                        "x": 0.0, "y": 0.0, "z": 0.0,
                        "visibility": 0.0, "presence": 0.0
                    }
                    continue
                landmark_dict[joint_name] = {
                    "x": float(np.mean([person_kpts[i][0] / w for i in valid])),
                    "y": float(np.mean([person_kpts[i][1] / h for i in valid])),
                    "z": 0.0,
                    "visibility": float(np.mean([person_scores[i] for i in valid])),
                    "presence": float(np.mean([person_scores[i] for i in valid])),
                }
            result.append(landmark_dict)
        return result

    def _build_world_landmarks(self, keypoints_2d: np.ndarray, kpt_scores: np.ndarray,
                                w: int, h: int) -> List[Dict]:
        """Build 3D world landmarks using perspective unprojection from 2D keypoints.

        Estimates depth from body proportions (visible body height in pixels vs
        known average body height), then unprojects 2D pixel coords to metric 3D
        coordinates centered on the hip.
        """
        f_est = float(max(w, h))  # estimated focal length

        result = []
        for person_kpts, person_scores in zip(keypoints_2d, kpt_scores):
            # Estimate root depth from visible body extent (indices 5-16: body keypoints)
            visible_ys = [person_kpts[i][1] for i in range(5, 17)
                          if i < len(person_kpts) and person_scores[i] > 0.3]
            if len(visible_ys) >= 2:
                body_height_px = max(visible_ys) - min(visible_ys)
                z_root = _TORSO_LEG_HEIGHT * f_est / max(body_height_px, 50.0)
            else:
                z_root = 3.0

            # Person center in image space (average of hip keypoints)
            hip_indices = [11, 12]
            valid_hips = [i for i in hip_indices if i < len(person_kpts)]
            cx = float(np.mean([person_kpts[i][0] for i in valid_hips]))
            cy = float(np.mean([person_kpts[i][1] for i in valid_hips]))
            xy_scale = z_root / f_est  # meters per image pixel

            landmark_dict = {}
            for joint_name, indices in COCO17_TO_OUTPUT_JOINTS.items():
                valid = [i for i in indices if i < len(person_kpts)]
                if not valid:
                    landmark_dict[joint_name] = {
                        "x": 0.0, "y": 0.0, "z": 0.0,
                        "visibility": 0.0, "presence": 0.0
                    }
                    continue
                landmark_dict[joint_name] = {
                    "x": float(np.mean([(person_kpts[i][0] - cx) * xy_scale for i in valid])),
                    "y": float(np.mean([(person_kpts[i][1] - cy) * xy_scale for i in valid])),
                    "z": 0.0,  # YOLO-NAS-Pose is 2D; z stays at 0 (flat depth plane)
                    "visibility": float(np.mean([person_scores[i] for i in valid])),
                    "presence": float(np.mean([person_scores[i] for i in valid])),
                }
            result.append(landmark_dict)
        return result

    def _fk_processing(self, world_landmarks: List[Dict]) -> Dict:
        """Compute forward kinematics bone rotations from world landmarks."""
        if not world_landmarks:
            return {}

        transformed = {}
        for joint_name, joint_data in world_landmarks[0].items():
            if isinstance(joint_data, dict) and all(k in joint_data for k in ["x", "y", "z"]):
                transformed[joint_name] = {
                    "x": float(joint_data["x"]),
                    "y": float(-joint_data["y"]),
                    "z": float(-joint_data["z"]),
                    "visibility": float(joint_data.get("visibility", 0.0)),
                    "presence": float(joint_data.get("presence", 0.0)),
                }
            else:
                transformed[joint_name] = joint_data

        converter = Converter()
        fk_data = converter.coordinate2angle(transformed)
        for joint_name, quat_data in fk_data.items():
            if isinstance(quat_data, dict):
                original_joint = world_landmarks[0].get(joint_name, {})
                visibility = original_joint.get("visibility", 0.0) if isinstance(original_joint, dict) else 0.0
                quat_data["visibility"] = float(visibility)

        return fk_data

    def cleanup(self):
        self.model = None
        self._is_initialized = False
        logger.info(f"YOLO-NAS-Pose processor {self.processor_id} cleaned up")

    @property
    def is_initialized(self) -> bool:
        return self._is_initialized
