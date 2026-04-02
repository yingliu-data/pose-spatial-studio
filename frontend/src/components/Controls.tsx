import { Socket } from 'socket.io-client';
import { useCameraDevices } from '@/hooks/useCameraDevices';
import { StreamInitService } from '@/services/streamInitService';
import { useAppStore } from '@/stores/appStore';
import { FUNCTION_DEFINITIONS } from '@/types/functions';

const ACTIVE_STREAM_ID = 'active_stream';

interface ControlsProps {
  connected: boolean;
  socket: Socket | null;
}

export function Controls({ connected, socket }: ControlsProps) {
  const activeFunction = useAppStore((s) => s.activeFunction);
  const functionDef = useAppStore((s) => s.functionDef);
  const pose3dProcessorType = useAppStore((s) => s.pose3dProcessorType);
  const sourceType = useAppStore((s) => s.sourceType);
  const deviceId = useAppStore((s) => s.deviceId);
  const videoFile = useAppStore((s) => s.videoFile);
  const isStreamActive = useAppStore((s) => s.isStreamActive);
  const isInitializing = useAppStore((s) => s.isInitializing);
  const initMessage = useAppStore((s) => s.initMessage);
  const selectFunction = useAppStore((s) => s.selectFunction);
  const setSourceConfig = useAppStore((s) => s.setSourceConfig);
  const setStreamActive = useAppStore((s) => s.setStreamActive);
  const setInitializing = useAppStore((s) => s.setInitializing);
  const setInitMessage = useAppStore((s) => s.setInitMessage);
  const setBackendResult = useAppStore((s) => s.setBackendResult);

  const { devices, loading: devicesLoading, requestPermission, resetPermission } = useCameraDevices();

  const handleFunctionSelect = (fnId: string) => {
    // If switching away from active stream, clean up
    if (isStreamActive && socket) {
      socket.emit('cleanup_processor', { stream_id: ACTIVE_STREAM_ID });
      setStreamActive(false);
      setBackendResult(null);
    }
    selectFunction(fnId as any);
  };

  const handleStart = async () => {
    if (!socket || !functionDef?.processorType) return;
    if (sourceType === 'video' && !videoFile) return;

    if (sourceType === 'camera' && !deviceId) return;

    setInitializing(true, 'Initializing...');

    setInitMessage('Initializing...');

    try {
      const processorType = activeFunction === 'pose_3d'
        ? pose3dProcessorType
        : functionDef.processorType;

      const config = {
        pose_processor: {
          processor_type: processorType,
        },
      };

      const result = await StreamInitService.initializeStream(
        socket,
        ACTIVE_STREAM_ID,
        config,
        (message: string) => setInitMessage(message),
        sourceType,
      );

      if (result.success) {
        setStreamActive(true);
      } else {
        alert(`Failed to start: ${result.message}`);
      }
    } catch {
      alert('Initialization timeout');
    } finally {
      setInitializing(false);
    }
  };

  const handleStop = () => {
    if (socket) {
      socket.emit('cleanup_processor', { stream_id: ACTIVE_STREAM_ID });
    }
    setStreamActive(false);
    setBackendResult(null);
    resetPermission();
  };

  const needsCamera = functionDef?.processorType !== null;

  return (
    <div className="controls">
      <div className="controls-header">
        <h2>Controls</h2>
      </div>

      {/* Function Menu */}
      <div className="section-label">FUNCTIONS</div>
      <div className="function-menu">
        {FUNCTION_DEFINITIONS.map((fn) => (
          <div
            key={fn.id}
            className={`function-item ${activeFunction === fn.id ? 'active' : ''}`}
            onClick={() => handleFunctionSelect(fn.id)}
          >
            <div className="function-icon">{fn.icon}</div>
            <div className="function-info">
              <div className="function-label">{fn.label}</div>
              <div className="function-desc">{fn.description}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Source Configuration */}
      {activeFunction && needsCamera && (
        <div className="source-section">
          <div className="section-label">SOURCE</div>

          <div className="form-group">
            <label>Source Type</label>
            <select
              value={sourceType}
              onChange={(e) => {
                const newSource = e.target.value as 'camera' | 'video';
                setSourceConfig(newSource, '', '', null);
                if (newSource === 'camera') requestPermission();
              }}
              disabled={isStreamActive}
            >
              <option value="camera">Camera</option>
              <option value="video">Video File</option>
            </select>
          </div>

          {sourceType === 'camera' ? (
            <div className="form-group">
              <label>Camera Device</label>
              {devicesLoading ? (
                <div style={{ padding: 8, color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                  Loading cameras...
                </div>
              ) : devices.length === 0 ? (
                <div style={{ padding: 8, color: '#ff453a', fontSize: 13 }}>
                  No cameras found
                </div>
              ) : (
                <select
                  value={deviceId}
                  onChange={(e) => {
                    const dev = devices.find((d) => d.deviceId === e.target.value);
                    setSourceConfig('camera', e.target.value, dev?.label ?? '', null);
                  }}
                  disabled={isStreamActive}
                >
                  <option value="">Select a camera</option>
                  {devices.map((d) => (
                    <option key={d.deviceId} value={d.deviceId}>
                      {d.label}
                    </option>
                  ))}
                </select>
              )}
            </div>
          ) : (
            <div className="form-group">
              <label>Video File</label>
              <input
                type="file"
                accept="video/*"
                disabled={isStreamActive}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) setSourceConfig('video', '', file.name, file);
                }}
              />
              {videoFile && (
                <small style={{ color: '#30d158' }}>
                  Selected: {videoFile.name}
                </small>
              )}
            </div>
          )}

          {/* Start / Stop */}
          <div className="source-actions">
            {!isStreamActive ? (
              <button
                className="btn btn-success btn-block"
                onClick={handleStart}
                disabled={
                  isInitializing ||
                  !connected ||
                  (sourceType === 'camera' && !deviceId) ||
                  (sourceType === 'video' && !videoFile)
                }
              >
                {isInitializing
                  ? initMessage || 'Initializing...'
                  : 'Start'}
              </button>
            ) : (
              <button
                className="btn btn-danger btn-block"
                onClick={handleStop}
              >
                Stop
              </button>
            )}
          </div>
        </div>
      )}

      {/* System Info */}
      <div className="info-section">
        <h3>System Info</h3>
        <div className="info-item">
          <span>Connection:</span>
          <span className={connected ? 'text-success' : 'text-danger'}>
            {connected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        {activeFunction && functionDef && (
          <div className="info-item">
            <span>Function:</span>
            <span>{functionDef.label}</span>
          </div>
        )}
        <div className="info-item">
          <span>Status:</span>
          <span>{isStreamActive ? 'Active' : 'Idle'}</span>
        </div>
      </div>
    </div>
  );
}
