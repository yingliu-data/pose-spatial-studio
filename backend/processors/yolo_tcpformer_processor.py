"""YOLOv8-Pose 2D detection + TCPFormer temporal 2D→3D lifting processor.

Pipeline per frame:
  1. YOLOv8-Pose detects COCO-17 keypoints (2D pixel coords)
  2. Convert COCO-17 → H36M-17 ordering
  3. Normalize: center on person bounding-box, scale to ~[-1,1]
  4. Append to 81-frame sliding window (pad by repeating when < 81)
  5. TCPFormer lifts [1,81,17,3] → [1,81,17,3] root-relative 3D
  6. Take last-frame prediction for minimal latency
  7. Map H36M-17 → unified output joints, scale to meters
  8. Perspective-unproject root position, compute FK quaternions
"""

import cv2
import numpy as np
from collections import deque
from pathlib import Path
from typing import Optional, List, Dict, Any

import torch

from processors.base_processor import BaseProcessor
from utils.kinetic import Converter
import config as app_config
import logging

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_N_FRAMES = 81  # TCPFormer temporal window
_N_JOINTS_H36M = 17

# Approximate shoulder-to-ankle height in meters (for root-depth estimation)
_TORSO_LEG_HEIGHT = 1.35

# COCO-17 keypoint names (for reference)
COCO_KEYPOINT_NAMES = [
    "nose", "left_eye", "right_eye", "left_ear", "right_ear",
    "left_shoulder", "right_shoulder", "left_elbow", "right_elbow",
    "left_wrist", "right_wrist", "left_hip", "right_hip",
    "left_knee", "right_knee", "left_ankle", "right_ankle"
]

# COCO skeleton connections for overlay drawing
COCO_SKELETON = [
    (0, 1), (0, 2), (1, 3), (2, 4),
    (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),
    (5, 11), (6, 12), (11, 12),
    (11, 13), (13, 15), (12, 14), (14, 16),
]

# COCO-17 → H36M-17 mapping.  Each entry is (h36m_idx, [list of coco indices to average]).
_COCO_TO_H36M = [
    (0,  [11, 12]),    # Hip (root) = avg(left_hip, right_hip)
    (1,  [12]),        # Right Hip
    (2,  [14]),        # Right Knee
    (3,  [16]),        # Right Ankle
    (4,  [11]),        # Left Hip
    (5,  [13]),        # Left Knee
    (6,  [15]),        # Left Ankle
    (7,  None),        # Spine — computed as avg(hip_center, thorax) below
    (8,  [5, 6]),      # Thorax = avg(left_shoulder, right_shoulder)
    (9,  [0]),         # Neck/Nose
    (10, [3, 4]),      # Head = avg(left_ear, right_ear)
    (11, [5]),         # Left Shoulder
    (12, [7]),         # Left Elbow
    (13, [9]),         # Left Wrist
    (14, [6]),         # Right Shoulder
    (15, [8]),         # Right Elbow
    (16, [10]),        # Right Wrist
]

# H36M-17 → unified output joint mapping
H36M_TO_UNIFIED = {
    0:  ['hipCentre'],
    1:  ['rightHip'],
    2:  ['rightKnee'],
    3:  ['rightAnkle', 'rightToe'],
    4:  ['leftHip'],
    5:  ['leftKnee'],
    6:  ['leftAnkle', 'leftToe'],
    8:  ['neck'],
    9:  [],  # Nose — eyes derived from 2D COCO keypoints below
    11: ['leftShoulder'],
    12: ['leftElbow'],
    13: ['leftWrist', 'leftThumb', 'leftIndex', 'leftPinky'],
    14: ['rightShoulder'],
    15: ['rightElbow'],
    16: ['rightWrist', 'rightThumb', 'rightIndex', 'rightPinky'],
}

# COCO-17 → unified output joint mapping (for 2D landmark output)
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

# YOLOv8-Pose model size mapping
_YOLO_MODEL_MAP = {
    'n': 'yolov8n-pose.pt',
    's': 'yolov8s-pose.pt',
    'm': 'yolov8m-pose.pt',
    'l': 'yolov8l-pose.pt',
    'x': 'yolov8x-pose.pt',
}

# Google Drive file ID for TCPFormer H36M-81 checkpoint
_GDRIVE_FILE_ID = '14D_gfCflgl67-nl0L2MJijbARizbphnP'
_CHECKPOINT_NAME = 'TCPFormer_h36m_81.pth.tr'


