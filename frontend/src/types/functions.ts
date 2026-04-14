export type AppFunction =
  | 'pose_2d'
  | 'pose_3d'
  | 'object_detection'
  | 'hand_gesture'
  | 'robotic_control';

export type ViewMode = '2d' | '3d' | 'voice' | 'placeholder';

export type ProcessorType =
  | 'yolo_pose_2d'
  | 'mediapipe'
  | 'rtmpose'
  | 'mediapipe_object_detection'
  | 'mediapipe_hand_gesture';

export interface FunctionDefinition {
  id: AppFunction;
  label: string;
  description: string;
  icon: string;
  viewMode: ViewMode;
  processorType: ProcessorType | null;
  modelLabel: string;
  hidden?: boolean;
  previewVideo?: string;
  previewPoseData?: string;
}

export const FUNCTION_DEFINITIONS: FunctionDefinition[] = [
  {
    id: 'pose_2d',
    label: '2D Pose Estimation',
    description: 'Video feed with 2D skeleton overlay',
    icon: '\u{1F9CD}',
    viewMode: '2d',
    processorType: 'yolo_pose_2d',
    modelLabel: 'YOLO',
    previewVideo: '/previews/pose_2d_preview.mp4',
  },
  {
    id: 'pose_3d',
    label: '3D Pose Estimation',
    description: '3D interactive space with skeleton/avatar',
    icon: '\u{1F9BE}',
    viewMode: '3d',
    processorType: 'mediapipe',
    modelLabel: 'MediaPipe',
    previewVideo: '/previews/pose_3d_preview.mp4',
    previewPoseData: '/previews/pose_3d_preview_poses.json',
  },
  {
    id: 'object_detection',
    label: 'Object Detection',
    description: 'Video feed with bounding boxes and labels',
    icon: '\u{1F4E6}',
    viewMode: '2d',
    processorType: 'mediapipe_object_detection',
    modelLabel: 'MediaPipe',
    previewVideo: '/previews/object_detection_preview.mp4',
  },
  {
    id: 'hand_gesture',
    label: 'Hand Gesture Recognition',
    description: 'Hand skeleton overlay with gesture names',
    icon: '\u{270B}',
    viewMode: '2d',
    processorType: 'mediapipe_hand_gesture',
    modelLabel: 'MediaPipe',
    previewVideo: '/previews/hand_gesture_preview.mp4',
  },
  {
    id: 'robotic_control',
    label: 'Avatar Voice Control',
    description: 'Voice-controlled avatar',
    icon: '\u{1F399}',
    viewMode: 'voice',
    processorType: null,
    modelLabel: 'Second Brain',
    hidden: true,
  },
];
