import { useState, useEffect, useRef } from 'react';

const SESSION_DURATION = 60; // seconds

interface UseSessionTimerReturn {
  remainingSeconds: number;
  isExpired: boolean;
}

export function useSessionTimer(startTimestamp: number | null): UseSessionTimerReturn {
  const [remainingSeconds, setRemainingSeconds] = useState(SESSION_DURATION);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!startTimestamp) {
      setRemainingSeconds(SESSION_DURATION);
      return;
    }

    const tick = () => {
      const elapsed = Math.floor((Date.now() - startTimestamp) / 1000);
      const remaining = Math.max(0, SESSION_DURATION - elapsed);
      setRemainingSeconds(remaining);
      if (remaining <= 0 && intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };

    tick();
    intervalRef.current = setInterval(tick, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [startTimestamp]);

  return { remainingSeconds, isExpired: remainingSeconds <= 0 };
}