def _download_checkpoint(dest: Path) -> None:
    """Download TCPFormer checkpoint from Google Drive if not present."""
    if dest.exists():
        return
    dest.parent.mkdir(parents=True, exist_ok=True)
    logger.info(f"Downloading TCPFormer checkpoint to {dest} ...")
    try:
        import gdown
        url = f'https://drive.google.com/uc?id={_GDRIVE_FILE_ID}'
        gdown.download(url, str(dest), quiet=False)
        logger.info("TCPFormer checkpoint downloaded successfully")
    except Exception as e:
        raise RuntimeError(
            f"Failed to download TCPFormer checkpoint: {e}. "
            f"Install gdown (`pip install gdown`) or manually download from "
            f"https://drive.google.com/file/d/{_GDRIVE_FILE_ID}/view "
            f"and place at {dest}"
        ) from e


def _coco17_to_h36m17(kpts_coco: np.ndarray, scores_coco: np.ndarray):
    """Convert COCO-17 keypoints to H36M-17 ordering.

    Args:
        kpts_coco: (17, 2) pixel coordinates
        scores_coco: (17,) confidence scores
    Returns:
        kpts_h36m: (17, 2)
        scores_h36m: (17,)
    """
    kpts = np.zeros((_N_JOINTS_H36M, 2), dtype=np.float32)
    scores = np.zeros(_N_JOINTS_H36M, dtype=np.float32)

    for h_idx, coco_indices in _COCO_TO_H36M:
        if coco_indices is None:
            continue  # Spine — filled below
        coords = kpts_coco[coco_indices]
        kpts[h_idx] = coords.mean(axis=0)
        scores[h_idx] = scores_coco[coco_indices].mean()

    # Spine = average of hip center (idx 0) and thorax (idx 8)
    kpts[7] = (kpts[0] + kpts[8]) / 2.0
    scores[7] = (scores[0] + scores[8]) / 2.0

    return kpts, scores


