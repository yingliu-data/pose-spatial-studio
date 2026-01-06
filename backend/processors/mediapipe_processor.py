import cv2
import mediapipe as mp
import numpy as np
from typing import Dict, Any, Optional, List
import logging
from processors.base_processor import BaseProcessor
import config
import threading
import subprocess
import os

from utils.kinetic import Converter

logger = logging.getLogger(__name__)

MEDIAPIPE_LANDMARK_NAMES = [
    "nose", "left_eye_inner", "left_eye", "left_eye_outer",
    "right_eye_inner", "right_eye", "right_eye_outer",
    "left_ear", "right_ear", "mouth_left", "mouth_right",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_pinky", "right_pinky",
    "left_index", "right_index", "left_thumb", "right_thumb",
    "left_hip", "right_hip", "left_knee", "right_knee",
    "left_ankle", "right_ankle", "left_heel", "right_heel",
    "left_foot_index", "right_foot_index"
]

LANDMARK_INDEX_DICT = {name: idx for idx, name in enumerate(MEDIAPIPE_LANDMARK_NAMES)}

OUTPUT_LANDMARK_NAMES = {
    'hipCentre': ['left_hip', 'right_hip'],
    'neck': ['left_shoulder', 'right_shoulder'],
    'leftEye': ['left_eye'],
    'rightEye': ['right_eye'],
    'rightShoulder': ['right_shoulder'],
    'rightElbow': ['right_elbow'],
    'rightWrist': ['right_wrist'],
    'rightThumb': ['right_thumb'],
    'rightIndex': ['right_index'],
    'rightPinky': ['right_pinky'],
    'leftShoulder': ['left_shoulder'],
    'leftElbow': ['left_elbow'],
    'leftWrist': ['left_wrist'],
    'leftThumb': ['left_thumb'],
    'leftIndex': ['left_index'],
    'leftPinky': ['left_pinky'],
    'rightHip': ['right_hip'],
    'rightKnee': ['right_knee'],
    'rightAnkle': ['right_ankle'],
    'rightToe': ['right_foot_index'],
    'leftHip': ['left_hip'],
    'leftKnee': ['left_knee'],
    'leftAnkle': ['left_ankle'],
    'leftToe': ['left_foot_index']
}


MODEL_LINK = {
    "efficientdet_lite0.tflite": "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/latest/efficientdet_lite0.tflite",
    "efficientdet_lite2.tflite": "https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite2/float16/latest/efficientdet_lite2.tflite",
    "ssd_mobilenet_v2.tflite": "https://storage.googleapis.com/mediapipe-models/object_detector/ssd_mobilenet_v2/float32/latest/ssd_mobilenet_v2.tflite"
}

