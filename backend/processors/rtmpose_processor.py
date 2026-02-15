from rtmlib import Wholebody, draw_skeleton
from typing import Optional, List, Dict, Any
from processors.base_processor import BaseProcessor
from processors.mediapipe_processor import OUTPUT_LANDMARK_NAMES, LANDMARK_INDEX_DICT
from utils.kinetic import Converter
import logging
import numpy as np

logger = logging.getLogger(__name__)

# Keypoint mappings to MediaPipe 33-point format
COCO17_TO_MEDIAPIPE = {
    0: 0, 1: 2, 2: 5, 3: 7, 4: 8, 5: 11, 6: 12, 7: 13, 8: 14,
    9: 15, 10: 16, 11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28
}

OPENPOSE18_TO_MEDIAPIPE = {
    0: 0, 1: 0, 2: 12, 3: 14, 4: 16, 5: 11, 6: 13, 7: 15,
    8: 24, 9: 26, 10: 28, 11: 23, 12: 25, 13: 27, 14: 5,
    15: 2, 16: 8, 17: 7
}

# COCO-133 (body + hands + face) - map body keypoints only
COCO133_TO_MEDIAPIPE = {
    0: 0, 1: 2, 2: 5, 3: 7, 4: 8, 5: 11, 6: 12, 7: 13, 8: 14,
    9: 15, 10: 16, 11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28
}

# OpenPose-134 (body + hands + face) - map body keypoints only
OPENPOSE134_TO_MEDIAPIPE = {
    0: 0, 1: 0, 2: 12, 3: 14, 4: 16, 5: 11, 6: 13, 7: 15,
    8: 24, 9: 26, 10: 28, 11: 23, 12: 25, 13: 27, 14: 5,
    15: 2, 16: 8, 17: 7
}

# Halpe-26 full body format
HALPE26_TO_MEDIAPIPE = {
    0: 0, 1: 2, 2: 5, 3: 7, 4: 8, 5: 11, 6: 12, 7: 13, 8: 14,
    9: 15, 10: 16, 11: 23, 12: 24, 13: 25, 14: 26, 15: 27, 16: 28,
    17: 17, 18: 19, 19: 21, 20: 18, 21: 20, 22: 22
}

# Hand-21 format - cannot map to body pose effectively
HAND21_TO_MEDIAPIPE = {}  # Empty mapping, hands don't correspond to body landmarks

SKELETON_MAPPINGS = {
    'coco17': COCO17_TO_MEDIAPIPE,
    'coco133': COCO133_TO_MEDIAPIPE,
    'hand21': HAND21_TO_MEDIAPIPE,
    'halpe26': HALPE26_TO_MEDIAPIPE,
    'openpose18': OPENPOSE18_TO_MEDIAPIPE,
    'openpose134': OPENPOSE134_TO_MEDIAPIPE,
}

def convert_rtmpose_to_mediapipe_format(keypoints: np.ndarray, scores: np.ndarray, 
                                        frame_shape: tuple, openpose_skeleton: bool = False) -> List[Dict[str, float]]:
    """Convert RTMPose keypoints to MediaPipe 33-point landmark format.
    
    Automatically detects skeleton format based on keypoint count and skeleton type.
    
    Args:
        keypoints: RTMPose keypoints array
        scores: Confidence scores array
        frame_shape: Frame dimensions for normalization
        openpose_skeleton: Whether using OpenPose-style skeleton
    
    Returns:
        List of landmark dictionaries in MediaPipe format
    """
    if keypoints is None or len(keypoints) == 0:
        return []
    
    h, w = frame_shape[:2]
    if len(keypoints.shape) == 2:
        keypoints = keypoints[np.newaxis, ...]
        scores = scores[np.newaxis, ...]
    
    # Detect skeleton format from keypoint count and skeleton type
    num_keypoints = keypoints.shape[1]
    
    if openpose_skeleton:
        if num_keypoints == 18:
            skeleton_type = 'openpose18'
        elif num_keypoints == 134:
            skeleton_type = 'openpose134'
        elif num_keypoints == 26:
            skeleton_type = 'halpe26'
        else:
            logger.warning(f"Unsupported OpenPose keypoint count: {num_keypoints}. Using openpose18 mapping.")
            skeleton_type = 'openpose18'
    else:
        if num_keypoints == 17:
            skeleton_type = 'coco17'
        elif num_keypoints == 133:
            skeleton_type = 'coco133'
        elif num_keypoints == 21:
            skeleton_type = 'hand21'
        elif num_keypoints == 26:
            skeleton_type = 'halpe26'
        else:
            logger.warning(f"Unsupported COCO keypoint count: {num_keypoints}. Using coco17 mapping.")
            skeleton_type = 'coco17'
    
    mapping = SKELETON_MAPPINGS.get(skeleton_type, COCO17_TO_MEDIAPIPE)
    
    if skeleton_type == 'hand21':
        logger.warning("Hand-21 format detected but cannot map to body pose landmarks.")
        return []
    
    landmarks = []
    for person_keypoints, person_scores in zip(keypoints, scores):
        mediapipe_landmarks = [{"x": 0.0, "y": 0.0, "z": 0.0, "visibility": 0.0, "presence": 0.0} for _ in range(33)]
        
        for rtm_idx, mp_idx in mapping.items():
            if rtm_idx < len(person_keypoints):
                kpt = person_keypoints[rtm_idx]
                score = float(person_scores[rtm_idx])
                mediapipe_landmarks[mp_idx] = {
                    "x": float(kpt[0] / w) if w > 0 else 0.0,
                    "y": float(kpt[1] / h) if h > 0 else 0.0,
                    "z": float(kpt[2] / w) if len(kpt) > 2 and w > 0 else 0.0,
                    "visibility": score,
                    "presence": score
                }
        landmarks.extend(mediapipe_landmarks)
    
    return landmarks