class YoloTCPFormerProcessor(BaseProcessor):
    """Combined YOLO 2D + TCPFormer 3D lifting processor."""

    def __init__(self, processor_id: str,
                 config_dict: Optional[Dict[str, Any]] = None):
        super().__init__(processor_id, config_dict)
        pose_cfg = self.config['pose_processor']
        self.confidence_threshold = pose_cfg.get('confidence_threshold', 0.5)
        self.device = pose_cfg.get('device', 'cpu')
        self.model_size = pose_cfg.get('model_size', 'm')
        self.yolo_model = None
        self.tcp_model = None
        # Per-person frame buffer: person_idx → deque of (h36m_kpts_norm, scores)
        self._frame_buffer: deque = deque(maxlen=_N_FRAMES)

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------
    def initialize(self) -> bool:
        try:
            self._init_yolo()
            self._init_tcpformer()
            self._is_initialized = True
            logger.info(
                f"YoloTCPFormer processor {self.processor_id} initialized "
                f"(YOLOv8-Pose-{self.model_size} + TCPFormer-81 on {self.device})")
            return True
        except Exception as e:
            logger.error(f"Failed to initialize YoloTCPFormer: {e}",
                         exc_info=True)
            return False

    def _init_yolo(self):
        from ultralytics import YOLO
        model_file = _YOLO_MODEL_MAP.get(self.model_size, 'yolov8m-pose.pt')
        logger.info(f"Loading YOLOv8-Pose: {model_file} on {self.device}")
        self.yolo_model = YOLO(model_file)
        if self.device == 'cuda':
            self.yolo_model.to('cuda')

    def _init_tcpformer(self):
        from models.tcpformer.model import MemoryInducedTransformer

        ckpt_path = app_config.MODELS_DIR / 'tcpformer' / _CHECKPOINT_NAME
        _download_checkpoint(ckpt_path)

        logger.info(f"Loading TCPFormer (n_frames={_N_FRAMES}) on {self.device}")
        self.tcp_model = MemoryInducedTransformer(
            n_layers=16, dim_in=3, dim_feat=128, dim_rep=512, dim_out=3,
            mlp_ratio=4, num_heads=8, num_joints=17, n_frames=_N_FRAMES,
            use_layer_scale=True, layer_scale_init_value=1e-5,
            use_adaptive_fusion=True, qkv_bias=False,
        )

        state = torch.load(str(ckpt_path), map_location='cpu', weights_only=False)
        # Checkpoint may wrap state_dict under various keys
        if isinstance(state, dict):
            for key in ('model_pos', 'state_dict', 'model'):
                if key in state:
                    state = state[key]
                    break
        # Strip DataParallel 'module.' prefix from checkpoint keys
        if any(k.startswith('module.') for k in state.keys()):
            state = {k.removeprefix('module.'): v for k, v in state.items()}
        self.tcp_model.load_state_dict(state, strict=False)

        if self.device == 'cuda':
            self.tcp_model = self.tcp_model.cuda()
        self.tcp_model.eval()
        logger.info("TCPFormer model loaded successfully")

    def cleanup(self):
        self.yolo_model = None
        self.tcp_model = None
        self._frame_buffer.clear()
        self._is_initialized = False
        logger.info(f"YoloTCPFormer processor {self.processor_id} cleaned up")

    @property
    def is_initialized(self) -> bool:
        return self._is_initialized

    # ------------------------------------------------------------------
    # Frame processing
    # ------------------------------------------------------------------
    def process_frame(self, frame: np.ndarray,
                      timestamp_ms: int) -> Dict[str, Any]:
        if not self._is_initialized:
            raise RuntimeError("Processor not initialized")
        if frame is None or np.isnan(frame).any():
            return None

        frame = np.ascontiguousarray(frame)
        h, w = frame.shape[:2]
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)

        # --- YOLO 2D detection ---
        results = self.yolo_model.predict(
            frame_rgb, conf=self.confidence_threshold, verbose=False)
        result = results[0]

        annotated = frame.copy()

        if result.keypoints is None or len(result.keypoints) == 0:
            self._frame_buffer.clear()
            return self._empty_result(annotated, timestamp_ms)

        kpts_2d = result.keypoints.xy.cpu().numpy()       # [N, 17, 2]
        kpt_scores = result.keypoints.conf.cpu().numpy()   # [N, 17]
        bboxes = result.boxes.xyxy.cpu().numpy()           # [N, 4]

        # Draw skeleton overlay
        self._draw_skeleton(annotated, kpts_2d, kpt_scores, bboxes)

        # Use first (highest-confidence) person only for TCPFormer
        person_kpts = kpts_2d[0]       # (17, 2)
        person_scores = kpt_scores[0]  # (17,)

        # --- COCO → H36M conversion ---
        h36m_kpts, h36m_scores = _coco17_to_h36m17(person_kpts, person_scores)

        # --- Normalize 2D keypoints ---
        # TCPFormer expects normalize_screen_coordinates: X / w * 2 - [1, h/w]
        kpts_norm = h36m_kpts / w * 2 - np.array([1.0, h / w], dtype=np.float32)
        # Input tensor: (17, 3) = (x_norm, y_norm, confidence)
        inp_frame = np.concatenate(
            [kpts_norm, h36m_scores[:, None]], axis=-1
        ).astype(np.float32)

        # --- Buffer management ---
        self._frame_buffer.append(inp_frame)

        # Pad to _N_FRAMES by repeating first frame
        buf = list(self._frame_buffer)
        while len(buf) < _N_FRAMES:
            buf.insert(0, buf[0])
        input_seq = np.stack(buf, axis=0)  # (81, 17, 3)

        # --- TCPFormer 3D inference ---
        with torch.no_grad():
            inp = torch.from_numpy(input_seq).unsqueeze(0).float()  # (1,81,17,3)
            if self.device == 'cuda':
                inp = inp.cuda()
            out_3d = self.tcp_model(inp)  # (1, 81, 17, 3)
            pred_3d = out_3d[0, -1].cpu().numpy()  # last frame → (17, 3)

        # TCPFormer output is root-relative in a metric scale (~meters)
        pred_3d_m = pred_3d

        # --- Build 2D landmarks (from YOLO COCO-17, normalized) ---
        landmarks_2d = self._build_2d_landmarks(kpts_2d, kpt_scores, w, h)

        # --- Build 3D world landmarks from TCPFormer output ---
        f_est = float(max(w, h))
        z_root = self._estimate_root_depth(person_kpts, person_scores, f_est)
        world_landmarks = self._build_world_landmarks(
            pred_3d_m, h36m_scores, person_kpts, person_scores, w, h, z_root,
            f_est)

        # --- FK ---
        fk_data = self._fk_processing(world_landmarks)

        root_position = None
        if world_landmarks:
            hip = world_landmarks[0].get('hipCentre', {})
            if hip:
                root_position = {
                    "x": float(hip.get("x", 0)),
                    "y": float(-hip.get("y", 0)),
                    "z": float(-hip.get("z", 0)),
                }

        return {
            "processed_frame": annotated,
            "data": {
                "landmarks": landmarks_2d,
                "world_landmarks": world_landmarks,
                "fk_data": fk_data,
                "root_position": root_position,
                "num_poses": int(len(kpts_2d)),
            },
            "timestamp_ms": timestamp_ms,
            "processor_id": self.processor_id,
        }

    # ------------------------------------------------------------------
    # Helpers
    # ------------------------------------------------------------------
    def _empty_result(self, frame, timestamp_ms):
        return {
            "processed_frame": frame,
            "data": {
                "landmarks": [],
                "world_landmarks": [],
                "fk_data": {},
                "root_position": None,
                "num_poses": 0,
            },
            "timestamp_ms": timestamp_ms,
            "processor_id": self.processor_id,
        }

    @staticmethod
    def _estimate_root_depth(person_kpts, person_scores, f_est):
        """Estimate root depth from visible body height in pixels."""
        visible_ys = [person_kpts[i][1] for i in range(5, 17)
                      if person_scores[i] > 0.3]
        if len(visible_ys) >= 2:
            body_h = max(visible_ys) - min(visible_ys)
            return _TORSO_LEG_HEIGHT * f_est / max(body_h, 50.0)
        return 3.0

    def _build_2d_landmarks(self, kpts_2d, kpt_scores, w, h):
        """Build normalized 2D landmarks in unified joint format (from COCO-17)."""
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

    def _build_world_landmarks(self, pred_3d_m, h36m_scores,
                               person_kpts_coco, coco_scores,
                               w, h, z_root, f_est):
        """Build 3D world landmarks from TCPFormer root-relative output.

        The root-relative 3D offsets are added to the perspective-unprojected
        hip position to produce absolute metric coordinates.
        """
        # Hip center in pixel space (from COCO indices 11, 12)
        hip_indices = [11, 12]
        cx = float(np.mean([person_kpts_coco[i][0] for i in hip_indices]))
        cy = float(np.mean([person_kpts_coco[i][1] for i in hip_indices]))
        xy_scale = z_root / f_est

        # Absolute root position in meters
        root_x = (cx - w / 2.0) * xy_scale
        root_y = (cy - h / 2.0) * xy_scale

        lm = {}
        for h_idx, joint_names in H36M_TO_UNIFIED.items():
            x_m = float(pred_3d_m[h_idx, 0] + root_x)
            y_m = float(pred_3d_m[h_idx, 1] + root_y)
            z_m = float(pred_3d_m[h_idx, 2])
            vis = float(h36m_scores[h_idx])
            for name in joint_names:
                lm[name] = {
                    "x": x_m, "y": y_m, "z": z_m,
                    "visibility": vis, "presence": vis,
                }

        # Derive eye positions from 2D COCO keypoints + 3D head depth
        # COCO: 1=left_eye, 2=right_eye; H36M: 9=nose (depth reference)
        head_z = float(pred_3d_m[9, 2])
        for eye_name, coco_idx in [('leftEye', 1), ('rightEye', 2)]:
            vis = float(coco_scores[coco_idx])
            if vis > 0.3:
                ex = float((person_kpts_coco[coco_idx][0] - w / 2.0) * xy_scale)
                ey = float((person_kpts_coco[coco_idx][1] - h / 2.0) * xy_scale)
                lm[eye_name] = {
                    "x": ex, "y": ey, "z": head_z,
                    "visibility": vis, "presence": vis,
                }

        return [lm]

    def _fk_processing(self, world_landmarks: List[Dict]) -> Dict:
        """Compute FK bone rotations from world landmarks."""
        if not world_landmarks:
            return {}
        transformed = {}
        for jn, jd in world_landmarks[0].items():
            if isinstance(jd, dict) and all(k in jd for k in ("x", "y", "z")):
                transformed[jn] = {
                    "x": float(jd["x"]),
                    "y": float(-jd["y"]),
                    "z": float(-jd["z"]),
                    "visibility": float(jd.get("visibility", 0.0)),
                    "presence": float(jd.get("presence", 0.0)),
                }
            else:
                transformed[jn] = jd
        converter = Converter()
        fk = converter.coordinate2angle(transformed)
        for jn, qd in fk.items():
            if isinstance(qd, dict):
                orig = world_landmarks[0].get(jn, {})
                qd["visibility"] = float(
                    orig.get("visibility", 0.0) if isinstance(orig, dict) else 0.0)
        return fk

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
