import { Socket } from 'socket.io-client';
import { PoseResult } from '@/types/pose';
import { StreamViewer } from './StreamViewer';
import { useState, useCallback, useRef, useEffect } from 'react';

interface Stream {
  streamId: string;
  sourceType: 'camera' | 'video';
  deviceId?: string;
  deviceLabel?: string;
  videoFile?: File;
  processorConfig?: Record<string, any>;
  active: boolean;
  createdAt: number;
}

interface MultiViewGridProps {
  socket: Socket | null;
  streams: Stream[];
  poseResults: Map<string, PoseResult>;
  selectedStream: string | null;
  onFlushStream: (streamId: string) => void;
}

const getGridColumns = (count: number) => count === 1 ? 1 : count === 2 ? 2 : count <= 4 ? 2 : count <= 6 ? 3 : 4;

export function MultiViewGrid({ socket, streams, poseResults, selectedStream, onFlushStream }: MultiViewGridProps) {
  const displayStreams = selectedStream ? streams.filter(s => s.streamId === selectedStream) : streams;
  const hasVideoStreams = displayStreams.some(s => s.sourceType === 'video');
  const videoStreams = displayStreams.filter(s => s.sourceType === 'video');
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [gridHeight, setGridHeight] = useState(60);
  const [isDragging, setIsDragging] = useState(false);
  
  const videoElementsRef = useRef<Map<string, HTMLVideoElement>>(new Map());
  const animationFrameRef = useRef<number | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const rect = containerRef.current.getBoundingClientRect();
      const percentage = ((e.clientY - rect.top) / rect.height) * 100;
      setGridHeight(Math.max(20, Math.min(80, percentage)));
    };

    const handleMouseUp = () => setIsDragging(false);

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

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
    <div ref={containerRef} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ height: hasVideoStreams ? `${gridHeight}%` : '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div className="multi-view-grid" style={{ display: 'grid', gridTemplateColumns: `repeat(${getGridColumns(displayStreams.length)}, 1fr)`, gap: '16px', padding: '16px', flex: 1, overflow: 'auto' }}>
          {displayStreams.map((stream) => (
            <StreamViewer 
              key={stream.streamId} 
              socket={socket} 
              stream={stream} 
              poseResult={poseResults.get(stream.streamId) || null}
              onVideoElementReady={stream.sourceType === 'video' ? (el) => registerVideoElement(stream.streamId, el) : undefined}
            />
          ))}
        </div>
        
        {hasVideoStreams && (
          <div style={{ padding: '16px', background: '#2a2a2a', borderTop: '1px solid #444', display: 'flex', alignItems: 'center', gap: '16px' }}>
            <button onClick={togglePlayPause} style={{ background: '#4CAF50', border: 'none', color: 'white', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              {isPlaying ? '⏸ Pause' : '▶ Play'}
            </button>
            <span style={{ color: '#aaa', fontSize: '14px', minWidth: '100px' }}>
              {Math.floor(currentTime)}s / {Math.floor(duration)}s
            </span>
            <input type="range" min="0" max={duration || 0} value={currentTime} onChange={handleSeek} step="0.1" style={{ flex: 1, cursor: 'pointer' }} />
          </div>
        )}
      </div>
      
    </div>
  );
}
