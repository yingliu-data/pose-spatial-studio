import { useState, useEffect, useCallback } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export function useCameraDevices() {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [permissionGranted, setPermissionGranted] = useState(false);

  const enumerate = useCallback(async () => {
    try {
      const allDevices = await navigator.mediaDevices.enumerateDevices();
      setDevices(
        allDevices
          .filter((d) => d.kind === 'videoinput')
          .map((d, i) => ({
            deviceId: d.deviceId,
            label: d.label || `Camera ${i + 1}`,
            groupId: d.groupId,
          })),
      );
    } catch (err) {
      console.error('Error enumerating devices:', err);
    }
  }, []);

  const requestPermission = useCallback(async () => {
    if (permissionGranted) {
      await enumerate();
      return;
    }
    setLoading(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach((t) => t.stop());
      setPermissionGranted(true);
      await enumerate();
    } catch (err) {
      console.error('Error requesting camera permission:', err);
    } finally {
      setLoading(false);
    }
  }, [permissionGranted, enumerate]);

  useEffect(() => {
    // Try enumeration without permission (labels may be empty)
    enumerate();
    navigator.mediaDevices.addEventListener('devicechange', enumerate);
    return () =>
      navigator.mediaDevices.removeEventListener('devicechange', enumerate);
  }, [enumerate]);

  return { devices, loading, permissionGranted, requestPermission };
}
