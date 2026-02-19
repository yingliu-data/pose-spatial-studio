import { useState } from 'react';
import { Socket } from 'socket.io-client';
import { CameraCapture } from './CameraCapture';
import { Skeleton3DViewer, type RendererType } from './Skeleton3DViewer';
import { PoseResult } from '@/types/pose';
import { AVAILABLE_MODELS, type ModelType } from '@/App';

interface Stream {
  streamId: string;
  sourceType: 'camera' | 'video';
  deviceId?: string;
  deviceLabel?: string;
  videoFile?: File;
  processorConfig?: Record<string, any>;
  modelType: ModelType;
  active: boolean;
}

interface StreamViewerProps {
  socket: Socket | null;
  stream: Stream;
  poseResult: PoseResult | null;
  onVideoElementReady?: (element: HTMLVideoElement | null) => void;
  onSwitchModel: (newModel: ModelType) => void;
  switchingMessage?: string;
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

export function StreamViewer({ socket, stream, poseResult, onVideoElementReady, onSwitchModel, switchingMessage }: StreamViewerProps) {
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [processedCanvas, setProcessedCanvas] = useState<HTMLCanvasElement | null>(null);
  const [rendererType, setRendererType] = useState<RendererType>('avatar');
  const hasData = !!(poseResult?.frame);
  const cameraReady = !!(videoElement);

  const handleVideoReady = (video: HTMLVideoElement) => {
    setVideoElement(video);
    if (onVideoElementReady) {
      onVideoElementReady(video);
    }
  };

  const renderContent = () => {
    if (hasData) {
      return (
        <Skeleton3DViewer
          poseResult={poseResult}
          videoElement={videoElement}
          processedCanvas={processedCanvas}
          rendererType={rendererType}
        />
      );
    }
    if (cameraReady && videoElement) {
      return (
        <video
          ref={(el) => {
            if (el && videoElement.srcObject) {
              el.srcObject = videoElement.srcObject;
              el.play().catch(() => {});
            }
          }}
          style={{ width: '100%', height: '100%', objectFit: 'contain', background: '#000' }}
          playsInline
          muted
          autoPlay
        />
      );
    }
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'rgba(255, 255, 255, 0.4)', flexDirection: 'column', gap: '10px', padding: '20px', textAlign: 'center' }}>
        <div style={{ fontSize: '14px', fontWeight: 600 }}>Initializing camera...</div>
        <div style={{ fontSize: '12px', color: 'rgba(255, 255, 255, 0.25)' }}>If prompted, please allow camera access</div>
      </div>
    );
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
      {renderContent()}
      <div style={{ ...overlayStyle, top: 14, left: 14 }}>{stream.streamId}</div>
      <button
        onClick={() => setRendererType(prev => prev === 'avatar' ? 'stickball' : 'avatar')}
        style={{ ...overlayStyle, top: 14, right: 14, pointerEvents: 'auto', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'background 0.2s' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.16)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)')}
        title={`Switch to ${rendererType === 'avatar' ? 'skeleton' : 'avatar'}`}
      >
        <span style={{ fontSize: '13px' }}>{rendererType === 'avatar' ? '🧍' : '🦴'}</span>
        <span>{rendererType === 'avatar' ? 'Avatar' : 'Skeleton'}</span>
      </button>
      {/* Model selector dropdown */}
      <div style={{ ...overlayStyle, bottom: 14, left: 14, pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '10px', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Model</span>
        <select
          value={stream.modelType}
          onChange={(e) => onSwitchModel(e.target.value as ModelType)}
          disabled={!!switchingMessage}
          style={{
            background: 'rgba(255, 255, 255, 0.06)',
            border: '1px solid rgba(255, 255, 255, 0.15)',
            borderRadius: '6px',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 600,
            padding: '3px 8px',
            cursor: switchingMessage ? 'wait' : 'pointer',
            outline: 'none',
            fontFamily: 'inherit',
            opacity: switchingMessage ? 0.5 : 1,
          }}
        >
          {AVAILABLE_MODELS.map((model) => (
            <option key={model.value} value={model.value} style={{ background: '#1c1c1e' }}>
              {model.label}
            </option>
          ))}
        </select>
        {switchingMessage && (
          <span style={{ fontSize: '10px', color: '#ff9f0a', animation: 'pulse 1.5s ease-in-out infinite' }}>
            {switchingMessage}
          </span>
        )}
      </div>
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
