import { useRef, useState, useEffect, useCallback } from 'react';
import { Skeleton3DViewer } from '@/components/Skeleton3DViewer';
import { type PoseResult, type PoseData } from '@/types/pose';
import { type RendererType } from '@/stores/appStore';

interface PoseFrame {
  timestamp_ms: number;
  pose_data: PoseData;
}

interface PoseDataFile {
  fps: number;
  total_frames: number;
  duration_ms: number;
  frames: PoseFrame[];
}

interface Preview3DPlayerProps {
  poseDataUrl: string;
  previewVideoUrl: string;
  rendererType: RendererType;
}

export function Preview3DPlayer({ poseDataUrl, previewVideoUrl, rendererType }: Preview3DPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
  const [poseData, setPoseData] = useState<PoseDataFile | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(false);
  const hideTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const animFrameRef = useRef<number>(0);

  // Load pose data JSON
  useEffect(() => {
    let cancelled = false;
    fetch(poseDataUrl)
      .then((r) => r.json())
      .then((data: PoseDataFile) => {
        if (!cancelled) setPoseData(data);
      })
      .catch((err) => console.error('Failed to load pose data:', err));
    return () => { cancelled = true; };
  }, [poseDataUrl]);

  // Capture video element ref once ready
  const handleVideoReady = useCallback(() => {
    if (videoRef.current) {
      setVideoElement(videoRef.current);
      setDuration(videoRef.current.duration);
    }
  }, []);

  // Sync pose frame index to video currentTime via animation frame
  useEffect(() => {
    if (!poseData || !videoRef.current) return;

    const sync = () => {
      const video = videoRef.current;
      if (!video || !poseData) return;

      const videoTimeMs = video.currentTime * 1000;

      // Binary search for the closest frame
      const frames = poseData.frames;
      let lo = 0;
      let hi = frames.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (frames[mid].timestamp_ms <= videoTimeMs) {
          lo = mid;
        } else {
          hi = mid - 1;
        }
      }
      setCurrentIndex(lo);
      setProgress(video.duration > 0 ? video.currentTime / video.duration : 0);

      animFrameRef.current = requestAnimationFrame(sync);
    };

    animFrameRef.current = requestAnimationFrame(sync);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [poseData]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      video.play();
      setIsPlaying(true);
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const value = parseFloat(e.target.value);
    video.currentTime = value * video.duration;
    setProgress(value);
  }, []);

  const handleMouseMove = useCallback(() => {
    setShowControls(true);
    clearTimeout(hideTimer.current);
    hideTimer.current = setTimeout(() => setShowControls(false), 2500);
  }, []);

  useEffect(() => {
    return () => clearTimeout(hideTimer.current);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const currentTime = duration * progress;

  // Build PoseResult for Skeleton3DViewer
  const currentFrame = poseData?.frames[currentIndex];
  const poseResult: PoseResult | null = currentFrame ? {
    stream_id: 'preview',
    frame: '',
    pose_data: currentFrame.pose_data,
    timestamp_ms: currentFrame.timestamp_ms,
  } : null;

  const rendererTypeMapped = rendererType === 'avatar' ? 'avatar' : 'stickball';

  return (
    <div
      style={{ position: 'relative', width: '100%', height: '100%' }}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => {
        clearTimeout(hideTimer.current);
        setShowControls(false);
      }}
    >
      {/* Hidden video element — drives pose sync and provides VideoPlane texture */}
      <video
        ref={videoRef}
        src={previewVideoUrl}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onLoadedMetadata={handleVideoReady}
        style={{ display: 'none' }}
      />

      {/* 3D Scene */}
      {poseResult?.pose_data ? (
        <Skeleton3DViewer
          poseResult={poseResult}
          videoElement={videoElement}
          processedCanvas={null}
          rendererType={rendererTypeMapped}
        />
      ) : (
        <div style={{
          width: '100%',
          height: '100%',
          backgroundColor: '#000',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: 13,
        }}>
          Loading 3D preview...
        </div>
      )}

      {/* Instruction overlay */}
      <div style={{
        position: 'absolute',
        top: '10%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        padding: '12px 20px',
        borderRadius: 10,
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 13,
        fontWeight: 500,
        textAlign: 'center',
        lineHeight: 1.5,
        pointerEvents: 'none',
        maxWidth: '80%',
      }}>
        Try it yourself: Choose a Streaming Source on the left panel (A Camera or a Video File)
      </div>

      {/* Bottom controls bar */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '8px 12px',
        background: 'linear-gradient(transparent, rgba(0, 0, 0, 0.7))',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        opacity: showControls || !isPlaying ? 1 : 0,
        transition: 'opacity 0.3s ease',
        pointerEvents: showControls || !isPlaying ? 'auto' : 'none',
      }}>
        <button
          onClick={(e) => { e.stopPropagation(); togglePlay(); }}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            padding: 4,
            display: 'flex',
            alignItems: 'center',
          }}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
              <rect x="6" y="4" width="4" height="16" rx="1" />
              <rect x="14" y="4" width="4" height="16" rx="1" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.9)">
              <polygon points="8,5 19,12 8,19" />
            </svg>
          )}
        </button>

        <span style={{
          fontSize: 11,
          color: 'rgba(255, 255, 255, 0.7)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 36,
        }}>
          {formatTime(currentTime)}
        </span>

        <input
          type="range"
          min={0}
          max={1}
          step={0.001}
          value={progress}
          onChange={handleSeek}
          onClick={(e) => e.stopPropagation()}
          style={{
            flex: 1,
            height: 4,
            appearance: 'none',
            WebkitAppearance: 'none',
            background: `linear-gradient(to right, rgba(255,255,255,0.8) ${progress * 100}%, rgba(255,255,255,0.2) ${progress * 100}%)`,
            borderRadius: 2,
            outline: 'none',
            cursor: 'pointer',
          }}
        />

        <span style={{
          fontSize: 11,
          color: 'rgba(255, 255, 255, 0.7)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 36,
        }}>
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
