export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  isStreaming?: boolean;
}

export interface AvatarCommand {
  name: string;
  result: {
    type: 'pose' | 'animation';
    joints?: Record<string, { x: number; y: number; z: number }>;
    duration_ms?: number;
    frames?: Array<{
      joints: Record<string, { x: number; y: number; z: number }>;
      hold_ms: number;
    }>;
    loop?: boolean;
  };
}
