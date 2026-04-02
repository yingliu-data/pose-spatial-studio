import { useState, useCallback, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { CameraCapture } from '@/components/CameraCapture';
import { Skeleton3DViewer } from '@/components/Skeleton3DViewer';
import { StreamInitService } from '@/services/streamInitService';
import { useAppStore } from '@/stores/appStore';
import { type ProcessorType } from '@/types/functions';
import { type PoseResult } from '@/types/pose';

const ACTIVE_STREAM_ID = 'active_stream';

const POSE_3D_MODELS: { value: ProcessorType; label: string }[] = [
  { value: 'mediapipe', label: 'MediaPipe' },
  { value: 'rtmpose', label: 'YOLO + RTMPose' },
];

interface View3DProps {
  socket: Socket | null;
}

export function View3D({ socket }: View3DProps) {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [processedCanvas, setProcessedCanvas] = useState<HTMLCanvasElement | null>(null);
  const { backendResult, isStreamActive, rendererType, toggleRendererType, pose3dProcessorType, setPose3dProcessorType } = useAppStore();
  const [isSwitching, setIsSwitching] = useState(false);

  const onVideoReady = useCallback((video: HTMLVideoElement) => {
    setVideoElement(video);
  }, []);

  const onProcessedImageReady = useCallback((canvas: HTMLCanvasElement) => {
    setProcessedCanvas(canvas);
  }, []);

  // Reset video/canvas state when stream stops
  useEffect(() => {
    if (!isStreamActive) {
      setVideoElement(null);
      setProcessedCanvas(null);
    }
  }, [isStreamActive]);

  // Cast to PoseResult for the 3D viewer (3D pose always returns PoseData)
  const poseResult = backendResult as PoseResult | null;

  return (
    <div className="view-container" style={{ position: 'relative', width: '100%', height: '100%', minHeight: 400 }}>
      {isStreamActive && (
        <CameraCapture
          socket={socket}
          onVideoReady={onVideoReady}
          onProcessedImageReady={onProcessedImageReady}
        />
      )}

      {poseResult?.pose_data ? (
        <Skeleton3DViewer
          poseResult={poseResult}
          videoElement={videoElement}
          processedCanvas={processedCanvas}
          rendererType={rendererType}
        />
      ) : videoElement ? (
        <div style={{ width: '100%', height: '100%', position: 'relative' }}>
          <video
            ref={(el) => {
              if (el && videoElement) {
                el.srcObject = videoElement.srcObject;
                el.play();
              }
            }}
            style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000', borderRadius: 16 }}
            playsInline
            muted
            autoPlay
          />
        </div>
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: '#000',
          borderRadius: 16,
          color: 'rgba(255,255,255,0.4)',
          fontSize: 14,
        }}>
          Waiting for camera...
        </div>
      )}

      {/* Function label + model selector */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 12,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.7)',
        background: 'rgba(0,0,0,0.5)',
        padding: '4px 10px',
        borderRadius: 8,
        backdropFilter: 'blur(8px)',
      }}>
        3D Pose
        <select
          value={pose3dProcessorType}
          onChange={async (e) => {
            const newType = e.target.value as ProcessorType;
            setPose3dProcessorType(newType);
            if (isStreamActive && socket) {
              setIsSwitching(true);
              try {
                await StreamInitService.switchModel(socket, ACTIVE_STREAM_ID, newType);
              } finally {
                setIsSwitching(false);
              }
            }
          }}
          disabled={isSwitching}
          style={{
            background: 'rgba(255,255,255,0.1)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4,
            color: 'rgba(255,255,255,0.8)',
            fontSize: 11,
            padding: '2px 4px',
            cursor: 'pointer',
          }}
        >
          {POSE_3D_MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
        {isSwitching && <span style={{ fontSize: 10, color: '#ff9f0a' }}>Switching...</span>}
        <span style={{ color: 'rgba(255,255,255,0.3)' }}>|</span>
        <button
          onClick={toggleRendererType}
          style={{
            background: 'none',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4,
            padding: '2px 6px',
            color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
            fontSize: 11,
          }}
          title={rendererType === 'avatar' ? 'Switch to Skeleton' : 'Switch to Avatar'}
        >
          {rendererType === 'avatar' ? 'Avatar' : 'Skeleton'}
        </button>
      </div>

      {/* Status indicator */}
      <div style={{
        position: 'absolute',
        bottom: 12,
        right: 14,
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        background: 'rgba(0,0,0,0.5)',
        padding: '4px 10px',
        borderRadius: 8,
        backdropFilter: 'blur(8px)',
      }}>
        <div style={{
          width: 8,
          height: 8,
          borderRadius: '50%',
          backgroundColor: backendResult ? '#30d158' : '#ff9f0a',
          animation: 'pulse 2s infinite',
        }} />
        {backendResult ? 'LIVE' : 'Starting...'}
      </div>
    </div>
  );
}
