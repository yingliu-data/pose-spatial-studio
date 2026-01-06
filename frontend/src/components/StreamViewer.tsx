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
  background: 'rgba(0, 0, 0, 0.7)',
  color: 'white',
  padding: '6px 10px',
  borderRadius: '4px',
  pointerEvents: 'none' as const
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
    <div className="view-container" style={{ background: '#1a1a1a', borderRadius: '8px', overflow: 'hidden', border: '2px solid #333', minHeight: '400px', position: 'relative' }}>
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: '#888', flexDirection: 'column', gap: '10px', padding: '20px', textAlign: 'center' }}>
          <div>Initializing camera...</div>
          <div style={{ fontSize: '12px', color: '#666' }}>If prompted, please allow camera access</div>
        </div>
      )}
      <div style={{ ...overlayStyle, top: 10, left: 10, fontSize: '12px', fontWeight: 'bold' }}>{stream.streamId}</div>
      <div style={{ ...overlayStyle, bottom: 10, right: 10, fontSize: '11px' }}>
        <div>
          <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', background: hasData ? '#00ff00' : '#ffaa00', marginRight: '6px' }} />
          {hasData ? 'Streaming' : 'Starting...'}
        </div>
        <div style={{ marginTop: '4px', fontSize: '10px', color: '#aaa' }}>{stream.deviceLabel || 'Default'}</div>
      </div>
    </div>
  );
}
