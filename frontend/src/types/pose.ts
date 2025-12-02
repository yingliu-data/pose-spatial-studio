export interface Landmark {
  x: number;
  y: number;
  z: number;
  visibility: number;
  presence: number;
}

export interface LimbCentre {
  '2d': number;
  '3d': number;
}

export interface PoseData {
  landmarks: Landmark[];
  world_landmarks: Landmark[];
  num_poses: number;
  upper_limb_centre?: LimbCentre;
  lower_limb_centre?: LimbCentre;
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