class MediaPipeProcessor(BaseProcessor):
    def __init__(self, processor_id: str, config_dict: Optional[Dict[str, Any]] = None):
        super().__init__(processor_id, config_dict)
        self.processor_id = processor_id
        self.config = config.merge_configs(config_dict)
        pose_processor_config = self.config['pose_processor']
        self.pose_landmarker_model_path = pose_processor_config['pose_landmarker_model_name']
        self.object_detector_model_path = pose_processor_config['object_detector_model_name']
        self.min_detection_confidence = pose_processor_config['min_detection_confidence']
        self.min_tracking_confidence = pose_processor_config['min_tracking_confidence']
        self.min_presence_confidence = pose_processor_config['min_presence_confidence']
        self.pose_landmarker_frame_width = pose_processor_config['pose_landmarker_frame_width']
        self.pose_landmarker_frame_height = pose_processor_config['pose_landmarker_frame_height']
        self.num_poses = pose_processor_config['num_poses']
        self.object_detector_frame_width = pose_processor_config['object_detector_frame_width']
        self.object_detector_frame_height = pose_processor_config['object_detector_frame_height']
        self.landmarker = None
        self.object_detector = None
        self.mp_pose = mp.solutions.pose
        self.latest_pose_result = None
        self.latest_object_result = None
        self.result_lock = threading.Lock()
        self.last_timestamp = 0
    
    def _pose_result_callback(self, result: mp.tasks.vision.PoseLandmarkerResult, output_image: mp.Image, timestamp_ms: int):
        with self.result_lock:
            self.latest_pose_result = result
    
    def _detection_result_callback(self, result: mp.tasks.vision.ObjectDetectorResult, output_image: mp.Image, timestamp_ms: int):
        with self.result_lock:
            self.latest_object_result = result
    
    def initialize(self) -> bool:
        try:
            VisionRunningMode = mp.tasks.vision.RunningMode.LIVE_STREAM
            if not os.path.exists(self.object_detector_model_path):
                model_url = MODEL_LINK.get(os.path.basename(self.object_detector_model_path))
                if model_url is None:
                    raise ValueError(f"No download URL found for model {self.object_detector_model_path}")
                subprocess.run(["wget", "-O", self.object_detector_model_path, model_url], check=True)
                
            object_detector_options = mp.tasks.vision.ObjectDetectorOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=self.object_detector_model_path),
                running_mode=VisionRunningMode,
                max_results=5,
                result_callback=self._detection_result_callback)
            self.object_detector = mp.tasks.vision.ObjectDetector.create_from_options(object_detector_options)

            landmarker_options = mp.tasks.vision.PoseLandmarkerOptions(
                base_options=mp.tasks.BaseOptions(model_asset_path=self.pose_landmarker_model_path),
                running_mode=VisionRunningMode,
                num_poses=self.num_poses,
                min_pose_detection_confidence=self.min_detection_confidence,
                min_pose_presence_confidence=self.min_presence_confidence,
                min_tracking_confidence=self.min_tracking_confidence,
                output_segmentation_masks=False,
                result_callback=self._pose_result_callback
            )
            self.landmarker = mp.tasks.vision.PoseLandmarker.create_from_options(landmarker_options)

            self._is_initialized = True
            logger.info(f"MediaPipe processor {self.processor_id} initialized")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize MediaPipe processor {self.processor_id}: {e}")
            return False
    
    def _mp_image_from_frame(self, frame: np.ndarray, width: int, height: int) -> mp.Image:
        frame = cv2.resize(frame, (width, height))
        return mp.Image(image_format=mp.ImageFormat.SRGB, data=frame)

    def _check_greyscale(self, frame: np.ndarray) -> bool:
        if len(frame.shape) == 2:
            frame = cv2.cvtColor(frame, cv2.COLOR_GRAY2RGB)
        else:
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        return frame

    def process_frame(self, frame: np.ndarray, timestamp_ms: int) -> Dict[str, Any]:
        if not self._is_initialized:
            raise RuntimeError("Processor not initialized")

        if frame is None or np.isnan(frame).any():
            return None
        
        if timestamp_ms <= self.last_timestamp:
            timestamp_ms = self.last_timestamp + 1
        self.last_timestamp = timestamp_ms
        
        frame = self._check_greyscale(frame)
        annotated_frame = cv2.resize(frame, (self.pose_landmarker_frame_width, self.pose_landmarker_frame_height)).copy()
        
        mp_pose_image = self._mp_image_from_frame(frame, self.pose_landmarker_frame_width, self.pose_landmarker_frame_height)
        mp_object_image = self._mp_image_from_frame(frame, self.object_detector_frame_width, self.object_detector_frame_height)

        self.landmarker.detect_async(mp_pose_image, timestamp_ms)
        self.object_detector.detect_async(mp_object_image, timestamp_ms)
        
        with self.result_lock:
            pose_result = self.latest_pose_result
            object_result = self.latest_object_result
        
        landmarks, world_landmarks = [], []
        
        if object_result and object_result.detections:
            for obj in object_result.detections:
                if not obj.categories or obj.categories[0].category_name != "person":
                    continue
                bounding_box = obj.bounding_box
                
                scale_x = self.pose_landmarker_frame_width / self.object_detector_frame_width
                scale_y = self.pose_landmarker_frame_height / self.object_detector_frame_height
                
                x1 = int(bounding_box.origin_x * scale_x)
                y1 = int(bounding_box.origin_y * scale_y)
                x2 = int((bounding_box.origin_x + bounding_box.width) * scale_x)
                y2 = int((bounding_box.origin_y + bounding_box.height) * scale_y)
                
                cv2.rectangle(annotated_frame, (x1, y1), (x2, y2), (0, 255, 0), 2)

        if pose_result and pose_result.pose_landmarks:
            h, w, _ = annotated_frame.shape
            landmark_dict = {}
            for pose_landmarks in pose_result.pose_landmarks:
                for output_landmark_name, mediapipe_landmark_names in OUTPUT_LANDMARK_NAMES.items():
                    landmark_dict[output_landmark_name] = {"x": np.mean([pose_landmarks[LANDMARK_INDEX_DICT[lm]].x for lm in mediapipe_landmark_names]), 
                                                        "y": np.mean([pose_landmarks[LANDMARK_INDEX_DICT[lm]].y for lm in mediapipe_landmark_names]), 
                                                        "z": np.mean([pose_landmarks[LANDMARK_INDEX_DICT[lm]].z for lm in mediapipe_landmark_names]), 
                                                        "visibility": np.mean([pose_landmarks[LANDMARK_INDEX_DICT[lm]].visibility for lm in mediapipe_landmark_names]), 
                                                        "presence": np.mean([pose_landmarks[LANDMARK_INDEX_DICT[lm]].presence for lm in mediapipe_landmark_names]), 
                                                        }
                landmarks.append(landmark_dict)
            
                for landmark in pose_landmarks:
                    cv2.circle(annotated_frame, (int(landmark.x * w), int(landmark.y * h)), 5, (0, 255, 0), -1)
                for start_idx, end_idx in self.mp_pose.POSE_CONNECTIONS:
                    if start_idx < len(pose_landmarks) and end_idx < len(pose_landmarks):
                        cv2.line(annotated_frame, (int(pose_landmarks[start_idx].x * w), int(pose_landmarks[start_idx].y * h)),
                                (int(pose_landmarks[end_idx].x * w), int(pose_landmarks[end_idx].y * h)), (255, 0, 0), 2)
        
        if pose_result and pose_result.pose_world_landmarks:
            for world_pose_landmarks in pose_result.pose_world_landmarks:
                world_landmark_dict = {}
                for output_landmark_name, mediapipe_landmark_names in OUTPUT_LANDMARK_NAMES.items():
                    world_landmark_dict[output_landmark_name] = {"x": np.mean([world_pose_landmarks[LANDMARK_INDEX_DICT[lm]].x for lm in mediapipe_landmark_names]), 
                                                        "y": np.mean([world_pose_landmarks[LANDMARK_INDEX_DICT[lm]].y for lm in mediapipe_landmark_names]), 
                                                        "z": np.mean([world_pose_landmarks[LANDMARK_INDEX_DICT[lm]].z for lm in mediapipe_landmark_names]), 
                                                        "visibility": np.mean([world_pose_landmarks[LANDMARK_INDEX_DICT[lm]].visibility for lm in mediapipe_landmark_names]), 
                                                        "presence": np.mean([world_pose_landmarks[LANDMARK_INDEX_DICT[lm]].presence for lm in mediapipe_landmark_names]), 
                                                        }
                world_landmarks.append(world_landmark_dict)
        
        # Get root position from hip center
        root_position = None
        if world_landmarks and len(world_landmarks) > 0:
            hip_data = world_landmarks[0].get("hipCentre", {})
            if hip_data:
                root_position = {
                    "x": hip_data.get("x", 0),
                    "y": hip_data.get("y", 0),
                    "z": hip_data.get("z", 0)
                }
        
        return {
            "processed_frame": annotated_frame,
            "data": {
                "landmarks": landmarks, 
                "world_landmarks": world_landmarks,
                "fk_data": self._fk_processing(world_landmarks),
                "root_position": root_position,
                "num_poses": len(pose_result.pose_landmarks) if pose_result and pose_result.pose_landmarks else 0},
            "timestamp_ms": timestamp_ms,
            "processor_id": self.processor_id
        }

    def _fk_processing(self, world_landmarks: List[Dict[str, float]]) -> Dict[str, float]:
        if world_landmarks:
            converter = Converter()
            fk_data = converter.coordinate2angle(world_landmarks[0])
            for joint_name, quat_data in fk_data.items():
                if isinstance(quat_data, dict):
                    original_joint = world_landmarks[0].get(joint_name, {})
                    visibility = original_joint.get("visibility", 0.0) if isinstance(original_joint, dict) else 0.0
                    quat_data["visibility"] = visibility
        else:
            fk_data = {}
        return fk_data


    def cleanup(self):
        if self.landmarker:
            self.landmarker.close()
            self.landmarker = None
        if self.object_detector:
            self.object_detector.close()
            self.object_detector = None
        with self.result_lock:
            self.latest_pose_result = None
            self.latest_object_result = None
        self._is_initialized = False
        logger.info(f"MediaPipe processor {self.processor_id} cleaned up")

