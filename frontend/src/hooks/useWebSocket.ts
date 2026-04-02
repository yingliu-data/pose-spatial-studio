import { useEffect, useState, useRef } from 'react';
import { Socket } from 'socket.io-client';
import { socketService } from '@/services/socketService';
import { type BackendResult } from '@/types/pose';
import { useAppStore } from '@/stores/appStore';

const RESULT_TIMEOUT_MS = 3000;
const ACTIVE_STREAM_ID = 'active_stream';

interface UseWebSocketReturn {
  socket: Socket | null;
  connected: boolean;
  flushActiveStream: () => void;
}

export function useWebSocket(): UseWebSocketReturn {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const lastUpdateTime = useRef(0);
  const setBackendResult = useAppStore((s) => s.setBackendResult);

  const flushActiveStream = () => {
    socket?.emit('flush_stream', { stream_id: ACTIVE_STREAM_ID });
    useAppStore.getState().setBackendResult(null);
    lastUpdateTime.current = 0;
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

    socketInstance.on('pose_result', (result: BackendResult) => {
      try {
        const age = Date.now() - result.timestamp_ms;
        if (age > RESULT_TIMEOUT_MS) return;

        if (result.timestamp_ms >= lastUpdateTime.current) {
          lastUpdateTime.current = result.timestamp_ms;
          setBackendResult(result);
        }
      } catch (err) {
        console.error('[WS] Error in pose_result handler:', err);
      }
    });

    socketInstance.on('error', (error) =>
      console.error('[WS] Socket error:', error),
    );

    return () => socketService.disconnect();
  }, [setBackendResult]);

  return { socket, connected, flushActiveStream };
}
