import { useRef, useEffect } from 'react';
import { Socket } from 'socket.io-client';
import { CameraCapture } from '@/components/CameraCapture';
import { useAppStore } from '@/stores/appStore';

interface View2DProps {
  socket: Socket | null;
}

export function View2D({ socket }: View2DProps) {
  const displayCanvasRef = useRef<HTMLCanvasElement>(null);
  const { backendResult, functionDef, isStreamActive } = useAppStore();

  // Draw annotated frame onto the visible canvas
  useEffect(() => {
    if (!backendResult?.frame || !displayCanvasRef.current) return;
    const ctx = displayCanvasRef.current.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.onload = () => {
      displayCanvasRef.current!.width = img.width;
      displayCanvasRef.current!.height = img.height;
      ctx.drawImage(img, 0, 0);
    };
    img.src = `data:image/jpeg;base64,${backendResult.frame}`;
  }, [backendResult]);

  // Clear canvas to black when stream stops
  useEffect(() => {
    if (!isStreamActive && displayCanvasRef.current) {
      const ctx = displayCanvasRef.current.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, displayCanvasRef.current.width, displayCanvasRef.current.height);
      }
    }
  }, [isStreamActive]);

  return (
    <div className="view-container" style={{ position: 'relative', width: '100%', aspectRatio: '4 / 3', margin: '0 auto' }}>
      {isStreamActive && <CameraCapture socket={socket} />}

      {!isStreamActive && !backendResult ? (
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
      ) : (
        <canvas
          ref={displayCanvasRef}
          style={{
            width: '100%',
            height: '100%',
            display: 'block',
            backgroundColor: '#000',
            borderRadius: 16,
          }}
        />
      )}

      {/* Function label overlay */}
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
        {functionDef?.label}
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
