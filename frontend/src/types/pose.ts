export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence: number;
}

export interface FKLandmark {
  x: number;
  y: number;
  z: number;
  w: number;
  visibility: number;
}

export interface RootPosition {
  x: number;
  y: number;
  z: number;
}

export interface LimbCentre {
  '2d': number | null;
  '3d': number | null;
}

export const UNIFIED_JOINT_NAMES = [
  'hipCentre', 'neck',
  'leftEye', 'rightEye',
  'rightShoulder', 'rightElbow', 'rightWrist', 'rightThumb', 'rightIndex', 'rightPinky',
  'leftShoulder', 'leftElbow', 'leftWrist', 'leftThumb', 'leftIndex', 'leftPinky',
  'rightHip', 'rightKnee', 'rightAnkle', 'rightToe',
  'leftHip', 'leftKnee', 'leftAnkle', 'leftToe',
] as const;

export type UnifiedJointName = typeof UNIFIED_JOINT_NAMES[number];

export type UnifiedJoints = {
  [K in UnifiedJointName]?: Landmark | null;
};

export type UnifiedFKData = {
  [K in UnifiedJointName]?: FKLandmark | null;
};

export interface PoseData {
  landmarks: UnifiedJoints[];
  world_landmarks: UnifiedJoints[];
  fk_data?: UnifiedFKData | null;
  root_position?: RootPosition;
  num_poses: number;
}

export interface PoseResult {
  stream_id: string;
  frame: string;
  pose_data: PoseData;
  timestamp_ms: number;
}

export interface StreamConfig {
  stream_id: string;
  processor_config?: Record<string, any>;
}

// Object detection result types
export interface DetectedObject {
  name: string;
  confidence: number;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface ObjectDetectionData {
  objects: DetectedObject[];
  num_objects: number;
}

// Hand gesture result types
export interface HandLandmarkPoint {
  x: number;
  y: number;
  z: number;
}

export interface DetectedHand {
  landmarks: HandLandmarkPoint[];
  gesture: string;
  confidence: number;
  handedness: string;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface HandGestureData {
  hands: DetectedHand[];
  num_hands: number;
}

// Union type for all backend result data
export type ResultData = PoseData | ObjectDetectionData | HandGestureData;

// Generic backend result (all processors use the pose_result event)
export interface BackendResult {
  stream_id: string;
  frame: string;
  pose_data: ResultData | null;
  timestamp_ms: number;
}
