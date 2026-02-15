import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { socketService } from '@/services/socketService';
import { PoseResult } from '@/types/pose';

interface UseWebSocketReturn {
  socket: Socket | null;
  connected: boolean;
  poseResults: Map<string, PoseResult>;
  clearPoseResult: (streamId: string) => void;
  flushStream: (streamId: string) => void;
}

const RESULT_TIMEOUT_MS = 3000;

export function useWebSocket(): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [poseResults, setPoseResults] = useState<Map<string, PoseResult>>(new Map());
  const lastUpdateTime = useRef<Map<string, number>>(new Map());

  const clearPoseResult = (streamId: string) => {
    setPoseResults(prev => {
      const next = new Map(prev);
      next.delete(streamId);
      return next;
    });
    lastUpdateTime.current.delete(streamId);
  };

  const flushStream = (streamId: string) => {
    clearPoseResult(streamId);
    socket?.emit('flush_stream', { stream_id: streamId });
  };

  useEffect(() => {
    const socketInstance = socketService.connect();
    setSocket(socketInstance);

    socketInstance.on('connect', () => {
      console.log('[WS] Connected, sid:', socketInstance.id);
      setConnected(true);
    });
    socketInstance.on('disconnect', (reason) => {
      console.warn('[WS] Disconnected, reason:', reason);
      setConnected(false);
    });

    socketInstance.on('pose_result', (result: PoseResult) => {
      try {
        const age = Date.now() - result.timestamp_ms;
        console.debug(`[WS] pose_result stream=${result.stream_id} age=${age}ms hasFrame=${!!result.frame} hasPose=${!!result.pose_data}`);
        if (age > RESULT_TIMEOUT_MS) {
          console.warn(`[WS] Dropping stale result (age=${age}ms > ${RESULT_TIMEOUT_MS}ms)`);
          return;
        }

        const lastTime = lastUpdateTime.current.get(result.stream_id) || 0;
        if (result.timestamp_ms >= lastTime) {
          setPoseResults(prev => new Map(prev).set(result.stream_id, result));
          lastUpdateTime.current.set(result.stream_id, result.timestamp_ms);
        }
      } catch (err) {
        console.error('[WS] Error in pose_result handler:', err);
      }
    });

    socketInstance.on('error', (error) => console.error('[WS] Socket error:', error));

    return () => socketService.disconnect();
  }, []);

  return { socket, connected, poseResults, clearPoseResult, flushStream };
}
