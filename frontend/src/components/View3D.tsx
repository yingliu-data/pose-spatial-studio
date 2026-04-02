import { useState, useCallback } from 'react';
import { Socket } from 'socket.io-client';
import { CameraCapture } from '@/components/CameraCapture';
import { Skeleton3DViewer } from '@/components/Skeleton3DViewer';
import { useAppStore } from '@/stores/appStore';
import { type PoseResult } from '@/types/pose';

interface View3DProps {
  socket: Socket | null;
}

export function View3D({ socket }: View3DProps) {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [processedCanvas, setProcessedCanvas] = useState<HTMLCanvasElement | null>(null);
  const { backendResult, isStreamActive, rendererType, toggleRendererType } = useAppStore();

  const onVideoReady = useCallback((video: HTMLVideoElement) => {
    setVideoElement(video);
  }, []);

  const onProcessedImageReady = useCallback((canvas: HTMLCanvasElement) => {
    setProcessedCanvas(canvas);
  }, []);

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

      {/* Function label */}
      <div style={{
        position: 'absolute',
        top: 12,
        left: 14,
        fontSize: 12,
        fontWeight: 600,
        color: 'rgba(255,255,255,0.7)',
        background: 'rgba(0,0,0,0.5)',
        padding: '4px 10px',
        borderRadius: 8,
        backdropFilter: 'blur(8px)',
      }}>
        3D Pose Estimation
      </div>

      {/* Avatar/Skeleton toggle */}
      {isStreamActive && (
        <button
          onClick={toggleRendererType}
          style={{
            position: 'absolute',
            top: 12,
            right: 14,
            background: 'rgba(0,0,0,0.5)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 8,
            padding: '4px 10px',
            color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer',
            fontSize: 12,
            backdropFilter: 'blur(8px)',
          }}
          title={rendererType === 'avatar' ? 'Switch to Skeleton' : 'Switch to Avatar'}
        >
          {rendererType === 'avatar' ? '\u{1F9CD}' : '\u{1F9B4}'} {rendererType === 'avatar' ? 'Avatar' : 'Skeleton'}
        </button>
      )}

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
