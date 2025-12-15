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
  upper_limb_centre?: LimbCentre;
  lower_limb_centre?: LimbCentre;
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
