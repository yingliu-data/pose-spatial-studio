import { useRef, useState, useEffect, useCallback, type CSSProperties } from 'react';

interface PreviewPlayerProps {
  src: string;
  style?: CSSProperties;
}

export function PreviewPlayer({ src, style }: PreviewPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(true);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);

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

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    setProgress(video.currentTime / video.duration);
  }, []);

  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (video) setDuration(video.duration);
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video || !video.duration) return;
    const value = parseFloat(e.target.value);
    video.currentTime = value * video.duration;
    setProgress(value);
  }, []);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Keep video in sync when src changes
  useEffect(() => {
    setProgress(0);
    setIsPlaying(true);
  }, [src]);

  const currentTime = duration * progress;

  return (
    <div
      style={{
        position: 'relative',
        backgroundColor: '#000',
        cursor: 'pointer',
        ...style,
      }}
    >
      <video
        ref={videoRef}
        src={src}
        autoPlay
        loop
        muted
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onClick={togglePlay}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'contain',
          display: 'block',
          backgroundColor: '#000',
        }}
      />

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

      {/* Bottom controls bar — always visible */}
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
      }}>
        {/* Play/Pause button */}
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

        {/* Time display */}
        <span style={{
          fontSize: 11,
          color: 'rgba(255, 255, 255, 0.7)',
          fontVariantNumeric: 'tabular-nums',
          minWidth: 36,
        }}>
          {formatTime(currentTime)}
        </span>

        {/* Scrub slider */}
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

        {/* Duration */}
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
