export type AppFunction =
  | 'pose_2d'
  | 'pose_3d'
  | 'object_detection'
  | 'hand_gesture'
  | 'robotic_control';

export type ViewMode = '2d' | '3d' | 'placeholder';

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
  },
  {
    id: 'pose_3d',
    label: '3D Pose Estimation',
    description: '3D interactive space with skeleton/avatar',
    icon: '\u{1F9BE}',
    viewMode: '3d',
    processorType: 'mediapipe',
    modelLabel: 'MediaPipe',
  },
  {
    id: 'object_detection',
    label: 'Object Detection',
    description: 'Video feed with bounding boxes and labels',
    icon: '\u{1F4E6}',
    viewMode: '2d',
    processorType: 'mediapipe_object_detection',
    modelLabel: 'MediaPipe',
  },
  {
    id: 'hand_gesture',
    label: 'Hand Gesture Recognition',
    description: 'Hand skeleton overlay with gesture names',
    icon: '\u{270B}',
    viewMode: '2d',
    processorType: 'mediapipe_hand_gesture',
    modelLabel: 'MediaPipe',
  },
  {
    id: 'robotic_control',
    label: 'Avatar Voice Control',
    description: 'Voice-controlled avatar (coming soon)',
    icon: '\u{1F399}',
    viewMode: 'placeholder',
    processorType: null,
    modelLabel: '',
  },
];
