from rtmlib import Wholebody3d, draw_skeleton
from typing import Optional, List, Dict, Any
from processors.base_processor import BaseProcessor
from utils.kinetic import Converter
import logging
import numpy as np

logger = logging.getLogger(__name__)

# COCO-133 WholeBody keypoint indices → output joint names
# Layout: 0-16 body, 17-22 feet, 23-90 face, 91-111 left hand, 112-132 right hand
COCO133_TO_OUTPUT_JOINTS = {
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
    'leftToe': [17],        # left_big_toe
    'rightToe': [20],       # right_big_toe
    'hipCentre': [11, 12],  # average of left/right hip
    'neck': [5, 6],         # average of left/right shoulder
    'leftThumb': [95],      # left hand thumb tip (91+4)
    'leftIndex': [99],      # left hand index tip (91+8)
    'leftPinky': [111],     # left hand pinky tip (91+20)
    'rightThumb': [116],    # right hand thumb tip (112+4)
    'rightIndex': [120],    # right hand index tip (112+8)
    'rightPinky': [132],    # right hand pinky tip (112+20)
}

# RTMPose3D model constants for 3D coordinate normalization
# Official codec: input_size=(288, 384, 288), z_range=2.1744869
# rtmlib bug: z decoded using image height (384) instead of z input size (288).
# We re-decode z from raw simcc pixel values using the correct z input size.
# For x,y we use image-space 2D keypoints (inverse-affine-transformed by rtmlib)
# with approximate perspective unprojection to get consistent metric coordinates.
_Z_RANGE = 2.1744869      # dataset statistic: max root-relative depth in meters
_Z_INPUT_HALF = 144.0     # codec input_size[2] / 2 = 288 / 2 (z dimension)
_TORSO_LEG_HEIGHT = 1.35  # approximate shoulder-to-ankle height in meters


class RTMPoseProcessor(BaseProcessor):
    def __init__(self, processor_id: str, config_dict: Optional[Dict[str, Any]] = None):
        super().__init__(processor_id, config_dict)
        pose_processor_config = self.config['pose_processor']
        self.backend = pose_processor_config.get('backend', 'onnxruntime')
        self.device = pose_processor_config.get('device', 'cpu')

    def initialize(self) -> bool:
        self._is_initialized = True
        self.wholebody = Wholebody3d(
            mode='balanced',
            to_openpose=False,
            backend=self.backend,
            device=self.device
        )
        logger.info(f"RTMpose 3D processor {self.processor_id} initialized")
        return True

    def process_frame(self, frame: np.ndarray, timestamp_ms: int) -> Dict[str, Any]:
        if not self._is_initialized:
            raise RuntimeError("Processor not initialized")

        if frame is None or np.isnan(frame).any():
            return None

        frame = np.ascontiguousarray(frame)
        keypoints_3d, scores, keypoints_simcc, keypoints_2d = self.wholebody(frame)

        # Fix rtmlib z-depth bug: rtmlib decodes z using image height (384/2=192)
        # but the model codec uses z_input_size (288/2=144). Re-decode from raw
        # simcc pixel values to get correct root-relative depth in meters.
        if keypoints_3d is not None and len(keypoints_3d) > 0:
            z_pixel = keypoints_simcc[..., 2]
            keypoints_3d[..., 2] = (z_pixel / _Z_INPUT_HALF - 1.0) * _Z_RANGE

        annotated_frame = draw_skeleton(frame, keypoints_2d, scores, kpt_thr=0.5)

        if keypoints_3d is None or len(keypoints_3d) == 0:
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

        h, w = frame.shape[:2]
        landmarks = self._build_2d_landmarks(keypoints_2d, scores, w, h)
        world_landmarks = self._build_world_landmarks(
            keypoints_3d, keypoints_2d, scores, w, h)

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
                "num_poses": len(keypoints_3d),
            },
            "timestamp_ms": timestamp_ms,
            "processor_id": self.processor_id
        }

    def _build_2d_landmarks(self, keypoints_2d: np.ndarray, scores: np.ndarray,
                             w: int, h: int) -> List[Dict]:
        """Build normalized 2D screen-space landmarks from COCO-133 keypoints."""
        result = []
        for person_kpts, person_scores in zip(keypoints_2d, scores):
            landmark_dict = {}
            for joint_name, indices in COCO133_TO_OUTPUT_JOINTS.items():
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

    def _build_world_landmarks(self, keypoints_3d: np.ndarray,
                                keypoints_2d: np.ndarray,
                                scores: np.ndarray,
                                w: int, h: int) -> List[Dict]:
        """Build 3D world landmarks combining 2D image-space x,y with 3D z.

        Uses keypoints_2d (inverse-affine-transformed to image space by rtmlib)
        for x,y, then applies approximate perspective unprojection to convert
        to meters consistent with the z-axis. z comes from keypoints_3d
        (already corrected for rtmlib's codec mismatch).
        """
        f_est = float(max(w, h))  # estimated focal length (~53° VFOV)

        result = []
        for person_3d, person_2d, person_scores in zip(
                keypoints_3d, keypoints_2d, scores):
            # Estimate root depth from visible body extent (indices 5-16)
            visible_ys = [person_2d[i][1] for i in range(5, 17)
                          if i < len(person_2d) and person_scores[i] > 0.3]
            if len(visible_ys) >= 2:
                body_height_px = max(visible_ys) - min(visible_ys)
                z_root = _TORSO_LEG_HEIGHT * f_est / max(body_height_px, 50.0)
            else:
                z_root = 3.0

            # Person center in image space (average of hip keypoints)
            hip_indices = [11, 12]
            valid_hips = [i for i in hip_indices if i < len(person_2d)]
            cx = float(np.mean([person_2d[i][0] for i in valid_hips]))
            cy = float(np.mean([person_2d[i][1] for i in valid_hips]))
            xy_scale = z_root / f_est  # meters per image pixel

            landmark_dict = {}
            for joint_name, indices in COCO133_TO_OUTPUT_JOINTS.items():
                valid = [i for i in indices if i < len(person_2d)]
                if not valid:
                    landmark_dict[joint_name] = {
                        "x": 0.0, "y": 0.0, "z": 0.0,
                        "visibility": 0.0, "presence": 0.0
                    }
                    continue
                landmark_dict[joint_name] = {
                    "x": float(np.mean([(person_2d[i][0] - cx) * xy_scale for i in valid])),
                    "y": float(np.mean([(person_2d[i][1] - cy) * xy_scale for i in valid])),
                    "z": float(np.mean([person_3d[i][2] for i in valid])),
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
        self._is_initialized = False
        logger.info(f"RTMpose processor {self.processor_id} cleaned up")

    @property
    def is_initialized(self) -> bool:
        return self._is_initialized
