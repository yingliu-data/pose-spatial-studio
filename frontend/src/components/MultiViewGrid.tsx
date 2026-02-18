import { Socket } from 'socket.io-client';
import { PoseResult } from '@/types/pose';
import { StreamViewer } from './StreamViewer';
import { useState, useCallback, useRef, useEffect } from 'react';
import type { ModelType } from '@/App';

interface Stream {
  streamId: string;
  sourceType: 'camera' | 'video';
  deviceId?: string;
  deviceLabel?: string;
  videoFile?: File;
  processorConfig?: Record<string, any>;
  modelType: ModelType;
  active: boolean;
  createdAt: number;
}

interface MultiViewGridProps {
  socket: Socket | null;
  streams: Stream[];
  poseResults: Map<string, PoseResult>;
  selectedStream: string | null;
  onFlushStream: (streamId: string) => void;
  onSwitchModel: (streamId: string, newModel: ModelType) => void;
  switchingModels: Map<string, string>;
}

const getGridColumns = (count: number) => count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 2 : count <= 6 ? 3 : 4;

export function MultiViewGrid({ socket, streams, poseResults, selectedStream, onFlushStream, onSwitchModel, switchingModels }: MultiViewGridProps) {
  const displayStreams = selectedStream ? streams.filter(s => s.streamId === selectedStream) : streams;
  const hasVideoStreams = displayStreams.some(s => s.sourceType === 'video');
  const videoStreams = displayStreams.filter(s => s.sourceType === 'video');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const animationFrameRef = useRef<number | undefined>(undefined);

  const registerVideoElement = useCallback((streamId: string, element: HTMLVideoElement | null) => {
    if (element) {
      videoElementsRef.current.set(streamId, element);
    } else {
      videoElementsRef.current.delete(streamId);
    }
  }, []);

  useEffect(() => {
    if (!isPlaying) return;
    
    const updateTimeline = () => {
      const videos = Array.from(videoElementsRef.current.values());
      if (videos.length > 0) {
        setCurrentTime(videos[0].currentTime);
        setDuration(videos[0].duration);
      }
      animationFrameRef.current = requestAnimationFrame(updateTimeline);
    };
    
    animationFrameRef.current = requestAnimationFrame(updateTimeline);
    return () => {
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
    };
  }, [isPlaying]);


  const togglePlayPause = async () => {
    const videos = Array.from(videoElementsRef.current.values());
    if (videos.length === 0) return;

    if (isPlaying) {
      videos.forEach(v => v.pause());
      setIsPlaying(false);
      videoStreams.forEach(s => onFlushStream(s.streamId));
    } else {
      videoStreams.forEach(s => onFlushStream(s.streamId));
      videos.forEach(v => v.play());
      setIsPlaying(true);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newTime = parseFloat(e.target.value);
    videoElementsRef.current.forEach(v => v.currentTime = newTime);
    setCurrentTime(newTime);
    videoStreams.forEach(s => onFlushStream(s.streamId));
  };

  if (displayStreams.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-content">
          <h2>No Active Streams</h2>
          <p>Click "Add Stream" in the sidebar to create a new stream.</p>
          <p>Your browser will request camera permission.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div className="multi-view-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${getGridColumns(displayStreams.length)}, 1fr)`, gap: '16px', padding: '16px', flex: 1, overflow: 'auto' }}>
        {displayStreams.map((stream) => (
          <StreamViewer
            key={stream.streamId}
            socket={socket}
            stream={stream}
            poseResult={poseResults.get(stream.streamId) || null}
            onVideoElementReady={stream.sourceType === 'video' ? (el) => registerVideoElement(stream.streamId, el) : undefined}
            onSwitchModel={(newModel) => onSwitchModel(stream.streamId, newModel)}
            switchingMessage={switchingModels.get(stream.streamId)}
          />
        ))}
      </div>

      {hasVideoStreams && (
        <div style={{ padding: '14px 24px', background: 'rgba(255, 255, 255, 0.05)', backdropFilter: 'blur(60px) saturate(180%)', WebkitBackdropFilter: 'blur(60px) saturate(180%)', borderTop: '1px solid rgba(255, 255, 255, 0.07)', display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
          <button onClick={togglePlayPause} className="btn btn-primary" style={{ padding: '10px 20px' }}>
            {isPlaying ? '⏸ Pause' : '▶ Play'}
          </button>
          <span style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '13px', minWidth: '100px', fontWeight: 500, fontVariantNumeric: 'tabular-nums' }}>
            {Math.floor(currentTime)}s / {Math.floor(duration)}s
          </span>
          <input type="range" min="0" max={duration || 0} value={currentTime} onChange={handleSeek} step="0.1" style={{ flex: 1, cursor: 'pointer', accentColor: '#0a84ff' }} />
        </div>
      )}
    </div>
  );
}
