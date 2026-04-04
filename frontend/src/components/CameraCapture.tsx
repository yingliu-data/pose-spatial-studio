import { useEffect, useRef } from 'react';
import { StreamService } from '@/services/streamService';
import { Socket } from 'socket.io-client';
import { useAppStore } from '@/stores/appStore';

const ACTIVE_STREAM_ID = 'active_stream';
const TARGET_FPS = 10;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

interface CameraCaptureProps {
  socket: Socket | null;
  onVideoReady?: (video: HTMLVideoElement) => void;
  onProcessedImageReady?: (canvas: HTMLCanvasElement) => void;
}

export function CameraCapture({
  socket,
  onVideoReady,
  onProcessedImageReady,
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamServiceRef = useRef<StreamService | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isProcessingFrameRef = useRef(false);
  const waitingForResultRef = useRef(false);
  const waitingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onVideoReadyRef = useRef(onVideoReady);
  const onProcessedImageReadyRef = useRef(onProcessedImageReady);

  const { sourceType, deviceId, videoFile, backendResult } = useAppStore();

  useEffect(() => {
    onVideoReadyRef.current = onVideoReady;
    onProcessedImageReadyRef.current = onProcessedImageReady;
  }, [onVideoReady, onProcessedImageReady]);

  // Release backpressure when a result arrives
  useEffect(() => {
    if (backendResult?.stream_id === ACTIVE_STREAM_ID) {
      waitingForResultRef.current = false;
      if (waitingTimeoutRef.current) {
        clearTimeout(waitingTimeoutRef.current);
        waitingTimeoutRef.current = null;
      }
    }
  }, [backendResult]);

  // Render processed frame to canvas
  useEffect(() => {
    if (
      backendResult?.frame &&
      backendResult.stream_id === ACTIVE_STREAM_ID &&
      processedCanvasRef.current
    ) {
      const ctx = processedCanvasRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          processedCanvasRef.current!.width = img.width;
          processedCanvasRef.current!.height = img.height;
          ctx.drawImage(img, 0, 0);
        };
        img.src = `data:image/jpeg;base64,${backendResult.frame}`;
      }
    }
  }, [backendResult]);

  // Main source lifecycle
  useEffect(() => {
    if (!socket) return;

    if (!streamServiceRef.current) {
      streamServiceRef.current = new StreamService(socket, ACTIVE_STREAM_ID);
    }

    const startSource = async () => {
      try {
        if (sourceType === 'camera') {
          const constraints: MediaStreamConstraints = {
            video: deviceId
              ? { deviceId: { exact: deviceId }, width: 640, height: 480 }
              : { width: 640, height: 480 },
            audio: false,
          };
          const stream = await navigator.mediaDevices.getUserMedia(constraints);
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.onloadedmetadata = () => {
              videoRef.current?.play();
              onVideoReadyRef.current?.(videoRef.current!);
              if (processedCanvasRef.current) {
                onProcessedImageReadyRef.current?.(processedCanvasRef.current);
              }
              startProcessing();
            };
          }
        } else if (sourceType === 'video' && videoFile) {
          const videoURL = URL.createObjectURL(videoFile);
          if (videoRef.current) {
            videoRef.current.src = videoURL;
            videoRef.current.loop = true;
            videoRef.current.muted = true;

            const videoElement = videoRef.current;

            const handlePlay = () => startProcessing();
            const handlePause = () => {
              if (intervalRef.current) {
                clearInterval(intervalRef.current);
                intervalRef.current = null;
              }
            };

            videoElement.addEventListener('play', handlePlay);
            videoElement.addEventListener('pause', handlePause);

            videoElement.onloadedmetadata = () => {
              onVideoReadyRef.current?.(videoRef.current!);
              if (processedCanvasRef.current) {
                onProcessedImageReadyRef.current?.(processedCanvasRef.current);
              }
              videoRef.current?.play();
            };

            return () => {
              videoElement.removeEventListener('play', handlePlay);
              videoElement.removeEventListener('pause', handlePause);
            };
          }
        }
      } catch (error) {
        console.error('Error accessing source:', error);
      }
    };

    startSource();

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream)
          .getTracks()
          .forEach((t) => t.stop());
      }
      if (videoRef.current?.src) {
        URL.revokeObjectURL(videoRef.current.src);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      if (waitingTimeoutRef.current) {
        clearTimeout(waitingTimeoutRef.current);
        waitingTimeoutRef.current = null;
      }
      isProcessingFrameRef.current = false;
      waitingForResultRef.current = false;
    };
  }, [socket, sourceType, deviceId, videoFile]);

  const startProcessing = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    const processFrame = () => {
      if (isProcessingFrameRef.current || waitingForResultRef.current) return;

      if (videoRef.current && canvasRef.current && streamServiceRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (
          ctx &&
          videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA
        ) {
          if (
            canvasRef.current.width !== videoRef.current.videoWidth ||
            canvasRef.current.height !== videoRef.current.videoHeight
          ) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }

          if (sourceType === 'camera') {
            ctx.translate(canvasRef.current.width, 0);
            ctx.scale(-1, 1);
          }
          ctx.drawImage(videoRef.current, 0, 0);
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          isProcessingFrameRef.current = true;
          canvasRef.current.toBlob(
            (blob) => {
              if (blob) {
                const reader = new FileReader();
                reader.onloadend = () => {
                  streamServiceRef.current?.sendFrame(
                    reader.result as string,
                    Date.now(),
                  );
                  isProcessingFrameRef.current = false;
                  waitingForResultRef.current = true;
                  waitingTimeoutRef.current = setTimeout(() => {
                    waitingForResultRef.current = false;
                    waitingTimeoutRef.current = null;
                  }, 2000);
                };
                reader.readAsDataURL(blob);
              } else {
                isProcessingFrameRef.current = false;
              }
            },
            'image/jpeg',
            0.8,
          );
        }
      }
    };

    intervalRef.current = setInterval(processFrame, FRAME_INTERVAL);
  };

  return (
    <>
      <video
        ref={videoRef}
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          opacity: 0,
          pointerEvents: 'none',
          overflow: 'hidden',
        }}
        playsInline
        muted
      />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={processedCanvasRef} style={{ display: 'none' }} />
    </>
  );
}
