import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { CameraCapture } from './CameraCapture';
import { Skeleton3DViewer } from './Skeleton3DViewer';
import { PoseResult } from '@/types/pose';

interface Stream {
  streamId: string;
  sourceType: 'camera' | 'video';
  deviceId?: string;
  deviceLabel?: string;
  videoFile?: File;
  processorConfig?: Record<string, any>;
  active: boolean;
}

interface StreamViewerProps {
  socket: Socket | null;
  stream: Stream;
  poseResult: PoseResult | null;
  onVideoElementReady?: (element: HTMLVideoElement | null) => void;
}

const overlayStyle = {
  position: 'absolute' as const,
  background: 'rgba(255, 255, 255, 0.08)',
  backdropFilter: 'blur(80px) saturate(200%) brightness(1.1)',
  WebkitBackdropFilter: 'blur(80px) saturate(200%) brightness(1.1)',
  border: '1px solid rgba(255, 255, 255, 0.18)',
  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.12)',
  color: 'rgba(255, 255, 255, 0.6)',
  padding: '6px 12px',
  borderRadius: '10px',
  pointerEvents: 'none' as const,
  fontSize: '11px',
  fontWeight: 500,
};

export function StreamViewer({ socket, stream, poseResult, onVideoElementReady }: StreamViewerProps) {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [processedCanvas, setProcessedCanvas] = useState<HTMLCanvasElement | null>(null);
  const hasData = !!(poseResult?.frame);

  const handleVideoReady = (video: HTMLVideoElement) => {
    setVideoElement(video);
    if (onVideoElementReady) {
      onVideoElementReady(video);
    }
  };
  
  return (
    <div className="view-container" style={{ background: 'rgba(0, 0, 0, 0.35)', borderRadius: '24px', overflow: 'hidden', border: '1px solid rgba(255, 255, 255, 0.18)', boxShadow: '0 24px 80px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.08)', minHeight: '400px', position: 'relative', backdropFilter: 'blur(80px) saturate(200%) brightness(1.1)', WebkitBackdropFilter: 'blur(80px) saturate(200%) brightness(1.1)' }}>
      <CameraCapture 
        socket={socket} 
        streamId={stream.streamId} 
        processorConfig={stream.processorConfig || {}}
        sourceType={stream.sourceType} 
        deviceId={stream.deviceId}
        videoFile={stream.videoFile} 
        poseResult={poseResult}
        onVideoReady={handleVideoReady} 
        onProcessedImageReady={setProcessedCanvas} 
      />
      {hasData ? (
        <Skeleton3DViewer 
          poseResult={poseResult} 
          videoElement={videoElement} 
          processedCanvas={processedCanvas} 
          />
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255, 255, 255, 0.4)', flexDirection: 'column', gap: '10px', padding: '20px', textAlign: 'center' }}>
          <div style={{ fontSize: '14px', fontWeight: 600 }}>Initializing camera...</div>
          <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.25)' }}>If prompted, please allow camera access</div>
        </div>
      )}
      <div style={{ ...overlayStyle, top: 14, left: 14 }}>{stream.streamId}</div>
      <div style={{ ...overlayStyle, bottom: 14, right: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: hasData ? '#30d158' : '#ff9f0a', boxShadow: hasData ? '0 0 10px rgba(48, 209, 88, 0.5)' : '0 0 10px rgba(255, 159, 10, 0.5)', animation: 'pulse 2s ease-in-out infinite' }} />
          <span style={{ fontWeight: 600 }}>{hasData ? 'LIVE' : 'Starting...'}</span>
        </div>
        <div style={{ marginTop: '4px', fontSize: '10px', color: 'rgba(255, 255, 255, 0.35)' }}>{stream.deviceLabel || 'Default'}</div>
      </div>
    </div>
  );
}
