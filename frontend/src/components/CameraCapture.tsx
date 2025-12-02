import { useEffect, useRef } from 'react';
import { StreamService } from '@/services/streamService';
import { Socket } from 'socket.io-client';
import { PoseResult } from '@/types/pose';

interface CameraCaptureProps {
  socket: Socket | null;
  streamId: string;
  processorConfig: Record<string, any>;
  sourceType: 'camera' | 'video';
  deviceId?: string;
  videoFile?: File;
  poseResult?: PoseResult | null;
  onVideoReady?: (video: HTMLVideoElement) => void;
  onProcessedImageReady?: (canvas: HTMLCanvasElement) => void;
}

export function CameraCapture({ 
  socket, 
  streamId, 
  processorConfig,
  sourceType, 
  deviceId,
  videoFile, 
  poseResult,
  onVideoReady, 
  onProcessedImageReady 
}: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const streamServiceRef = useRef<StreamService | null>(null);
  const intervalRef = useRef<number | null>(null);
  const isProcessingFrameRef = useRef<boolean>(false);
  const onVideoReadyRef = useRef(onVideoReady);
  const onProcessedImageReadyRef = useRef(onProcessedImageReady);
  
  const TARGET_FPS = 10;
  const FRAME_INTERVAL = 1000 / TARGET_FPS;
  
  useEffect(() => {
    onVideoReadyRef.current = onVideoReady;
    onProcessedImageReadyRef.current = onProcessedImageReady;
  }, [onVideoReady, onProcessedImageReady]);

  useEffect(() => {
    if (poseResult?.frame && poseResult.stream_id === streamId && processedCanvasRef.current) {
      const ctx = processedCanvasRef.current.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          processedCanvasRef.current!.width = img.width;
          processedCanvasRef.current!.height = img.height;
          ctx.drawImage(img, 0, 0);
        };
        img.src = `data:image/jpeg;base64,${poseResult.frame}`;
      }
    }
  }, [poseResult, streamId]); 

  useEffect(() => {
    if (!socket) return;

    if (!streamServiceRef.current) {
      streamServiceRef.current = new StreamService(socket, streamId, processorConfig);
    }

    const startSource = async () => {
      try {
        if (sourceType === 'camera') {
          const constraints: MediaStreamConstraints = {
            video: deviceId ? { deviceId: { exact: deviceId }, width: 640, height: 480 } : { width: 640, height: 480 },
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
            };
            
            return () => {
              videoElement.removeEventListener('play', handlePlay);
              videoElement.removeEventListener('pause', handlePause);
            };
          }
        }
      } catch (error) {
        console.error('Error accessing source:', error);
        alert(`Failed to access source: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    };

    startSource();

    return () => {
      if (videoRef.current?.srcObject) {
        (videoRef.current.srcObject as MediaStream).getTracks().forEach(track => track.stop());
      }
      if (videoRef.current?.src) {
        URL.revokeObjectURL(videoRef.current.src);
      }
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      isProcessingFrameRef.current = false;
    };
  }, [socket, streamId, sourceType, deviceId, videoFile]);

  const startProcessing = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    
    const processFrame = () => {
      if (isProcessingFrameRef.current) return;
      
      if (videoRef.current && canvasRef.current && streamServiceRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx && videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
          if (canvasRef.current.width !== videoRef.current.videoWidth || 
              canvasRef.current.height !== videoRef.current.videoHeight) {
            canvasRef.current.width = videoRef.current.videoWidth;
            canvasRef.current.height = videoRef.current.videoHeight;
          }
          
          ctx.drawImage(videoRef.current, 0, 0);
          isProcessingFrameRef.current = true;
          canvasRef.current.toBlob((blob) => {
            if (blob) {
              const reader = new FileReader();
              reader.onloadend = () => {
                streamServiceRef.current?.sendFrame(reader.result as string, Date.now());
                isProcessingFrameRef.current = false;
              };
              reader.readAsDataURL(blob);
            } else {
              isProcessingFrameRef.current = false;
            }
          }, 'image/jpeg', 0.8);
        }
      }
    };
    
    intervalRef.current = setInterval(processFrame, FRAME_INTERVAL);
  };

  return (
    <>
      <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <canvas ref={processedCanvasRef} style={{ display: 'none' }} />
    </>
  );
}

