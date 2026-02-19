import { useEffect, useState, useRef, useCallback } from 'react';
import { Socket } from 'socket.io-client';

export interface LogEntry {
  timestamp: string;
  logger: string;
  level: 'DEBUG' | 'INFO' | 'WARNING' | 'ERROR' | 'CRITICAL';
  message: string;
}

interface UseLogStreamReturn {
  logs: LogEntry[];
  clearLogs: () => void;
  isSubscribed: boolean;
  subscribe: () => void;
  unsubscribe: () => void;
}

const MAX_CLIENT_LOGS = 1000;

export function useLogStream(
  socket: Socket | null,
  connected: boolean
): UseLogStreamReturn {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const subscribedRef = useRef(false);

  const subscribe = useCallback(() => {
    if (socket && connected && !subscribedRef.current) {
      socket.emit('subscribe_logs', { level: 'INFO' });
      subscribedRef.current = true;
      setIsSubscribed(true);
    }
  }, [socket, connected]);

  const unsubscribe = useCallback(() => {
    if (socket && subscribedRef.current) {
      socket.emit('unsubscribe_logs');
      subscribedRef.current = false;
      setIsSubscribed(false);
    }
  }, [socket]);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  useEffect(() => {
    if (!socket) return;

    const handleLogBatch = (data: { logs: LogEntry[] }) => {
      setLogs(prev => {
        const combined = [...prev, ...data.logs];
        if (combined.length > MAX_CLIENT_LOGS) {
          return combined.slice(combined.length - MAX_CLIENT_LOGS);
        }
        return combined;
      });
    };

    socket.on('log_batch', handleLogBatch);

    return () => {
      socket.off('log_batch', handleLogBatch);
      if (subscribedRef.current) {
        socket.emit('unsubscribe_logs');
        subscribedRef.current = false;
      }
    };
  }, [socket]);

  return { logs, clearLogs, isSubscribed, subscribe, unsubscribe };
}
