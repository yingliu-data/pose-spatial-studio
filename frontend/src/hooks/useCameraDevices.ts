import { useState, useEffect } from 'react';

export interface CameraDevice {
  deviceId: string;
  label: string;
  groupId: string;
}

export function useCameraDevices() {
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getCameraDevices = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true });
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        setDevices(allDevices
          .filter(device => device.kind === 'videoinput')
          .map((device, index) => ({
            deviceId: device.deviceId,
            label: device.label || `Camera ${index + 1}`,
            groupId: device.groupId
          })));
      } catch (err) {
        console.error('Error accessing camera devices:', err);
      } finally {
        setLoading(false);
      }
    };

    getCameraDevices();
    navigator.mediaDevices.addEventListener('devicechange', getCameraDevices);
    return () => navigator.mediaDevices.removeEventListener('devicechange', getCameraDevices);
  }, []);

  return { devices, loading };
}