class RTMPoseProcessor(BaseProcessor):
    # TODO: Improve performance
    def __init__(self, processor_id: str, config_dict: Optional[Dict[str, Any]] = None):
        super().__init__(processor_id, config_dict)
        pose_processor_config = self.config['pose_processor']
        self.openpose_skeleton = pose_processor_config.get('openpose_skeleton', False)
        self.mode = pose_processor_config.get('mode', 'lightweight')
        self.backend = pose_processor_config.get('backend', 'onnxruntime')
        self.device = pose_processor_config.get('device', 'cpu')
        
    def initialize(self) -> bool:
        self._is_initialized = True
        self.wholebody = Wholebody(to_openpose=self.openpose_skeleton,
                                  mode=self.mode,
                                  backend=self.backend,
                                  device=self.device)
        logger.info(f"RTMpose processor {self.processor_id} initialized")
        return True
    
    def process_frame(self, frame: np.ndarray, timestamp_ms: int) -> Dict[str, Any]:
        if not self._is_initialized:
            raise RuntimeError("Processor not initialized")

        if frame is None or np.isnan(frame).any():
            return None

        frame = np.ascontiguousarray(frame)
        keypoints, scores = self.wholebody(frame)
        annotated_frame = draw_skeleton(frame, keypoints, scores, openpose_skeleton=self.openpose_skeleton, kpt_thr=0.5)

        # Convert RTMPose output to MediaPipe 33-point flat list
        flat_landmarks = convert_rtmpose_to_mediapipe_format(keypoints, scores, frame.shape, self.openpose_skeleton)

        # Convert flat list to named dict format matching MediaPipe output
        landmarks = self._to_named_landmarks(flat_landmarks)
        world_landmarks = landmarks  # RTMPose has no separate world coordinates

        # FK processing for avatar animation
        fk_data = self._fk_processing(world_landmarks)

        # Root position from hip centre
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
                "num_poses": len(keypoints) if keypoints is not None and len(keypoints) > 0 else 0,
            },
            "timestamp_ms": timestamp_ms,
            "processor_id": self.processor_id
        }

    def _to_named_landmarks(self, flat_landmarks: List[Dict]) -> List[Dict]:
        """Convert flat 33-point landmark list to named dict format matching MediaPipe output."""
        if not flat_landmarks or len(flat_landmarks) < 33:
            return []

        named_landmarks = []
        # Each person has 33 landmarks
        for i in range(0, len(flat_landmarks), 33):
            person_points = flat_landmarks[i:i + 33]
            if len(person_points) < 33:
                break

            landmark_dict = {}
            for output_name, mediapipe_names in OUTPUT_LANDMARK_NAMES.items():
                indices = [LANDMARK_INDEX_DICT[name] for name in mediapipe_names]
                landmark_dict[output_name] = {
                    "x": float(np.mean([person_points[idx]["x"] for idx in indices])),
                    "y": float(np.mean([person_points[idx]["y"] for idx in indices])),
                    "z": float(np.mean([person_points[idx]["z"] for idx in indices])),
                    "visibility": float(np.mean([person_points[idx]["visibility"] for idx in indices])),
                    "presence": float(np.mean([person_points[idx]["presence"] for idx in indices])),
                }
            named_landmarks.append(landmark_dict)

        return named_landmarks

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